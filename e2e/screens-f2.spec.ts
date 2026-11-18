import { expect, test } from '@playwright/test';
import { actions } from './helpers';
import {
  boot,
  chooseType,
  filterField,
  openFilter,
  press,
  sheetPage,
  showSuperseded,
  tagToggle,
  taxonomy,
} from './f2';

/**
 * Screenshots of the area and topic work, over the mocked archive (no live record is shown).
 * Output: screenshots/f2/<project>-<scheme>-<name>.png
 */
for (const scheme of ['light', 'dark'] as const) {
  test(`areas, topics, filters and successors in ${scheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    const shot = async (name: string) => {
      await page.waitForTimeout(250);
      await page.screenshot({ path: `screenshots/f2/${info.project.name}-${scheme}-${name}.png` });
    };
    await boot(page);
    const tax = await taxonomy(page, info);
    await press(tagToggle(tax, 'LLC'), info);
    await press(tagToggle(tax, 'Personal'), info);
    // The rail on desktop; the Topics page of the filter sheet on a phone.
    const topics = await taxonomy(page, info, 'topics');
    await press(tagToggle(topics, 'Tax'), info);
    await shot('rail-areas-topics');

    // The editor, on a new topic.
    await press(topics.getByRole('button', { name: 'New topic' }), info);
    const pop = page.locator('.editor-pop');
    await pop.getByLabel('Name').fill('Insurance');
    await pop.getByLabel('Area').selectOption({ label: 'Personal' });
    await press(pop.getByRole('radio', { name: 'Teal' }), info);
    await press(pop.getByRole('button', { name: 'landmark' }), info);
    await shot('popover');
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    if (info.project.name === 'mobile') await page.keyboard.press('Escape');

    // Show every record again, so the filters below have something to match.
    if (info.project.name === 'mobile') {
      await (await sheetPage(page, 'Topics')).getByRole('button', { name: 'Clear all' }).click();
      await (await sheetPage(page, 'Areas')).getByRole('button', { name: 'Clear all' }).click();
      await page.keyboard.press('Escape');
    } else {
      const tags = await taxonomy(page, info);
      await tags.getByRole('button', { name: 'Clear all' }).nth(1).click();
      await tags.getByRole('button', { name: 'Clear all' }).first().click();
    }

    await press(page.getByRole('button', { name: 'Filter' }), info);
    await shot('filter-menu');
    await chooseType(page, info, 'application/pdf', 'PDF');
    await (await filterField(page, info, 'Pages', 'Minimum pages')).fill('3');
    await (await filterField(page, info, 'menu', 'Signed')).check();
    await showSuperseded(page, info);
    await page.keyboard.press('Escape');
    await shot('chips');

    // The sort lives in the filter sheet on a phone: its Sort page is the screen.
    if (info.project.name === 'mobile') await sheetPage(page, 'Sort');
    else await press(page.getByRole('button', { name: 'Sort' }), info);
    await shot('sort-menu');
    await page.keyboard.press('Escape');

    if (info.project.name !== 'mobile')
      await press(page.getByRole('button', { name: 'Filter' }), info);
    else await openFilter(page);
    await (await filterField(page, info, 'menu', 'Signed')).uncheck();
    await (await filterField(page, info, 'Pages', 'Minimum pages')).fill('');
    await chooseType(page, info, '', 'Any');
    await page.keyboard.press('Escape');
    await shot('superseded-row');

    await page.goto('/r/102');
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await press(actions(page).locator('[aria-label="More"]'), info);
    await press(page.getByRole('menuitemradio', { name: 'Superseded' }), info);
    await page.getByLabel('Search records').fill('o');
    await shot('successor-picker');
  });
}
