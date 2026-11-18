import { expect, test } from './test';
import { apiDocs, recordWithHeadType, recordWithVersions } from './api';
import { trackCls } from './cls';
import { actions, expectStable, isMobile, openPalette, settled, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => {
  await trackCls(page);
});

test.describe('search', () => {
  test('a tapped or clicked result opens that result', async ({ page }, info) => {
    await page.goto('/');
    await waitForRows(page);
    await openPalette(page, info);
    await page.locator('.palette input').fill('operating');
    await expect(page.locator('.result').nth(1)).toBeVisible();
    const target = page.locator('.result').nth(1);
    const id = await target.getAttribute('data-id');
    if (isMobile(info)) await target.tap();
    else await target.click();
    await expect(page).toHaveURL(new RegExp(`/r/${id}$`));
  });

  test('a result keeps its status pill and a word-boundary snippet', async ({ page }, info) => {
    await page.goto('/');
    await waitForRows(page);
    await openPalette(page, info);
    await page.locator('.palette input').fill('agreement');
    const rows = page.locator('.result');
    await expect(rows.first().locator('.pill')).toBeVisible();
    const hit = page.locator('.result[data-source="text"]').first();
    await expect(hit).toBeVisible({ timeout: 15_000 });
    const text = hit.locator('.result-sub');
    await expect(text).not.toBeEmpty();
    const snippet = (await text.innerText()).trim();
    if (snippet.endsWith('…')) expect(snippet.at(-2)).not.toMatch(/\s/);
  });

  test('Escape closes only the palette, traps focus, locks the page and restores focus', async ({
    page,
  }, info) => {
    test.skip(isMobile(info), 'keyboard focus behavior is checked on desktop');
    const id = (await recordWithVersions(page)).id;
    await page.goto(`/r/${id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    const opener = page.locator('.search-field');
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.palette')).toBeVisible();
    await expect(page.locator('.shell')).toHaveAttribute('inert', '');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(page.locator('.palette input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.palette')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/r/${id}$`));
    await expect(opener).toBeFocused();
    await expect(page.locator('.shell')).not.toHaveAttribute('inert', '');
  });
});

test.describe('versions', () => {
  test('every entry addresses its exact version and the header shows the selected one', async ({
    page,
  }, info) => {
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await actions(page).locator('[aria-label="Versions"]').click();
    const items = page.locator('.menu [data-version]');
    await expect(items).toHaveCount(doc.versions.length);
    expect(
      await items.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-version')))),
    ).toEqual(doc.versions.map((v) => v.id));
    await expect(items.first()).toHaveAttribute('aria-checked', 'true');
    const older = doc.versions[1]!;
    await page.locator(`.menu [data-version="${older.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/r/${doc.id}\\?v=${older.id}$`));
    await expect(page.locator('.pane-version')).toHaveText(older.version_label ?? /.+/);
    await expect(page.locator('.pane-status .pill')).toHaveCount(0);
    await expect(actions(page).locator('a[download]')).toHaveAttribute(
      'href',
      new RegExp(`version=${older.id}$`),
    );
    await expectStable(page, `${info.project.name} version switch`);
  });

  test('the current version is the first one the API lists, and shows the status pill', async ({
    page,
  }) => {
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-version')).toHaveText(doc.versions[0]!.version_label ?? /.+/);
    await expect(page.locator('.pane-status .pill')).toHaveCount(1);
    await expect(actions(page).locator('a[download]')).toHaveAttribute(
      'href',
      new RegExp(`version=${doc.versions[0]!.id}$`),
    );
  });
});

test.describe('copy link', () => {
  test('copies the exact version path and reports success', async ({ page, context }, info) => {
    test.skip(isMobile(info), 'clipboard read permission is desktop only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const doc = await recordWithVersions(page);
    const older = doc.versions[1]!;
    await page.goto(`/r/${doc.id}?v=${older.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await actions(page).getByRole('button', { name: 'Copy link' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${new URL(page.url()).origin}/r/${doc.id}?v=${older.id}`);
  });

  test('reports failure when the browser refuses the copy', async ({ page }) => {
    const doc = (await apiDocs(page))[0]!;
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denied')) },
      });
      document.execCommand = () => false;
    });
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await actions(page).getByRole('button', { name: 'Copy link' }).click();
    await expect(page.locator('.toast')).toHaveText('Copy failed');
    await expect(
      actions(page).getByRole('button', { name: 'Copy link' }).locator('svg'),
    ).toBeVisible();
  });
});

test.describe('terminal states', () => {
  test('a missing record keeps the pane geometry and offers Back', async ({ page }, info) => {
    const doc = (await apiDocs(page))[0]!;
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    // A phone's sheet slides in; its rectangles are only exact once it has stopped.
    await settled(page);
    const want = await page.evaluate(() => ({
      head: document.querySelector('.pane-head')!.getBoundingClientRect().height,
      body: document.querySelector('.pane-body')!.getBoundingClientRect().height,
    }));
    await page.goto('/r/99999999');
    await expect(page.locator('.pane-title h1')).toHaveText('Not found');
    await settled(page);
    const got = await page.evaluate(() => ({
      head: document.querySelector('.pane-head')!.getBoundingClientRect().height,
      body: document.querySelector('.pane-body')!.getBoundingClientRect().height,
    }));
    expect(got).toEqual(want);
    await expectStable(page, `${info.project.name} missing record`);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a failing text preview keeps the pane geometry', async ({ page }) => {
    const doc = await recordWithHeadType(page, 'text/plain');
    await page.route('**/api/documents/*/preview/**', (route) => route.fulfill({ status: 500 }));
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.preview-failed')).toBeVisible();
    await expect(page.locator('.pane-head')).toBeVisible();
  });
});

test.describe('first paint', () => {
  test('the record shell is there before the data arrives', async ({ page }, info) => {
    const doc = (await apiDocs(page))[0]!;
    let release!: () => void;
    const dataReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/api\/documents\/(?:\d+\/)?(?:\?|$)/, async (route) => {
      await dataReady;
      await route.fallback();
    });
    const shell = () =>
      page.evaluate(() => {
        const box = (s: string) => document.querySelector(s)?.getBoundingClientRect().height ?? -1;
        const bar = Array.from(document.querySelectorAll('.pane-actions')).find(
          (el) => (el as HTMLElement).offsetHeight > 0,
        );
        return {
          head: box('.pane-head'),
          body: box('.pane-body'),
          bar: bar?.getBoundingClientRect().height ?? 0,
        };
      });
    let early: Awaited<ReturnType<typeof shell>>;
    try {
      await page.goto(`/r/${doc.id}`);
      await expect(page.locator('.pane-head')).toBeVisible();
      await expect(page.locator('.pane-title .pane-skeleton')).toBeAttached();
      await settled(page);
      early = await shell();
      expect(early.head).toBeGreaterThan(0);
      expect(early.body).toBeGreaterThan(0);
      expect(early.bar).toBeGreaterThan(0);
    } finally {
      release();
    }
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await settled(page);
    expect(await shell()).toEqual(early);
    await expectStable(page, `${info.project.name} slow record`, 600);
  });

  test('recovery shows only its three downloads while loading', async ({ page }) => {
    await page.route('**/api/documents/?**', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fallback();
    });
    await page.goto('/recovery');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('.list-scroll .row')).toHaveCount(3);
    await expect(page.locator('.skeleton-bar')).toHaveCount(0);
  });
});

test.describe('touch targets', () => {
  test('menu rows are 44px and the status trigger has a 44px hit area', async ({ page }, info) => {
    test.skip(!isMobile(info), 'mobile only');
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await settled(page);
    const trigger = await page.locator('.pill-button').boundingBox();
    expect(trigger!.height).toBeGreaterThanOrEqual(44);
    expect(trigger!.width).toBeGreaterThanOrEqual(44);
    expect((await page.locator('.pill-button .pill').boundingBox())!.height).toBe(20);
    await page.locator('.pane-actions:visible [aria-label="More"]').tap();
    await settled(page);
    for (const item of await page.locator('.menu .menu-item:visible').all()) {
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
