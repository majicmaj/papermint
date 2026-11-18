import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Helpers for the service worker specs. They talk to the mock server, never to the live archive. */
export interface Control {
  docs?: number;
  latency?: number;
  swVersion?: number;
  sensitive?: number[];
}

export async function control(request: APIRequestContext, body: Control): Promise<void> {
  await request.post('/__control', { data: body });
}

export async function reset(request: APIRequestContext): Promise<void> {
  await request.post('/__reset');
  await control(request, { docs: 40, latency: 0, swVersion: 1 });
}

export interface ServerLog {
  log: { method: string; path: string }[];
  patches: { id: number; body: Record<string, unknown> }[];
  posts: string[];
}

export async function serverLog(request: APIRequestContext): Promise<ServerLog> {
  return (await request.get('/__log')).json();
}

/** Open the app and wait until the worker controls the page and the index is drawn. */
export async function start(
  page: Page,
  path = '/',
  ready = '.list-scroll .row[data-id]',
): Promise<void> {
  await page.goto(path);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.locator(ready).first()).toBeVisible();
}

/** Every Cache Storage entry: cache name to the urls in it. */
export async function cacheKeys(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const name of await caches.keys()) {
      out[name] = (await (await caches.open(name)).keys()).map((r) => r.url);
    }
    return out;
  });
}

/** Everything stored: all cached response bodies, and all IndexedDB records, as one string. */
export async function everythingStored(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const parts: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        parts.push(
          request.url,
          await response!
            .clone()
            .text()
            .catch(() => ''),
        );
      }
    }
    for (const info of await indexedDB.databases()) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(info.name!);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      for (const name of Array.from(db.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((resolve) => {
          const all = db.transaction(name).objectStore(name).getAll();
          all.onsuccess = () => resolve(all.result);
        });
        parts.push(
          `${info.name}/${name}`,
          JSON.stringify(rows, (_k, v) => (v instanceof Blob ? `blob:${v.size}` : v)),
        );
      }
      db.close();
    }
    return parts.join('\n');
  });
}

export async function idbRows<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('majin');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction(name).objectStore(name).getAll();
          all.onsuccess = () => resolve(all.result as T[]);
        };
      }),
    store,
  );
}

/** The names of the stores in the app's database. */
export async function idbStores(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('majin');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const names = Array.from(open.result.objectStoreNames);
          open.result.close();
          resolve(names);
        };
      }),
  );
}

/** Wait until the app has written its index to disk. */
export async function indexStored(page: Page): Promise<void> {
  await expect
    .poll(async () => (await idbRows<unknown>(page, 'index')).length, { timeout: 10_000 })
    .toBe(1);
}

/** Ask the active worker which build it is. */
export async function workerBuild(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active;
    return new Promise<string>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(String(event.data));
      worker?.postMessage({ type: 'version' }, [channel.port2]);
      // A worker that is still taking over may not answer yet.
      setTimeout(() => resolve('pending'), 400);
    });
  });
}
