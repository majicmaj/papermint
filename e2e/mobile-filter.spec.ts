import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeTaxonomy, openFilter, rowTitles, sheetFront, sheetPage } from './f2';
import { expectStable, settled, stepStable } from './helpers';
import {
  animationsSeen,
  anyAnimation,
  bootLong,
  center,
  recordAnimations,
  touchDrag,
} from './motion-helpers';

test.skip(({ isMobile }) => !isMobile, 'the phone layout');

const PERSONAL = ['Joint tax return', 'Apartment lease', 'Health insurance', 'Photo ID'];

const box = async (target: Locator) => (await target.boundingBox())!;
const round = (n: number) => Math.round(n);

/** The rows of the page in front, with their place on screen. */
async function rowBoxes(front: Locator) {
  await settled(front.page());
  return Promise.all((await front.locator('.fs-row').all()).map((row) => box(row)));
}

async function back(page: Page) {
  await sheetFront(page).getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(sheetFront(page).locator('.fs-search')).toBeVisible();
}

test('the sheet is a menu: search and close on top, one grouped list of filter kinds', async ({
  page,
}) => {
  await bootLong(page, 0);
  const sheet = await openFilter(page);
  await page.waitForTimeout(650);
  const drawer = await box(sheet);
  expect(drawer.height).toBeLessThanOrEqual(844 * 0.88 + 1);
  expect(await sheet.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('28px');
  const bar = await box(sheet.locator('.drawer-bar'));
  expect([round(bar.width), round(bar.height), round(bar.y - drawer.y)]).toEqual([36, 5, 8]);

  const search = await box(sheet.getByLabel('Search filters'));
  const field = await box(sheet.locator('.fs-search'));
  const close = await box(sheet.getByRole('button', { name: 'Close' }));
  expect([round(field.height), round(close.width), round(close.height)]).toEqual([48, 48, 48]);
  expect(round(field.x - drawer.x)).toBe(20);
  expect(round(close.x - field.x - field.width)).toBe(12);
  expect(search.height).toBeGreaterThanOrEqual(44);

  const front = sheetFront(page);
  await expect(front.locator('.fs-label').first()).toHaveText('All filters');
  await expect(front.locator('.fs-row .fs-text')).toHaveText([
    'Areas',
    'Topics',
    'Created',
    'Added',
    'Modified',
    'Size',
    'Pages',
    'Type',
    'Signed',
    'Versions',
    'Sort',
  ]);
  const group = await box(front.locator('.fs-group'));
  expect(round(group.x - drawer.x)).toBe(16);
  for (const row of await rowBoxes(front)) expect(round(row.height)).toBe(56);
  await expect(front.getByRole('switch')).toHaveCount(2);
  await expect(front.locator('.fs-nav[data-kind="sort"] .fs-summary')).toHaveText('Created');
  // Recovery lives in the header's menu, not in the sheet.
  await expect(sheet.getByRole('link', { name: 'Recovery' })).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Close' }).tap();
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expect(page.locator('.topbar-filter')).toBeFocused();
  await expectStable(page, 'filter sheet menu', 500);
});

test('the Filter drawer applies areas, topics, filters and sort', async ({ page }) => {
  await bootLong(page, 0);
  let front = await sheetPage(page, 'Areas');
  await front.locator('.fs-tag-toggle', { hasText: 'Personal' }).tap();
  await expect(rowTitles(page)).toHaveText(PERSONAL);
  front = await sheetPage(page, 'Topics');
  await front.locator('.fs-tag-toggle', { hasText: 'Health' }).tap();
  await expect(rowTitles(page)).toHaveText(['Joint tax return', 'Health insurance']);
  await back(page);
  // The menu names the choice at the end of each row.
  await expect(front.locator('.fs-nav[data-kind="areas"] .fs-summary')).toHaveText('Personal');
  await expect(front.locator('.fs-nav[data-kind="topics"] .fs-summary')).toHaveText('Health');

  await front.getByRole('switch', { name: 'Signed' }).check();
  await expect(page.locator('.topbar .chip')).toHaveText(['Signed']);
  await front.getByRole('switch', { name: 'Signed' }).uncheck();
  await expect(page.locator('.topbar .chip')).toHaveCount(0);

  front = await sheetPage(page, 'Sort');
  await front.getByRole('radio', { name: 'Title' }).tap();
  await expect(rowTitles(page).first()).toHaveText('Joint tax return');
  await expect(front.getByRole('radio', { name: 'Title' })).toHaveAttribute('aria-checked', 'true');
  await front.getByRole('radio', { name: 'Ascending' }).tap();
  await expect(rowTitles(page).first()).toHaveText('Health insurance');
  await back(page);
  await expect(front.locator('.fs-nav[data-kind="sort"] .fs-summary')).toHaveText('Title');

  // An area is not a chip: the Filter button shows that something is chosen.
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expect(page.locator('.topbar-filter')).toHaveAttribute('data-active', 'true');
  await stepStable(page, 'drawer filters', 700);
  front = await sheetPage(page, 'Topics');
  await front.getByRole('button', { name: 'Clear all' }).tap();
  front = await sheetPage(page, 'Areas');
  await front.getByRole('button', { name: 'Clear all' }).tap();
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expect(page.locator('.topbar-filter')).not.toHaveAttribute('data-active', 'true');
  await expectStable(page, 'drawer clear', 700);
});

test('pages: dates with presets, sizes, pages and the type, each with Clear', async ({ page }) => {
  await bootLong(page, 0);
  let front = await sheetPage(page, 'Created');
  await expect(front.getByRole('button', { name: 'Clear' })).toHaveCount(0);
  const rows = await rowBoxes(front);
  for (const row of rows) expect(round(row.height)).toBe(52);
  await front.getByRole('radio', { name: 'Last year' }).tap();
  await expect(front.getByRole('radio', { name: 'Last year' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const year = new Date().getFullYear() - 1;
  await expect(front.getByLabel('Created from')).toHaveValue(`${year}-01-01`);
  await expect(front.getByLabel('Created to')).toHaveValue(`${year}-12-31`);
  // A choice moves no row: the check and Clear have their own places.
  expect(await rowBoxes(front)).toEqual(rows);
  await front.getByRole('button', { name: 'Clear' }).tap();
  await expect(front.getByLabel('Created from')).toHaveValue('');
  await front.getByLabel('Created from').fill('2026-03-01');
  await expect(page.locator('.topbar .chip')).toHaveText(['Created from Mar 1, 2026']);
  await back(page);
  await expect(sheetFront(page).locator('.fs-nav[data-kind="created"] .fs-summary')).toHaveText(
    'From Mar 1',
  );
  await sheetFront(page).locator('.fs-nav[data-kind="created"]').tap();
  await sheetFront(page).getByRole('button', { name: 'Clear' }).tap();

  front = await sheetPage(page, 'Pages');
  await front.getByLabel('Minimum pages').fill('5');
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Apartment lease',
    'Operating agreement',
    'Stripe agreement',
  ]);
  expect((await box(front.getByLabel('Minimum pages'))).height).toBeGreaterThanOrEqual(44);
  await front.getByRole('button', { name: 'Clear' }).tap();
  await expect(rowTitles(page)).toHaveCount(9);

  front = await sheetPage(page, 'Size');
  await front.getByLabel('Minimum size').fill('105');
  await expect(page.locator('.topbar .chip')).toHaveText(['Size from 105 KB']);
  await back(page);
  await expect(sheetFront(page).locator('.fs-nav[data-kind="size"] .fs-summary')).toHaveText(
    'From 105 KB',
  );
  front = await sheetPage(page, 'Size');
  await front.getByRole('button', { name: 'Clear' }).tap();

  front = await sheetPage(page, 'Type');
  await expect(front.getByRole('radio', { name: 'Any' })).toHaveAttribute('aria-checked', 'true');
  await front.getByRole('radio', { name: 'PDF' }).tap();
  await expect(page.locator('.topbar .chip')).toHaveText(['PDF']);
  await expect(rowTitles(page)).toHaveCount(7);
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expectStable(page, 'filter pages', 600);
});

test('a choice never moves the rows under the finger', async ({ page }) => {
  await bootLong(page, 0);
  let front = await sheetPage(page, 'Topics');
  const before = await rowBoxes(front);
  for (const name of ['Tax', 'Health', 'Banking']) {
    await front.locator('.fs-tag-toggle', { hasText: name }).tap();
    expect(await rowBoxes(front), name).toEqual(before);
  }
  await front.getByRole('button', { name: 'Clear all' }).tap();
  expect(await rowBoxes(front)).toEqual(before);
  front = await sheetPage(page, 'Areas');
  const areas = await rowBoxes(front);
  await front.locator('.fs-tag-toggle', { hasText: 'LLC' }).tap();
  expect(await rowBoxes(front)).toEqual(areas);
  await front.locator('.fs-tag-toggle', { hasText: 'LLC' }).tap();
  await back(page);
  front = sheetFront(page);
  const menu = await rowBoxes(front);
  await front.getByRole('switch', { name: 'Versions' }).check();
  expect(await rowBoxes(front)).toEqual(menu);
  await front.getByRole('switch', { name: 'Versions' }).uncheck();
  // Every target in the sheet is 44px or more.
  // The switch's whole row is its label, so the row is the target.
  expect((await box(front.locator('.fs-toggle[data-kind="versions"]'))).height).toBe(56);
  front = await sheetPage(page, 'Areas');
  for (const target of [
    front.getByRole('button', { name: 'Back' }),
    front.getByRole('button', { name: 'New area' }),
    front.getByRole('button', { name: 'Select all' }),
    front.getByRole('button', { name: 'Edit LLC' }),
    front.locator('.fs-tag-toggle', { hasText: 'LLC' }),
  ]) {
    expect((await box(target)).height).toBeGreaterThanOrEqual(44);
  }
});

test('search narrows the kinds and toggles areas and topics in place', async ({ page }) => {
  await bootLong(page, 0);
  const sheet = await openFilter(page);
  await page.waitForTimeout(650);
  const front = sheetFront(page);
  const height = (await box(sheet)).height;
  const field = sheet.getByLabel('Search filters');
  await field.fill('ed');
  await expect(front.locator('.fs-nav .fs-text, .fs-toggle .fs-text')).toHaveText([
    'Created',
    'Added',
    'Modified',
    'Signed',
  ]);
  // Fewer rows never shrink the sheet: the field stays where the thumb left it.
  expect(round((await box(sheet)).height)).toBe(round(height));
  await field.fill('heal');
  await expect(front.locator('.fs-label')).toHaveText(['Topics']);
  const health = front.locator('.fs-tag-toggle', { hasText: 'Health' });
  await expect(health).toContainText('Personal');
  await health.tap();
  await expect(health).toHaveAttribute('aria-pressed', 'true');
  await expect(rowTitles(page)).toHaveText(['Joint tax return', 'Health insurance']);
  await field.fill('llc');
  await front.locator('.fs-tag-toggle', { hasText: 'LLC' }).tap();
  // Health sits under Personal, which is not chosen: its choice no longer filters.
  await expect(rowTitles(page)).toHaveCount(6);
  await field.fill('tax');
  // A topic outside the chosen areas brings its area along.
  await front.locator('.fs-tag-toggle', { hasText: 'Tax' }).tap();
  await expect(rowTitles(page)).toHaveText(['Joint tax return', 'EIN letter']);
  await field.fill('zzz');
  await expect(front.locator('.fs-empty')).toHaveText('No matches');
  await field.fill('');
  await expect(front.locator('.fs-row')).toHaveCount(11);
  await closeTaxonomy(page, test.info());
});

test('a page slides in with the drawer curve and back; focus follows', async ({ page }) => {
  await bootLong(page, 0);
  await openFilter(page);
  await page.waitForTimeout(650);
  await recordAnimations(page);
  const front = sheetFront(page);
  await front.locator('.fs-nav[data-kind="topics"]').tap();
  // Mid-slide both pages are there; only the new one can be used.
  await expect(page.locator('.fs-page[data-leave="forward"][inert]')).toHaveCount(1);
  const duration = await page.evaluate(
    () => getComputedStyle(document.querySelector('.fs-page[data-enter]')!).transitionDuration,
  );
  expect(duration).toBe('0.28s, 0.28s');
  await expect(page.locator('.fs-page')).toHaveCount(1);
  await expect(front.getByRole('button', { name: 'Back' })).toBeFocused();
  await front.getByRole('button', { name: 'Back' }).tap();
  await expect(page.locator('.fs-page')).toHaveCount(1);
  await expect(front.locator('.fs-nav[data-kind="topics"]')).toBeFocused();
  const seen = await animationsSeen(page);
  expect(anyAnimation(seen, /fs-page transition:transform/), seen.join('\n')).toBe(true);
  // Only transform and opacity move.
  expect(
    seen.filter((s) => s.includes('fs-page') && !/transition:(transform|opacity)/.test(s)),
  ).toEqual([]);
  await expectStable(page, 'sheet pages', 400);
});

test('a page opened by a key is there at once; reduced motion fades', async ({ page }) => {
  await bootLong(page, 0);
  await page.locator('.topbar-filter').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
  const row = sheetFront(page).locator('.fs-nav[data-kind="sort"]');
  await row.focus();
  await recordAnimations(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.fs-page')).toHaveCount(1);
  await expect(page.locator('.fs-page[data-page="sort"]')).not.toHaveAttribute('data-enter');
  await expect(sheetFront(page).getByRole('button', { name: 'Back' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.fs-page[data-page="menu"]')).toHaveCount(1);
  await expect(row).toBeFocused();
  expect((await animationsSeen(page)).filter((s) => s.includes('fs-page'))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer-root')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFilter(page);
  await page.waitForTimeout(400);
  await recordAnimations(page);
  await sheetFront(page).locator('.fs-nav[data-kind="type"]').tap();
  await page.waitForTimeout(400);
  const seen = (await animationsSeen(page)).filter((s) => s.includes('fs-page'));
  expect(anyAnimation(seen, 'transition:opacity'), seen.join('\n')).toBe(true);
  expect(anyAnimation(seen, 'transition:transform'), seen.join('\n')).toBe(false);
});

test('the drawer is a dialog: focus goes in and stays in, Escape returns it', async ({ page }) => {
  await bootLong(page, 0);
  const filter = page.locator('.topbar-filter');
  await filter.tap();
  const sheet = page.getByRole('dialog', { name: 'Filter' });
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  const inside = () => page.evaluate(() => !!document.activeElement?.closest('.drawer') || false);
  await expect.poll(inside).toBe(true);
  // The page behind is inert: Tab, forward or back, never leaves the drawer.
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press(key);
      expect(await inside(), `${key} ${i}`).toBe(true);
    }
  }
  // On a page too.
  await sheetFront(page).locator('.fs-nav[data-kind="areas"]').focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await inside(), `page Tab ${i}`).toBe(true);
  }
  expect(await page.evaluate(() => document.querySelector('.shell')?.hasAttribute('inert'))).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expect(filter).toBeFocused();
  expect(await page.evaluate(() => document.querySelector('.shell')?.hasAttribute('inert'))).toBe(
    false,
  );
});

test('a drag dismisses the drawer: slow past 40%, or a short flick; a short slow drag snaps back', async ({
  page,
}) => {
  await bootLong(page, 0);
  const open = async () => {
    await page.locator('.topbar-filter').tap();
    await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
    await page.waitForTimeout(650);
  };
  const grip = () => center(page.locator('.drawer-grip'));
  const sheet = page.locator('.drawer');

  // A short, slow drag: the drawer follows the finger, the scrim follows the drawer, it snaps back.
  await open();
  const rest = (await sheet.boundingBox())!;
  const start = await grip();
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: y === undefined ? [] : [{ x: start.x, y }],
    });
  await send('touchStart', start.y);
  for (let i = 1; i <= 6; i++) {
    await send('touchMove', start.y + 25 * i);
    await page.waitForTimeout(60);
  }
  const mid = (await sheet.boundingBox())!;
  expect(Math.round(mid.y - rest.y)).toBe(150);
  const scrimOpacity = await page.evaluate(() =>
    Number(getComputedStyle(document.querySelector('.drawer-scrim')!).opacity),
  );
  expect(scrimOpacity).toBeLessThan(0.9);
  await send('touchEnd');
  await cdp.detach();
  await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
  await expect
    .poll(async () => Math.round((await sheet.boundingBox())!.y - rest.y), { timeout: 3000 })
    .toBe(0);

  // Slow, past 40% of the height: dismissed.
  await touchDrag(page, await grip(), 420, 900);
  await expect(page.locator('.drawer-root')).toHaveCount(0);

  // Fast and short: a flick dismisses.
  await open();
  await touchDrag(page, await grip(), 70, 50);
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expect(page.locator('.topbar-filter')).toBeFocused();

  // A page's header is a grip too.
  await open();
  await sheetFront(page).locator('.fs-nav[data-kind="type"]').tap();
  await page.waitForTimeout(400);
  const title = await center(sheetFront(page).locator('.fs-title'));
  await touchDrag(page, title, 90, 60);
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expectStable(page, 'drawer drags', 600);
});

test('the list behind the Filter drawer changes under it, never through it', async ({ page }) => {
  await bootLong(page, 0);
  await openFilter(page);
  // Every value the root's cross-fade marker takes while the owner taps filters.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __vt: string[] }).__vt = seen;
    new MutationObserver(() => {
      const value = document.documentElement.dataset['vt'];
      if (value) seen.push(value);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-vt'] });
  });
  let front = await sheetPage(page, 'Areas');
  await front.locator('.fs-tag-toggle', { hasText: 'Personal' }).tap();
  await expect(rowTitles(page)).toHaveText(PERSONAL);
  front = await sheetPage(page, 'Topics');
  await front.locator('.fs-tag-toggle', { hasText: 'Health' }).tap();
  await expect(rowTitles(page)).toHaveText(['Joint tax return', 'Health insurance']);
  front = await sheetPage(page, 'Sort');
  await front.getByRole('radio', { name: 'Title' }).tap();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as { __vt: string[] }).__vt)).toEqual([]);
  // The drawer stays drawn above the list the whole time.
  await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
  await stepStable(page, 'drawer taps', 400);
});
