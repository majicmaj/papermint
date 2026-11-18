import { expect, test } from '@playwright/test';
import { reset, start } from './pwa';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

test('the manifest describes an installable app', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({
    name: 'Papermint',
    short_name: 'Papermint',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });
  expect(manifest.display_override).toEqual(['window-controls-overlay', 'standalone']);
  const sizes = manifest.icons.map(
    (i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`,
  );
  expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
  }
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test('the browser finds nothing in the way of installing it', async ({ page, context }) => {
  await start(page);
  const session = await context.newCDPSession(page);
  const result = await session.send('Page.getInstallabilityErrors');
  // A test browser is a private window, which cannot install. Nothing else may be in the way.
  const errors = result.installabilityErrors
    .map((e) => e.errorId)
    .filter((id) => id !== 'in-incognito');
  expect(errors).toEqual([]);
});

test('the worker file is served fresh, from the root, so updates are found', async ({
  request,
}) => {
  const response = await request.get('/sw.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('javascript');
  expect(response.headers()['cache-control']).toContain('no-cache');
});
