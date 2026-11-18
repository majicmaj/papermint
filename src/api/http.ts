import { requireOnline } from '../pwa/connectivity';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function csrfToken(): string | undefined {
  const match = /(?:^|;\s*)csrftoken=([^;]+)/.exec(document.cookie);
  return match?.[1];
}

function writeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const token = csrfToken();
  if (token) headers['X-CSRFToken'] = token;
  return headers;
}

async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) throw new ApiError(response.status, `${response.status} ${response.url}`);
  return response;
}

/**
 * Every API read asks the server and keeps no copy: `cache: 'no-store'`. Records can be private,
 * so the browser's HTTP cache must never hold an answer, and Nginx says the same with its header.
 */
export const NO_STORE = { cache: 'no-store', credentials: 'same-origin' } as const;

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await ensureOk(
    await fetch(path, { headers: { Accept: 'application/json' }, ...NO_STORE, signal }),
  );
  return (await response.json()) as T;
}

let writes = 0;

/** Writes that left the page and have no answer yet. An app update never reloads over one. */
export function writesInFlight(): number {
  return writes;
}

async function write(path: string, init: RequestInit): Promise<Response> {
  requireOnline();
  writes += 1;
  try {
    return await ensureOk(await fetch(path, { headers: writeHeaders(), ...NO_STORE, ...init }));
  } finally {
    writes -= 1;
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await write(path, { method: 'POST', body: JSON.stringify(body) });
  return (await response.json()) as T;
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await write(path, { method: 'PATCH', body: JSON.stringify(body) });
  return (await response.json()) as T;
}

export async function deleteRequest(path: string): Promise<void> {
  await write(path, { method: 'DELETE' });
}

/** Convert an absolute `next` link from the API into a same-origin path. */
export function toLocalPath(url: string): string {
  const parsed = new URL(url, window.location.origin);
  return `${parsed.pathname}${parsed.search}`;
}
