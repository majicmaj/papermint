import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Doc, Tag } from '../api/types';
import { forgetPreviews, hasPreview } from '../api/preview-store';
import { prefetchPreview } from './prefetch';

const tags = [
  { id: 2, name: 'Current' },
  { id: 5, name: 'Sensitive' },
] as Tag[];
const doc = (id: number, tagIds: number[]) =>
  ({ id, title: 't', tags: tagIds, versions: [{ id, is_root: true }] }) as unknown as Doc;

afterEach(() => {
  forgetPreviews();
  vi.unstubAllGlobals();
});

describe('prefetch', () => {
  it('keeps an ordinary preview in memory, fetched with no-store', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response('x', { headers: { 'content-type': 'text/plain' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    prefetchPreview(doc(1, [2]), tags);
    await vi.waitFor(() => expect(hasPreview('/api/documents/1/preview/?version=1')).toBe(true));
    expect((fetchMock.mock.calls[0]![1] as RequestInit).cache).toBe('no-store');
  });

  it('never fetches or keeps a Sensitive record', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    prefetchPreview(doc(2, [2, 5]), tags);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hasPreview('/api/documents/2/preview/?version=2')).toBe(false);
  });
});
