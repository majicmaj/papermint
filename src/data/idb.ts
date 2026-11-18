/**
 * A very small promise wrapper over IndexedDB, shared by the app and the service worker.
 * One database, a few stores. Nothing here knows what the data means.
 */
export const DB_NAME = 'majin';
export const DB_VERSION = 2;

/** The only store left. Earlier versions also kept `meta`, `outbox` and `lru`; version 2 drops them. */
export type StoreName = 'index';

const LEGACY_STORES = ['meta', 'outbox', 'lru'];

function upgrade(db: IDBDatabase): void {
  const have = new Set(Array.from(db.objectStoreNames));
  for (const name of LEGACY_STORES) if (have.has(name)) db.deleteObjectStore(name);
  if (!have.has('index')) db.createObjectStore('index');
}

let opening: Promise<IDBDatabase> | null = null;

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => (opening = null);
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

/** Forget the open connection. Tests use this between databases. */
export function resetDb(): void {
  opening = null;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return (await openDb()).transaction(name, mode).objectStore(name);
}

export async function dbGet<T>(name: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return wrap<T | undefined>((await store(name, 'readonly')).get(key));
}

export async function dbPut(name: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  await wrap((await store(name, 'readwrite')).put(value, key));
}

export async function dbDelete(name: StoreName, key: IDBValidKey): Promise<void> {
  await wrap((await store(name, 'readwrite')).delete(key));
}

export async function dbAll<T>(name: StoreName): Promise<T[]> {
  return wrap<T[]>((await store(name, 'readonly')).getAll());
}

export async function dbClear(name: StoreName): Promise<void> {
  await wrap((await store(name, 'readwrite')).clear());
}

export async function dbCount(name: StoreName): Promise<number> {
  return wrap((await store(name, 'readonly')).count());
}
