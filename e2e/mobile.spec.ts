import { expect, test, type Locator, type Page } from '@playwright/test';
import { CLS_LIMIT, readCls, resetCls } from './cls';
import { closeTaxonomy, openFilter, rowTitles } from './f2';
import { expectStable, stepStable } from './helpers';
import {
  animationsSeen,
  anyAnimation,
  bootLong,
  center,
  recordAnimations,
  touchDrag,
} from './motion-helpers';

test.skip(({ isMobile }) => !isMobile, 'the phone layout');

const VIEWPORT = { width: 390, height: 844 };

/** The part of a 40px control that takes a tap: its box and the hit area around it. */
async function hitArea(target: Locator): Promise<{ width: number; height: number }> {
  return target.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const hits = (px: number, py: number) => el.contains(document.elementFromPoint(px, py));
    let top = 0;
    let bottom = 0;
    let left = 0;
    let right = 0;
    while (hits(x, y - top - 1)) top++;
    while (hits(x, y + bottom + 1)) bottom++;
    while (hits(x - left - 1, y)) left++;
    while (hits(x + right + 1, y)) right++;
    return { width: left + right + 1, height: top + bottom + 1 };
  });
}

test('the floating bar: a Search capsule and a round Upload button over the list', async ({
  page,
}) => {
  await bootLong(page);
  const [search, upload] = await Promise.all([
    page.locator('.bottombar-search').boundingBox(),
    page.locator('.bottombar-upload').boundingBox(),
  ]);
  expect(search!.height).toBe(56);
  expect(upload!).toMatchObject({ width: 56, height: 56 });
  expect(search!.x).toBe(16);
  expect(Math.round(upload!.x + upload!.width)).toBe(VIEWPORT.width - 16);
  expect(Math.round(search!.y + search!.height)).toBe(VIEWPORT.height - 12);
  await expect(page.locator('.bottombar-search')).toHaveText('Search');
  await expect(page.locator('.bottombar-upload')).toHaveAccessibleName('Upload');
  // The list scrolls under the bar and ends clear of it.
  const scroller = page.locator('.list-scroll');
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const last = (await page.locator('.list-scroll .row[data-id]').last().boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(search!.y - 16 + 1);
  await scroller.evaluate((el) => (el.scrollTop = 0));
  await expectStable(page, 'floating bar', 500);
});

test('Current and Drafts are pills under the title; the active one holds Filter', async ({
  page,
}) => {
  await bootLong(page);
  const pills = page.locator('.segments .segment-link');
  await expect(pills).toHaveText(['Current', 'Drafts']);
  for (const pill of await pills.all()) {
    expect((await pill.boundingBox())!.height).toBe(40);
    expect((await hitArea(pill)).height).toBeGreaterThanOrEqual(44);
  }
  const filter = page.locator('.segment[data-active] .topbar-filter');
  const area = await hitArea(filter);
  expect(area.width).toBeGreaterThanOrEqual(44);
  expect(area.height).toBeGreaterThanOrEqual(44);
  await expect(pills.first()).toHaveAttribute('aria-current', 'page');
  await resetCls(page);
  await pills.nth(1).tap();
  await expect(page).toHaveURL(/\/pending$/);
  await expect(page.locator('.topbar-title')).toHaveText('Records');
  await expect(page.locator('.segments .segment-link').nth(1)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.segment[data-active] .segment-link')).toHaveText('Drafts');
  await stepStable(page, 'pill to Drafts', 500);
  await page.locator('.segments .segment-link').first().tap();
  await expect(page).toHaveURL(/\/$/);
  await expectStable(page, 'pills', 500);
});

/** Sort by title in the Filter sheet, on its own page if the sheet has one. */
async function sortByTitle(page: Page): Promise<void> {
  const sheet = await openFilter(page);
  const title = sheet.getByRole('radio', { name: 'Title' });
  if (!(await title.isVisible())) await sheet.getByRole('button', { name: /^Sort/ }).tap();
  await title.tap();
}

test('the list: month headers over one-line 52px rows; a title sort is flat', async ({
  page,
}, info) => {
  await bootLong(page);
  const heads = page.locator('.list-scroll .prow-head');
  await expect(heads.first()).toHaveText('July 2026');
  await expect(heads.last()).toHaveText('January 2025');
  const segments = (await page.locator('.segments').boundingBox())!;
  const head = (await heads.first().boundingBox())!;
  expect(head.height).toBe(40);
  expect(Math.round(head.y - (segments.y + segments.height))).toBe(8);
  const row = page.locator('.list-scroll .row[data-id]').first();
  expect((await row.boundingBox())!.height).toBe(52);
  await expect(row.locator('.row-title')).toHaveCSS('font-size', '17px');
  await expect(row.locator('.pill')).toHaveCount(0);
  // A date of this year has no year; Operating agreement shows Signed and its 3 versions.
  const thisYear = new Date().getFullYear() === 2026;
  await expect(row.locator('.row-date')).toHaveText(thisYear ? 'Jul 1' : 'Jul 1, 2026');
  const agreement = page.locator('.list-scroll .row', { hasText: 'Operating agreement' });
  await expect(agreement.getByRole('img', { name: 'Signed' })).toBeVisible();
  await expect(agreement.locator('.row-versions')).toHaveText('3');
  await expect(page.locator('.list-scroll .row', { hasText: 'Filler record 00' })).toContainText(
    'Jan 1, 2025',
  );
  await resetCls(page);
  await sortByTitle(page);
  await closeTaxonomy(page, info);
  await expect(heads).toHaveCount(0);
  await expect(rowTitles(page).first()).toHaveText('Stripe agreement');
  // The sheet covers the page and may change its own height; nothing behind it moves.
  await page.waitForTimeout(600);
  const behind = (await readCls(page)).shifts.filter(
    (shift) => !shift.sources.every((source) => source.node.includes('drawer')),
  );
  expect(behind.reduce((sum, shift) => sum + shift.value, 0)).toBeLessThanOrEqual(CLS_LIMIT);
});

test('Search opens the full-screen palette with the keyboard up; Upload opens the picker', async ({
  page,
}) => {
  await bootLong(page);
  await page.waitForTimeout(600);
  await resetCls(page);
  await page.locator('.bottombar-search').tap();
  const palette = page.locator('.palette');
  await expect(palette).toBeVisible();
  await expect(page.locator('.palette input')).toBeFocused();
  await expect(page.locator('.bottombar')).toBeHidden();
  await page.waitForTimeout(400);
  const box = (await palette.boundingBox())!;
  expect(Math.round(box.width)).toBe(VIEWPORT.width);
  expect(Math.round(box.height)).toBe(VIEWPORT.height);
  await page.locator('.palette input').fill('operating');
  await expect(page.locator('.result').first()).toBeVisible();
  const close = page.getByRole('button', { name: 'Close' });
  expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await close.tap();
  await expect(palette).toHaveCount(0);
  await expect(page.locator('.bottombar-search')).toBeFocused();
  await expectStable(page, 'search capsule', 500);

  const chooser = page.waitForEvent('filechooser');
  await page.locator('.bottombar-upload').tap();
  await chooser;
});

test('the header: a large title, Filter in the pill, and Recovery and Superseded under ⋯', async ({
  page,
}) => {
  await bootLong(page);
  const title = page.locator('.topbar-title');
  await expect(title).toHaveText('Records');
  await expect(title).toHaveCSS('font-size', '28px');
  const more = page.getByRole('button', { name: 'More' });
  expect((await more.boundingBox())!).toMatchObject({ width: 44, height: 44 });

  // The Filter button opens the sheet; the floating bar steps aside while it is open.
  await page.locator('.topbar-filter').tap();
  await expect(page.getByRole('dialog', { name: 'Filter' })).toBeVisible();
  await expect(page.locator('.bottombar')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await expect(page.locator('.bottombar')).toBeVisible();
  await stepStable(page, 'filter sheet from the pill', 600);

  // Superseded: the same switch the desktop has. Its rows show muted, with the archive mark.
  await more.tap();
  const superseded = page.getByRole('menuitemcheckbox', { name: 'Superseded' });
  await expect(superseded).toHaveAttribute('aria-checked', 'false');
  await superseded.tap();
  await expect(superseded).toHaveAttribute('aria-checked', 'true');
  const old = page.locator('.list-scroll .row[data-superseded]', { hasText: 'EIN letter scan' });
  await expect(old.getByRole('img', { name: 'Superseded' })).toBeVisible();
  await expect(page.locator('.topbar .chip')).toHaveText(['Superseded']);
  await page.keyboard.press('Escape');
  await stepStable(page, 'superseded on', 500);
  await page.getByRole('button', { name: 'Remove Superseded' }).tap();
  await expect(page.locator('.list-scroll .row[data-superseded]')).toHaveCount(0);
  await expect(page.locator('.topbar-chips')).toHaveCount(0);
  await stepStable(page, 'superseded off', 500);

  // Recovery: no pills; the menu leads back to Records.
  await more.tap();
  await page.getByRole('menuitem', { name: 'Recovery' }).tap();
  await expect(page).toHaveURL(/\/recovery$/);
  await expect(title).toHaveText('Recovery');
  await expect(page.locator('.segments')).toHaveCount(0);
  await stepStable(page, 'recovery from the menu', 700);
  await more.tap();
  await page.getByRole('menuitem', { name: 'Records' }).tap();
  await expect(page).toHaveURL(/\/$/);
  await expectStable(page, 'records from the menu', 700);
});

// The filter sheet's own tests (its pages, focus, drags, the list behind it) are in
// mobile-filter.spec.ts.

test('the record is a sheet over the list: thumb-zone actions, drag to dismiss, list position kept', async ({
  page,
}) => {
  await bootLong(page);
  const scroller = page.locator('.list-scroll');
  await scroller.evaluate((el) => (el.scrollTop = 240));
  const before = await scroller.evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(100);
  const firstVisible = page.locator('.list-scroll .row[data-id]').nth(6);
  const title = await firstVisible.locator('.row-title').innerText();
  await resetCls(page);
  await firstVisible.tap();
  const sheet = page.getByRole('dialog', { name: 'Record' });
  await expect(sheet).toBeVisible();
  await expect(page.locator('.pane-title h1')).toHaveText(title);
  await page.waitForTimeout(650);
  // The list stays mounted and visible behind the sheet.
  await expect(page.locator('.list-col')).toBeVisible();
  // Download and Copy link sit in the lower third, 44px tall.
  for (const name of ['Download', 'Copy link']) {
    const button = page.locator('.pane-actions:visible .btn', { hasText: name });
    const box = (await button.boundingBox())!;
    expect(box.y, name).toBeGreaterThan(VIEWPORT.height * 0.66);
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
  await expectStable(page, 'open record sheet', 500);

  const dismissals: [string, () => Promise<unknown>][] = [
    [
      'drag from the header',
      // The free strip at the top of the header: the title line, marks and status are controls.
      async () => {
        const head = (await page.locator('.pane-head').boundingBox())!;
        await touchDrag(page, { x: head.x + head.width / 2, y: head.y + 3 }, 380, 600);
      },
    ],
    [
      'flick from the grip',
      async () => touchDrag(page, await center(page.locator('.drawer-grip')), 90, 60),
    ],
    ['Escape', () => page.keyboard.press('Escape')],
    ['the scrim', () => page.mouse.click(200, 5)],
    ['Back', () => page.getByRole('button', { name: 'Back' }).tap()],
    ['the browser back button', () => page.goBack()],
  ];
  for (const [index, [how, dismiss]] of dismissals.entries()) {
    if (index > 0) {
      await page.locator('.list-scroll .row[data-id]').nth(6).tap();
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(650);
    }
    await dismiss();
    await expect(page.locator('.drawer-root'), how).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    expect(await scroller.evaluate((el) => el.scrollTop), `${how}: list position`).toBe(before);
  }
  await expectStable(page, 'record sheet dismissals', 700);
});

test('reduced motion: the sheet and the drawer fade, nothing slides in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await bootLong(page, 0);
  await recordAnimations(page);
  await page.locator('.topbar-filter').tap();
  await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer-root')).toHaveCount(0);
  await page.locator('.list-scroll .row[data-id]').first().tap();
  await expect(page.getByRole('dialog', { name: 'Record' })).toBeVisible();
  await page.waitForTimeout(500);
  const seen = await animationsSeen(page);
  expect(anyAnimation(seen, 'opacity'), seen.join('\n')).toBe(true);
  expect(anyAnimation(seen, 'transition:transform'), seen.join('\n')).toBe(false);
  expect(anyAnimation(seen, 'translate'), seen.join('\n')).toBe(false);
  await expectStable(page, 'reduced motion sheets', 500);
});

test('the sheet and the drawer slide in with the drawer curve', async ({ page }) => {
  await bootLong(page, 0);
  await recordAnimations(page);
  await page.locator('.topbar-filter').tap();
  await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
  await page.waitForTimeout(700);
  const seen = await animationsSeen(page);
  expect(anyAnimation(seen, 'drawer--filter transition:transform'), seen.join('\n')).toBe(true);
  const duration = await page.evaluate(
    () => getComputedStyle(document.querySelector('.drawer')!).transitionDuration,
  );
  expect(duration).toBe('0.5s');
  const total = (await readCls(page)).total;
  expect(total).toBeLessThanOrEqual(CLS_LIMIT);
});
