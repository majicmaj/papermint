import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc, Tag } from '../api/types';
import { buildTagModel } from '../domain/tags';
import { sameIndex } from './index-sync';
import { appStore, applyHeld, loadIndex } from './app';

const tag = (id: number, name: string): Tag => ({ id, name, slug: name.toLowerCase(), color: 'x' });
const doc = (id: number, title: string, tags: number[] = [9]): Doc => ({
  id,
  title,
  tags,
  created: '2026-01-01',
  added: '2026-01-01T00:00:00Z',
  pageCount: null,
  mime: 'text/plain',
  versions: [],
});
const TAGS = [tag(9, 'Draft'), tag(13, 'Final')];

/** Serve the given index from the (stubbed) API. */
function serve(docs: Doc[]) {
  vi.stubGlobal('window', { location: { origin: 'http://x' } });
  vi.stubGlobal('fetch', async (url: string) => {
    const raw = url.includes('/api/tags/')
      ? TAGS
      : docs.map((d) => ({
          id: d.id,
          title: d.title,
          tags: d.tags,
          created: d.created,
          added: d.added,
          page_count: null,
          mime_type: d.mime,
          versions: [],
        }));
    return new Response(JSON.stringify({ count: raw.length, next: null, results: raw }), {
      status: 200,
    });
  });
}

function show(docs: Doc[]) {
  appStore.set({
    phase: 'ready',
    docs,
    tags: TAGS,
    model: buildTagModel(TAGS, docs),
    held: null,
  });
}

describe('background index refresh', () => {
  beforeEach(() => show([doc(1, 'A'), doc(2, 'B')]));
  afterEach(() => vi.unstubAllGlobals());

  it('holds a changed index instead of changing visible rows', async () => {
    serve([doc(3, 'New'), doc(1, 'A')]);
    await loadIndex('background');
    const state = appStore.get();
    expect(state.docs.map((d) => d.id)).toEqual([1, 2]);
    expect(state.held?.docs.map((d) => d.id)).toEqual([3, 1]);
  });

  it('draws the held index only when applied', async () => {
    serve([doc(3, 'New'), doc(1, 'A')]);
    await loadIndex('background');
    applyHeld();
    expect(appStore.get().docs.map((d) => d.id)).toEqual([3, 1]);
    expect(appStore.get().held).toBeNull();
  });

  it('holds nothing when the index did not change', async () => {
    serve([doc(2, 'B'), doc(1, 'A')]);
    await loadIndex('background');
    expect(appStore.get().held).toBeNull();
  });

  it('applies at once when the owner asked for it', async () => {
    serve([doc(3, 'New')]);
    await loadIndex('now');
    expect(appStore.get().docs.map((d) => d.id)).toEqual([3]);
  });

  it('applies at once when nothing is on screen yet', async () => {
    appStore.set({ phase: 'loading', docs: [], held: null });
    serve([doc(3, 'New')]);
    await loadIndex('background');
    expect(appStore.get().docs.map((d) => d.id)).toEqual([3]);
    expect(appStore.get().phase).toBe('ready');
  });
});

describe('sameIndex', () => {
  it('ignores order and notices any change', () => {
    const a = { docs: [doc(1, 'A'), doc(2, 'B')], tags: TAGS };
    expect(sameIndex(a, { docs: [doc(2, 'B'), doc(1, 'A')], tags: TAGS })).toBe(true);
    expect(sameIndex(a, { docs: [doc(1, 'A'), doc(2, 'B', [13])], tags: TAGS })).toBe(false);
    expect(sameIndex(a, { docs: [doc(1, 'A')], tags: TAGS })).toBe(false);
  });
});
