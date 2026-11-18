import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineError, setOffline } from '../pwa/connectivity';
import { deleteRequest, getJson, patchJson, postJson } from './http';
import { createTag, updateTag } from './tags';
import { removeDoc, saveTags } from './documents';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('document', { cookie: '' });
});

afterEach(() => {
  setOffline(false);
  vi.unstubAllGlobals();
});

describe('every request says no-store', () => {
  it('reads and writes', async () => {
    await getJson('/api/tags/');
    await postJson('/api/x/', {});
    await patchJson('/api/x/1/', {});
    await deleteRequest('/api/x/1/');
    const modes = fetchMock.mock.calls.map(([, init]) => (init as RequestInit).cache);
    expect(modes).toEqual(['no-store', 'no-store', 'no-store', 'no-store']);
  });
});

describe('offline, nothing is written', () => {
  const writes: [string, () => Promise<unknown>][] = [
    ['postJson', () => postJson('/api/x/', {})],
    ['patchJson', () => patchJson('/api/x/1/', {})],
    ['deleteRequest', () => deleteRequest('/api/x/1/')],
    ['createTag', () => createTag({ name: 'A', color: '#000000', parent: null })],
    ['updateTag', () => updateTag(1, { name: 'B' })],
    ['saveTags', () => saveTags(1, [1])],
    ['removeDoc', () => removeDoc(1)],
  ];

  it.each(writes)('%s refuses before a request is made', async (_name, write) => {
    setOffline(true);
    await expect(write()).rejects.toBeInstanceOf(OfflineError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads still go out', async () => {
    setOffline(true);
    await getJson('/api/tags/');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
