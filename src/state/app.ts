import { fetchDoc, fetchDocs, fetchTags, removeDoc, saveTags } from '../api/documents';
import type { Doc, Tag } from '../api/types';
import type { TagIcons } from '../api/ui-settings';
import { fetchTagIcons } from '../api/ui-settings';
import { buildTagModel, statusKeyOf, withStatus, type TagModel } from '../domain/tags';
import { withArea, withTopic } from '../domain/taxonomy';
import { nextLinks, linkedIds } from '../domain/record-details';
import { writeCache, type CachedIndex } from './cache';
import { sameIndex, type Index } from './index-sync';
import { createRecordQueue } from './record-queue';
import { fetchDetails, fetchHierarchy, saveRecord } from './details';
import type { CustomValue, DetailedDoc } from '../domain/record-details';
import { createStore, useStore } from './store';
import type { UploadItem } from './uploads';

export type Phase = 'loading' | 'ready' | 'error';

export interface AppState {
  phase: Phase;
  docs: Doc[];
  tags: Tag[];
  model: TagModel;
  uploads: UploadItem[];
  notice: string | null;
  /** True when the first paint came from the local cache. */
  cached: boolean;
  /**
   * A newer index that arrived in the background. It is never drawn on its own: visible rows
   * never appear, vanish or reorder by themselves. It applies on the next intentional list change.
   */
  held: Index | null;
  successorField: number | null;
  /** Tag id (as text) to the Lucide icon name the owner chose for it. */
  icons: TagIcons;
}

export const appStore = createStore<AppState>({
  phase: 'loading',
  docs: [],
  tags: [],
  model: buildTagModel([], []),
  uploads: [],
  notice: null,
  cached: false,
  held: null,
  successorField: null,
  icons: {},
});

/**
 * Start from the index the last visit ended with, so the first paint already has its rows.
 * Does nothing once the network has answered first.
 */
export function hydrate(cache: CachedIndex | null): void {
  if (!cache || appStore.get().phase === 'ready') return;
  appStore.set({
    phase: 'ready',
    docs: cache.docs,
    tags: cache.tags,
    model: buildTagModel(cache.tags, cache.docs),
    cached: true,
    icons: cache.icons ?? {},
    successorField: cache.successorField ?? null,
  });
}

export function useApp<T>(select: (state: AppState) => T): T {
  return useStore(appStore, select);
}

/** Keep the cache in step with the store, so the next first paint has the same rows. */
export function persist(): void {
  const { docs, tags, icons } = appStore.get();
  writeCache({ docs, tags, icons, successorField: appStore.get().successorField });
}

function applyIndex(fetched: Doc[], tags: Tag[]): void {
  // A record with a write in flight keeps its optimistic tags until the server confirms them.
  const local = new Map(appStore.get().docs.map((d) => [d.id, d]));
  const docs = fetched.map((d) => {
    const mine = local.get(d.id);
    if (mine && mutator.isPending(d.id))
      return { ...d, tags: mine.tags, customFields: (mine as DetailedDoc).customFields };
    const detail = d as DetailedDoc;
    const old = mine as DetailedDoc | undefined;
    return old && old.modified === detail.modified ? { ...detail, size: old.size } : d;
  });
  appStore.set({ docs, tags, model: buildTagModel(tags, docs), phase: 'ready' });
  persist();
}

/**
 * Fetch the index. A background fetch over rows that are already on screen is held, not drawn:
 * it applies at the next user-initiated list change. A fetch the owner asked for (`now`),
 * or the first fetch when nothing is on screen yet, applies at once.
 */
export async function loadIndex(mode: 'background' | 'now' = 'background'): Promise<void> {
  try {
    const [rawDocs, tags, icons] = await Promise.all([
      fetchDocs(),
      fetchHierarchy().catch(() => fetchTags()),
      fetchTagIcons().catch(() => appStore.get().icons),
    ]);
    const details = await fetchDetails(rawDocs).catch(() => ({ docs: rawDocs, fieldId: null }));
    const docs = details.docs;
    appStore.set({ successorField: details.fieldId, icons });
    const state = appStore.get();
    if (mode === 'now' || state.phase !== 'ready') {
      applyIndex(docs, tags);
      appStore.set({ held: null });
      return;
    }
    writeCache({ docs, tags, icons, successorField: appStore.get().successorField });
    appStore.set({ held: sameIndex(state, { docs, tags }) ? null : { docs, tags } });
  } catch {
    if (appStore.get().phase !== 'ready') appStore.set({ phase: 'error' });
  }
}

/** Draw the held index. Call it only as the result of a user action that changes the list. */
export function applyHeld(): void {
  const { held } = appStore.get();
  if (!held) return;
  applyIndex(held.docs, held.tags);
  appStore.set({ held: null });
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export function notify(message: string): void {
  if (noticeTimer) clearTimeout(noticeTimer);
  appStore.set({ notice: message });
  noticeTimer = setTimeout(() => appStore.set({ notice: null }), 2600);
}

interface RecordValue {
  tags: number[];
  customFields: CustomValue[] | undefined;
}
function valueOf(doc: DetailedDoc): RecordValue {
  return { tags: doc.tags, customFields: doc.customFields };
}
function patchDoc(id: number, value: RecordValue): void {
  const patch = (docs: Doc[]) => docs.map((d) => (d.id === id ? { ...d, ...value } : d));
  appStore.set((s) => ({
    docs: patch(s.docs),
    held: s.held ? { ...s.held, docs: patch(s.held.docs) } : null,
  }));
}
/** Records whose document links changed and still wait to be written. */
const dirtyLinks = new Set<number>();
const mutator = createRecordQueue<RecordValue>({
  get: (id) => {
    const doc = appStore.get().docs.find((d) => d.id === id);
    return doc ? valueOf(doc) : null;
  },
  set: patchDoc,
  save: (id, value) => {
    if (!dirtyLinks.delete(id)) return saveTags(id, value.tags);
    return saveRecord(id, value.tags, value.customFields ?? []);
  },
  load: async (id) => {
    const doc = await fetchDoc(id);
    const detail = await fetchDetails([doc]);
    return valueOf(detail.docs[0]!);
  },
  onFailure: () => notify('Save failed'),
});
function changeRecord(doc: Doc, compute: (value: RecordValue) => RecordValue): Promise<void> {
  return mutator.change(doc.id, compute).then(persist);
}
function isSuperseded(id: number): boolean {
  const { docs, model } = appStore.get();
  const doc = docs.find((d) => d.id === id);
  return !!doc && statusKeyOf(doc.tags, model) === 'superseded';
}

/** Paperless mirrors a link into the linked record. Show the same in the cached index. */
function mirrorLink(docId: number, before: number[], after: number[], field: number): void {
  const changed = new Set(
    [...before, ...after].filter((id) => before.includes(id) !== after.includes(id)),
  );
  if (changed.size === 0) return;
  const patch = (docs: Doc[]) =>
    docs.map((doc) => {
      if (!changed.has(doc.id)) return doc;
      const links = linkedIds(doc as DetailedDoc, field);
      const next = after.includes(doc.id) ? [...links, docId] : links.filter((id) => id !== docId);
      const others = ((doc as DetailedDoc).customFields ?? []).filter(
        (item) => item.field !== field,
      );
      return { ...doc, customFields: [...others, { field, value: next }] };
    });
  appStore.set((s) => ({
    docs: patch(s.docs),
    held: s.held ? { ...s.held, docs: patch(s.held.docs) } : null,
  }));
}

function withLinks(value: RecordValue, field: number, links: number[]): CustomValue[] {
  return [
    ...(value.customFields ?? []).filter((item) => item.field !== field),
    { field, value: links },
  ];
}

/**
 * Set the status. A Superseded record also gets its successor, written to its own field
 * only. A record that leaves Superseded loses the link to its successor. The custom field
 * is sent only when its links changed.
 */
export function setStatus(doc: Doc, statusId: number, successor?: number): Promise<void> {
  const { model, successorField: field } = appStore.get();
  const toSuperseded = model.statusKey.get(statusId) === 'superseded';
  if (toSuperseded && successor !== undefined && field === null) {
    notify('Superseded by field unavailable');
    return Promise.resolve();
  }
  return changeRecord(doc, (value) => {
    const tags = withStatus(value.tags, model, statusId);
    if (field === null) return { ...value, tags };
    const before = linkedIds({ ...doc, customFields: value.customFields }, field);
    const after = nextLinks(
      { ...doc, customFields: value.customFields },
      field,
      isSuperseded,
      toSuperseded ? (successor ?? null) : null,
    );
    if (before.length === after.length && before.every((id) => after.includes(id))) {
      return { ...value, tags };
    }
    dirtyLinks.add(doc.id);
    mirrorLink(doc.id, before, after, field);
    return { tags, customFields: withLinks(value, field, after) };
  });
}

export function toggleTopic(doc: Doc, topicId: number): Promise<void> {
  const { model } = appStore.get();
  return changeRecord(doc, (value) => ({ ...value, tags: withTopic(value.tags, model, topicId) }));
}

export function toggleArea(doc: Doc, areaId: number): Promise<void> {
  const { model } = appStore.get();
  return changeRecord(doc, (value) => ({ ...value, tags: withArea(value.tags, model, areaId) }));
}

export async function deleteRecord(id: number): Promise<boolean> {
  const before = appStore.get().docs;
  const without = (docs: Doc[]) => docs.filter((d) => d.id !== id);
  appStore.set((s) => ({
    docs: without(s.docs),
    held: s.held ? { ...s.held, docs: without(s.held.docs) } : null,
  }));
  try {
    await removeDoc(id);
    persist();
    return true;
  } catch {
    appStore.set({ docs: before });
    notify('Delete failed');
    return false;
  }
}
