import { expect, test } from '@playwright/test';
import { readCls, trackCls } from './cls';
import { control, indexStored, reset, start } from './pwa';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

const rows = (page: import('@playwright/test').Page) => page.locator('.list-scroll .row[data-id]');

test('a warm start draws the stored records at the first paint, never a skeleton, and moves nothing', async ({
  page,
}) => {
  await trackCls(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __skeleton: boolean; __firstRows: number | null };
    w.__skeleton = false;
    w.__firstRows = null;
    new MutationObserver(() => {
      if (document.querySelector('.skeleton-bar')) w.__skeleton = true;
      const count = document.querySelectorAll('.list-scroll .row[data-id]').length;
      if (count > 0 && w.__firstRows === null) w.__firstRows = count;
    }).observe(document, { childList: true, subtree: true });
  });
  await start(page);
  await indexStored(page);
  const stored = await rows(page).count();
  await page.reload();
  await expect(rows(page).first()).toBeVisible();
  // The very first time rows exist, all of them are there: the stored index, not a later fetch.
  const first = await page.evaluate(
    () => (window as unknown as { __firstRows: number }).__firstRows,
  );
  expect(first).toBe(stored);
  expect(await page.evaluate(() => (window as unknown as { __skeleton: boolean }).__skeleton)).toBe(
    false,
  );
  await page.waitForTimeout(1200);
  expect((await readCls(page)).total).toBeLessThanOrEqual(0.001);
});

test('a changed index from the server waits for an intentional list change', async ({
  page,
  request,
}) => {
  await start(page);
  await indexStored(page);
  const before = await rows(page).count();
  const titles = await page.locator('.list-scroll .row-title').allInnerTexts();
  // The server now has more records, as if another device added them.
  await control(request, { docs: 55 });
  await page.reload();
  await expect(rows(page).first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await rows(page).count()).toBe(before);
  expect(await page.locator('.list-scroll .row-title').allInnerTexts()).toEqual(titles);
  // Changing the order redraws the list, even with no other view to switch to.
  await page.getByRole('button', { name: 'Sort', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Title', exact: true }).click();
  await expect.poll(() => rows(page).count()).toBeGreaterThan(before);
});

test('the stored index survives going offline for a whole session', async ({ page, context }) => {
  await start(page);
  await indexStored(page);
  const before = await rows(page).count();
  await context.setOffline(true);
  await page.reload();
  await expect(rows(page)).toHaveCount(before);
  await page.locator('.row[data-id="104"]').click();
  await expect(page.locator('.pane-title h1')).toHaveText('Bank statement');
});
