import { expect, type Page, type TestInfo } from '@playwright/test';
import { CLS_LIMIT, readCls, resetCls } from './cls';

export const SETTLE_MS = 1500;

export const isMobile = (info: TestInfo) => info.project.name === 'mobile';

export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: `screenshots/${info.project.name}-${name}.png` });
}

/** Input-inclusive: every layout shift counts, also the ones right after a click or key. */
export async function expectStable(page: Page, label: string, settle = SETTLE_MS): Promise<void> {
  await page.waitForTimeout(settle);
  const cls = await readCls(page);
  console.log(`CLS ${label}: total=${cls.total.toFixed(4)} vitals=${cls.vitals.toFixed(4)}`);
  if (cls.total > CLS_LIMIT) {
    for (const shift of cls.shifts) {
      for (const source of shift.sources.slice(0, 6)) {
        console.log(
          `  shift ${shift.value.toFixed(4)} ${source.node}: ${source.from} -> ${source.to}`,
        );
      }
    }
  }
  expect(cls.total, `${label} layout shift`).toBeLessThanOrEqual(CLS_LIMIT);
}

export async function waitForRows(page: Page): Promise<void> {
  // Skeleton rows are rows too: wait for a real one.
  await expect(page.locator('.list-scroll .row:not([aria-hidden])').first()).toBeVisible();
}

export async function openPalette(page: Page, info: TestInfo): Promise<void> {
  if (isMobile(info)) await page.locator('.bottombar-search').tap();
  else await page.locator('.search-field').click();
  await expect(page.locator('.palette')).toBeVisible();
  // Its opening is a short fade and settle: measure it after, not during.
  await settled(page);
}

/** The two actions a visible pane shows: the header on desktop, the bottom bar on mobile. */
export function actions(page: Page) {
  return page.locator('.pane-actions:visible');
}

/** One interaction on its own: wait, check every layout shift since the last step, start over. */
export async function stepStable(page: Page, label: string, settle = 350): Promise<void> {
  await expectStable(page, label, settle);
  await resetCls(page);
}

/** Wait until every transition and animation on the page has ended. Geometry read earlier is mid-motion. */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      // Loops (the skeleton pulse, the filing shimmer) never end and are not what moves geometry.
      const running = document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === 'running' &&
            Number.isFinite(Number(a.effect?.getComputedTiming().endTime)),
        );
      if (running.length === 0) return;
      await Promise.allSettled(running.map((a) => a.finished));
    }
  });
}
