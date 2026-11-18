import { type Page, type TestInfo } from '@playwright/test';
import { expect, test } from './test';
import { recordWithVersions } from './api';
import { trackCls } from './cls';
import { FAKE_CODE, mockRecoveryFiles } from './recovery-mocks';
import { expectStable, isMobile, openPalette, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => {
  await trackCls(page);
});

// Let in-flight index requests finish before the page closes, so the Sensitive filter's
// route handler never runs against a closed page.
test.afterEach(async ({ page }) => {
  await page.waitForLoadState('networkidle').catch(() => undefined);
});

/** Parse a computed color: rgb(), rgba() or color(srgb …). Channels 0–255, alpha 0–1. */
function parseColor(value: string): { r: number; g: number; b: number; a: number } {
  const nums = (value.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
  const scale = value.startsWith('color(') ? 255 : 1;
  return { r: nums[0]! * scale, g: nums[1]! * scale, b: nums[2]! * scale, a: nums[3] ?? 1 };
}

async function width(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  return Math.round(box?.width ?? 0);
}

test.describe('palette scrim', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the backdrop darkens the page in ${scheme} mode`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/recovery');
      await waitForRows(page);
      await openPalette(page, info);
      const color = parseColor(
        await page.locator('.palette-scrim').evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      // Never a light wash: every channel is dark, and the veil is clearly visible.
      expect(Math.max(color.r, color.g, color.b)).toBeLessThan(scheme === 'dark' ? 40 : 60);
      expect(color.a).toBeGreaterThan(scheme === 'dark' ? 0.5 : 0.3);
      expect(color.a).toBeLessThan(0.8);
    });
  }
});

const desktopOnly = (info: TestInfo) => test.skip(isMobile(info), 'columns are fixed on mobile');

test.describe('resizable sidebar', () => {
  test('the handle is a separator with value, limits and keyboard control', async ({
    page,
  }, info) => {
    desktopOnly(info);
    await page.goto('/recovery');
    await waitForRows(page);
    const rail = page.getByRole('separator', { name: 'Resize sidebar' });
    await expect(rail).toHaveAttribute('aria-orientation', 'vertical');
    await expect(rail).toHaveAttribute('aria-valuemin', '180');
    await expect(rail).toHaveAttribute('aria-valuemax', '320');
    await expect(rail).toHaveAttribute('aria-valuenow', '216');
    await rail.focus();
    await page.keyboard.press('ArrowRight');
    await expect(rail).toHaveAttribute('aria-valuenow', '232');
    expect(await width(page, '.rail-body')).toBe(232);
    await page.keyboard.press('Shift+ArrowRight');
    await expect(rail).toHaveAttribute('aria-valuenow', '296');
    await page.keyboard.press('End');
    await expect(rail).toHaveAttribute('aria-valuenow', '320');
    await page.keyboard.press('ArrowRight');
    await expect(rail).toHaveAttribute('aria-valuenow', '320');
    await page.keyboard.press('Home');
    await expect(rail).toHaveAttribute('aria-valuenow', '180');
    await page.keyboard.press('ArrowLeft');
    await expect(rail).toHaveAttribute('aria-valuenow', '180');
  });

  test('dragging resizes, persists, and double-click resets', async ({ page }, info) => {
    desktopOnly(info);
    await page.goto('/recovery');
    await waitForRows(page);
    const rail = page.getByRole('separator', { name: 'Resize sidebar' });
    const box = (await rail.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, y, { steps: 5 });
    await page.mouse.up();
    await expect(rail).toHaveAttribute('aria-valuenow', '256');
    expect(await width(page, '.rail-body')).toBe(256);
    expect(await page.evaluate(() => localStorage.getItem('majin.layout.v1'))).toContain(
      '"rail":256',
    );
    await rail.dblclick();
    await expect(rail).toHaveAttribute('aria-valuenow', '216');
    expect(await page.evaluate(() => localStorage.getItem('majin.layout.v1'))).toContain(
      '"rail":216',
    );
  });

  test('saved widths apply before the app runs, so a reload does not move anything', async ({
    page,
  }, info) => {
    desktopOnly(info);
    await page.addInitScript(() =>
      localStorage.setItem('majin.layout.v1', '{"rail":260,"list":500}'),
    );
    // Block the app script: only the inline first-paint script can have set the widths.
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/recovery');
    expect(
      await page.evaluate(() => {
        const style = document.documentElement.style;
        return [style.getPropertyValue('--rail'), style.getPropertyValue('--list')];
      }),
    ).toEqual(['260px', '500px']);
    await page.unroute('**/assets/*.js');
    await page.goto('/recovery');
    await waitForRows(page);
    expect(await width(page, '.rail-body')).toBe(260);
    await expectStable(page, 'saved widths load', 800);
  });
});

test.describe('resizable list', () => {
  test('the handle resizes the list and the pane keeps 360px', async ({ page }, info) => {
    desktopOnly(info);
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    const handle = page.getByRole('separator', { name: 'Resize list' });
    await expect(handle).toHaveAttribute('aria-valuenow', '440');
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    expect(await width(page, '.list-scroll')).toBe(504);
    await page.keyboard.press('Home');
    expect(await width(page, '.list-scroll')).toBe(320);
    await page.keyboard.press('End');
    expect(Number(await handle.getAttribute('aria-valuemax'))).toBeLessThanOrEqual(720);
    expect(await width(page, '.pane-body')).toBeGreaterThanOrEqual(360);
    await handle.dblclick();
    expect(await width(page, '.list-scroll')).toBe(440);
  });

  test('a narrow window keeps 360px for the pane even with a wide saved list', async ({
    page,
  }, info) => {
    desktopOnly(info);
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.addInitScript(() =>
      localStorage.setItem('majin.layout.v1', '{"rail":216,"list":720}'),
    );
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    expect(await width(page, '.pane-body')).toBeGreaterThanOrEqual(360);
  });
});

/** The rows of the list, whatever element they are. */
const rowsReady = async (page: Page) =>
  expect(page.locator('.list-scroll .row:not([aria-hidden])').first()).toBeVisible();

test.describe('wide list when nothing is selected', () => {
  test('the list takes the whole width, with aligned columns, and no pane', async ({
    page,
  }, info) => {
    desktopOnly(info);
    await page.goto('/');
    await rowsReady(page);
    await expect(page.locator('.pane-body')).toBeHidden();
    await expect(page.getByRole('separator', { name: 'Resize list' })).toHaveCount(0);
    const viewport = page.viewportSize()!.width;
    expect(
      Math.abs(
        (await width(page, '.list-scroll')) - (viewport - (await width(page, '.rail-body'))),
      ),
    ).toBeLessThanOrEqual(1);
    // Every column starts at the same x in every row.
    const columns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.list-scroll .row[data-id]'))
        .slice(0, 8)
        .map((row) => {
          const x = (selector: string) =>
            row.querySelector(selector)?.getBoundingClientRect().x ?? null;
          return {
            y:
              row.querySelector('.row-title')!.getBoundingClientRect().y -
              row.getBoundingClientRect().y,
            pill: x('.pill'),
            date: x('.row-date'),
            dots: x('.dots'),
          };
        }),
    );
    expect(columns.length).toBeGreaterThan(2);
    for (const key of ['pill', 'date', 'dots'] as const) {
      const xs = new Set(columns.map((c) => c[key] && Math.round(c[key]!)));
      expect(
        [...xs].filter((v) => v !== null),
        key,
      ).toHaveLength(1);
    }
    // One line per record: the title is vertically centered in the row.
    const offsets = columns.map((c) => c.y);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThanOrEqual(1);
  });
});

test.describe('wide list and pane', () => {
  test('selecting a record brings the pane back without remounting the list', async ({
    page,
  }, info) => {
    desktopOnly(info);
    await page.goto('/');
    await rowsReady(page);
    await page.evaluate(() => {
      const w = window as unknown as { __kept: Element[] };
      w.__kept = [
        document.querySelector('.list-scroll')!,
        ...Array.from(document.querySelectorAll('.list-scroll .row')).slice(0, 5),
      ];
    });
    const stable = () =>
      page.evaluate(() => {
        const w = window as unknown as { __kept: Element[] };
        const [scroll, ...rows] = w.__kept;
        const now = Array.from(document.querySelectorAll('.list-scroll .row')).slice(0, 5);
        return scroll!.isConnected && rows.every((r, i) => r === now[i] && r.isConnected);
      });
    await page.locator('.list-scroll .row[data-id]').nth(1).click();
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await expect(page.locator('.pane-body')).toBeVisible();
    expect(await width(page, '.list-scroll')).toBe(440);
    expect(await stable()).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pane-body')).toBeHidden();
    expect(await stable()).toBe(true);
  });

  // Wide and split share one single-line row grid: status and date keep their columns, the
  // title flexes, and topics, then versions, hide in a narrow list. Nothing moves.
  test('wide <-> split moves nothing', async ({ page }, info) => {
    desktopOnly(info);
    await page.goto('/');
    await rowsReady(page);
    await page.waitForTimeout(600);
    await page.locator('.list-scroll .row[data-id]').nth(1).click();
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await page.keyboard.press('Escape');
    await expectStable(page, 'desktop wide<->split', 800);
  });

  test('on mobile the list is stacked, not a table', async ({ page }, info) => {
    test.skip(!isMobile(info), 'mobile only');
    await page.goto('/');
    await rowsReady(page);
    const rect = await page.evaluate(() => {
      const row = document.querySelector('.list-scroll .row[data-id]')!;
      return {
        title: row.querySelector('.row-title')!.getBoundingClientRect().y,
        date: row.querySelector('.row-date')!.getBoundingClientRect().y,
      };
    });
    expect(rect.date).toBeGreaterThan(rect.title);
  });
});

async function stubBlobs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __urls: { made: number; revoked: number; live: Set<string> } };
    w.__urls = { made: 0, revoked: 0, live: new Set() };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      const url = create(obj);
      w.__urls.made += 1;
      w.__urls.live.add(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      w.__urls.revoked += 1;
      w.__urls.live.delete(url);
      revoke(url);
    };
  });
}

const row = (page: Page, key: string) => page.locator(`.row[data-file="${key}"]`);

const blobs = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __urls: { made: number; revoked: number; live: Set<string> } };
    return { made: w.__urls.made, revoked: w.__urls.revoked, live: w.__urls.live.size };
  });

// Recovery files are secrets: every test here talks to a mock, never to the live server.
test.describe('recovery rows', () => {
  test('clicking a row opens it in the pane and never downloads', async ({ page }, info) => {
    await mockRecoveryFiles(page);
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    await page.goto('/recovery');
    await rowsReady(page);
    if (isMobile(info)) await row(page, 'code').tap();
    else await row(page, 'code').click();
    await expect(page).toHaveURL(/\/f\/code$/);
    await expect(page.locator('.pane-title h1')).toHaveText('Example recovery code');
    await expect(page.locator('.pane-body pre')).toContainText(FAKE_CODE);
    await expect(row(page, 'code')).toHaveAttribute('aria-current', 'true');
    await page.waitForTimeout(1200);
    expect(downloads).toBe(0);
  });

  test('only the icon button and the pane button download', async ({ page }, info) => {
    await mockRecoveryFiles(page);
    await page.goto('/recovery');
    await rowsReady(page);
    const icon = page.getByRole('link', { name: 'Download Example recovery code' });
    const box = (await icon.boundingBox())!;
    if (isMobile(info)) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const [first] = await Promise.all([page.waitForEvent('download'), icon.click()]);
    expect(first.suggestedFilename()).toBe('example-recovery-code.txt');
    await expect(page).toHaveURL(/\/recovery$/);
    await row(page, 'code').click();
    await expect(page.locator('.pane-body pre')).toContainText(FAKE_CODE);
    const [second] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.pane-actions:visible a[download]').click(),
    ]);
    expect(second.suggestedFilename()).toBe('example-recovery-code.txt');
  });
});

test.describe('recovery previews', () => {
  test('a PDF shows in the frame from a blob, and the URL is revoked on close', async ({
    page,
  }, info) => {
    await mockRecoveryFiles(page);
    await stubBlobs(page);
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    await page.goto('/recovery');
    await rowsReady(page);
    if (isMobile(info)) await row(page, 'packet').tap();
    else await row(page, 'packet').click();
    const frame = page.locator('.pane-body iframe');
    await expect(frame).toBeVisible();
    const src = (await frame.getAttribute('src'))!;
    expect(src.startsWith('blob:')).toBe(true);
    const type = await page.evaluate(
      async (url) => (await (await fetch(url)).blob()).type,
      src.split('#')[0]!,
    );
    expect(type).toBe('application/pdf');
    expect((await blobs(page)).live).toBe(1);
    // Leave the file: the object URL must be released.
    await page.goto('/recovery');
    await rowsReady(page);
    await row(page, 'code').click();
    await expect(page.locator('.pane-body pre')).toContainText(FAKE_CODE);
    expect((await blobs(page)).live).toBe(0);
    await page.waitForTimeout(800);
    expect(downloads).toBe(0);
  });

  test('revokes the blob URL when the owner switches to another file', async ({ page }, info) => {
    desktopOnly(info);
    await mockRecoveryFiles(page);
    await stubBlobs(page);
    await page.goto('/recovery');
    await rowsReady(page);
    await row(page, 'packet').click();
    await expect(page.locator('.pane-body iframe')).toBeVisible();
    await row(page, 'originals').click();
    await expect(page.locator('.file-card')).toBeVisible();
    expect(await blobs(page)).toEqual({ made: 1, revoked: 1, live: 0 });
  });

  test('an archive is a file card, and its body is never fetched', async ({ page }) => {
    const files = await mockRecoveryFiles(page);
    await page.goto('/recovery');
    await rowsReady(page);
    await row(page, 'originals').click();
    const card = page.locator('.file-card');
    await expect(card).toContainText('example-records.tar.gz');
    await expect(card).toContainText('TAR.GZ');
    await expect(card.locator('.file-card-meta span').nth(1)).toHaveText('412 MB');
    await expect(card.locator('a[download]')).toHaveAttribute('href', '/backups/originals');
    await page.waitForTimeout(800);
    expect(files.seen.map((r) => r.method)).toEqual(['HEAD']);
  });
});

test.describe('recovery privacy', () => {
  test('contents are never cached or stored', async ({ page }) => {
    await mockRecoveryFiles(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __caches: string[] };
      w.__caches = [];
      const real = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (String(input).includes('/recovery-files/')) w.__caches.push(String(init?.cache));
        return real(input, init);
      };
    });
    await page.goto('/recovery');
    await rowsReady(page);
    await row(page, 'code').click();
    await expect(page.locator('.pane-body pre')).toContainText(FAKE_CODE);
    // The request asks the browser not to use or keep any cached copy.
    expect(
      await page.evaluate(() => (window as unknown as { __caches: string[] }).__caches),
    ).toEqual(['no-store']);
    const stored = await page.evaluate(async () => ({
      storage: JSON.stringify(localStorage) + JSON.stringify(sessionStorage),
      caches: await caches.keys(),
      databases: (await indexedDB.databases()).map((d) => d.name),
      // Everything in the app's own database, as text.
      database: await new Promise<string>((resolve) => {
        const open = indexedDB.open('majin');
        open.onsuccess = async () => {
          const parts: string[] = [];
          for (const name of Array.from(open.result.objectStoreNames)) {
            parts.push(
              JSON.stringify(
                await new Promise((done) => {
                  const all = open.result.transaction(name).objectStore(name).getAll();
                  all.onsuccess = () => done(all.result);
                }),
              ),
            );
          }
          resolve(parts.join('\n'));
        };
      }),
    }));
    expect(stored.storage.includes(FAKE_CODE)).toBe(false);
    expect(stored.caches).toEqual([]);
    // The only database is the app's own index. The file's contents are not in it.
    expect(stored.databases).toEqual(['majin']);
    expect(stored.database.includes(FAKE_CODE)).toBe(false);
  });

  test('switching between files does not shift the layout', async ({ page }, info) => {
    await mockRecoveryFiles(page);
    await page.goto('/f/code');
    await expect(page.locator('.pane-body pre')).toContainText(FAKE_CODE);
    if (!isMobile(info)) {
      await row(page, 'packet').click();
      await expect(page.locator('.pane-body iframe')).toBeVisible();
      await row(page, 'originals').click();
      await expect(page.locator('.file-card')).toBeVisible();
    }
    await expectStable(page, `${info.project.name} recovery file`, 1000);
  });
});
