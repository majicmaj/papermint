import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, dbDelete, dbGet, dbPut, openDb, resetDb } from './idb';
import {
  migrateLegacyStorage,
  purgeLegacyCaches,
  readStoredIndex,
  writeStoredIndex,
} from './index-store';

beforeEach(() => {
  resetDb();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

/** A database as version 1 of the app made it, with every store it had. */
function makeLegacyDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      db.createObjectStore('index');
      db.createObjectStore('meta');
      db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('lru', { keyPath: 'url' });
    };
    open.onsuccess = () => {
      const tx = open.result.transaction(['index', 'meta', 'outbox', 'lru'], 'readwrite');
      tx.objectStore('index').put({ docs: [], tags: [] }, 'index');
      tx.objectStore('meta').put([1], 'sensitive');
      tx.objectStore('outbox').put({ kind: 'patch', docId: 1, body: { tags: [1] } });
      tx.objectStore('lru').put({ url: '/api/documents/1/preview/', size: 1, usedAt: 1 });
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
    };
    open.onerror = () => reject(open.error);
  });
}

describe('database', () => {
  it('has one store, the index', async () => {
    const db = await openDb();
    expect(Array.from(db.objectStoreNames)).toEqual(['index']);
  });

  it('drops the stores an earlier version made, and keeps the index', async () => {
    await makeLegacyDb();
    const db = await openDb();
    expect(Array.from(db.objectStoreNames)).toEqual(['index']);
    expect(await dbGet('index', 'index')).toEqual({ docs: [], tags: [] });
  });

  it('stores, reads and deletes', async () => {
    await dbPut('index', { a: 1 }, 'k');
    expect(await dbGet('index', 'k')).toEqual({ a: 1 });
    await dbDelete('index', 'k');
    expect(await dbGet('index', 'k')).toBeUndefined();
  });
});

describe('stored index', () => {
  it('round-trips the index', async () => {
    const index = { docs: [], tags: [], icons: { '1': 'landmark' }, successorField: 3 };
    await writeStoredIndex(index);
    expect(await readStoredIndex()).toEqual(index);
  });

  it('is empty before anything was written', async () => {
    expect(await readStoredIndex()).toBeNull();
  });

  it('deletes the response caches earlier versions made, and no other cache', async () => {
    const names = new Set(['api-v1', 'files-v1', 'precache-abc']);
    (globalThis as { caches?: unknown }).caches = {
      keys: async () => [...names],
      delete: async (name: string) => names.delete(name),
    };
    await purgeLegacyCaches();
    expect([...names]).toEqual(['precache-abc']);
    delete (globalThis as { caches?: unknown }).caches;
  });
});

const SECRET_CONTENT = 'SENSITIVE-CONTENT-SENTINEL';
const SECRET_NOTE = 'SENSITIVE-NOTE-SENTINEL';

const wide = {
  docs: [
    {
      id: 106,
      title: 'Apartment lease',
      tags: [5],
      versions: [{ id: 106, added: '2026-06-10T10:00:00Z', version_label: null, is_root: true }],
      content: SECRET_CONTENT,
      notes: [{ id: 1, note: SECRET_NOTE }],
    },
  ],
  tags: [],
};

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('start with old copies on disk and no network', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cuts the wide IndexedDB index and removes the localStorage copy, without any request', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const local = memoryStorage({ 'majin.index.v1': JSON.stringify(wide), 'majin.rows': '12' });
    const session = memoryStorage({ 'majin.index.v1': JSON.stringify(wide) });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', { localStorage: local, sessionStorage: session });
    await dbPut('index', wide, 'index');
    await migrateLegacyStorage();
    const stored = JSON.stringify(await dbGet('index', 'index'));
    expect(stored).toContain('Apartment lease');
    expect(stored).not.toContain(SECRET_CONTENT);
    expect(stored).not.toContain(SECRET_NOTE);
    expect(local.data.has('majin.index.v1')).toBe(false);
    expect(session.data.has('majin.index.v1')).toBe(false);
    expect(local.data.get('majin.rows')).toBe('12');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('moves a localStorage-only index into IndexedDB through the allowlist', async () => {
    const local = memoryStorage({ 'majin.index.v1': JSON.stringify(wide) });
    vi.stubGlobal('window', { localStorage: local, sessionStorage: memoryStorage() });
    await migrateLegacyStorage();
    const stored = JSON.stringify(await readStoredIndex());
    expect(stored).toContain('Apartment lease');
    expect(stored).not.toContain(SECRET_CONTENT);
    expect(local.data.size).toBe(0);
  });

  it('removes the localStorage copy even when it is broken', async () => {
    const local = memoryStorage({ 'majin.index.v1': '{not json' });
    vi.stubGlobal('window', { localStorage: local, sessionStorage: memoryStorage() });
    await migrateLegacyStorage();
    expect(local.data.size).toBe(0);
    expect(await readStoredIndex()).toBeNull();
  });

  it('deletes an IndexedDB index that cannot be read as an index', async () => {
    vi.stubGlobal('window', { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
    await dbPut('index', { docs: 'broken', content: SECRET_CONTENT }, 'index');
    await migrateLegacyStorage();
    expect(await dbGet('index', 'index')).toBeUndefined();
  });
});
