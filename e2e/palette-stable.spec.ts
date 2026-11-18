import { expect, test } from '@playwright/test';
import { resetCls, trackCls } from './cls';
import { mockApi } from './fixture';
import { expectStable, openPalette, waitForRows } from './helpers';

interface Slot {
  id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

const slots = (page: import('@playwright/test').Page): Promise<Slot[]> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.palette-list .result')).map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-id'), x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );

test('palette results update in place: no row moves, input-inclusive CLS is 0', async ({
  page,
}, info) => {
  await trackCls(page);
  await mockApi(page);
  await page.goto('/');
  await waitForRows(page);
  // The load has its own gate. From here every shift is one the palette causes.
  await page.waitForTimeout(1200);
  await resetCls(page);
  await openPalette(page, info);
  await page.waitForTimeout(300);

  const orders: (string | null)[][] = [];
  const first = await slots(page);
  expect(first.length).toBeGreaterThan(3);
  const { x, y, width, height } = first[0]!;
  // Name every node now on screen, so a node that moves is found by name, not by position.
  await page.evaluate(() =>
    document.querySelectorAll('.palette-list .result').forEach((el, i) => {
      (el as HTMLElement).dataset['slot'] = String(i);
    }),
  );
  // Every keystroke changes the ranking: titles starting with the letter win, then word starts.
  for (const key of ['a', 'g', 'r', 'e', 'Backspace', 'Backspace', 'Backspace', 'e', 'i', 'n']) {
    await page.keyboard.press(key);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const now = await slots(page);
    orders.push(now.map((s) => s.id));
    const named = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.palette-list .result[data-slot]')).map(
        (el) => ({ slot: Number(el.dataset['slot']), y: el.getBoundingClientRect().y }),
      ),
    );
    for (const node of named)
      expect(node.y, `${key}: node ${node.slot} moved`).toBe(first[node.slot]!.y);
    // Search may draw more rows than the recent list, with the same geometry for each slot.
    now.forEach((slot, index) => {
      expect(slot, `${key}: slot ${index}`).toMatchObject({
        x,
        y: y + index * height,
        width,
        height,
      });
    });
  }
  // The test only means something if the ranking really changed between keystrokes.
  const changed = orders.some((order, i) => i > 0 && order.join() !== orders[i - 1]!.join());
  expect(changed).toBe(true);
  await expectStable(page, 'palette typing', 600);
});
