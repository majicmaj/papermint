import { expect, test } from '@playwright/test';
import { SUCCESSOR_FIELD, TAG } from './fixture';
import { actions, expectStable, isMobile } from './helpers';
import { boot, press } from './f2';

async function openStatus(
  page: import('@playwright/test').Page,
  info: import('@playwright/test').TestInfo,
) {
  await press(actions(page).locator('[aria-label="More"]'), info);
  await expect(page.locator('.menu')).toBeVisible();
}

test('the successor picker writes status and link together, to the superseded record only', async ({
  page,
}, info) => {
  const api = await boot(page, '/r/102');
  await openStatus(page, info);
  await press(page.getByRole('menuitemradio', { name: 'Superseded' }), info);
  const picker = page.getByLabel('Search records');
  await expect(picker).toBeFocused();
  // Superseded records and the record itself are never offered.
  await expect(
    page.locator('.successor-picker .menu-item', { hasText: 'EIN letter scan' }),
  ).toHaveCount(0);
  await expect(
    page.locator('.successor-picker .menu-item', { hasText: /^EIN letter$/ }),
  ).toHaveCount(0);
  await picker.fill('operating');
  await expect(page.locator('.successor-picker .menu-item')).toHaveText(['Operating agreement']);
  await press(page.locator('.successor-picker .menu-item').first(), info);
  await expect.poll(() => api.writes.docPatches.length).toBe(1);
  expect(api.writes.docPatches[0]).toEqual({
    id: 102,
    body: {
      tags: [TAG.llc, TAG.tax, TAG.superseded],
      // 109 stays: it is the record this one replaced. 101 is the new successor.
      custom_fields: [{ field: SUCCESSOR_FIELD, value: [109, 101] }],
    },
  });
  await expectStable(page, `${info.project.name} successor picker`, 600);
});

test('a record that leaves Superseded loses its link, and nothing else is written', async ({
  page,
}, info) => {
  const api = await boot(page, '/r/109');
  await openStatus(page, info);
  await press(page.getByRole('menuitemradio', { name: 'Current' }), info);
  await expect.poll(() => api.writes.docPatches.length).toBe(1);
  expect(api.writes.docPatches[0]).toEqual({
    id: 109,
    body: {
      tags: [TAG.llc, TAG.tax, TAG.current],
      custom_fields: [{ field: SUCCESSOR_FIELD, value: [] }],
    },
  });
  await expectStable(page, `${info.project.name} leave superseded`, 600);
});

test('a status change preserves the Draft topic and sends tags only', async ({ page }, info) => {
  const api = await boot(page, '/r/108');
  await openStatus(page, info);
  await press(page.getByRole('menuitemradio', { name: 'Current' }), info);
  await expect.poll(() => api.writes.docPatches.length).toBe(1);
  expect(api.writes.docPatches[0]).toEqual({
    id: 108,
    body: { tags: [TAG.draft, TAG.llc, TAG.current] },
  });
});

test('a phone row of a Superseded record is muted and carries the archive mark', async ({
  page,
}, info) => {
  test.skip(!isMobile(info), 'the phone list');
  await boot(page);
  await page.getByRole('button', { name: 'More' }).tap();
  await page.getByRole('menuitemcheckbox', { name: 'Superseded' }).tap();
  await page.keyboard.press('Escape');
  const row = page.locator('.list-scroll .row', { hasText: 'EIN letter scan' });
  await expect(row).toHaveAttribute('data-superseded', '');
  await expect(row.getByRole('img', { name: 'Superseded' })).toBeVisible();
  const color = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).color);
  const muted = await color('.list-scroll .row[data-superseded] .row-title');
  expect(muted).not.toBe(await color('.list-scroll .row:not([data-superseded]) .row-title'));
  await expectStable(page, 'superseded phone rows', 600);
  // The record names its successor in the sheet.
  await row.tap();
  const sheet = page.getByRole('dialog', { name: 'Record' });
  await expect(sheet.locator('.successor')).toContainText('Superseded by EIN letter');
});

test('a Superseded row names its successor and the name is a link', async ({ page }, info) => {
  test.skip(isMobile(info), 'phone rows are one line: the sheet names the successor');
  await boot(page);
  await press(page.getByRole('button', { name: 'Filter' }), info);
  await page.locator('.filter-panel').getByLabel('Superseded').check();
  await page.keyboard.press('Escape');
  const row = page.locator('.row-wrap', { hasText: 'EIN letter scan' });
  await expect(row.locator('.successor')).toHaveText('Superseded by EIN letter');
  const draft = page.locator('.row-wrap', { hasText: 'Operating agreement draft' });
  await expect(draft.locator('.successor')).toHaveText('Superseded by Operating agreement');
  // Narrow rows give their status line to the successor, so nothing is drawn twice. The wide
  // list is one line per record, so the successor takes a second line under the title.
  await expect(row.locator('.row-meta')).toHaveCSS(
    'visibility',
    isMobile(info) ? 'hidden' : 'visible',
  );
  await expectStable(page, `${info.project.name} superseded row`, 600);
  // Opening the record switches the list to the split layout: that switch has its own test.
  await press(draft.locator('.successor a'), info);
  await expect(page).toHaveURL(/\/r\/101$/);
});
