import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectStable, isMobile, stepStable } from './helpers';
import {
  boot,
  chipsOf,
  chooseType,
  closeTaxonomy,
  filterField,
  heightOf,
  press,
  rowTitles,
  sheetFront,
  sheetPage,
  showSuperseded,
} from './f2';

test('filter menu, chips and removing a chip', async ({ page }, info) => {
  await boot(page);
  const chips = chipsOf(page);
  await expect(chips).toHaveCount(0);

  await press(page.getByRole('button', { name: 'Filter' }), info);
  if (!isMobile(info)) await expect(page.locator('.filter-panel')).toBeVisible();
  await chooseType(page, info, 'application/pdf', 'PDF');
  await expect(chips).toHaveText(['PDF']);
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Apartment lease',
    'Health insurance',
    'Bank statement',
    'Operating agreement',
    'EIN letter',
    'Stripe agreement',
  ]);

  await (await filterField(page, info, 'Pages', 'Minimum pages')).fill('5');
  await expect(chips).toHaveText(['PDF', 'Pages from 5']);
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Apartment lease',
    'Operating agreement',
    'Stripe agreement',
  ]);

  await (await filterField(page, info, 'menu', 'Signed')).check();
  await expect(chips).toHaveText(['PDF', 'Pages from 5', 'Signed']);
  await expect(rowTitles(page)).toHaveText(['Operating agreement', 'Stripe agreement']);

  // A date range: the inputs are always in the panel, and the chip names the range.
  await (await filterField(page, info, 'Created', 'Created from')).fill('2026-03-01');
  await expect(chips.last()).toHaveText('Created from Mar 1, 2026');
  await expect(rowTitles(page)).toHaveText(['Operating agreement']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.filter-panel')).toHaveCount(0);
  await expect(page.locator('.drawer-root')).toHaveCount(0);

  // Newest first: nothing sits after the chip that goes, so nothing moves. Removing an older
  // chip slides the newer ones left by one chip; that is the one shift a chip bar cannot avoid.
  await stepStable(page, `${info.project.name} chips so far`);
  for (const name of [/^Remove Created/, 'Remove Signed', 'Remove Pages from 5', 'Remove PDF']) {
    await press(page.getByRole('button', { name }), info);
    await stepStable(page, `${info.project.name} remove chip`);
  }
  await expect(chips).toHaveCount(0);
  await expect(rowTitles(page)).toHaveCount(10);
  await expectStable(page, `${info.project.name} filter chips`, 600);
});

test('size loads from the metadata endpoint, and Superseded adds those records', async ({
  page,
}, info) => {
  await boot(page);
  await press(page.getByRole('button', { name: 'Filter' }), info);
  const minimum = await filterField(page, info, 'Size', 'Minimum size');
  await minimum.fill('105');
  await expect(chipsOf(page)).toHaveText(['Size from 105 KB']);
  await expect(rowTitles(page)).toHaveText([
    'Draft contract',
    'Joint tax return',
    'Apartment lease',
    'Health insurance',
    'Meeting notes',
    'Stripe agreement',
    'Photo ID',
  ]);
  if (isMobile(info)) expect(await heightOf(minimum)).toBeGreaterThanOrEqual(44);
  await minimum.fill('');
  await showSuperseded(page, info);
  await expect(chipsOf(page)).toHaveText(['Superseded']);
  await expect(rowTitles(page)).toHaveCount(12);
  await expect(page.locator('.list-scroll .row', { hasText: 'EIN letter scan' })).toBeVisible();
  await expectStable(page, `${info.project.name} size and superseded`, 600);
});

/** The sort keys: a menu on desktop, the Sort page of the filter sheet on a phone. */
async function sortControls(page: Page, info: TestInfo) {
  if (isMobile(info)) {
    await sheetPage(page, 'Sort');
    const front = sheetFront(page);
    return {
      key: (name: string) => front.getByRole('radio', { name, exact: true }),
      // The desktop button names the direction it has and flips it; the phone has a choice each.
      toggle: (name: string) =>
        front.getByRole('radio', { name: name === 'Descending' ? 'Ascending' : 'Descending' }),
      open: async () => {
        await sheetPage(page, 'Sort');
      },
      done: () => closeTaxonomy(page, info),
    };
  }
  const menu = page.getByRole('menu', { name: 'Sort' });
  return {
    key: (name: string) => menu.getByRole('menuitemradio', { name }),
    toggle: (name: string) => menu.getByRole('menuitem', { name }),
    open: () => press(page.getByRole('button', { name: 'Sort' }), info),
    done: async () => {},
  };
}

test('sort menu: key, check mark and direction', async ({ page }, info) => {
  await boot(page);
  const sort = await sortControls(page, info);
  if (!isMobile(info)) await sort.open();
  await expect(sort.key('Created')).toHaveAttribute('aria-checked', 'true');
  await press(sort.key('Title'), info);
  await expect(rowTitles(page).first()).toHaveText('Stripe agreement');
  await sort.done();
  await sort.open();
  await expect(sort.key('Title')).toHaveAttribute('aria-checked', 'true');
  await press(sort.toggle('Descending'), info);
  await expect(rowTitles(page).first()).toHaveText('Apartment lease');
  await sort.done();
  await sort.open();
  await press(sort.key('Added'), info);
  await expect(rowTitles(page).first()).toHaveText('Photo ID');
  await sort.done();
  await expectStable(page, `${info.project.name} sort`, 600);
});
