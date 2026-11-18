import { expect, test, type Page } from '@playwright/test';
import { boot } from './f2';
import { expectStable, isMobile } from './helpers';

const head = (page: Page) => page.locator('.pane-head');
/** The line of facts at the top of the pane body: status context lives there. */
const line = (page: Page) => page.locator('.pane-metarow');

test.describe('record header marks, on a direct route', () => {
  test('a Signed record shows the Signed mark', async ({ page }) => {
    await boot(page, '/r/101');
    await expect(head(page).getByRole('img', { name: 'Signed' })).toBeVisible();
    await expect(head(page).getByRole('img', { name: 'Sensitive' })).toHaveCount(0);
    await expectStable(page, 'signed header', 600);
  });

  test('a Sensitive record shows the lock', async ({ page }) => {
    await boot(page, '/r/106');
    await expect(head(page).getByRole('img', { name: 'Sensitive' })).toBeVisible();
    await expect(head(page).getByRole('img', { name: 'Signed' })).toHaveCount(0);
    await expectStable(page, 'sensitive header', 600);
  });

  test('a Current record that replaced another lists what it replaced', async ({ page }) => {
    await boot(page, '/r/101');
    const replaces = line(page).getByRole('button', { name: 'Replaces' });
    await expect(replaces).toContainText('Replaces 1');
    await replaces.click();
    const item = page.getByRole('menuitem', { name: 'Operating agreement draft' });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(/\/r\/103$/);
  });

  test('a Superseded record names its successor, as a link', async ({ page }) => {
    await boot(page, '/r/103');
    const successor = line(page).locator('.successor');
    await expect(successor).toContainText('Superseded by');
    await expect(successor.getByRole('link', { name: 'Operating agreement' })).toBeVisible();
    await expect(line(page).getByRole('button', { name: /^Replaces/ })).toHaveCount(0);
    await successor.getByRole('link', { name: 'Operating agreement' }).click();
    await expect(page).toHaveURL(/\/r\/101$/);
  });

  test('a record with no status context shows no marks and no gap', async ({ page }) => {
    await boot(page, '/r/104');
    await expect(line(page).locator('.successor')).toHaveCount(0);
    await expect(head(page).getByRole('img')).toHaveCount(0);
    await expect(line(page).getByRole('button', { name: /^Replaces/ })).toHaveCount(0);
  });

  test('the marks never move the title or the toolbar height', async ({ page }, info) => {
    await boot(page, '/r/101');
    const h1 = await head(page).locator('h1').boundingBox();
    expect(h1!.x).toBeGreaterThan(0);
    expect((await head(page).boundingBox())!.height).toBe(
      isMobile(info) ? (await head(page).boundingBox())!.height : 44,
    );
    await expectStable(page, `${info.project.name} marks`, 800);
  });
});
