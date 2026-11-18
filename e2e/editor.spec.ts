import { expect, test } from '@playwright/test';
import { actions, expectStable, isMobile } from './helpers';
import { boot, closeTaxonomy, editRow, heightOf, press, tagToggle, taxonomy } from './f2';

const POPOVER = '.editor-pop';

test('create an area: name, color and icon, and the icon is saved without touching other settings', async ({
  page,
}, info) => {
  const api = await boot(page);
  const tax = await taxonomy(page, info);
  await press(tax.getByRole('button', { name: 'New area' }), info);
  const pop = page.locator(POPOVER);
  await expect(pop).toBeVisible();
  await expect(pop.getByRole('radio', { name: 'Area' })).toHaveAttribute('aria-checked', 'true');
  await expect(pop.getByRole('button', { name: 'Create' })).toBeDisabled();
  await pop.getByLabel('Name').fill('Vendors');
  await press(pop.getByRole('radio', { name: 'Teal' }), info);
  await press(pop.getByRole('button', { name: 'wallet' }), info);
  if (isMobile(info)) {
    for (const target of [
      pop.getByRole('radio', { name: 'Teal' }),
      pop.getByRole('button', { name: 'wallet' }),
      pop.getByRole('button', { name: 'Create' }),
      pop.getByLabel('Name'),
    ]) {
      expect(await heightOf(target)).toBeGreaterThanOrEqual(44);
    }
  }
  await press(pop.getByRole('button', { name: 'Create' }), info);
  await expect(pop).toHaveCount(0);
  expect(api.writes.tagPosts).toEqual([
    { name: 'Vendors', color: '#12a594', parent: null, matching_algorithm: 0, is_inbox_tag: false },
  ]);
  await expect.poll(() => api.writes.settingsPosts.length).toBe(1);
  expect(api.writes.settingsPosts[0]).toEqual({
    sidebar: { hidden_items: ['dashboard'] },
    version: '3.4.2',
    saved_views: { sidebar_views_visible_ids: [1, 2, 3] },
    majin: { other: 1, tagIcons: { '10': 'landmark', '901': 'wallet' } },
  });
  const row = tagToggle(await taxonomy(page, info), 'Vendors');
  await expect(row.locator('.glyph svg')).toHaveCount(1);
  await closeTaxonomy(page, info);
  await expectStable(page, `${info.project.name} create area`, 600);
});

test('a topic needs an area, and lands under it', async ({ page }, info) => {
  const api = await boot(page);
  const tax = await taxonomy(page, info, 'topics');
  await press(tax.getByRole('button', { name: 'New topic' }), info);
  const pop = page.locator(POPOVER);
  await expect(pop.getByRole('radio', { name: 'Topic' })).toHaveAttribute('aria-checked', 'true');
  await pop.getByLabel('Name').fill('Insurance');
  await expect(pop.getByRole('button', { name: 'Create' })).toBeDisabled();
  await pop.getByLabel('Area').selectOption({ label: 'Personal' });
  await press(pop.getByRole('button', { name: 'Create' }), info);
  await expect(pop).toHaveCount(0);
  expect(api.writes.tagPosts).toEqual([
    { name: 'Insurance', color: '#8d8d8d', parent: 11, matching_algorithm: 0, is_inbox_tag: false },
  ]);
  // No icon chosen: no settings write.
  expect(api.writes.settingsPosts).toEqual([]);
  await expect(tagToggle(await taxonomy(page, info, 'topics'), 'Insurance')).toBeVisible();
  await closeTaxonomy(page, info);
  await expectStable(page, `${info.project.name} create topic`, 600);
});

test('the Kind switch works both ways and an edit keeps the kind fixed', async ({ page }, info) => {
  await boot(page);
  const tax = await taxonomy(page, info);
  await press(tax.getByRole('button', { name: 'New area' }), info);
  const pop = page.locator(POPOVER);
  await expect(pop.getByLabel('Area')).toHaveCount(0);
  await press(pop.getByRole('radio', { name: 'Topic' }), info);
  await expect(pop.getByLabel('Area')).toBeVisible();
  await press(pop.getByRole('radio', { name: 'Area' }), info);
  await expect(pop.getByLabel('Area')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);

  await editRow(await taxonomy(page, info, 'topics'), page, 'Tax', info);
  await press(page.getByRole('menuitem', { name: 'Rename' }), info);
  await expect(pop.getByRole('radio', { name: 'Area' })).toBeDisabled();
  await expect(pop.getByLabel('Area')).toBeDisabled();
});

test('the row menu renames, recolors and changes the icon', async ({ page }, info) => {
  const api = await boot(page);
  const tax = await taxonomy(page, info);
  await editRow(tax, page, 'LLC', info);
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Icon', 'Color']);
  await press(page.getByRole('menuitem', { name: 'Rename' }), info);
  const pop = page.locator(POPOVER);
  await expect(pop.getByLabel('Name')).toBeFocused();
  await expect(pop.getByLabel('Name')).toHaveValue('LLC');
  await expect(pop.getByRole('button', { name: 'landmark' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await pop.getByLabel('Name').fill('Company');
  await press(pop.getByRole('radio', { name: 'Red' }), info);
  await press(pop.getByRole('button', { name: 'globe' }), info);
  await press(pop.getByRole('button', { name: 'Save' }), info);
  await expect(pop).toHaveCount(0);
  expect(api.writes.tagPatches).toEqual([{ id: 10, body: { name: 'Company', color: '#e5484d' } }]);
  await expect.poll(() => api.writes.settingsPosts.length).toBe(1);
  expect(api.writes.settingsPosts[0]).toMatchObject({
    sidebar: { hidden_items: ['dashboard'] },
    majin: { other: 1, tagIcons: { '10': 'globe' } },
  });
  await expect(tagToggle(await taxonomy(page, info), 'Company')).toBeVisible();
  await closeTaxonomy(page, info);
  await expectStable(page, `${info.project.name} edit tag`, 600);
});

test('Icon and Color in the row menu focus their own control', async ({ page }, info) => {
  await boot(page);
  const tax = await taxonomy(page, info);
  await editRow(tax, page, 'Personal', info);
  await press(page.getByRole('menuitem', { name: 'Icon' }), info);
  await expect(page.locator(`${POPOVER} .icon-cell`).first()).toBeFocused();
  await page.keyboard.press('Escape');
  await editRow(await taxonomy(page, info), page, 'Personal', info);
  await press(page.getByRole('menuitem', { name: 'Color' }), info);
  await expect(page.locator(`${POPOVER} .swatch`).first()).toBeFocused();
});

test('the record menu: areas, the topics of those areas, and New topic assigns it', async ({
  page,
}, info) => {
  const api = await boot(page, '/r/104');
  await press(actions(page).locator('[aria-label="More"]'), info);
  const menu = page.locator('.menu');
  await expect(menu.locator('.menu-label')).toHaveText(['Status', 'Areas', 'Topics']);
  await expect(menu.getByRole('menuitemcheckbox')).toHaveText([
    'LLC',
    'Personal',
    'Banking',
    'Draft',
    'Tax',
  ]);
  await expect(menu.getByRole('menuitemcheckbox', { name: 'LLC' })).toBeDisabled();
  await press(menu.getByRole('menuitem', { name: 'New topic…' }), info);
  const pop = page.locator(POPOVER);
  await expect(pop.getByLabel('Area')).toHaveValue('10');
  await pop.getByLabel('Name').fill('Audit');
  await press(pop.getByRole('button', { name: 'Create' }), info);
  await expect(pop).toHaveCount(0);
  expect(api.writes.tagPosts[0]).toMatchObject({ name: 'Audit', parent: 10 });
  await expect.poll(() => api.writes.docPatches.length).toBe(1);
  expect(api.writes.docPatches[0]!.id).toBe(104);
  expect((api.writes.docPatches[0]!.body['tags'] as number[]).sort((a, b) => a - b)).toEqual([
    2, 10, 21, 901,
  ]);
  await expectStable(page, `${info.project.name} record menu new topic`, 600);
});

test('New area from the record menu adds the area to the record', async ({ page }, info) => {
  const api = await boot(page, '/r/112');
  await press(actions(page).locator('[aria-label="More"]'), info);
  await press(page.getByRole('menuitem', { name: 'New area…' }), info);
  const pop = page.locator(POPOVER);
  await pop.getByLabel('Name').fill('Travel');
  await press(pop.getByRole('button', { name: 'Create' }), info);
  await expect.poll(() => api.writes.docPatches.length).toBe(1);
  expect((api.writes.docPatches[0]!.body['tags'] as number[]).sort((a, b) => a - b)).toEqual([
    2, 10, 901,
  ]);
});
