import { expect, test } from '@playwright/test';
import {
  cacheKeys,
  control,
  everythingStored,
  idbStores,
  indexStored,
  reset,
  serverLog,
  start,
  workerBuild,
} from './pwa';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

const SENTINELS = [
  'SENSITIVE-CONTENT-SENTINEL',
  'SENSITIVE-NOTE-SENTINEL',
  'SENSITIVE-CUSTOM-FIELD-SENTINEL',
  'SENSITIVE-MOCK-BYTES',
  'FAKE-CODE-0000-1111-2222',
];

test.describe('install and offline start', () => {
  test('installs, takes control on the first visit, and precaches the app shell', async ({
    page,
  }) => {
    await start(page);
    const keys = await cacheKeys(page);
    const precache = Object.entries(keys).find(([name]) => name.startsWith('precache-'));
    expect(precache).toBeDefined();
    const urls = precache![1].map((u) => new URL(u).pathname);
    expect(urls).toContain('/index.html');
    expect(urls.some((u) => /^\/assets\/index-.*\.js$/.test(u))).toBe(true);
    expect(urls.some((u) => /^\/assets\/.*\.css$/.test(u))).toBe(true);
    expect(urls).toContain('/manifest.webmanifest');
    expect(urls).not.toContain('/sw.js');
  });

  test('starts offline from the cached shell and the stored index', async ({ page, context }) => {
    await start(page);
    await indexStored(page);
    const rows = await page.locator('.list-scroll .row[data-id]').count();
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.list-scroll .row[data-id]')).toHaveCount(rows);
    await expect(page.locator('.sync-dot')).toHaveAttribute('data-state', 'offline');
    await page.goto('/r/102');
    await expect(page.locator('.pane-title h1')).toHaveText('EIN letter');
  });
});

test.describe('the worker keeps the app and nothing else', () => {
  test('Cache Storage holds the app shell only: no API response, no preview', async ({ page }) => {
    await start(page);
    await indexStored(page);
    await page.reload();
    await expect(page.locator('.list-scroll .row[data-id]').first()).toBeVisible();
    await page.locator('.row[data-id="102"]').click();
    await expect(page.locator('.pane-body pre')).toContainText('mock preview of 102');
    await page.evaluate(() => fetch('/api/documents/104/thumb/').then((r) => r.status));
    const keys = await cacheKeys(page);
    expect(Object.keys(keys).every((name) => name.startsWith('precache-'))).toBe(true);
    expect(
      Object.values(keys)
        .flat()
        .filter((u) => u.includes('/api/')),
    ).toEqual([]);
  });

  test('every API request goes to the network, each time', async ({ page, request }) => {
    await start(page);
    await indexStored(page);
    const count = async () =>
      (await serverLog(request)).log.filter((e) => e.path.startsWith('/api/documents/?')).length;
    const before = await count();
    await page.reload();
    await expect(page.locator('.list-scroll .row[data-id]').first()).toBeVisible();
    await expect.poll(count).toBeGreaterThan(before);
  });

  test('a list read that asks for text fields stores nothing', async ({ page }) => {
    await start(page);
    await indexStored(page);
    const body = await page.evaluate(async () =>
      (
        await fetch('/api/documents/?page_size=200&fields=id,title,content,notes,custom_fields')
      ).text(),
    );
    // The server did send the secret text. It is not kept anywhere.
    expect(body).toContain('SENSITIVE-CONTENT-SENTINEL');
    const stored = await everythingStored(page);
    for (const secret of SENTINELS) expect(stored, secret).not.toContain(secret);
  });
});

test.describe('secrets never reach the disk', () => {
  test('a Sensitive record never reaches IndexedDB or Cache Storage, by any path', async ({
    page,
  }) => {
    await start(page);
    await indexStored(page);
    await page.evaluate(async () => {
      const paths = [
        '/api/documents/106/',
        '/api/documents/106/preview/',
        '/api/documents/106/preview/?version=106',
        '/api/documents/106/thumb/',
        '/api/documents/106/download/?original=true',
        '/api/documents/?query=SENSITIVE-CONTENT-SENTINEL',
        '/api/documents/?page_size=200&fields=id,content,notes,custom_fields',
      ];
      for (const path of paths) await fetch(path, { cache: 'no-cache' });
    });
    // The app itself: open the record, search, change view, reload.
    await page.locator('.row[data-id="106"]').click();
    await expect(page.locator('.pane-title h1')).toHaveText('Apartment lease');
    await page.keyboard.press('/');
    await page.locator('.palette input').fill('lease');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('.list-scroll .row[data-id]').first()).toBeVisible();
    await indexStored(page);
    await page.waitForTimeout(500);
    const stored = await everythingStored(page);
    expect(stored).toContain('Apartment lease');
    for (const secret of SENTINELS) expect(stored, secret).not.toContain(secret);
    expect(await idbStores(page)).toEqual(['index']);
  });

  test('recovery files, backups and their blobs never reach any cache or database', async ({
    page,
  }) => {
    await start(page, '/recovery', '.row[data-file]');
    await page.locator('.row[data-file="code"]').click();
    await expect(page.locator('.pane-body pre')).toContainText('FAKE-CODE-0000-1111-2222');
    await page.locator('.row[data-file="packet"]').click();
    await expect(page.locator('.pane-body iframe')).toBeVisible();
    await page.locator('.row[data-file="originals"]').click();
    await expect(page.locator('.file-card')).toBeVisible();
    await indexStored(page);
    const keys = Object.values(await cacheKeys(page)).flat();
    expect(keys.filter((u) => /\/(recovery|recovery-files|backups)\//.test(u))).toEqual([]);
    const stored = await everythingStored(page);
    for (const secret of SENTINELS) expect(stored, secret).not.toContain(secret);
  });
});

test.describe('earlier versions leave nothing behind', () => {
  test('old response caches, stores and wide copies are deleted on the first start', async ({
    page,
  }) => {
    // A page of this origin that does not start the app, to plant what version 1 left.
    await page.goto('/favicon.png');
    await page.evaluate(async () => {
      for (const name of ['api-v1', 'files-v1']) {
        const cache = await caches.open(name);
        await cache.put('/api/documents/106/preview/', new Response('SENSITIVE-MOCK-BYTES'));
      }
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('majin', 1);
        open.onupgradeneeded = () => {
          const db = open.result;
          db.createObjectStore('index');
          db.createObjectStore('meta');
          db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
          db.createObjectStore('lru', { keyPath: 'url' });
        };
        open.onsuccess = () => {
          const tx = open.result.transaction(['index', 'outbox', 'lru'], 'readwrite');
          const doc = {
            id: 106,
            title: 'Apartment lease',
            tags: [],
            versions: [],
            content: 'SENSITIVE-CONTENT-SENTINEL',
          };
          tx.objectStore('index').put({ docs: [doc], tags: [] }, 'index');
          tx.objectStore('outbox').put({
            kind: 'patch',
            docId: 106,
            body: { title: 'SENSITIVE-NOTE-SENTINEL' },
          });
          tx.objectStore('lru').put({ url: '/api/documents/106/preview/', size: 1, usedAt: 1 });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
        open.onerror = () => reject(open.error);
      });
    });
    // The planted index has one record and no rows in this view, so wait for the sidebar instead.
    await start(page, '/', '.nav-item');
    await expect
      .poll(async () => Object.keys(await cacheKeys(page)).every((n) => n.startsWith('precache-')))
      .toBe(true);
    await expect.poll(() => idbStores(page)).toEqual(['index']);
    await indexStored(page);
    await page.waitForTimeout(500);
    const stored = await everythingStored(page);
    for (const secret of SENTINELS) expect(stored, secret).not.toContain(secret);
  });
});

test.describe('old copies on disk, no network', () => {
  test('a wide index in IndexedDB and in web storage is cut down at the start, offline', async ({
    page,
    context,
  }) => {
    await start(page);
    await indexStored(page);
    await page.evaluate(async () => {
      const wide = {
        docs: [
          {
            id: 102,
            title: 'EIN letter',
            tags: [2],
            versions: [
              { id: 102, added: '2026-02-10T10:00:00Z', version_label: null, is_root: true },
            ],
            content: 'SENSITIVE-CONTENT-SENTINEL',
            notes: [{ id: 1, note: 'SENSITIVE-NOTE-SENTINEL' }],
          },
        ],
        tags: [],
      };
      localStorage.setItem('majin.index.v1', JSON.stringify(wide));
      sessionStorage.setItem('majin.index.v1', JSON.stringify(wide));
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('majin');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('index', 'readwrite');
          tx.objectStore('index').put(wide, 'index');
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      });
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.nav-item').first()).toBeVisible();
    await expect(page.locator('.sync-dot')).toHaveAttribute('data-state', 'offline');
    await page.waitForTimeout(500);
    const stored = await everythingStored(page);
    expect(stored).toContain('EIN letter');
    for (const secret of SENTINELS) expect(stored, secret).not.toContain(secret);
    const web = await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    );
    expect(web).not.toContain('SENSITIVE');
    expect(web).not.toContain('majin.index.v1');
  });
});

type Page = Parameters<typeof start>[0];

function countNavigations(page: Page): () => number {
  let navigations = 0;
  page.on('framenavigated', (frame) => frame === page.mainFrame() && (navigations += 1));
  return () => navigations;
}

/** Deploy build 2 on the server and let the page find it. */
async function deploy(page: Page, request: Parameters<typeof control>[0]): Promise<void> {
  await control(request, { swVersion: 2 });
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update();
  });
}

async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** The new worker took over without waiting, and the page has no waiting worker left. */
async function tookOver(page: Page): Promise<void> {
  await expect.poll(() => workerBuild(page), { timeout: 15_000 }).toBe('precache-v2');
  expect(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())!.waiting),
  ).toBe(false);
}

test.describe('updates', () => {
  test('at launch, before the first click, the app moves to the new build by itself', async ({
    page,
    request,
  }) => {
    const navigations = countNavigations(page);
    await start(page);
    expect(await workerBuild(page)).toMatch(/^precache-[0-9a-f]{12}$/);
    await deploy(page, request);
    await expect.poll(navigations, { timeout: 15_000 }).toBe(2);
    await expect(page.locator('.list-scroll .row[data-id]').first()).toBeVisible();
    await expect.poll(() => workerBuild(page), { timeout: 15_000 }).toBe('precache-v2');
    const names = Object.keys(await cacheKeys(page)).filter((n) => n.startsWith('precache-'));
    expect(names).toEqual(['precache-v2']);
    // One reload, no loop.
    await page.waitForTimeout(1500);
    expect(navigations()).toBe(2);
  });

  test('while the owner works in the window the page keeps running, and reloads when the window is hidden', async ({
    page,
    request,
  }) => {
    const navigations = countNavigations(page);
    await start(page, '/r/1', '.pane-title h1');
    await page.keyboard.press('Shift');
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    await deploy(page, request);
    await tookOver(page);
    await page.waitForTimeout(800);
    expect(navigations()).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    await hide(page);
    await expect.poll(navigations, { timeout: 15_000 }).toBe(2);
    // The same record opens again, now on the new build.
    expect(new URL(page.url()).pathname).toBe('/r/1');
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await expect.poll(() => workerBuild(page), { timeout: 15_000 }).toBe('precache-v2');
    await page.waitForTimeout(1500);
    expect(navigations()).toBe(2);
  });

  test('never reloads over typed text or an open dialog', async ({ page, request }) => {
    const navigations = countNavigations(page);
    await start(page);
    const opener = page.locator('.search-field').first();
    await opener.focus();
    await page.keyboard.press('Enter');
    await page.locator('.palette input').fill('operating');
    await deploy(page, request);
    await tookOver(page);
    await hide(page);
    await page.waitForTimeout(1000);
    expect(navigations()).toBe(1);
    await expect(page.locator('.palette input')).toHaveValue('operating');
    // Once the dialog is closed, the next chance applies the update.
    await page.evaluate(() =>
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }),
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.palette')).toHaveCount(0);
    await hide(page);
    await expect.poll(navigations, { timeout: 15_000 }).toBe(2);
    await expect.poll(() => workerBuild(page), { timeout: 15_000 }).toBe('precache-v2');
  });
});
