/**
 * Previews fetched ahead of a click. They live in memory only: a small, capped map of file URL to
 * bytes. Nothing here touches the HTTP cache, Cache Storage or IndexedDB, and a page that is
 * closed or hidden for good takes it all away. Sensitive records are never put here.
 */
import { NO_STORE } from './http';

export interface PreviewFile {
  blob: Blob;
  /** Content-Type without parameters. */
  type: string;
}

const MAX_FILES = 6;
const MAX_BYTES = 40 * 1024 * 1024;

const files = new Map<string, PreviewFile>();
let bytes = 0;

export function typeOf(response: Response): string {
  return (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
}

/** Fetch one preview file. Throws when the server does not answer with the file. */
export async function loadPreview(url: string, init: RequestInit = {}): Promise<PreviewFile> {
  const response = await fetch(url, { ...NO_STORE, ...init });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return { blob: await response.blob(), type: typeOf(response) };
}

function drop(url: string): void {
  const file = files.get(url);
  if (!file) return;
  bytes -= file.blob.size;
  files.delete(url);
}

export function keepPreview(url: string, file: PreviewFile): void {
  if (file.blob.size > MAX_BYTES) return;
  drop(url);
  files.set(url, file);
  bytes += file.blob.size;
  for (const oldest of files.keys()) {
    if (files.size <= MAX_FILES && bytes <= MAX_BYTES) break;
    drop(oldest);
  }
}

/** The prefetched file for this URL, if there is one. It stays until it is evicted. */
export function peekPreview(url: string): PreviewFile | undefined {
  const file = files.get(url);
  if (file) {
    files.delete(url);
    files.set(url, file);
  }
  return file;
}

export function hasPreview(url: string): boolean {
  return files.has(url);
}

/** Forget everything kept for one record, whatever the version. */
export function forgetRecord(id: number): void {
  const prefix = `/api/documents/${id}/`;
  for (const url of Array.from(files.keys())) if (url.startsWith(prefix)) drop(url);
}

export function forgetPreviews(): void {
  files.clear();
  bytes = 0;
}
