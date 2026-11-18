import { expect, test, type Page } from '@playwright/test';
import { boot } from './f2';
import { mockApi } from './fixture';
import { isMobile } from './helpers';

async function openCommands(page: Page) {
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog.getByRole('combobox')).toBeFocused();
  return dialog;
}

test('the empty palette remembers opened records and clears active filters', async ({
  page,
}, info) => {
  test.skip(isMobile(info), 'desktop commands');
  await boot(page);
  await page.locator('.list-scroll .row[data-id="104"]').click();
  await expect(page.locator('.pane-title h1')).toHaveText('Bank statement');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  const area = page.locator('.rail .tag-toggle').filter({ hasText: 'LLC' });
  await area.click();
  await expect(area).toHaveAttribute('aria-pressed', 'true');
  const commands = await openCommands(page);
  await expect(commands.getByRole('option').first()).toContainText('Bank statement');
  await commands.getByRole('option', { name: 'Clear filters' }).click();
  await expect(area).toHaveAttribute('aria-pressed', 'false');
  await expect(commands).toHaveCount(0);
  await openCommands(page);
  await expect(commands.getByRole('option', { name: 'Clear filters' })).toHaveCount(0);
  await commands.getByRole('option', { name: 'Go to Recovery' }).click();
  await expect(page).toHaveURL(/\/recovery$/);
});

test('record commands use the selected version while typing still searches all records', async ({
  page,
  context,
}, info) => {
  test.skip(isMobile(info), 'desktop commands and clipboard');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page, '/r/101?v=1011');
  const commands = await openCommands(page);
  await expect(commands.locator('.palette-context')).toHaveText('Operating agreement');
  await expect(commands.getByRole('option')).toHaveText([
    'Download selected version',
    'Copy link',
    'Open versions',
  ]);
  await commands.getByRole('option', { name: 'Copy link' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/\/r\/101\?v=1011$/);

  await openCommands(page);
  const downloaded = page.waitForEvent('download');
  await commands.getByRole('option', { name: 'Download selected version' }).click();
  const downloadUrl = new URL((await downloaded).url());
  expect(downloadUrl.pathname).toBe('/api/documents/101/download/');
  expect(downloadUrl.searchParams.get('version')).toBe('1011');

  await openCommands(page);
  await commands.getByRole('option', { name: 'Open versions' }).click();
  await expect(commands.getByRole('option', { name: /Draft.*Selected/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(commands.getByRole('option', { name: 'Copy link' })).toBeVisible();
  await commands.getByRole('option', { name: 'Open versions' }).click();
  await commands.getByRole('option', { name: 'Signed copy' }).click();
  await expect(page).toHaveURL(/\/r\/101\?v=1012$/);

  await openCommands(page);
  await commands.getByRole('combobox').fill('bank statement');
  await expect(commands.getByRole('option', { name: /Bank statement/ })).toBeVisible();
  await expect(commands.getByRole('option', { name: 'Copy link' })).toHaveCount(0);
});

test('a record fetched outside the list index still has its own commands', async ({
  page,
}, info) => {
  test.skip(isMobile(info), 'desktop commands');
  const api = await mockApi(page);
  await page.route('**/api/documents/?page_size=*', (route) => {
    const results = api.docs.filter(({ id }) => id !== 101);
    return route.fulfill({ json: { count: results.length, next: null, results } });
  });
  await page.goto('/r/101');
  await expect(page.locator('.pane-title h1')).toHaveText('Operating agreement');
  const commands = await openCommands(page);
  await expect(commands.locator('.palette-context')).toHaveText('Operating agreement');
  await expect(commands.getByRole('option', { name: 'Download selected version' })).toBeVisible();
});
