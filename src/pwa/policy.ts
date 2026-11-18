/**
 * What the service worker answers. It keeps the app shell and nothing else: every request
 * to the server goes straight to the network and is never stored, so no record, no list,
 * no preview and no setting can end up in Cache Storage.
 */
export type Strategy =
  | 'network' // not ours: the browser handles it, nothing is stored
  | 'shell'; // the app itself, from the precache

export interface RequestInfo {
  url: URL;
  method: string;
  mode: string;
  origin: string;
}

/** Paths Nginx serves as files, or that never belong to the app. The worker leaves them alone. */
const NEVER = /^\/(recovery|recovery-files|backups|media|static|theme|accounts|admin)\//;

const STATIC = /^\/(assets\/|icons\/|favicon\.png$|manifest\.webmanifest$|robots\.txt$)/;

export function classify(request: RequestInfo): Strategy {
  const { url } = request;
  if (request.method !== 'GET') return 'network';
  if (url.origin !== request.origin) return 'network';
  if (NEVER.test(url.pathname) || url.pathname === '/config.json') return 'network';
  if (url.pathname.startsWith('/api/')) return 'network';
  if (request.mode === 'navigate') return 'shell';
  return STATIC.test(url.pathname) ? 'shell' : 'network';
}
