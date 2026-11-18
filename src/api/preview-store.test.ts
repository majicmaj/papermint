import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetPreviews,
  forgetRecord,
  hasPreview,
  keepPreview,
  loadPreview,
  peekPreview,
} from './preview-store';

const file = (size = 10, type = 'application/pdf') => ({
  blob: new Blob([new Uint8Array(size)]),
  type,
});

afterEach(() => {
  forgetPreviews();
  vi.unstubAllGlobals();
});

describe('prefetched previews', () => {
  it('are fetched with no-store and held in memory', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('x', { headers: { 'content-type': 'text/plain; charset=utf-8' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const loaded = await loadPreview('/api/documents/1/preview/');
    expect(loaded.type).toBe('text/plain');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).cache).toBe('no-store');
  });

  it('refuse a failed answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(loadPreview('/api/documents/1/preview/')).rejects.toThrow();
  });

  it('keep at most six files, dropping the least recently used', () => {
    for (let i = 1; i <= 7; i += 1) keepPreview(`/api/documents/${i}/preview/`, file());
    expect(hasPreview('/api/documents/1/preview/')).toBe(false);
    expect(hasPreview('/api/documents/7/preview/')).toBe(true);
    peekPreview('/api/documents/2/preview/');
    keepPreview('/api/documents/8/preview/', file());
    expect(hasPreview('/api/documents/2/preview/')).toBe(true);
    expect(hasPreview('/api/documents/3/preview/')).toBe(false);
  });

  it('keep at most 40 MB, and nothing bigger than that', () => {
    keepPreview('/api/documents/1/preview/', file(30 * 1024 * 1024));
    keepPreview('/api/documents/2/preview/', file(30 * 1024 * 1024));
    expect(hasPreview('/api/documents/1/preview/')).toBe(false);
    expect(hasPreview('/api/documents/2/preview/')).toBe(true);
    keepPreview('/api/documents/3/preview/', file(41 * 1024 * 1024));
    expect(hasPreview('/api/documents/3/preview/')).toBe(false);
  });

  it('are forgotten per record and all at once', () => {
    keepPreview('/api/documents/5/preview/?version=5', file());
    keepPreview('/api/documents/5/preview/?version=51', file());
    keepPreview('/api/documents/6/preview/', file());
    forgetRecord(5);
    expect(hasPreview('/api/documents/5/preview/?version=5')).toBe(false);
    expect(hasPreview('/api/documents/5/preview/?version=51')).toBe(false);
    expect(hasPreview('/api/documents/6/preview/')).toBe(true);
    forgetPreviews();
    expect(hasPreview('/api/documents/6/preview/')).toBe(false);
  });
});
