import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { trackCls } from './cls';
import { mockApi, type Api } from './fixture';
import { isMobile, waitForRows } from './helpers';

/** Load the app over the mocked API, with layout shifts tracked from the first frame. */
export async function boot(page: Page, path = '/'): Promise<Api> {
  await trackCls(page);
  const api = await mockApi(page);
  await page.goto(path);
  if (path.startsWith('/r/')) await expect(page.locator('.pane-title h1')).toBeVisible();
  else await waitForRows(page);
  return api;
}

/** A click on desktop, a tap on the phone. */
export async function press(target: Locator, info: TestInfo): Promise<void> {
  if (isMobile(info)) await target.tap();
  else await target.click();
}

/** The row titles in list order. */
export const rowTitles = (page: Page) => page.locator('.list-scroll .row-title');

/** The phone's filter sheet, on its menu when it opens. Opens it if closed. */
export async function openFilter(page: Page): Promise<Locator> {
  const sheet = page.getByRole('dialog', { name: 'Filter' });
  if ((await page.locator('.drawer-root[data-state="open"]').count()) === 0) {
    // A drawer that is still leaving cannot be reused: wait for it to go.
    await expect(page.locator('.drawer-root')).toHaveCount(0);
    await page.getByRole('button', { name: 'Filter' }).tap();
  }
  await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
  return sheet;
}

/** The page of the filter sheet in front: the menu, or the page a row opened. */
export const sheetFront = (page: Page) =>
  page.getByRole('dialog', { name: 'Filter' }).locator('.fs-page:not([inert])');

/** The menu of the phone's filter sheet. Opens the sheet, and goes back from a page. */
export async function sheetMenu(page: Page): Promise<Locator> {
  await openFilter(page);
  const front = sheetFront(page);
  if ((await front.locator('.fs-title').count()) > 0) {
    await front.getByRole('button', { name: 'Back', exact: true }).tap();
    await expect(front.locator('.fs-search')).toBeVisible();
  }
  return front;
}

/**
 * One page of the phone's filter sheet ('Areas', 'Topics', 'Created', 'Size', 'Type', 'Sort'…),
 * opened from the menu. Opens the sheet first, and goes back from another page.
 */
export async function sheetPage(page: Page, title: string): Promise<Locator> {
  await openFilter(page);
  const current = sheetFront(page).locator('.fs-title');
  if ((await current.count()) > 0 && (await current.innerText()) === title) return sheetFront(page);
  const front = await sheetMenu(page);
  await front.locator(`.fs-nav[data-kind="${title.toLowerCase()}"]`).tap();
  await expect(current).toHaveText(title);
  return front;
}

/**
 * Where the areas and topics live: the rail on desktop; on a phone, the Areas or the Topics page
 * of the filter sheet.
 */
export async function taxonomy(
  page: Page,
  info: TestInfo,
  kind: 'areas' | 'topics' = 'areas',
): Promise<Locator> {
  if (!isMobile(info)) return page.locator('.rail');
  return sheetPage(page, kind === 'areas' ? 'Areas' : 'Topics');
}

/** The labels over the topic groups, one per area. */
export const subheads = (root: Locator) => root.locator('.tag-subhead, .fs-section .fs-label');

export async function closeTaxonomy(page: Page, info: TestInfo): Promise<void> {
  if (!isMobile(info)) return;
  if ((await page.locator('.drawer-root[data-state="open"]').count()) > 0) {
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('.drawer-root')).toHaveCount(0);
}

const tagName = (page: Page, name: string) =>
  page.locator(`.tag-name:text-is("${name}"), .fs-tag-name:text-is("${name}")`);

/** The button of one tag row, by name: in the rail, or on a page of the phone's filter sheet. */
export const tagToggle = (root: Locator, name: string) =>
  root.locator('.tag-toggle, .fs-tag-toggle', { has: tagName(root.page(), name) });

export async function editRow(root: Locator, page: Page, name: string, info: TestInfo) {
  const row = root.locator('.tag-row, .fs-tag').filter({ has: tagName(page, name) });
  if (isMobile(info)) await row.getByRole('button', { name: `Edit ${name}` }).tap();
  else await row.click({ button: 'right' });
  await expect(page.locator('.tag-menu')).toBeVisible();
}

export async function heightOf(target: Locator): Promise<number> {
  return Math.round((await target.boundingBox())!.height);
}

/** The active filters: the desktop toolbar's chips, or the phone header's chip row. */
export const chipsOf = (page: Page) => page.locator('.chips .chip, .topbar-chips .chip');

/**
 * A filter field: in the open desktop Filter menu, or on its page of the phone's filter sheet
 * ('menu' for the switches on the sheet's first page).
 */
export async function filterField(
  page: Page,
  info: TestInfo,
  sheet: string,
  label: string,
): Promise<Locator> {
  if (!isMobile(info)) return page.locator('.filter-panel').getByLabel(label);
  const front = sheet === 'menu' ? await sheetMenu(page) : await sheetPage(page, sheet);
  return front.getByLabel(label);
}

/** The type: a select in the desktop menu, a list of choices on the phone. */
export async function chooseType(page: Page, info: TestInfo, mime: string, name: string) {
  if (!isMobile(info)) {
    await page.locator('.filter-panel').getByLabel('Type').selectOption(mime);
    return;
  }
  await (await sheetPage(page, 'Type')).getByRole('radio', { name, exact: true }).tap();
}

/** Superseded: a switch in the desktop menu, under the header's More menu on the phone. */
export async function showSuperseded(page: Page, info: TestInfo) {
  if (!isMobile(info)) {
    await page.locator('.filter-panel').getByLabel('Superseded').check();
    return;
  }
  await closeTaxonomy(page, info);
  await page.getByRole('button', { name: 'More' }).tap();
  await page.getByRole('menuitemcheckbox', { name: 'Superseded' }).tap();
  await page.keyboard.press('Escape');
}
