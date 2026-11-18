import { expect, test } from './test';
import { isMobile, waitForRows } from './helpers';

// Keys must act on the route the owner sees, even while a View Transition is still running.
test('Escape right after opening a record closes it', async ({ page }, info) => {
  test.skip(isMobile(info), 'keyboard behavior is checked on desktop');
  await page.goto('/');
  await waitForRows(page);
  for (let i = 0; i < 3; i += 1) {
    await page
      .locator('.list-scroll .row[data-id]')
      .nth(i + 1)
      .click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.pane-body')).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  }
});
