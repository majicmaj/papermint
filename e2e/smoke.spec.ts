import { type Page } from '@playwright/test';
import { expect, test } from './test';
import { apiDocs, recordWithMismatchedRoot, previewType, versionWithType } from './api';
import { trackCls } from './cls';
import { closeTaxonomy, sheetPage } from './f2';
import { actions, expectStable, isMobile, openPalette, shot, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => {
  await trackCls(page);
});

for (const [name, path] of [
  ['records', '/'],
  ['recovery', '/recovery'],
] as const) {
  test(`${name} view loads without layout shift`, async ({ page }, info) => {
    await page.goto(path);
    await waitForRows(page);
    await expectStable(page, `${info.project.name} ${name}`);
    await shot(page, info, name);
  });
}

test('a legacy Drafts link opens the shared archive', async ({ page }) => {
  await page.goto('/pending');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.list-scroll .row', { hasText: 'Draft contract' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Drafts', exact: true })).toHaveCount(0);
});

test('cold cache load without layout shift', async ({ page }, info) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForRows(page);
  await expectStable(page, `${info.project.name} cold`);
});

/** What the pane really rendered, read from the DOM. */
async function rendered(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const body = document.querySelector('.pane-body');
    const frame = body?.querySelector('iframe');
    if (frame) {
      const src = frame.getAttribute('src')!.split('#')[0]!;
      const type = (await fetch(src)).headers.get('content-type') ?? '';
      return `pdf:${type.split(';')[0]}`;
    }
    // Phones draw PDF pages with pdf.js. A page counts once it has pixels.
    const pages = [...(body?.querySelectorAll<HTMLCanvasElement>('canvas.pdf-page') ?? [])];
    if (pages.length) return pages[0]!.width > 0 ? 'pdf:application/pdf' : 'pdf:pending';
    const img = body?.querySelector('img');
    if (img) return `image:${img.naturalWidth > 0 ? 'decoded' : 'broken'}`;
    const pre = body?.querySelector('pre');
    if (pre)
      return `text:${pre.textContent?.startsWith('%PDF') ? 'binary' : 'plain'}:${pre.textContent?.length ?? 0}`;
    return 'none';
  });
}

async function openRecord(page: Page, id: number, version?: number): Promise<void> {
  await page.goto(`/r/${id}${version ? `?v=${version}` : ''}`);
  await expect(page.locator('.pane-title h1')).toBeVisible();
}

for (const [kind, type] of [
  ['text', 'text/plain'],
  ['pdf', 'application/pdf'],
  ['image', 'image/png'],
] as const) {
  test(`${kind} file renders its real content without layout shift`, async ({ page }, info) => {
    const { doc, version } = await versionWithType(page, type);
    await openRecord(page, doc.id, version);
    const want =
      kind === 'pdf'
        ? /^pdf:application\/pdf$/
        : kind === 'image'
          ? /^image:decoded$/
          : /^text:plain:[1-9]/;
    await expect.poll(() => rendered(page), { message: `${kind} content` }).toMatch(want);
    await expectStable(page, `${info.project.name} ${kind} file ${doc.id}/${version}`);
    await shot(page, info, `record-${kind}`);
  });
}

test('preview follows the current version, not the root mime type', async ({ page }) => {
  const doc = await recordWithMismatchedRoot(page);
  for (const version of doc.versions) {
    const served = await previewType(page, doc.id, version.id);
    await openRecord(page, doc.id, version.id);
    const want =
      served === 'application/pdf'
        ? /^pdf:/
        : served.startsWith('image/')
          ? /^image:/
          : /^text:plain/;
    await expect.poll(() => rendered(page)).toMatch(want);
  }
  await openRecord(page, doc.id);
  const head = await previewType(page, doc.id, doc.versions[0]!.id);
  await expect
    .poll(() => rendered(page))
    .toMatch(head === 'application/pdf' ? /^pdf:/ : /^text:plain/);
});

test('palette, selection and menus do not shift layout', async ({ page }, info) => {
  if (isMobile(info)) {
    await page.goto('/');
    await waitForRows(page);
  } else {
    // Start in the split layout. The wide-list <-> split switch has its own test (shell.spec.ts).
    await page.goto(`/r/${(await apiDocs(page))[0]!.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
  }
  await openPalette(page, info);
  await page.locator('.palette input').fill('operating');
  await expect(page.locator('.result').first()).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, info, 'palette');
  await page.keyboard.press('Enter');
  await expect(page.locator('.pane-title h1')).toBeVisible();
  await actions(page).locator('[aria-label="More"]').click();
  await expect(page.locator('.menu')).toBeVisible();
  await shot(page, info, 'menu');
  await page.keyboard.press('Escape');
  await expectStable(page, `${info.project.name} interactions`);
});

test('area and topic toggles, view switches and version menus do not shift layout', async ({
  page,
}, info) => {
  await page.goto('/');
  await waitForRows(page);
  // Areas and topics: the rail on desktop, the Areas page of the filter sheet on a phone.
  if (isMobile(info)) await sheetPage(page, 'Areas');
  const toggles = page.locator(
    isMobile(info) ? '.drawer .fs-page:not([inert]) .fs-tag-toggle' : '.rail .tag-toggle',
  );
  for (let i = 0; i < Math.min(await toggles.count(), 4); i++) {
    await toggles.nth(i).click();
    await page.waitForTimeout(150);
    await toggles.nth(i).click();
    await page.waitForTimeout(150);
  }
  if (isMobile(info)) await closeTaxonomy(page, info);
  await page
    .locator('.list-scroll .row', { has: page.locator('.row-versions') })
    .first()
    .click();
  await expect(page.locator('.pane-title h1')).toBeVisible();
  await actions(page).locator('[aria-label="Versions"]').click();
  await expect(page.locator('.menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toHaveCount(0);
  if (!isMobile(info)) {
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(200);
    }
    await page.locator('.nav-item', { hasText: 'Recovery' }).click();
    await page.waitForTimeout(300);
    await page.locator('.nav-item', { hasText: 'Records' }).click();
  }
  await expectStable(page, `${info.project.name} filters`);
  await shot(page, info, 'filtered');
});
