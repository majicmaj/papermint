import { expect, test, type Page } from '@playwright/test';
import { dropFile } from './mocks';
import { boot, press } from './f2';
import { actions, isMobile, settled, stepStable } from './helpers';
import { animationsSeen, anyAnimation, recordAnimations } from './motion-helpers';

/** Everything runs over the mocked archive. Each interaction is checked for layout shift on its own. */

const clearSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __anims: Set<string> }).__anims.clear());

async function start(page: Page, path = '/') {
  const api = await boot(page, path);
  await page.waitForTimeout(500);
  await recordAnimations(page);
  return api;
}

const row = (page: Page, id: number) => page.locator(`.list-scroll .row[data-id="${id}"]`);

test.describe('desktop panes and results', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop columns');

  test('the pane slides in and out; the page cross-fades; nothing shifts', async ({ page }) => {
    await start(page);
    await row(page, 104).click();
    await expect(page.locator('.pane-title h1')).toHaveText('Bank statement');
    await page.waitForTimeout(400);
    let seen = await animationsSeen(page);
    expect(
      anyAnimation(seen, '::view-transition-new(record-pane) animation:vt-pane-in'),
      seen.join('\n'),
    ).toBe(true);
    expect(
      anyAnimation(seen, /vt-pane-in \[(opacity,transform|transform,opacity)\]/),
      seen.join('\n'),
    ).toBe(true);
    await stepStable(page, 'desktop pane open', 400);

    // A pointer closes it with the same motion reversed, and faster.
    await clearSeen(page);
    await page.locator('.nav-item', { hasText: 'Records' }).click();
    await expect(page.locator('.pane-title h1')).toHaveCount(0);
    await page.waitForTimeout(400);
    seen = await animationsSeen(page);
    expect(
      anyAnimation(seen, '::view-transition-old(record-pane) animation:vt-pane-out'),
      seen.join('\n'),
    ).toBe(true);
    await stepStable(page, 'desktop pane close', 400);
  });

  test('the keyboard never animates: Escape and j/k change the page at once', async ({ page }) => {
    await start(page);
    await row(page, 104).click();
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await page.waitForTimeout(500);
    await clearSeen(page);
    await page.keyboard.press('j');
    await expect(page.locator('.pane-title h1')).not.toHaveText('Bank statement');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pane-title h1')).toHaveCount(0);
    await page.waitForTimeout(300);
    const seen = await animationsSeen(page);
    expect(anyAnimation(seen, 'view-transition'), seen.join('\n')).toBe(false);
    await stepStable(page, 'desktop keyboard', 300);
  });
});

test.describe('desktop results and status', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop columns');

  test('a view switch, an area and a filter cross-fade the results in place', async ({ page }) => {
    await start(page);
    await page.locator('.nav-item', { hasText: 'Drafts' }).click();
    await expect(page.locator('.list-scroll .row[data-id="108"]')).toBeVisible();
    await page.waitForTimeout(400);
    let seen = await animationsSeen(page);
    expect(anyAnimation(seen, '::view-transition-new(results)'), seen.join('\n')).toBe(true);
    await stepStable(page, 'view switch', 400);

    await page.locator('.nav-item', { hasText: 'Records' }).click();
    await clearSeen(page);
    await page.locator('.rail .tag-toggle', { hasText: 'Personal' }).click();
    await expect(page.locator('.list-scroll .row[data-id="105"]')).toBeVisible();
    await page.waitForTimeout(400);
    seen = await animationsSeen(page);
    expect(anyAnimation(seen, '::view-transition-new(results)'), seen.join('\n')).toBe(true);
    await stepStable(page, 'area toggle', 400);

    await clearSeen(page);
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.locator('.filter-panel').getByLabel('Signed').check();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await stepStable(page, 'filter toggle', 400);
  });

  test('a status change settles the new pill in', async ({ page }) => {
    await start(page, '/r/104');
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await page.waitForTimeout(400);
    await clearSeen(page);
    await page.locator('.pill-button').click();
    await page.getByRole('menuitemradio', { name: 'Draft' }).click();
    await expect(page.locator('.pill-button .pill')).toContainText('Draft');
    await page.waitForTimeout(400);
    const seen = await animationsSeen(page);
    expect(
      anyAnimation(seen, /pill-morph waapi \[(opacity,transform|transform,opacity)\]/),
      seen.join('\n'),
    ).toBe(true);
    await stepStable(page, 'status change', 400);
  });

  test('reduced motion: the pane and the pill fade, nothing slides or scales', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page);
    await row(page, 104).click();
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await page.waitForTimeout(400);
    await clearSeen(page);
    await page.locator('.pill-button').click();
    await page.getByRole('menuitemradio', { name: 'Draft' }).click();
    await expect(page.locator('.pill-button .pill')).toContainText('Draft');
    await page.locator('.pill-button').click();
    await page.waitForTimeout(400);
    const seen = await animationsSeen(page);
    expect(anyAnimation(seen, 'pill-morph waapi [opacity]'), seen.join('\n')).toBe(true);
    expect(
      anyAnimation(seen, /waapi \[(opacity,transform|transform,opacity)\]/),
      seen.join('\n'),
    ).toBe(false);
    expect(anyAnimation(seen, /div\.menu\b.*transition:transform/), seen.join('\n')).toBe(false);
    expect(anyAnimation(seen, /div\.menu\b.*transition:opacity/), seen.join('\n')).toBe(true);
    await stepStable(page, 'reduced motion', 400);
  });
});

test('reduced motion: the pane cross-fades without a slide', async ({ page }, info) => {
  test.skip(isMobile(info), 'desktop columns');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await row(page, 104).click();
  await expect(page.locator('.pane-title h1')).toBeVisible();
  await page.waitForTimeout(400);
  const seen = await animationsSeen(page);
  expect(anyAnimation(seen, 'animation:vt-fade-in'), seen.join('\n')).toBe(true);
  expect(anyAnimation(seen, 'vt-pane-in'), seen.join('\n')).toBe(false);
});

test.describe('popovers, palette, toast, intake and press', () => {
  test('a menu grows out of its trigger on a press and does not move on a key', async ({
    page,
  }, info) => {
    await start(page, '/r/104');
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await page.waitForTimeout(400);
    const more = actions(page).locator('[aria-label="More"]');
    await clearSeen(page);
    await press(more, info);
    const menu = page.locator('.menu');
    await expect(menu).toBeVisible();
    const origin = await menu.evaluate((el) => getComputedStyle(el).transformOrigin);
    const box = (await menu.boundingBox())!;
    expect(origin).not.toBe('50% 50%');
    expect(origin.endsWith('0px') || info.project.name === 'mobile').toBe(true);
    await page.waitForTimeout(300);
    let seen = await animationsSeen(page);
    expect(anyAnimation(seen, /div\.menu\b.*transition:opacity/), seen.join('\n')).toBe(true);
    expect(anyAnimation(seen, /div\.menu\b.*transition:transform/), seen.join('\n')).toBe(true);
    expect(box.width).toBeGreaterThan(0);
    await settled(page);
    await stepStable(page, `${info.project.name} menu`, 400);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    // By keyboard: no transition at all.
    await clearSeen(page);
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.menu')).toBeVisible();
    await page.waitForTimeout(300);
    seen = await animationsSeen(page);
    expect(anyAnimation(seen, /div\.menu\b.*transition:/), seen.join('\n')).toBe(false);
    await stepStable(page, `${info.project.name} menu by key`, 300);
  });

  test('the palette animates from a click or a tap, never from the keyboard', async ({
    page,
  }, info) => {
    await start(page);
    await clearSeen(page);
    if (isMobile(info)) {
      await page.locator('.bottombar-search').tap();
    } else {
      await page.locator('.search-field').click();
    }
    await expect(page.locator('.palette')).toBeVisible();
    await page.waitForTimeout(300);
    let seen = await animationsSeen(page);
    expect(anyAnimation(seen, 'palette transition:opacity'), seen.join('\n')).toBe(true);
    await stepStable(page, `${info.project.name} palette by click`, 400);
    await page.keyboard.press('Escape');
    if (isMobile(info)) return;
    await expect(page.locator('.palette')).toHaveCount(0);

    await clearSeen(page);
    await page.keyboard.press('Control+k');
    await expect(page.locator('.palette')).toBeVisible();
    await page.waitForTimeout(300);
    seen = await animationsSeen(page);
    expect(anyAnimation(seen, 'palette transition'), seen.join('\n')).toBe(false);
    await stepStable(page, 'palette by key', 300);
  });
});

test.describe('toast', () => {
  test('a toast enters from below and leaves the way it came', async ({ page }, info) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denied')) },
      });
      document.execCommand = () => false;
    });
    await start(page, '/r/104');
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await page.waitForTimeout(400);
    await clearSeen(page);
    await press(actions(page).getByRole('button', { name: 'Copy link' }), info);
    const toast = page.locator('.toast');
    await expect(toast).toHaveText('Copy failed');
    await page.waitForTimeout(500);
    expect(anyAnimation(await animationsSeen(page), 'toast transition:translate')).toBe(true);
    await stepStable(page, `${info.project.name} toast in`, 300);
    await expect(toast).toHaveAttribute('data-state', 'closing', { timeout: 6000 });
    await expect(toast).toHaveCount(0, { timeout: 2000 });
    await stepStable(page, `${info.project.name} toast out`, 300);
  });
});

test.describe('intake and press', () => {
  test('the filing form rises into place', async ({ page }, info) => {
    await start(page, '/pending');
    await clearSeen(page);
    await dropFile(page, 'Tax form 2026.txt');
    await expect(page.locator('.intake')).toBeVisible();
    await page.waitForTimeout(400);
    const seen = await animationsSeen(page);
    expect(anyAnimation(seen, 'aside.intake transition:transform'), seen.join('\n')).toBe(true);
    await stepStable(page, `${info.project.name} intake`, 400);
  });

  test('a press squeezes a button by 3% and lets go', async ({ page }, info) => {
    test.skip(isMobile(info), 'a mouse press');
    await start(page);
    const button = page.locator('.rail-foot .btn');
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    const pressed = await button.evaluate((el) => getComputedStyle(el).transform);
    expect(pressed).toBe('matrix(0.97, 0, 0, 0.97, 0, 0)');
    await page.mouse.move(2, 2);
    await page.mouse.up();
    await page.waitForTimeout(250);
    expect(await button.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    await stepStable(page, 'press', 300);
  });
});
