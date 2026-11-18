import { test, type Page, type TestInfo } from '@playwright/test';
import { openFilter, sheetPage } from './f2';
import { bootLong, center, touchDrag } from './motion-helpers';
import { settled } from './helpers';

/**
 * Stills and a short recording of the motion, over the mocked archive only (no live data, no
 * recovery files, no Sensitive record opened). Files: screenshots/motion/<project>-<scheme>-*.
 */
// Top level: a video setting in a describe would start a new worker. Size follows the viewport.
test.use({ video: 'on' });

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    const save = async (page: Page, info: TestInfo, name: string) => {
      await settled(page);
      await page.screenshot({
        path: `screenshots/motion/${info.project.name}-${scheme}-${name}.png`,
      });
    };
    const keep = async (page: Page, info: TestInfo) => {
      const video = page.video();
      await page.close();
      await video?.saveAs(`screenshots/motion/${info.project.name}-${scheme}.webm`);
    };

    test(`desktop flow, ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop');
      await page.emulateMedia({ colorScheme: scheme });
      await bootLong(page, 0);
      await page.waitForTimeout(600);
      await page.locator('.rail .tag-toggle', { hasText: 'LLC' }).click();
      await page.waitForTimeout(500);
      await page.locator('.list-scroll .row[data-id="108"]').click();
      await page.waitForTimeout(150);
      await save(page, info, 'pane-opening');
      await page.waitForTimeout(500);
      await page.locator('.pill-button').click();
      await page.waitForTimeout(100);
      await save(page, info, 'menu');
      await page.getByRole('menuitemradio', { name: 'Current' }).click();
      await page.waitForTimeout(700);
      await page.locator('.search-field').click();
      await page.locator('.palette input').fill('agre');
      await page.waitForTimeout(400);
      await save(page, info, 'palette');
      await page.keyboard.press('Escape');
      await page.locator('.nav-item', { hasText: 'Recovery' }).click();
      await page.waitForTimeout(800);
      await keep(page, info);
    });

    test(`phone flow, ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone');
      await page.emulateMedia({ colorScheme: scheme });
      await bootLong(page, 14);
      await page.waitForTimeout(600);
      await save(page, info, 'list');
      await page.locator('.topbar-filter').tap();
      await page.waitForTimeout(800);
      await save(page, info, 'filter-drawer');
      await openFilter(page);
      const areas = await sheetPage(page, 'Areas');
      await areas.locator('.fs-tag-toggle', { hasText: 'Personal' }).tap();
      await page.waitForTimeout(500);
      await touchDrag(page, await center(page.locator('.drawer-grip')), 420, 700);
      await page.waitForTimeout(700);
      await page.locator('.list-scroll .row[data-id="105"]').tap();
      await page.waitForTimeout(900);
      await save(page, info, 'record-sheet');
      const head = (await page.locator('.pane-head').boundingBox())!;
      await touchDrag(page, { x: head.x + head.width / 2, y: head.y + 3 }, 380, 600);
      await page.waitForTimeout(700);
      await page.locator('.bottombar-search').tap();
      await page.locator('.palette input').fill('agre');
      await page.waitForTimeout(500);
      await save(page, info, 'search');
      await keep(page, info);
    });
  });
}
