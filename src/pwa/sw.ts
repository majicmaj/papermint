/**
 * The service worker: the app opens from the cache, and that is all it does. It keeps the
 * built files of the app (the shell). Every request to the server, whatever it is, goes
 * straight to the network and is never stored. See policy.ts.
 */
import { classify, type RequestInfo } from './policy';

declare const __PRECACHE__: { url: string }[];
declare const __BUILD_ID__: string;

interface WorkerEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends WorkerEvent {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}
interface MessageEvent2 extends WorkerEvent {
  data: { type?: string } | null;
  ports: { postMessage(message: unknown): void }[];
}
interface Scope {
  addEventListener(type: string, listener: (event: never) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  location: Location;
}

const sw = self as unknown as Scope;
const PRECACHE = `precache-${__BUILD_ID__}`;
const SHELL = '/index.html';

// A new build takes over as soon as its files are stored. It never waits for old pages to close:
// an old page cannot hold an update back. Open pages keep their running build until they reload
// at a safe moment (register.ts). Only the shell is cached, so an old page loses nothing.
sw.addEventListener('install', (event: WorkerEvent) => {
  event.waitUntil(precache().then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event: WorkerEvent) => {
  event.waitUntil(activate());
});

// A page can still ask a waiting worker to take over (pages of earlier builds ask on pagehide).
sw.addEventListener('message', (event: MessageEvent2) => {
  const type = event.data?.type;
  if (type === 'activate') void sw.skipWaiting();
  if (type === 'version') event.ports[0]?.postMessage(PRECACHE);
});

sw.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const info: RequestInfo = {
    url: new URL(request.url),
    method: request.method,
    mode: request.mode,
    origin: sw.location.origin,
  };
  if (classify(info) === 'shell') event.respondWith(shell(request, info));
});

async function precache(): Promise<void> {
  const cache = await caches.open(PRECACHE);
  await Promise.all(
    __PRECACHE__.map((entry) => cache.add(new Request(entry.url, { cache: 'reload' }))),
  );
}

async function activate(): Promise<void> {
  const names = await caches.keys();
  // Replace earlier app shells. Leave unrelated caches alone.
  const stale = names.filter((name) => name.startsWith('precache-') && name !== PRECACHE);
  const first = !names.some((name) => name.startsWith('precache-') && name !== PRECACHE);
  await Promise.all(stale.map((name) => caches.delete(name)));
  // The very first install has no earlier worker: take over the open page, so it works offline at once.
  if (first) await sw.clients.claim();
}

async function shell(request: Request, info: RequestInfo): Promise<Response> {
  const cache = await caches.open(PRECACHE);
  const key = request.mode === 'navigate' ? SHELL : info.url.pathname;
  return (await cache.match(key)) ?? fetch(request);
}
