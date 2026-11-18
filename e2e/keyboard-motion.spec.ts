import { expect, test, type Page } from '@playwright/test';
import { boot } from './f2';
import { settled, stepStable } from './helpers';
import { animationsSeen, anyAnimation, bootLong, recordAnimations } from './motion-helpers';

/** What a key must leave behind: no running animation, no layer still leaving, no wait. */
const afterKey = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __key: number; __gone: number };
    return {
      running: document.getAnimations().map((a) => {
        const effect = a.effect as KeyframeEffect | null;
        return `${effect?.target ? (effect.target as HTMLElement).className : effect?.pseudoElement}`;
      }),
      roots: document.querySelectorAll('.drawer-root').length,
      msToGone: w.__gone ? w.__gone - w.__key : -1,
    };
  });

/** Time from the key press to the moment `.drawer-root` leaves the page. */
async function watchExit(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __key: number; __gone: number };
    w.__key = 0;
    w.__gone = 0;
    window.addEventListener('keydown', () => (w.__key = performance.now()), true);
    new MutationObserver(() => {
      if (w.__key && !w.__gone && !document.querySelector('.drawer-root')) {
        w.__gone = performance.now();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

test.describe('phone: a key closes a layer at once', () => {
  test.skip(({ isMobile }) => !isMobile, 'the phone layout');

  test('Escape on the record sheet: no animation runs, nothing waits', async ({ page }) => {
    await bootLong(page, 0);
    await page.locator('.list-scroll .row[data-id="104"]').tap();
    await expect(page.getByRole('dialog', { name: 'Record' })).toBeVisible();
    await settled(page);
    await watchExit(page);
    await page.keyboard.press('Escape');
    const after = await afterKey(page);
    expect(after.running, after.running.join('\n')).toEqual([]);
    expect(after.roots).toBe(0);
    await expect(page).toHaveURL(/\/$/);
    const waited = (await afterKey(page)).msToGone;
    expect(waited).toBeGreaterThanOrEqual(0);
    expect(waited, 'a pointer close waits 360ms').toBeLessThan(100);
    await stepStable(page, 'escape record sheet', 400);
  });

  test('Escape on the filter drawer: no animation runs, nothing waits', async ({ page }) => {
    await bootLong(page, 0);
    await page.locator('.topbar-filter').tap();
    await expect(page.getByRole('dialog', { name: 'Filter' })).toBeVisible();
    await settled(page);
    await watchExit(page);
    await page.keyboard.press('Escape');
    const after = await afterKey(page);
    expect(after.running, after.running.join('\n')).toEqual([]);
    expect(after.roots).toBe(0);
    expect((await afterKey(page)).msToGone).toBeLessThan(100);
    await expect(page.locator('.topbar-filter')).toBeFocused();
    await stepStable(page, 'escape filter drawer', 400);
  });

  test('a drawer opened from the keyboard is simply there', async ({ page }) => {
    await bootLong(page, 0);
    await page.locator('.topbar-filter').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
    const state = await page.evaluate(() => ({
      running: document.getAnimations().length,
      transform: getComputedStyle(document.querySelector('.drawer')!).transform,
      scrim: getComputedStyle(document.querySelector('.drawer-scrim')!).opacity,
    }));
    expect(state.running).toBe(0);
    expect(state.transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
    expect(state.scrim).toBe('1');
    await stepStable(page, 'open drawer by key', 400);
  });

  test('a tap on the scrim still leaves with the slide: the key rule is not a global off switch', async ({
    page,
  }) => {
    await bootLong(page, 0);
    await page.locator('.topbar-filter').tap();
    await expect(page.locator('.drawer-root[data-state="open"]')).toBeVisible();
    await settled(page);
    await page.mouse.click(200, 20);
    const during = await page.evaluate(() => ({
      state: document.querySelector('.drawer-root')?.getAttribute('data-state'),
      running: document.getAnimations().length,
    }));
    expect(during.state).toBe('closing');
    expect(during.running).toBeGreaterThan(0);
    await expect(page.locator('.drawer-root')).toHaveCount(0);
  });
});

test('a status change by the keyboard has no pill animation; by a pointer it has', async ({
  page,
}, info) => {
  await boot(page, '/r/103');
  await page.waitForTimeout(500);
  await recordAnimations(page);
  const pill = page.locator('.pill-button');
  await pill.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitemradio', { name: 'Current' }).focus();
  await page.keyboard.press('Enter');
  await expect(pill.locator('.pill')).toContainText('Current');
  await page.waitForTimeout(400);
  let seen = await animationsSeen(page);
  expect(anyAnimation(seen, /waapi/), seen.join('\n')).toBe(false);
  expect(anyAnimation(seen, /pill-morph/), seen.join('\n')).toBe(false);
  await stepStable(page, `${info.project.name} status by key`, 300);

  await page.evaluate(() => (window as unknown as { __anims: Set<string> }).__anims.clear());
  await pill.click();
  await page.getByRole('menuitemradio', { name: 'Superseded' }).click();
  await page.getByRole('menuitem', { name: 'Operating agreement', exact: true }).click();
  await expect(pill.locator('.pill')).toContainText('Superseded');
  await page.waitForTimeout(400);
  seen = await animationsSeen(page);
  expect(anyAnimation(seen, /pill-morph waapi/), seen.join('\n')).toBe(true);
});

test('a toast raised by a key appears without a transition', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    document.execCommand = () => false;
  });
  await boot(page, '/r/104');
  await page.waitForTimeout(500);
  const copy = page.locator('.pane-actions:visible').getByRole('button', { name: 'Copy link' });
  await copy.focus();
  await page.keyboard.press('Enter');
  const toast = page.locator('.toast');
  await expect(toast).toHaveText('Copy failed');
  const during = await toast.evaluate((el) => ({
    running: el.getAnimations().length,
    opacity: getComputedStyle(el).opacity,
  }));
  expect(during).toEqual({ running: 0, opacity: '1' });
});
