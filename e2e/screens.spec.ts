import { expect, test } from './test';
import { recordWithVersions } from './api';
import { openPalette, waitForRows } from './helpers';

/** Screenshots of every view in both color schemes. Output: screenshots/<project>-<scheme>-<view>.png */
for (const scheme of ['light', 'dark'] as const) {
  test(`screenshots in ${scheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    const shot = (name: string) =>
      page.screenshot({ path: `screenshots/${info.project.name}-${scheme}-${name}.png` });
    for (const [name, path] of [
      ['records', '/'],
      ['pending', '/pending'],
      ['recovery', '/recovery'],
    ] as const) {
      await page.goto(path);
      await waitForRows(page);
      await page.waitForTimeout(400);
      await shot(name);
    }
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await expect(
      page.locator('.pane-body iframe, .pane-body pre, .pane-body img').first(),
    ).toBeVisible();
    await page.waitForTimeout(1200);
    await shot('record');
    await page.goto('/');
    await waitForRows(page);
    await openPalette(page, info);
    await page.locator('.palette input').fill('agreement');
    await expect(page.locator('.result[data-source="text"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await shot('palette');
  });
}
