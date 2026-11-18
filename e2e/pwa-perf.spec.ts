import { expect, test } from '@playwright/test';
import { readCls, trackCls } from './cls';
import { control, reset, start } from './pwa';

const ROWS = 600;

test.beforeEach(async ({ request }) => {
  await reset(request);
  await control(request, { docs: ROWS });
});

test(`${ROWS} records: off-screen rows are skipped and scrolling stays smooth`, async ({
  page,
}) => {
  await trackCls(page);
  await start(page);
  await expect(page.locator('.list-scroll .row[data-id]')).toHaveCount(ROWS);
  // Let the first layout settle before counting what was skipped.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await page.waitForTimeout(300);
  const rowCount = await page.locator('.list-scroll .row-wrap').count();
  const stats = await page.evaluate(async () => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.list-scroll .row-wrap'));
    const skipped = rows.filter(
      (row) => !row.firstElementChild!.checkVisibility({ contentVisibilityAuto: true }),
    ).length;
    const mode = getComputedStyle(rows[0]!).contentVisibility;
    const scroller = document.querySelector<HTMLElement>('.list-scroll')!;
    const frames: number[] = [];
    let last = performance.now();
    await new Promise<void>((done) => {
      let n = 0;
      const step = (now: number) => {
        frames.push(now - last);
        last = now;
        scroller.scrollTop += 140;
        if (++n < 150) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    frames.shift();
    frames.sort((a, b) => a - b);
    const at = (p: number) => frames[Math.floor(frames.length * p)]!;
    return { skipped, mode, p50: at(0.5), p95: at(0.95), max: frames[frames.length - 1]! };
  });
  console.log(
    `PERF ${ROWS} rows: skipped=${stats.skipped} p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms max=${stats.max.toFixed(1)}ms`,
  );
  expect(stats.mode).toBe('auto');
  expect(stats.skipped).toBeGreaterThan(rowCount - 60);
  expect(stats.p95).toBeLessThan(34);
  expect(stats.max).toBeLessThan(120);
  expect((await readCls(page)).total).toBeLessThanOrEqual(0.001);
});

test('scrolling a long list moves no row by layout: positions are in normal flow', async ({
  page,
}) => {
  await start(page);
  const transformed = await page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>('.list-scroll .row-wrap, .list-scroll .row'),
      ).filter((el) => getComputedStyle(el).transform !== 'none').length,
  );
  expect(transformed).toBe(0);
});
