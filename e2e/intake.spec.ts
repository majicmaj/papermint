import { expect, test, type Page } from '@playwright/test';
import { NEW_ID, dropFile } from './mocks';
import { TAG } from './fixture';
import { expectStable, isMobile, settled } from './helpers';
import { boot, press, tagToggle, taxonomy, closeTaxonomy } from './f2';

/** Intake over the mocked API: it never writes to the live archive. */
const confirm = (page: Page) => page.locator('.intake').getByRole('button', { name: 'Confirm' });

test('a dropped file opens a fixed-size filing form: area is required, topics follow the area', async ({
  page,
}, info) => {
  const api = await boot(page, '/pending');
  const firstRow = () => page.locator('.list-scroll .row').first().boundingBox();
  const rowBefore = await firstRow();
  await dropFile(page, 'Tax form 2026.txt');
  const panel = page.locator('.intake');
  await expect(panel).toBeVisible();
  await expect(panel.getByPlaceholder('Title')).toHaveValue('Tax form 2026');
  await expect(panel.getByRole('combobox', { name: 'Status' })).toHaveValue(String(TAG.draft));
  await expect(confirm(page)).toBeDisabled();
  await settled(page);
  const sending = await panel.boundingBox();

  // Two areas and none chosen: no default, and Confirm stays off until one is picked.
  await panel.getByPlaceholder('Title').fill('Tax form 2026 (final)');
  await expect(confirm(page)).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Topics' })).toBeDisabled();
  await press(panel.getByRole('button', { name: 'Area' }), info);
  await expect(page.getByRole('menuitemcheckbox')).toHaveText(['LLC', 'Personal']);
  await press(page.getByRole('menuitemcheckbox', { name: 'LLC' }), info);
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('button', { name: 'Area' })).toContainText('LLC');
  await expect(confirm(page)).toBeEnabled();
  expect(await panel.boundingBox()).toEqual(sending);

  // Only the topics of the chosen area.
  await press(panel.getByRole('button', { name: 'Topics' }), info);
  await expect(page.getByRole('menuitemcheckbox')).toHaveText(['Banking', 'Tax']);
  await press(page.getByRole('menuitemcheckbox', { name: 'Tax' }), info);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `screenshots/${info.project.name}-intake-light.png` });
  await panel.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Current' });
  await press(confirm(page), info);
  await expect(panel).toHaveCount(0);
  expect(await firstRow()).toEqual(rowBefore);
  expect(api.writes.merges).toEqual([]);
  const patch = api.writes.docPatches.find((p) => p.id === NEW_ID)!;
  expect(patch.body['title']).toBe('Tax form 2026 (final)');
  expect((patch.body['tags'] as number[]).sort((a, b) => a - b)).toEqual([
    TAG.current,
    TAG.llc,
    TAG.tax,
  ]);
  await expectStable(page, `${info.project.name} intake filing`, 800);
});

test('the area on screen is the default, and removing it from the choice drops its topics', async ({
  page,
}, info) => {
  const api = await boot(page);
  const tax = await taxonomy(page, info);
  await press(tagToggle(tax, 'Personal'), info);
  await closeTaxonomy(page, info);
  await dropFile(page, 'Insurance card.txt');
  const panel = page.locator('.intake');
  await expect(panel.getByRole('button', { name: 'Area' })).toContainText('Personal');
  await expect(confirm(page)).toBeEnabled({ timeout: 10_000 });
  await press(panel.getByRole('button', { name: 'Topics' }), info);
  await press(page.getByRole('menuitemcheckbox', { name: 'Health' }), info);
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('button', { name: 'Topics' })).toContainText('Health');
  // Swap Personal for LLC: Health belongs to Personal and goes away.
  await press(panel.getByRole('button', { name: 'Area' }), info);
  await press(page.getByRole('menuitemcheckbox', { name: 'LLC' }), info);
  await press(page.getByRole('menuitemcheckbox', { name: 'Personal' }), info);
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('button', { name: 'Topics' })).not.toContainText('Health');
  await press(confirm(page), info);
  await expect(panel).toHaveCount(0);
  const patch = api.writes.docPatches.find((p) => p.id === NEW_ID)!;
  expect((patch.body['tags'] as number[]).sort((a, b) => a - b)).toEqual([TAG.draft, TAG.llc]);
});

test('"Add as version of…" merges into the chosen record and writes nothing else', async ({
  page,
}, info) => {
  const api = await boot(page, '/pending');
  await dropFile(page, 'Operating agreement signed.txt');
  const panel = page.locator('.intake');
  await expect(confirm(page)).toBeDisabled();
  await panel.getByPlaceholder('Add as version of…').fill('operating');
  const option = panel.locator('.picker-item').first();
  await expect(option).toBeVisible();
  const chosen = await option.innerText();
  await page.screenshot({ path: `screenshots/${info.project.name}-intake-picker-light.png` });
  await press(option, info);
  await expect(panel.locator('.field--chosen')).toContainText(chosen);
  // A merge needs no area: the record keeps its own.
  await expect(panel.getByRole('combobox', { name: 'Status' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Area' })).toBeDisabled();
  await expect(confirm(page)).toBeEnabled({ timeout: 10_000 });
  await press(confirm(page), info);
  await expect(page).toHaveURL(/\/r\/101$/);
  expect(api.writes.docPatches.find((p) => p.id === NEW_ID)).toBeUndefined();
  expect(api.writes.merges).toEqual([
    {
      documents: [101, NEW_ID],
      root_document_id: 101,
      version_label: 'Operating agreement signed',
    },
  ]);
  await expectStable(page, `${info.project.name} intake merge`, 800);
});

test('dismissing the form sends nothing', async ({ page }, info) => {
  const api = await boot(page, '/pending');
  await dropFile(page, 'Scratch.txt');
  const panel = page.locator('.intake');
  await expect(panel.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Dismiss' })).toBeEnabled({ timeout: 10_000 });
  await press(panel.getByRole('button', { name: 'Dismiss' }), info);
  await expect(panel).toHaveCount(0);
  expect(api.writes).toEqual({
    tagPosts: [],
    tagPatches: [],
    docPatches: [],
    settingsPosts: [],
    merges: [],
  });
  if (isMobile(info)) await expectStable(page, 'mobile dismiss', 400);
});
