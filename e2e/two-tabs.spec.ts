import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './fixture';
import { isMobile } from './helpers';

const POPOVER = '.editor-pop';

async function newArea(page: Page, name: string, iconIndex: number): Promise<void> {
  await page.getByRole('button', { name: 'New area' }).click();
  const pop = page.locator(POPOVER);
  await pop.getByLabel('Name').fill(name);
  await pop.locator('.icon-cell').nth(iconIndex).click();
  await expect(pop.getByRole('button', { name: 'Create' })).toBeEnabled();
}

test('two tabs saving two icons at once keep both', async ({ context, browserName }, info) => {
  test.skip(isMobile(info), 'two desktop tabs');
  void browserName;
  // One mocked server for both tabs, with slow settings reads and writes, so the two
  // read-modify-writes would overlap if nothing ordered them.
  const api = await mockApi(context as unknown as Page);
  await context.route('**/api/ui_settings/', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fallback();
  });
  const [a, b] = [await context.newPage(), await context.newPage()];
  await Promise.all([a.goto('/'), b.goto('/')]);
  await expect(a.locator('.rail-body')).toBeVisible();
  await expect(b.locator('.rail-body')).toBeVisible();
  await newArea(a, 'Vendors', 1);
  await newArea(b, 'Travel', 2);
  await Promise.all([
    a.locator(POPOVER).getByRole('button', { name: 'Create' }).click(),
    b.locator(POPOVER).getByRole('button', { name: 'Create' }).click(),
  ]);
  await expect.poll(() => api.writes.settingsPosts.length, { timeout: 15_000 }).toBe(2);
  const icons = (api.settings['majin'] as { tagIcons: Record<string, string> }).tagIcons;
  expect(Object.keys(icons).sort()).toEqual(['10', '901', '902']);
  // Every other setting is still there.
  expect(api.settings['version']).toBe('3.4.2');
});
