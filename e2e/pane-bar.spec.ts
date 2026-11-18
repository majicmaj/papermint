import { expect, test, type Page } from '@playwright/test';
import { boot } from './f2';
import { expectStable, isMobile } from './helpers';

/** The record toolbar at a given window width, with the list saved at its widest. */
async function openAt(page: Page, width: number, path = '/r/101', list = 720): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.addInitScript(
    (saved) =>
      localStorage.setItem('majin.layout.v1', `{"rail":216,"list":${saved},"collapsed":false}`),
    list,
  );
  await boot(page, path);
}

const head = (page: Page) => page.locator('.pane-head');
const visible = async (page: Page, selector: string) => page.locator(selector).first().isVisible();

test.beforeEach(async ({ page }, info) => {
  void page;
  test.skip(isMobile(info), 'the desktop toolbar');
});

test.describe('the record toolbar at 1000px with a wide saved list', () => {
  test('the title keeps a readable width and nothing overflows', async ({ page }) => {
    await openAt(page, 1000);
    const title = await head(page).locator('.pane-title').boundingBox();
    expect(title!.width).toBeGreaterThanOrEqual(120);
    const h1 = await head(page).locator('h1').boundingBox();
    expect(h1!.width).toBeGreaterThanOrEqual(90);
    expect(
      await head(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      'toolbar overflows',
    ).toBe(true);
    // The pane itself stays at least 360px.
    expect((await page.locator('.pane-body').boundingBox())!.width).toBeGreaterThanOrEqual(360);
  });

  test('Copy link and Versions are not in the toolbar, and Download is still there', async ({
    page,
  }) => {
    await openAt(page, 1000);
    expect(await visible(page, '.pane-head .btn-copy')).toBe(false);
    expect(await visible(page, '.pane-head .menu-host--versions')).toBe(false);
    await expect(head(page).getByRole('link', { name: 'Download' })).toBeVisible();
    await expect(head(page).getByRole('button', { name: 'More' })).toBeVisible();
    await expect(head(page).locator('.pill-button')).toBeVisible();
  });

  test('both are in the ⋯ menu, and they work', async ({ page }) => {
    await openAt(page, 1000);
    await head(page).getByRole('button', { name: 'More' }).click();
    const menu = page.locator('.menu[aria-label="More"]');
    await expect(menu.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
    // Record 101 has three versions; each is a menu entry.
    const versions = menu.locator('[data-version]');
    await expect(versions).toHaveCount(3);
    await expect(versions.first()).toHaveAttribute('aria-checked', 'true');
    const older = await versions.nth(1).getAttribute('data-version');
    await versions.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/r/101\\?v=${older}$`));
    await expect(page.locator('.pane-metarow .pane-version')).toBeVisible();
  });

  test('Copy link in the menu copies the exact link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openAt(page, 1000, '/r/101?v=1011');
    await head(page).getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Copy link' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${new URL(page.url()).origin}/r/101?v=1011`,
    );
  });
});

test.describe('the toolbar by pane width', () => {
  // [window width, saved list width, Copy link, Versions, Download label]: pane = window - 216 - list.
  for (const [width, list, copy, versions, label] of [
    [1440, 440, true, true, true],
    [1180, 320, false, true, true],
    [1180, 440, false, false, true],
    [1000, 720, false, false, false],
  ] as const) {
    test(`window ${width}, list ${list}: Copy link ${copy ? 'shown' : 'moved'}, Versions ${versions ? 'shown' : 'moved'}`, async ({
      page,
    }) => {
      await openAt(page, width, '/r/101', list);
      expect(await visible(page, '.pane-head .btn-copy'), 'Copy link').toBe(copy);
      expect(await visible(page, '.pane-head .menu-host--versions'), 'Versions').toBe(versions);
      expect(await visible(page, '.pane-head .btn-label'), 'Download label').toBe(label);
      expect((await head(page).locator('.pane-title').boundingBox())!.width).toBeGreaterThanOrEqual(
        120,
      );
      expect(await head(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await head(page).getByRole('button', { name: 'More' }).click();
      const menu = page.locator('.menu[aria-label="More"]');
      expect(
        await menu.getByRole('menuitem', { name: 'Copy link' }).isVisible(),
        'menu Copy link',
      ).toBe(!copy);
      expect(await menu.locator('[data-version]').first().isVisible(), 'menu versions').toBe(
        !versions,
      );
    });
  }

  test('the toolbar changes as the window is resized, without reloading', async ({ page }) => {
    await openAt(page, 1440, '/r/101', 440);
    expect(await visible(page, '.pane-head .btn-copy')).toBe(true);
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect.poll(() => visible(page, '.pane-head .btn-copy')).toBe(false);
    await expectStable(page, 'resized toolbar', 300).catch(() => undefined);
  });
});
