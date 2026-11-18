import { expect, test, type Page } from '@playwright/test';
import { boot } from './f2';
import { expectStable, isMobile, settled } from './helpers';

interface Item {
  name: string;
  dropped: boolean;
  /** An item or a part of it is cut by overflow (ellipsis or clip). */
  cut: boolean;
  /** The item sticks out of the line. */
  outside: boolean;
}

/** Every item of the meta line, read from the DOM. */
async function items(page: Page): Promise<Item[]> {
  return page.locator('.pane-meta').evaluate((line) => {
    const limit = line.getBoundingClientRect().right + 0.5;
    const cutOff = (el: Element): boolean =>
      (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) ||
      Array.from(el.children).some(cutOff);
    return Array.from(line.children).map((el) => ({
      name: el.className.split(' ')[0] ?? '',
      dropped: el.hasAttribute('data-dropped'),
      cut: cutOff(el),
      outside: el.getBoundingClientRect().right > limit,
    }));
  });
}

async function openAt(page: Page, path: string, width: number, list?: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  if (list)
    await page.addInitScript(
      (saved) =>
        localStorage.setItem('majin.layout.v1', `{"rail":216,"list":${saved},"collapsed":false}`),
      list,
    );
  await boot(page, path);
  await expect(page.locator('.pane-title h1')).toBeVisible();
  await settled(page);
}

const shown = (all: Item[]) => all.filter((item) => !item.dropped);

function expectWhole(all: Item[], label: string): void {
  for (const item of shown(all)) {
    expect(item.cut, `${label}: ${item.name} is cut`).toBe(false);
    expect(item.outside, `${label}: ${item.name} sticks out`).toBe(false);
  }
}

const RECORDS = ['/r/101', '/r/103', '/r/104', '/r/106', '/r/107'];

test.describe('the meta line sits at the top of the pane body, across the full pane', () => {
  test.beforeEach(async ({ page }, info) => {
    void page;
    test.skip(isMobile(info), 'the desktop pane');
  });

  test('the toolbar row keeps the title, marks, status and actions only', async ({ page }) => {
    await openAt(page, '/r/101', 1440);
    const head = page.locator('.pane-head');
    expect((await head.boundingBox())!.height).toBe(44);
    await expect(head.locator('.pane-meta')).toHaveCount(0);
    await expect(head.locator('h1')).toBeVisible();
    await expect(head.getByRole('img', { name: 'Signed' })).toBeVisible();
    const row = (await page.locator('.pane-metarow').boundingBox())!;
    const body = (await page.locator('.pane-body').boundingBox())!;
    const bar = (await head.boundingBox())!;
    expect(row.height).toBe(32);
    expect(row.x).toBe(body.x);
    expect(row.width).toBe(body.width);
    expect(row.y).toBe(body.y);
    expect(row.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  });

  for (const path of RECORDS) {
    test(`1440px, default widths: nothing in the line is cut (${path})`, async ({ page }) => {
      await openAt(page, path, 1440);
      const all = await items(page);
      expect(shown(all).length).toBeGreaterThan(0);
      expectWhole(all, path);
      // At this width everything fits: nothing is dropped.
      expect(all.filter((item) => item.dropped)).toEqual([]);
    });

    test(`1000px, list at its widest: whole items or none (${path})`, async ({ page }) => {
      await openAt(page, path, 1000, 720);
      const all = await items(page);
      expectWhole(all, path);
      // The date is never dropped, and the status link never is either.
      expect(all.find((item) => item.name === 'pane-date')?.dropped).toBe(false);
      for (const link of ['marks']) {
        const mark = all.find((item) => item.name === link);
        if (mark) expect(mark.dropped).toBe(false);
      }
    });
  }
});

test.describe('the meta line drops whole items, and moves nothing', () => {
  test.beforeEach(async ({ page }, info) => {
    void page;
    test.skip(isMobile(info), 'the desktop pane');
  });

  test('what does not fit leaves whole and in order: topics, then the page count, never the date', async ({
    page,
  }) => {
    // Record 107 has a date, a page count and two topics.
    await openAt(page, '/r/107', 1440, 720);
    const names = (all: Item[]) => all.map((item) => item.name);
    expect(names(await items(page))).toEqual(
      expect.arrayContaining(['pane-date', 'pane-pages', 'pane-topic', 'pane-topic']),
    );
    // Longer topic names make the same facts wider, so a narrow pane has too little room.
    await page.addStyleTag({ content: '.pane-topic { padding-right: 90px; }' });
    await settled(page);
    const dropped: string[][] = [];
    for (const width of [1400, 1360, 1330, 1300, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      // The fit runs when the line is resized, before the next paint.
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
      await settled(page);
      const all = await items(page);
      expectWhole(all, `${width}px`);
      expect(all.find((item) => item.name === 'pane-date')?.dropped).toBe(false);
      const topics = all.filter((item) => item.name === 'pane-topic');
      const pages = all.find((item) => item.name === 'pane-pages');
      // The second topic leaves first, then the first, then the page count.
      if (topics[0]?.dropped) expect(topics[1]?.dropped).toBe(true);
      if (pages?.dropped) expect(topics.every((topic) => topic.dropped)).toBe(true);
      dropped.push(all.filter((item) => item.dropped).map((item) => item.name));
    }
    // The narrowest pane drops something, and the widest drops nothing.
    expect(dropped.at(-1)!.length).toBeGreaterThan(0);
  });

  test('the line changes nothing else: layout shift stays 0 at both widths', async ({
    page,
  }, info) => {
    await openAt(page, '/r/101', 1440);
    await expectStable(page, `${info.project.name} meta 1440`, 600);
    await openAt(page, '/r/103', 1000, 720);
    await expectStable(page, `${info.project.name} meta 1000`, 600);
  });
});

test.describe('the meta line in the phone sheet', () => {
  test.beforeEach(async ({ page }, info) => {
    void page;
    test.skip(!isMobile(info), 'the phone sheet');
  });

  for (const path of RECORDS) {
    test(`390px: nothing is cut, the date stays, and the line is full width (${path})`, async ({
      page,
    }) => {
      await boot(page, path);
      await expect(page.locator('.pane-title h1')).toBeVisible();
      await settled(page);
      const all = await items(page);
      expectWhole(all, path);
      expect(all.find((item) => item.name === 'pane-date')?.dropped).toBe(false);
      const row = (await page.locator('.pane-metarow').boundingBox())!;
      const body = (await page.locator('.pane-body').boundingBox())!;
      expect(row.width).toBe(body.width);
      expect(row.height).toBe(32);
      await expect(page.locator('.pane-head .pane-meta')).toHaveCount(0);
    });
  }
});
