import { expect, test } from './test';
import { mockRecoveryFiles } from './recovery-mocks';
import { isMobile, openPalette } from './helpers';

/** Screenshots of the layout round: scrim, wide list, recovery files. Recovery files are mocked. */
for (const scheme of ['light', 'dark'] as const) {
  test(`layout states in ${scheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mockRecoveryFiles(page);
    const shot = (name: string) =>
      page.screenshot({ path: `screenshots/${info.project.name}-${scheme}-${name}.png` });
    const rows = page.locator('.list-scroll .row:not([aria-hidden])');

    await page.goto('/');
    await expect(rows.first()).toBeVisible();
    await page.waitForTimeout(400);
    await shot('wide-list');
    await openPalette(page, info);
    await page.locator('.palette input').fill('agreement');
    await expect(page.locator('.result').first()).toBeVisible();
    await page.waitForTimeout(300);
    await shot('scrim');
    await page.keyboard.press('Escape');

    await page.goto('/recovery');
    await expect(rows.first()).toBeVisible();
    await shot('recovery');
    await page.goto('/f/packet');
    await expect(page.locator('.pane-body iframe')).toBeVisible();
    await page.waitForTimeout(1200);
    await shot('recovery-pdf');
    await page.goto('/f/originals');
    await expect(page.locator('.file-card')).toBeVisible();
    await page.waitForTimeout(300);
    await shot('recovery-archive');
    if (!isMobile(info)) {
      await page.goto('/f/code');
      await expect(page.locator('.pane-body pre')).not.toBeEmpty();
      await page.waitForTimeout(300);
      await shot('recovery-text');
    }
  });
}
