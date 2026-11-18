import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeAsVersions } from './documents';

describe('mergeAsVersions (mocked API)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the Paperless 3.4.2 merge_as_versions payload', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('document', { cookie: 'csrftoken=abc' });
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
    });
    await mergeAsVersions(13, 101, 'Signed copy');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('/api/documents/merge_as_versions/');
    expect(calls[0]!.init.method).toBe('POST');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-CSRFToken']).toBe('abc');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      documents: [13, 101],
      root_document_id: 13,
      version_label: 'Signed copy',
    });
  });

  it('cuts the label to 64 characters and omits an empty one', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return new Response('{}', { status: 200 });
    });
    await mergeAsVersions(1, 2, 'x'.repeat(100));
    await mergeAsVersions(1, 2);
    expect((bodies[0] as { version_label: string }).version_label).toHaveLength(64);
    expect(bodies[1]).toEqual({ documents: [1, 2], root_document_id: 1 });
  });

  it('rejects when the API refuses the merge', async () => {
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async () => new Response('no', { status: 400 }));
    await expect(mergeAsVersions(1, 2)).rejects.toThrow();
  });
});
