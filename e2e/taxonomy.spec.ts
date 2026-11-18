import { expect, test } from '@playwright/test';
import { expectStable, isMobile } from './helpers';
import {
  boot,
  closeTaxonomy,
  heightOf,
  press,
  rowTitles,
  subheads,
  tagToggle,
  taxonomy,
} from './f2';

const ALL = [
  'Draft contract',
  'Joint tax return',
  'Apartment lease',
  'Health insurance',
  'Bank statement',
  'Meeting notes',
  'Operating agreement',
  'EIN letter',
  'Stripe agreement',
  'Photo ID',
];

test('areas and topics: OR inside a group, AND between groups', async ({ page }, info) => {
  await boot(page);
  // The rail on desktop; the Areas and the Topics pages of the filter sheet on a phone.
  const areas = () => taxonomy(page, info, 'areas');
  const topics = () => taxonomy(page, info, 'topics');
  let tax = await areas();
  await expect(rowTitles(page)).toHaveText(ALL);
  await expect(tagToggle(tax, 'LLC')).toContainText('9');
  await expect(tagToggle(tax, 'Personal')).toContainText('4');

  // No area chosen: every topic shows, grouped by area.
  await expect(subheads(await topics())).toHaveText(['LLC', 'Personal']);

  tax = await areas();
  await press(tagToggle(tax, 'LLC'), info);
  await expect(tagToggle(tax, 'LLC')).toHaveAttribute('aria-pressed', 'true');
  await expect(rowTitles(page)).toHaveText([
    'Draft contract',
    'Joint tax return',
    'Bank statement',
    'Meeting notes',
    'Operating agreement',
    'EIN letter',
    'Stripe agreement',
  ]);
  // One area: only its topics, no subheader.
  tax = await topics();
  await expect(subheads(tax)).toHaveCount(0);
  await expect(tagToggle(tax, 'Health')).toHaveCount(0);

  await press(tagToggle(tax, 'Draft'), info);
  await expect(rowTitles(page)).toHaveText(['Draft contract']);
  await press(tagToggle(tax, 'Draft'), info);
  await press(tagToggle(tax, 'Tax'), info);
  await expect(rowTitles(page)).toHaveText(['Joint tax return', 'EIN letter']);
  await press(tagToggle(tax, 'Banking'), info);
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Bank statement',
    'EIN letter',
    'Stripe agreement',
  ]);

  // A second area widens the areas group and adds its topics under a subheader.
  await press(tagToggle(await areas(), 'Personal'), info);
  tax = await topics();
  await expect(subheads(tax)).toHaveText(['LLC', 'Personal']);
  await press(tagToggle(tax, 'Health'), info);
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Health insurance',
    'Bank statement',
    'EIN letter',
    'Stripe agreement',
  ]);

  // Dropping an area drops its topic selection too.
  await press(tagToggle(await areas(), 'Personal'), info);
  await expect(tagToggle(await topics(), 'Health')).toHaveCount(0);
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Bank statement',
    'EIN letter',
    'Stripe agreement',
  ]);
  await closeTaxonomy(page, info);
  await expectStable(page, `${info.project.name} areas and topics`, 600);
});

test('Clear all resets filters, and selections survive a reload', async ({ page }, info) => {
  await boot(page);
  // The rail has a head per group; a page of the phone's sheet has one group.
  const head = async (kind: 'areas' | 'topics') => {
    const root = await taxonomy(page, info, kind);
    const mobile = isMobile(info);
    return root
      .locator(mobile ? '.fs-actions' : '.tag-head')
      .nth(mobile || kind === 'areas' ? 0 : 1);
  };
  const pressed = '.tag-toggle[aria-pressed="true"], .fs-tag-toggle[aria-pressed="true"]';
  let tax = await taxonomy(page, info);
  if (!isMobile(info)) await expect(tax.getByRole('button', { name: 'Select all' })).toHaveCount(0);
  await press(tagToggle(tax, 'LLC'), info);
  await expect(tax.locator(pressed)).toHaveCount(1);
  await (await head('areas')).getByRole('button', { name: 'Clear all' }).click();
  await expect(tax.locator(pressed)).toHaveCount(0);
  await expect(rowTitles(page)).toHaveText(ALL);

  await press(tagToggle(tax, 'LLC'), info);
  tax = await taxonomy(page, info, 'topics');
  await press(tagToggle(tax, 'Tax'), info);
  await press(tagToggle(tax, 'Banking'), info);
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Bank statement',
    'EIN letter',
    'Stripe agreement',
  ]);
  await closeTaxonomy(page, info);

  await page.reload();
  await expect(rowTitles(page).first()).toBeVisible();
  await expect(rowTitles(page)).toHaveText([
    'Joint tax return',
    'Bank statement',
    'EIN letter',
    'Stripe agreement',
  ]);
  tax = await taxonomy(page, info);
  await expect(tagToggle(tax, 'LLC')).toHaveAttribute('aria-pressed', 'true');
  tax = await taxonomy(page, info, 'topics');
  await expect(tagToggle(tax, 'Tax')).toHaveAttribute('aria-pressed', 'true');
  await expect(tagToggle(tax, 'Health')).toHaveCount(0);

  await (await head('topics')).getByRole('button', { name: 'Clear all' }).click();
  await (await head('areas')).getByRole('button', { name: 'Clear all' }).click();
  await expect(rowTitles(page)).toHaveText(ALL);
  await closeTaxonomy(page, info);
  await expectStable(page, `${info.project.name} clear all and reload`, 600);
});

test('tag icons show in place of the dot and every target is 44px on touch', async ({
  page,
}, info) => {
  await boot(page);
  const tax = await taxonomy(page, info);
  // LLC has a stored icon, Personal has none.
  await expect(tagToggle(tax, 'LLC').locator('.glyph svg')).toHaveCount(1);
  await expect(tagToggle(tax, 'Personal').locator('.glyph .dot')).toHaveCount(1);
  if (!isMobile(info)) return;
  for (const target of [
    tagToggle(tax, 'LLC'),
    tax.getByRole('button', { name: 'Edit LLC' }),
    tax.getByRole('button', { name: 'New area' }),
    tax.getByRole('button', { name: 'Select all' }).first(),
  ]) {
    expect(await heightOf(target)).toBeGreaterThanOrEqual(44);
  }
});

test('Sensitive is a marker: a lock on the row, never an area or a topic', async ({
  page,
}, info) => {
  await boot(page);
  const tax = await taxonomy(page, info);
  const toggles = '.tag-toggle, .fs-tag-toggle';
  await expect(tax.locator(toggles, { hasText: 'Sensitive' })).toHaveCount(0);
  const topics = await taxonomy(page, info, 'topics');
  await expect(topics.locator(toggles, { hasText: 'Sensitive' })).toHaveCount(0);
  const row = page.locator('.list-scroll .row', { hasText: 'Apartment lease' });
  await expect(row.getByRole('img', { name: 'Sensitive' })).toBeVisible();
  await expect(
    page
      .locator('.list-scroll .row', { hasText: 'Photo ID' })
      .getByRole('img', { name: 'Sensitive' }),
  ).toHaveCount(0);
});
