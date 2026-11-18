import { type Page, type TestInfo } from '@playwright/test';
import { expect, test } from './test';
import { trackCls } from './cls';
import { isMobile, waitForRows } from './helpers';
import { sensitiveIds } from './live';

test.beforeEach(async ({ page }) => {
  await trackCls(page);
});

interface Rect {
  id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Every row the owner can see right now, with its exact box. */
async function visibleRows(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const view = window.innerHeight;
    return Array.from(document.querySelectorAll<HTMLElement>('.list-scroll .row')).flatMap(
      (row) => {
        const r = row.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= view) return [];
        return [
          { id: row.getAttribute('data-id'), x: r.x, y: r.y, width: r.width, height: r.height },
        ];
      },
    );
  });
}

async function openView(page: Page, info: TestInfo, name: 'Records' | 'Drafts'): Promise<void> {
  const link = isMobile(info)
    ? page.locator('.segment-link', { hasText: name === 'Records' ? 'Current' : 'Drafts' })
    : page.locator('.nav-item', { hasText: name });
  await link.click();
}

interface RawDoc {
  id: number;
  title: string;
  tags: number[];
  added: string;
}

/** Serve a changed index: a Draft added at the top, one visible row removed, one renamed. */
async function serveChangedIndex(
  page: Page,
  change: { draft: number; remove: number; rename: number },
): Promise<void> {
  const hidden = await sensitiveIds(page.request);
  await page.route('**/api/documents/?page_size=200*', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { results: RawDoc[] };
    body.results = body.results
      .filter((d) => d.id !== change.remove && !hidden.has(d.id))
      .map((d) => (d.id === change.rename ? { ...d, title: 'Renamed by the server' } : d));
    body.results.unshift({
      ...body.results[0]!,
      id: 990002,
      title: 'Injected record',
      tags: [change.draft],
      added: '2099-01-01T00:00:00Z',
    });
    await route.fulfill({ response, json: body });
  });
}

async function draftTagId(page: Page): Promise<number> {
  const response = await page.request.get('/api/tags/?page_size=100&fields=id,name');
  const body = (await response.json()) as { results: { id: number; name: string }[] };
  return body.results.find((t) => t.name === 'Draft')!.id;
}

test.describe('stable lists', () => {
  test('rows are laid out in normal flow, not placed by transform', async ({ page }) => {
    await page.goto('/pending');
    await waitForRows(page);
    const style = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.list-scroll .row')!;
      const css = getComputedStyle(row);
      return { position: css.position, transform: css.transform, inline: row.style.transform };
    });
    expect(style).toEqual({ position: 'static', transform: 'none', inline: '' });
  });

  test('a background refresh with a changed index moves no visible row', async ({ page }, info) => {
    await page.goto('/pending');
    await waitForRows(page);
    await page.waitForTimeout(500);
    const ids = (await visibleRows(page)).map((r) => Number(r.id));
    const change = { draft: await draftTagId(page), remove: ids[2]!, rename: ids[1]! };
    await serveChangedIndex(page, change);
    const refreshed = page.waitForResponse((r) =>
      r.url().includes('/api/documents/?page_size=200'),
    );
    await page.reload();
    await waitForRows(page);
    const before = await visibleRows(page);
    await refreshed;
    await page.waitForTimeout(1500);
    expect(await visibleRows(page)).toEqual(before);
    await expect(page.getByText('Injected record')).toHaveCount(0);
    await expect(page.getByText('Renamed by the server')).toHaveCount(0);
    // The owner switches view: now the held index is drawn.
    await openView(page, info, 'Records');
    await openView(page, info, 'Drafts');
    await expect(page.locator('.list-scroll .row').first()).toContainText('Injected record');
    await expect(page.getByText('Renamed by the server')).toHaveCount(1);
    await expect(page.locator(`.list-scroll .row[data-id="${change.remove}"]`)).toHaveCount(0);
  });

  test('an upload never changes the list, only the intake panel', async ({ page }) => {
    const { dropFile, mockWrites } = await import('./mocks');
    await mockWrites(page);
    await page.goto('/pending');
    await waitForRows(page);
    const before = await visibleRows(page);
    await dropFile(page, 'Stays in the panel.txt');
    await expect(page.locator('.intake')).toBeVisible();
    // Filing needs an area, so Confirm stays off here; the file is in once the title is.
    await expect(page.locator('.intake').getByPlaceholder('Title')).toHaveValue(
      'Stays in the panel',
    );
    await expect(page.locator('.intake .progress')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(1200);
    expect(await visibleRows(page)).toEqual(before);
  });

  test('a status change moves the record out of the list at once (owner action)', async ({
    page,
  }, info) => {
    test.skip(isMobile(info), 'list and record are shown together on desktop');
    await page.goto('/pending');
    await waitForRows(page);
    const first = page.locator('.list-scroll .row').first();
    const id = await first.getAttribute('data-id');
    await page.route(`**/api/documents/${id}/`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await first.click();
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await page.locator('.pane-head .pill-button').click();
    await page.getByRole('menuitemradio', { name: 'Current' }).click();
    await expect(page.locator(`.list-scroll .row[data-id="${id}"]`)).toHaveCount(0);
  });
});
