import { expect, test, type Page } from '@playwright/test';
import { boot } from './f2';
import { expectStable, isMobile } from './helpers';

/** Position and size of one element, rounded. */
async function box(page: Page, selector: string) {
  const b = (await page.locator(selector).first().boundingBox())!;
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
}

/** What an installed window reports about its title bar. Playwright cannot emulate it, so the
 * app's own variables are set instead: the layout reads only these. */
async function titleBar(page: Page, x: string, width: string): Promise<void> {
  await page.evaluate(
    ([left, w]) => {
      document.documentElement.style.setProperty('--tb-x', left!);
      document.documentElement.style.setProperty('--tb-w', w!);
    },
    [x, width],
  );
}

test.beforeEach(async ({ page }, info) => {
  void page;
  test.skip(isMobile(info), 'the unified toolbar is the desktop layout');
});

test.describe('one toolbar row', () => {
  test('every column starts at one 44px height, in the list and in a record', async ({ page }) => {
    await boot(page, '/');
    for (const selector of ['.rail-bar', '.list-head']) {
      expect(await box(page, selector), selector).toMatchObject({ y: 0, h: 44 });
    }
    await page.locator('.list-scroll .row[data-id]').first().click();
    await expect(page.locator('.pane-title h1')).toBeVisible();
    for (const selector of ['.rail-bar', '.list-head', '.pane-head']) {
      expect(await box(page, selector), selector).toMatchObject({ y: 0, h: 44 });
    }
    // The body of every column starts right under it.
    for (const selector of ['.rail-body', '.list-scroll', '.pane-body']) {
      expect((await box(page, selector)).y, selector).toBe(44);
    }
    await expectStable(page, 'toolbar row', 600);
  });

  test('the view name and count lead, with Filter, Sort, and Group at the right', async ({
    page,
  }) => {
    await boot(page, '/');
    const head = page.locator('.list-head');
    await expect(head.locator('.list-title')).toContainText('Records');
    const rows = await page.locator('.list-scroll .row[data-id]').count();
    await expect(head.locator('.list-count')).toHaveText(String(rows));
    const order = await head
      .locator('.list-title, button')
      .evaluateAll((els) =>
        els.slice(0, 4).map((el) => el.textContent?.replace(/\d+$/, '').trim()),
      );
    expect(order).toEqual(['Records', 'Filter', 'Sort', 'Group']);
    const end = await box(page, '.list-head > .menu-host:last-child');
    const toolbar = await box(page, '.list-head');
    expect(toolbar.x + toolbar.w - end.x - end.w).toBe(12);
    await expect(page.locator('.list-scroll').getByRole('button', { name: 'Filter' })).toHaveCount(
      0,
    );
  });

  test('the brand left the toolbar and search is the first item in the sidebar', async ({
    page,
  }) => {
    await boot(page, '/');
    await expect(page.locator('.brand')).toHaveCount(0);
    expect(await page.locator('.rail-body > *').first().getAttribute('class')).toContain(
      'search-field',
    );
    const toolbar = await box(page, '.rail-bar');
    const search = await box(page, '.search-field');
    expect(search.y - (toolbar.y + toolbar.h)).toBe(8);
    await expect(
      page.locator('.rail-bar').getByRole('button', { name: 'Collapse sidebar' }),
    ).toBeVisible();
  });

  test('a record puts its title, status, Download, Copy link and the menu in the toolbar', async ({
    page,
  }) => {
    await boot(page, '/r/101');
    const head = page.locator('.pane-head');
    await expect(head.locator('h1')).toHaveText('Operating agreement');
    await expect(head.locator('.pill-button')).toBeVisible();
    await expect(head.getByRole('link', { name: 'Download' })).toBeVisible();
    await expect(head.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(head.getByRole('button', { name: 'More' })).toBeVisible();
    expect((await box(page, '.pane-head')).h).toBe(44);
  });
});

test.describe('folding the sidebar', () => {
  test('the button folds it away and brings it back, and the choice is kept', async ({ page }) => {
    await boot(page, '/r/101');
    const button = page.locator('.rail-bar').getByRole('button', { name: 'Collapse sidebar' });
    const before = await box(page, '.rail-bar button');
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-rail-collapsed', '');
    await expect(page.locator('.rail-body')).toBeHidden();
    expect((await box(page, '.list-head')).x).toBe(0);
    // The button stays where it was, so it can be found again.
    expect(await box(page, '.rail-bar button')).toMatchObject({ x: before.x, y: before.y });
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // The title never sits under the button.
    const bar = await box(page, '.rail-bar button');
    expect((await box(page, '.list-title')).x).toBeGreaterThan(bar.x + bar.w);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-rail-collapsed', '');
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-rail-collapsed', '');
    await expect(page.locator('.rail-body')).toBeVisible();
  });

  test('a saved fold applies before the app runs', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('majin.layout.v1', '{"rail":216,"list":440,"collapsed":true}'),
    );
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-rail-collapsed', '');
  });
});

test.describe('installed window', () => {
  test('on a Mac the sidebar controls clear the traffic lights', async ({ page }) => {
    await boot(page, '/');
    await titleBar(page, '78px', 'calc(100vw - 78px)');
    expect((await box(page, '.rail-bar button')).x).toBeGreaterThanOrEqual(78);
    // Folded, the button and the list's title both clear them.
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    const bar = await box(page, '.rail-bar button');
    expect(bar.x).toBeGreaterThanOrEqual(78);
    expect((await box(page, '.list-title')).x).toBeGreaterThan(bar.x + bar.w);
  });

  test('on Windows the last toolbar cell clears the window buttons', async ({ page }) => {
    await boot(page, '/r/101');
    await titleBar(page, '0px', 'calc(100vw - 138px)');
    const viewport = page.viewportSize()!.width;
    const lastRight = await page.locator('.pane-head .pane-actions').evaluate((el) => {
      const kids = Array.from(el.querySelectorAll<HTMLElement>('a, button'));
      return Math.max(...kids.map((k) => k.getBoundingClientRect().right));
    });
    expect(lastRight).toBeLessThanOrEqual(viewport - 138);
    // With no record open the list's toolbar is the last cell and does the same.
    await page.goto('/');
    await titleBar(page, '0px', 'calc(100vw - 138px)');
    const padding = await page
      .locator('.list-head')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingRight));
    expect(padding).toBeGreaterThanOrEqual(138);
  });

  test('in a normal tab the offsets are zero', async ({ page }) => {
    await boot(page, '/');
    const left = await page
      .locator('.rail-bar')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    expect(left).toBe(8);
  });
});

test.describe('dragging the window', () => {
  const region = (page: Page, selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return style.getPropertyValue('app-region') || style.getPropertyValue('-webkit-app-region');
      });

  test('empty toolbar space drags; every control opts out', async ({ page }) => {
    await boot(page, '/r/101');
    for (const selector of ['.rail-bar', '.list-head', '.pane-head', '.pane-title']) {
      expect(await region(page, selector), selector).toBe('drag');
    }
    for (const selector of [
      '.rail-bar button',
      '.list-head button',
      '.pane-head .pill-button',
      '.pane-head a[download]',
      '.pane-head [aria-label="More"]',
    ]) {
      expect(await region(page, selector), selector).toBe('no-drag');
    }
  });

  test('a double-click on empty toolbar space does nothing', async ({ page }) => {
    await boot(page, '/r/101');
    const url = page.url();
    const railWidth = (await box(page, '.rail-body')).w;
    const points = await page.evaluate(() => {
      const mid = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return [r.right - 6, r.top + 22];
      };
      return [mid('.rail-bar'), mid('.list-head'), [900, 22]];
    });
    for (const [x, y] of points) {
      await page.mouse.dblclick(x!, y!);
      expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
    }
    expect(page.url()).toBe(url);
    expect((await box(page, '.rail-body')).w).toBe(railWidth);
    await expect(page.locator('.palette')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.locator('.menu')).toHaveCount(0);
    // The resize handles stop under the toolbar: nothing there can react to a double-click.
    const handleTop = await page
      .locator('.handle--rail')
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(handleTop).toBe(44);
    expect(
      await page.evaluate(() => document.elementFromPoint(216, 22)?.className ?? ''),
    ).not.toContain('handle');
  });
});
