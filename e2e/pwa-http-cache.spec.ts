import { expect, test, type Page } from '@playwright/test';
import { indexStored, reset, start } from './pwa';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

const URLS = [
  '/api/documents/106/preview/',
  '/api/documents/106/preview/?version=106',
  '/api/documents/106/thumb/',
  '/api/documents/106/',
  '/api/documents/102/preview/?version=102',
  '/api/documents/104/preview/?version=104',
  '/api/documents/?page_size=200&fields=id,title,tags,versions',
];

/** Every cache mode that could answer from the HTTP cache. Each one that answers is listed. */
async function answers(page: Page): Promise<string[]> {
  return page.evaluate(async (urls) => {
    const out: string[] = [];
    const tries: [RequestCache, RequestMode][] = [
      ['force-cache', 'cors'],
      ['only-if-cached', 'same-origin'],
    ];
    const ask = async (url: string, cache: RequestCache, mode: RequestMode) => {
      try {
        const response = await fetch(url, { cache, mode });
        out.push(`${cache} ${url} ${response.status}`);
      } catch {
        // The expected result: nothing is stored.
      }
    };
    for (const url of urls) for (const [cache, mode] of tries) await ask(url, cache, mode);
    return out;
  }, URLS);
}

test('a Sensitive record and an ordinary one leave nothing in the HTTP cache', async ({
  page,
  context,
}) => {
  await start(page);
  await indexStored(page);
  for (const id of [106, 102]) {
    await page.locator(`.row[data-id="${id}"]`).click();
    await expect(page.locator('.pane-body pre')).not.toBeEmpty();
  }
  await page.locator('.row[data-id="104"]').hover();
  await page.waitForTimeout(400);
  await context.setOffline(true);
  expect(await answers(page)).toEqual([]);
});

test('every API answer says no-store', async ({ page }) => {
  await start(page);
  const headers = await page.evaluate(async () => {
    const out: (string | null)[] = [];
    for (const url of ['/api/documents/102/preview/', '/api/tags/', '/api/documents/102/thumb/'])
      out.push((await fetch(url, { cache: 'no-store' })).headers.get('cache-control'));
    return out;
  });
  expect(headers).toEqual(['no-store', 'no-store', 'no-store']);
});
