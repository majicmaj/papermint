import { expect, test } from './test';
import { apiDocs, recordWithVersions } from './api';
import { trackCls } from './cls';
import { actions, expectStable, isMobile, openPalette, settled, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => {
  await trackCls(page);
});

test.describe('delete dialog', () => {
  test('stays bound to its record, traps focus, locks the page and restores focus', async ({
    page,
  }, info) => {
    test.skip(isMobile(info), 'keyboard behavior is checked on desktop');
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await waitForRows(page);
    const trigger = actions(page).locator('[aria-label="More"]');
    await trigger.click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const title = await dialog.locator('.dialog-title').innerText();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'j', 'k'])
      await page.keyboard.press(key);
    await expect(page).toHaveURL(new RegExp(`/r/${doc.id}$`));
    await expect(dialog.locator('.dialog-title')).toHaveText(title);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.dialog'))).toBe(true);
    await expect(page.locator('.shell')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/r/${doc.id}$`));
    await expect(trigger).toBeFocused();
    await expect(page.locator('.shell')).not.toHaveAttribute('inert', '');
  });

  test('list shortcuts are suspended while a menu is open', async ({ page }, info) => {
    test.skip(isMobile(info), 'keyboard behavior is checked on desktop');
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await waitForRows(page);
    await actions(page).locator('[aria-label="More"]').click();
    await expect(page.locator('.menu')).toBeVisible();
    for (const key of ['j', 'k', 'ArrowDown']) await page.keyboard.press(key);
    await expect(page).toHaveURL(new RegExp(`/r/${doc.id}$`));
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await expect(page).not.toHaveURL(new RegExp(`/r/${doc.id}$`));
  });
});

test.describe('invalid version', () => {
  test('an unknown explicit version is a terminal state, not the current file', async ({
    page,
  }, info) => {
    const docs = await apiDocs(page);
    const doc = await recordWithVersions(page);
    const foreign = docs.find((d) => d.id !== doc.id)!.versions[0]!.id;
    await page.goto(`/r/${doc.id}`);
    await expect(page.locator('.pane-title h1')).toBeVisible();
    // A phone's sheet slides in; its rectangles are only exact once it has stopped.
    await settled(page);
    const want = await page.evaluate(() => ({
      head: document.querySelector('.pane-head')!.getBoundingClientRect().height,
      body: document.querySelector('.pane-body')!.getBoundingClientRect().height,
    }));
    for (const bad of [999999, foreign]) {
      await page.goto(`/r/${doc.id}?v=${bad}`);
      await expect(page.locator('.pane-title h1')).toHaveText('Version not found');
      await expect(actions(page).locator('a[download]')).toHaveCount(0);
      await expect(actions(page).locator('.btn--primary')).toHaveAttribute('aria-disabled', 'true');
      await expect(actions(page).getByText('Copy link')).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator('.pane-body iframe, .pane-body pre, .pane-body img')).toHaveCount(
        0,
      );
      await settled(page);
      expect(
        await page.evaluate(() => ({
          head: document.querySelector('.pane-head')!.getBoundingClientRect().height,
          body: document.querySelector('.pane-body')!.getBoundingClientRect().height,
        })),
      ).toEqual(want);
    }
    await expectStable(page, `${info.project.name} invalid version`);
    await page.getByRole('link', { name: 'Current version' }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${doc.id}$`));
    await expect(page.locator('.pane-title h1')).toHaveText(doc.title);
    await expect(actions(page).locator('a[download]')).toHaveAttribute(
      'href',
      new RegExp(`version=${doc.versions[0]!.id}$`),
    );
  });

  test('Back leaves the terminal state', async ({ page }) => {
    const doc = await recordWithVersions(page);
    await page.goto(`/r/${doc.id}?v=999999`);
    await expect(page.locator('.pane-title h1')).toHaveText('Version not found');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('search states', () => {
  test('a nonsense query says "No results" inside the same panel', async ({ page }, info) => {
    await page.goto('/');
    await waitForRows(page);
    await openPalette(page, info);
    const before = await page.locator('.palette').boundingBox();
    await page.locator('.palette input').fill('zzqxjvkwq');
    await expect(page.locator('.result-status')).toHaveText('No results');
    expect(await page.locator('.palette').boundingBox()).toEqual(before);
    await expectStable(page, `${info.project.name} no results`);
  });

  test('a failed full-text search shows Retry, and Retry recovers', async ({ page }, info) => {
    await page.goto('/');
    await waitForRows(page);
    await openPalette(page, info);
    await page.route('**/api/documents/?*query=*', (route) => route.abort());
    await page.locator('.palette input').fill('agreement');
    const status = page.locator('.result-status');
    await expect(status).toContainText('Search failed');
    await expect(page.locator('.result').first()).toBeVisible();
    await page.unroute('**/api/documents/?*query=*');
    await status.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.result[data-source="text"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(status).toHaveCount(0);
  });
});

test.describe('mobile header and chips', () => {
  test('the version label is never truncated at 390px', async ({ page }, info) => {
    test.skip(!isMobile(info), 'mobile only');
    const doc = await recordWithVersions(page);
    for (const version of doc.versions.filter((v) => v.version_label)) {
      await page.goto(`/r/${doc.id}?v=${version.id}`);
      const label = page.locator('.pane-version');
      await expect(label).toHaveText(version.version_label!);
      const box = await label.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
      expect(box.scroll, version.version_label!).toBeLessThanOrEqual(box.client + 1);
    }
  });

  test('chips have a 44px hit area and gray-12 selected text', async ({ page }, info) => {
    test.skip(!isMobile(info), 'mobile only');
    await page.goto('/');
    await waitForRows(page);
    // The header's switch makes a chip; the chip row appears under the pills.
    await page.getByRole('button', { name: 'More' }).tap();
    await page.getByRole('menuitemcheckbox', { name: 'Superseded' }).tap();
    await page.keyboard.press('Escape');
    await expect(page.locator('.chip--active')).toHaveText('Superseded');
    const chip = page.locator('.topbar .chip--active');
    await settled(page);
    const box = (await chip.boundingBox())!;
    const hit = await page.evaluate(
      ({ x, y, h }) => {
        const above = document.elementFromPoint(x, y - h / 2 - 5)?.closest('.chip');
        const below = document.elementFromPoint(x, y + h / 2 + 5)?.closest('.chip');
        return { above: !!above, below: !!below };
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2, h: box.height },
    );
    expect(hit).toEqual({ above: true, below: true });
    const colors = await page.evaluate(() => {
      const pressed = getComputedStyle(document.querySelector('.chip--active')!).color;
      const probe = document.createElement('span');
      probe.style.color = 'var(--mw-gray-12)';
      document.body.appendChild(probe);
      const gray12 = getComputedStyle(probe).color;
      probe.remove();
      return { pressed, gray12 };
    });
    expect(colors.pressed).toBe(colors.gray12);
  });
});
