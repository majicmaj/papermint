import { expect, test } from './test';
import { recordWithVersions } from './api';
import { actions, openPalette, waitForRows } from './helpers';
import { dropFile, mockWrites } from './mocks';

/** Screenshots of the states added in fix round 2, in both color schemes. */
for (const scheme of ['light', 'dark'] as const) {
  test(`new states in ${scheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    const shot = (name: string) =>
      page.screenshot({ path: `screenshots/${info.project.name}-${scheme}-${name}.png` });
    const doc = await recordWithVersions(page);

    await page.goto(`/r/${doc.id}?v=999999`);
    await expect(page.locator('.pane-title h1')).toHaveText('Version not found');
    await page.waitForTimeout(300);
    await shot('version-not-found');

    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await actions(page).locator('[aria-label="More"]').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await shot('delete-dialog');
    await page.keyboard.press('Escape');

    await page.goto('/');
    await waitForRows(page);
    await openPalette(page, info);
    await page.locator('.palette input').fill('zzqxjvkwq');
    await expect(page.locator('.result-status')).toHaveText('No results');
    await shot('search-empty');
    await page.route('**/api/documents/?*query=*', (route) => route.abort());
    await page.locator('.palette input').fill('agreement');
    await expect(page.locator('.result-status')).toContainText('Search failed');
    await shot('search-failed');
    await page.keyboard.press('Escape');
    await page.unroute('**/api/documents/?*query=*');

    await mockWrites(page);
    await page.goto('/pending');
    await waitForRows(page);
    await dropFile(page, 'Operating agreement signed.txt');
    // Filing needs an area or a target record, so Confirm is off until one is chosen.
    await expect(page.locator('.intake .progress')).toBeHidden({ timeout: 10_000 });
    await page.locator('.intake').getByPlaceholder('Add as version of…').fill('operating');
    await expect(page.locator('.picker-item').first()).toBeVisible();
    await page.waitForTimeout(300);
    await shot('intake');

    const labelled = doc.versions.find((v) => v.version_label)!;
    await page.goto(`/r/${doc.id}?v=${labelled.id}`);
    await expect(page.locator('.pane-version')).toBeVisible();
    await page.waitForTimeout(1000);
    await shot('version-header');
  });
}
