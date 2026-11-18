import { readStoredIndex, writeStoredIndex, type StoredIndex } from '../data/index-store';

export type CachedIndex = StoredIndex;

/** The index the last visit ended with, read from IndexedDB. Null on a first run. */
export function readCache(): Promise<CachedIndex | null> {
  return readStoredIndex();
}

let latest: CachedIndex | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  const index = latest;
  timer = null;
  if (index) await writeStoredIndex(index);
}

/** Keep the stored index in step with the screen. Writes are batched: only the latest is kept. */
export function writeCache(index: CachedIndex): void {
  latest = index;
  timer ??= setTimeout(() => void flush(), 250);
}

/** Write now. Used when the page is about to go away. */
export function flushCache(): Promise<void> {
  if (timer) clearTimeout(timer);
  return flush();
}
