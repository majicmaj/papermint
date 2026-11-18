import { dbDelete, dbGet, dbPut } from './idb';
import { projectIndex, type StoredIndex } from './project';

export type { StoredIndex };

const KEY = 'index';
/** Where earlier versions kept a copy of the index (with record text) outside IndexedDB. */
const LEGACY_KEYS = ['majin.index.v1'];

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Remove the legacy keys from both web storages. Needs no network and cannot fail the start. */
function removeLegacyKeys(): string | null {
  let raw: string | null = null;
  for (const area of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[area];
      for (const key of LEGACY_KEYS) {
        raw ??= storage.getItem(key);
        storage.removeItem(key);
      }
    } catch {
      // Storage can be blocked. There is nothing to remove then.
    }
  }
  return raw;
}

/**
 * Run once at every start, before the index is read, and without the network: whatever an
 * earlier version left on disk is cut down to the allowlisted projection (or deleted when it
 * cannot be read), and the old localStorage copy is removed in every case.
 */
export async function migrateLegacyStorage(): Promise<void> {
  const legacy = removeLegacyKeys();
  try {
    const raw = await dbGet<unknown>('index', KEY);
    const safe = projectIndex(raw);
    if (raw !== undefined && !safe) await dbDelete('index', KEY);
    else if (safe && !sameJson(raw, safe)) await dbPut('index', safe, KEY);
    if (!safe && legacy) {
      const moved = projectIndex(JSON.parse(legacy) as unknown);
      if (moved) await dbPut('index', moved, KEY);
    }
  } catch {
    // IndexedDB can be missing or blocked, and the old copy can be broken. Nothing is kept.
  }
}

/** Read the stored index. It is passed through the allowlist again, so a wider copy is cut down. */
export async function readStoredIndex(): Promise<StoredIndex | null> {
  try {
    return projectIndex(await dbGet<unknown>('index', KEY));
  } catch {
    // IndexedDB can be missing or blocked. The app starts from the network instead.
    return null;
  }
}

export async function writeStoredIndex(index: StoredIndex): Promise<void> {
  try {
    // Whatever the caller passes, only the allowlisted projection is written.
    const safe = projectIndex(index);
    if (safe) await dbPut('index', safe, KEY);
  } catch {
    // Storage can be full or blocked. The app works without it.
  }
}

export async function clearStoredIndex(): Promise<void> {
  await dbDelete('index', KEY).catch(() => undefined);
}

/** Delete what earlier versions kept on disk: the response caches the service worker made. */
export async function purgeLegacyCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  for (const name of await caches.keys().catch(() => [] as string[])) {
    if (name === 'api-v1' || name === 'files-v1') await caches.delete(name).catch(() => false);
  }
}
