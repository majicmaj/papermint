import { expect, test } from '@playwright/test';
import { boot, closeTaxonomy, sheetPage } from './f2';
import { isMobile } from './helpers';

test('the demo fills the viewport and folding the sidebar lets rows use its width', async ({
  page,
}, info) => {
  test.skip(isMobile(info), 'desktop layout');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.route('**/config.json', (route) => route.fulfill({ json: { readOnly: true } }));
  await boot(page);
  await expect(page.locator('.list-head .demo-label')).toHaveText('Demo');
  const scroller = page.locator('.list-scroll');
  const list = page.locator('.desktop-records');
  const before = (await scroller.boundingBox())!;
  expect(before.y + before.height).toBe(900);
  // The list always uses the whole width beside the sidebar.
  expect((await list.boundingBox())!.width).toBe(await scroller.evaluate((el) => el.clientWidth));
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  const after = (await scroller.boundingBox())!;
  expect(after.x).toBe(0);
  expect(after.width).toBe(1600);
  expect(after.y + after.height).toBe(900);
  expect((await list.boundingBox())!.width).toBe(await scroller.evaluate((el) => el.clientWidth));
});

test('grouping changes the headings and survives a reload', async ({ page }, info) => {
  await boot(page);
  const mobile = isMobile(info);
  const headings = page.locator(mobile ? '.prow-head' : '.record-month');
  await expect(headings.first()).toHaveText('August 2026');
  if (mobile) {
    const sort = await sheetPage(page, 'Sort');
    await sort.getByRole('radio', { name: 'Year', exact: true }).tap();
    await closeTaxonomy(page, info);
  } else {
    await page.getByRole('button', { name: 'Group', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Year', exact: true }).click();
  }
  await expect(headings).toHaveText(['2026']);
  await page.reload();
  await expect(headings).toHaveText(['2026']);
});

test('appearance overrides System and updates the sidebar and preview', async ({ page }, info) => {
  test.skip(isMobile(info), 'desktop sidebar and preview');
  await page.emulateMedia({ colorScheme: 'dark' });
  await boot(page, '/r/101');
  const html = page.locator('html');
  const rail = page.locator('.rail-body');
  const preview = page.locator('.pane-body');
  const open = () => page.getByRole('button', { name: 'Appearance' }).click();
  await expect(html).toHaveCSS('color-scheme', 'dark');
  await expect(rail).toHaveCSS('background-color', 'rgb(33, 34, 37)');
  await expect(preview).toHaveCSS('background-color', 'rgb(24, 25, 27)');
  await open();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await expect(html).toHaveCSS('color-scheme', 'light');
  await expect(rail).toHaveCSS('background-color', 'rgb(240, 240, 243)');
  await expect(preview).toHaveCSS('background-color', 'rgb(249, 249, 251)');
  await page.reload();
  await expect(html).toHaveAttribute('data-bs-theme', 'light');
  await open();
  await page.getByRole('menuitemradio', { name: 'System', exact: true }).click();
  await expect(html).toHaveCSS('color-scheme', 'dark');
});
