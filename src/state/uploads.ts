import { isNetworkFailure, isOffline } from '../pwa/connectivity';
import { mergeAsVersions, patchDocument } from '../api/documents';
import { uploadDocument, waitForTask } from '../api/upload';
import { tagByStatus } from '../domain/tags';
import { effectiveAreas } from '../domain/taxonomy';
import { appStore, loadIndex, notify } from './app';
import { fileIntake, fileNameToTitle, type IntakeForm } from './intake';
import { navigate } from './router';
import { selection } from './topics';
import { recordPath } from './routes';

export type UploadPhase = 'sending' | 'waiting' | 'filing' | 'ready' | 'saving' | 'failed';

/** One uploaded file and the filing decisions the owner is making for it. */
export interface UploadItem extends IntakeForm {
  key: string;
  name: string;
  /** 0..1 while sending. */
  progress: number;
  phase: UploadPhase;
  /** Known once Paperless has filed the file. */
  docId: number | null;
}

export function updateUpload(key: string, patch: Partial<UploadItem>): void {
  appStore.set((s) => ({
    uploads: s.uploads.map((u) => (u.key === key ? { ...u, ...patch } : u)),
  }));
}

export function dismissUpload(key: string): void {
  waiting.delete(key);
  appStore.set((s) => ({ uploads: s.uploads.filter((u) => u.key !== key) }));
}

/**
 * Files dropped while offline, held in memory only. Nothing is sent when the network returns:
 * the owner's Confirm sends them.
 */
const waiting = new Map<string, { file: File; tagIds: number[] }>();

function hold(key: string, file: File, tagIds: number[]): void {
  waiting.set(key, { file, tagIds });
  updateUpload(key, { phase: 'waiting', progress: 0 });
}

/** Send one file and wait until Paperless has filed it. Returns the new record's id. */
async function send(file: File, key: string, tagIds: number[]): Promise<number> {
  const taskId = await uploadDocument(file, tagIds, (p) => updateUpload(key, { progress: p }));
  updateUpload(key, { progress: 1, phase: 'filing' });
  const docId = await waitForTask(taskId);
  if (docId === null) throw new Error('filing failed');
  return docId;
}

/** Returns the record id, or null when the file was held or failed (and the owner was told). */
async function sendOrHold(file: File, key: string, tagIds: number[]): Promise<number | null> {
  if (isOffline()) {
    hold(key, file, tagIds);
    return null;
  }
  try {
    return await send(file, key, tagIds);
  } catch (error) {
    if (isNetworkFailure(error) && navigator.onLine === false) {
      hold(key, file, tagIds);
      return null;
    }
    updateUpload(key, { phase: 'failed' });
    notify('Upload failed');
    return null;
  }
}

async function uploadOne(file: File, key: string, tagIds: number[]): Promise<void> {
  const docId = await sendOrHold(file, key, tagIds);
  if (docId !== null) updateUpload(key, { phase: 'ready', docId });
}

/** Upload files as Draft. Each file gets a filing form, ready to edit while it is sent. */
export async function uploadFiles(files: readonly File[]): Promise<void> {
  if (appStore.get().phase !== 'ready') await loadIndex('now');
  const { model } = appStore.get();
  const draft = tagByStatus(model, 'draft');
  // The area the owner is looking at is the default. A single area needs no choice at all.
  const chosen = effectiveAreas(model, selection.get().areas);
  const areaIds = chosen.length === 1 ? [chosen[0]!.id] : [];
  for (const file of files) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: UploadItem = {
      key,
      name: file.name,
      progress: 0,
      phase: 'sending',
      docId: null,
      title: fileNameToTitle(file.name),
      statusId: draft?.id ?? null,
      areaIds,
      topicIds: [],
      targetId: null,
    };
    appStore.set((s) => ({ uploads: [...s.uploads, item] }));
    void uploadOne(file, key, draft ? [draft.id] : []);
  }
}

/** Apply the form: file the record, or add the file as the newest version of another. */
export async function confirmUpload(key: string): Promise<void> {
  if (isOffline()) return;
  const item = appStore.get().uploads.find((u) => u.key === key);
  if (!item) return;
  if (item.phase === 'ready' && item.docId !== null) return fileRecord(key, item.docId);
  const held = waiting.get(key);
  if (item.phase !== 'waiting' || !held) return;
  // The file was held while offline. This Confirm is what sends it.
  waiting.delete(key);
  updateUpload(key, { phase: 'sending', progress: 0 });
  const docId = await sendOrHold(held.file, key, held.tagIds);
  if (docId === null) return;
  updateUpload(key, { docId });
  await fileRecord(key, docId);
}

async function fileRecord(key: string, docId: number): Promise<void> {
  const state = appStore.get();
  const item = state.uploads.find((u) => u.key === key);
  if (!item) return;
  updateUpload(key, { phase: 'saving' });
  try {
    const current = state.docs.find((d) => d.id === docId)?.tags ?? [];
    const result = await fileIntake(docId, current, item, state.model, {
      patch: patchDocument,
      merge: mergeAsVersions,
    });
    await loadIndex('now');
    dismissUpload(key);
    if (result.kind === 'merged') navigate(recordPath(result.rootId));
  } catch {
    updateUpload(key, { phase: 'ready', docId });
    notify('Save failed');
  }
}
