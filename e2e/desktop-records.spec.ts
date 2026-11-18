import { expect, test } from '@playwright/test';
import { bootLong } from './motion-helpers';
import { mockApi } from './fixture';

test.skip(({ isMobile }) => isMobile, 'desktop archive');

test('date sorts group compact title-first rows and title sorting removes the headings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1000 });
  await bootLong(page);
  const months = page.locator('.record-month');
  await expect(months.first()).toHaveText('August 2026');
  const row = page.locator('.archive-row[data-id="107"]');
  await expect(row.locator('.row-title')).toHaveText('Joint tax return');
  await expect(row.locator('.pill')).toHaveCount(0);
  const frame = (await row.boundingBox())!;
  const title = (await row.locator('.row-title').boundingBox())!;
  const date = (await row.locator('.row-date').boundingBox())!;
  expect(frame.height).toBe(40);
  expect(date.x - title.x).toBeGreaterThan(0);
  // The row spans the list, the date ends it, and a wide list names the topics.
  expect(Math.round(date.x + date.width)).toBe(Math.round(frame.x + frame.width - 16));
  await expect(row.locator('.topic-labels')).toBeVisible();
  await expect(row.locator('.dots')).toBeHidden();
  await page.getByRole('button', { name: 'Sort', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Title', exact: true }).click();
  await expect(months).toHaveCount(0);
});

test('the split preview keeps a long title, its mark, and the selected version readable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  const api = await mockApi(page);
  api.docs.find((doc) => doc.id === 101)!.title = 'Operating agreement and amendments '.repeat(5);
  await page.goto('/r/101?v=1011');
  const row = page.locator('.archive-row[data-id="101"]');
  await expect(row.getByRole('img', { name: 'Signed' })).toBeVisible();
  const title = row.locator('.row-title-text');
  expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const date = (await row.locator('.row-date').boundingBox())!;
  const frame = (await row.boundingBox())!;
  expect(date.x + date.width).toBeLessThan(frame.x + frame.width);
  await expect(page.locator('.pane-version')).toHaveText('Draft');
  await expect(page.locator('.pane-date')).toHaveAttribute('datetime', '2026-03-03T10:00:00Z');
  await expect(page.locator('.pane-actions--desktop a[download]')).toHaveAttribute(
    'href',
    /version=1011/,
  );
});

test('closing the preview restores the archive scroll and its opener', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 580 });
  await bootLong(page, 50);
  const list = page.locator('.list-scroll');
  const opener = page.locator('.archive-row[data-id="101"]');
  await list.evaluate((el) => (el.scrollTop = 212));
  await opener.focus();
  const position = await list.evaluate((el) => el.scrollTop);
  await page.keyboard.press('Enter');
  await expect(page.locator('.pane-title h1')).toHaveText('Operating agreement');
  await page.keyboard.press('j');
  await expect(page.locator('.pane-title h1')).not.toHaveText('Operating agreement');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await expect(opener).toBeFocused();
  expect(await list.evaluate((el) => el.scrollTop)).toBe(position);
});
