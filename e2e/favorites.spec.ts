import type { Locator, Page, TestInfo } from '@playwright/test';
import {
  boot,
  closeTaxonomy,
  filterField,
  press,
  rowTitles,
  sheetMenu,
  tagToggle,
  taxonomy,
} from './f2';
import { isMobile, waitForRows } from './helpers';
import { expect, test } from './test';

const LLC = [
  'Draft contract',
  'Joint tax return',
  'Bank statement',
  'Meeting notes',
  'Operating agreement',
  'EIN letter',
  'Stripe agreement',
];

/** Where favorites are applied: the rail on desktop, the header's row on a phone. */
const favorite = (page: Page, info: TestInfo, name: string): Locator =>
  isMobile(info)
    ? page.locator('.topbar-fav', { hasText: name })
    : page.locator('.rail .fav-toggle', { hasText: name });

async function saveFavorite(page: Page, info: TestInfo): Promise<Locator> {
  if (isMobile(info)) {
    const menu = await sheetMenu(page);
    await menu.locator('[data-kind="favorite-save"]').tap();
  } else {
    await page.getByRole('button', { name: 'Save as favorite', exact: true }).click();
  }
  const editor = page.getByRole('dialog', { name: 'New favorite' });
  await expect(editor).toBeVisible();
  return editor;
}

test('a filter combination saves as a favorite with a name, icon and color', async ({
  page,
}, info) => {
  await boot(page);
  await press(tagToggle(await taxonomy(page, info), 'LLC'), info);
  await expect(rowTitles(page)).toHaveText(LLC);
  await (await filterField(page, info, 'menu', 'Signed')).check();
  await expect(rowTitles(page)).toHaveText(['Operating agreement', 'Stripe agreement']);
  if (!isMobile(info)) await page.keyboard.press('Escape');

  const editor = await saveFavorite(page, info);
  const name = editor.getByLabel('Name');
  // The name starts from what the favorite filters, and the summary lists it.
  await expect(name).toHaveValue('LLC');
  await expect(editor.getByRole('list', { name: 'Filters' }).locator('li')).toHaveText([
    'LLC',
    'Signed',
  ]);
  await name.fill('Company');
  await press(editor.getByRole('radio', { name: 'Teal' }), info);
  await press(editor.getByRole('button', { name: 'briefcase' }), info);
  await press(editor.getByRole('button', { name: 'Add to favorites' }), info);
  await expect(editor).toHaveCount(0);

  const row = favorite(page, info, 'Company');
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  await expect(row.locator('.fav-glyph')).toHaveCSS('color', 'rgb(18, 165, 148)');
  if (!isMobile(info)) {
    await expect(row.locator('.fav-count')).toHaveText('2');
    await expect(page.getByRole('button', { name: 'Edit favorite Company' })).toBeVisible();
  }

  // A second press clears the filters, like a pressed area.
  await press(row, info);
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  await expect(rowTitles(page)).toHaveCount(10);

  // The favorite survives a reload and applies the whole combination.
  await page.reload();
  await waitForRows(page);
  await press(favorite(page, info, 'Company'), info);
  await expect(rowTitles(page)).toHaveText(['Operating agreement', 'Stripe agreement']);
  await expect(favorite(page, info, 'Company')).toHaveAttribute('aria-pressed', 'true');
});

test('a favorite can be renamed, moved and removed', async ({ page }, info) => {
  await boot(page);
  for (const area of ['LLC', 'Personal']) {
    const tax = await taxonomy(page, info);
    await press(tagToggle(tax, area), info);
    await closeTaxonomy(page, info);
    const editor = await saveFavorite(page, info);
    await press(editor.getByRole('button', { name: 'Add to favorites' }), info);
    await expect(editor).toHaveCount(0);
    // Start the next combination from nothing.
    await press(favorite(page, info, area), info);
  }
  const names = isMobile(info)
    ? page.locator('.topbar-fav-name')
    : page.locator('.rail .fav-label');
  await expect(names).toHaveText(['LLC', 'Personal']);

  const openMenu = async (name: string) => {
    if (isMobile(info)) {
      const menu = await sheetMenu(page);
      await menu.getByRole('button', { name: `Options for ${name}` }).tap();
    } else {
      await page.locator('.rail .fav-row', { hasText: name }).click({ button: 'right' });
    }
    const menu = page.getByRole('menu', { name });
    await expect(menu).toBeVisible();
    return menu;
  };

  await press((await openMenu('Personal')).getByRole('menuitem', { name: 'Move up' }), info);
  await expect(names).toHaveText(['Personal', 'LLC']);

  await press((await openMenu('LLC')).getByRole('menuitem', { name: 'Edit…' }), info);
  const editor = page.getByRole('dialog', { name: 'Edit favorite' });
  await editor.getByLabel('Name').fill('Business');
  await press(editor.getByRole('button', { name: 'Save' }), info);
  await expect(names).toHaveText(['Personal', 'Business']);

  await press(
    (await openMenu('Personal')).getByRole('menuitem', { name: 'Remove from favorites' }),
    info,
  );
  await expect(names).toHaveText(['Business']);
  await page.reload();
  await waitForRows(page);
  await expect(names).toHaveText(['Business']);
});

test('keys move a favorite and open the palette list', async ({ page }, info) => {
  test.skip(isMobile(info), 'Keyboard only');
  await boot(page);
  for (const area of ['LLC', 'Personal']) {
    await tagToggle(page.locator('.rail'), area).click();
    await page.getByRole('button', { name: 'Save as favorite', exact: true }).click();
    await page.getByRole('button', { name: 'Add to favorites' }).click();
    await favorite(page, info, area).click();
  }
  const names = page.locator('.rail .fav-label');
  await favorite(page, info, 'Personal').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(names).toHaveText(['Personal', 'LLC']);
  await expect(favorite(page, info, 'Personal')).toBeFocused();

  await page.keyboard.press('Control+k');
  await page.getByRole('option', { name: 'Favorites', exact: true }).click();
  await page.getByRole('option', { name: /LLC/ }).click();
  await expect(rowTitles(page)).toHaveText(LLC);
});
