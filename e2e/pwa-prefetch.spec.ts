import { expect, test } from '@playwright/test';
import { indexStored, reset, serverLog, start } from './pwa';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

async function previews(request: import('@playwright/test').APIRequestContext, id: number) {
  const { log } = await serverLog(request);
  return log.filter((e) => e.path.startsWith(`/api/documents/${id}/preview/`));
}

test('hovering a row fetches its preview once, for the current version', async ({
  page,
  request,
}) => {
  await start(page);
  await indexStored(page);
  await page.locator('.row[data-id="104"]').hover();
  await expect.poll(async () => (await previews(request, 104)).length).toBe(1);
  expect((await previews(request, 104))[0]!.path).toBe('/api/documents/104/preview/?version=104');
  // The current version of a record with versions is the first one listed.
  await page.locator('.row[data-id="101"]').hover();
  await expect.poll(async () => (await previews(request, 101)).length).toBe(1);
  expect((await previews(request, 101))[0]!.path).toBe('/api/documents/101/preview/?version=1012');
  await page.locator('.row[data-id="104"]').hover();
  await page.waitForTimeout(400);
  expect(await previews(request, 104)).toHaveLength(1);
});

test('a pointer that only sweeps across the list fetches nothing', async ({ page, request }) => {
  await start(page);
  await indexStored(page);
  const row = page.locator('.row[data-id="105"]');
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 10);
  await page.mouse.move(box.x + 40, box.y - 60);
  await page.waitForTimeout(400);
  expect(await previews(request, 105)).toHaveLength(0);
});

test('a press or keyboard focus on a row fetches its preview before the click', async ({
  page,
  request,
}) => {
  await start(page);
  await indexStored(page);
  await page.locator('.row[data-id="105"]').dispatchEvent('pointerdown');
  await expect.poll(async () => (await previews(request, 105)).length).toBe(1);
  await page.locator('.row[data-id="112"]').focus();
  await expect.poll(async () => (await previews(request, 112)).length).toBe(1);
});

test('a Sensitive record is never fetched ahead', async ({ page, request }) => {
  await start(page);
  await indexStored(page);
  const row = page.locator('.row[data-id="106"]');
  await row.hover();
  await row.dispatchEvent('pointerdown');
  await row.focus();
  await page.waitForTimeout(500);
  expect(await previews(request, 106)).toEqual([]);
});

test('nothing is fetched ahead while offline', async ({ page, context, request }) => {
  await start(page);
  await indexStored(page);
  await context.setOffline(true);
  await page.locator('.row[data-id="104"]').hover();
  await page.waitForTimeout(400);
  await context.setOffline(false);
  expect(await previews(request, 104)).toHaveLength(0);
});
