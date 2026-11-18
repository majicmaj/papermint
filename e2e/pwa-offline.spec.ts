import { expect, test } from '@playwright/test';
import { idbStores, indexStored, reset, serverLog, start } from './pwa';

test.beforeEach(async ({ request }) => {
  await reset(request);
});

test.describe('offline: nothing can be written', () => {
  test('the status and the whole ⋯ menu are off, and nothing is sent', async ({
    page,
    context,
    request,
  }) => {
    await start(page);
    await indexStored(page);
    await page.locator('.row[data-id]').nth(1).click();
    await expect(page.locator('.pane-title h1')).toBeVisible();
    await expect(page.locator('.pane-head .pill-button')).toBeEnabled();
    await context.setOffline(true);
    await expect(page.locator('.sync-dot')).toHaveAttribute('data-state', 'offline');
    await expect(page.locator('.pane-head .pill-button')).toBeDisabled();
    await page.locator('.pane-head [aria-label="More"]').click();
    // Copy link and the version list only read, so they stay on; every other entry writes.
    const writes = await page
      .locator('.menu .menu-item')
      .evaluateAll((els) =>
        els.flatMap((el, i) =>
          el.closest('.menu-collapsed') || el.matches('.menu-collapsed') ? [] : [i],
        ),
      );
    expect(writes.length).toBeGreaterThan(5);
    for (const i of writes) {
      const item = page.locator('.menu .menu-item').nth(i);
      await expect(item, (await item.innerText()).trim()).toBeDisabled();
    }
    await page.keyboard.press('Escape');
    expect((await serverLog(request)).patches).toEqual([]);
    // Back online: the controls work again, and nothing was replayed.
    await context.setOffline(false);
    await expect(page.locator('.pane-head .pill-button')).toBeEnabled();
    await page.waitForTimeout(800);
    expect((await serverLog(request)).patches).toEqual([]);
    await expect(page.locator('.sync-dot')).toHaveAttribute('data-state', 'idle');
  });

  test('no queue exists: the database has only the index, and nothing says "Queued"', async ({
    page,
    context,
  }) => {
    await start(page);
    await indexStored(page);
    await context.setOffline(true);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(new File(['offline'], 'Offline note.txt', { type: 'text/plain' }));
      for (const type of ['dragenter', 'drop']) {
        window.dispatchEvent(
          new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
        );
      }
    });
    await expect(page.locator('.intake')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByText('Queued')).toHaveCount(0);
    expect(await idbStores(page)).toEqual(['index']);
  });
});

test.describe('offline: the area and topic dialogs', () => {
  const tagWrites = async (request: import('@playwright/test').APIRequestContext) =>
    (await serverLog(request)).log.filter(
      (e) => e.method !== 'GET' && e.path.includes('/api/tags'),
    );

  test('a dialog that was open when the network dropped cannot submit; it works again online', async ({
    page,
    context,
    request,
  }) => {
    await start(page);
    await indexStored(page);
    await page.getByRole('button', { name: 'New area' }).click();
    const editor = page.locator('.editor');
    await editor.getByLabel('Name').fill('Offline area');
    await expect(editor.getByRole('button', { name: 'Create' })).toBeEnabled();
    await context.setOffline(true);
    await expect(editor.getByRole('button', { name: 'Create' })).toBeDisabled();
    await editor.getByLabel('Name').press('Enter');
    await page.waitForTimeout(500);
    expect(await tagWrites(request)).toEqual([]);
    await expect(editor).toBeVisible();
    await context.setOffline(false);
    await expect(editor.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  test('New topic and the edit dialog are off while offline', async ({
    page,
    context,
    request,
  }) => {
    await start(page);
    await indexStored(page);
    await context.setOffline(true);
    await expect(page.locator('.sync-dot')).toHaveAttribute('data-state', 'offline');
    await page.getByRole('button', { name: 'New area' }).click();
    await page.locator('.editor').getByLabel('Name').fill('Nope');
    await expect(page.locator('.editor').getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: /^Edit / })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.locator('.editor').getByLabel('Name').fill('Renamed');
    await expect(page.locator('.editor').getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.locator('.editor').getByLabel('Name').press('Enter');
    await page.waitForTimeout(400);
    expect(await tagWrites(request)).toEqual([]);
  });
});

test.describe('offline: uploads wait in the panel for Confirm', () => {
  test('a file dropped offline waits; the network returning only enables Confirm, and Confirm sends', async ({
    page,
    context,
    request,
  }) => {
    await start(page);
    await indexStored(page);
    await context.setOffline(true);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(new File(['offline'], 'Offline note.txt', { type: 'text/plain' }));
      for (const type of ['dragenter', 'drop']) {
        window.dispatchEvent(
          new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
        );
      }
    });
    const panel = page.locator('.intake');
    const confirm = panel.getByRole('button', { name: 'Confirm' });
    await expect(panel).toBeVisible();
    await expect(panel.getByPlaceholder('Title')).toHaveValue('Offline note');
    await expect(confirm).toBeDisabled();
    await page.waitForTimeout(800);
    expect((await serverLog(request)).posts).toEqual([]);
    // The network is back. Nothing is sent by itself: an area is chosen, Confirm turns on.
    await context.setOffline(false);
    await expect(page.locator('.sync-dot')).toHaveAttribute('data-state', 'idle');
    const area = panel.getByRole('button', { name: 'Area' });
    await expect(area).toBeEnabled();
    await area.click();
    await page.getByRole('menuitemcheckbox').first().click();
    await page.keyboard.press('Escape');
    await expect(confirm).toBeEnabled();
    await page.waitForTimeout(1000);
    expect((await serverLog(request)).posts).toEqual([]);
    await expect(panel).toBeVisible();
    // Only the owner's Confirm sends the file, and then files it.
    await confirm.click();
    await expect.poll(async () => (await serverLog(request)).posts.length).toBe(1);
    await expect(panel).toHaveCount(0);
    expect((await serverLog(request)).patches.length).toBe(1);
    expect((await serverLog(request)).posts).toHaveLength(1);
  });

  test('going offline after the file is filed turns Confirm off until the network is back', async ({
    page,
    context,
  }) => {
    await start(page);
    await indexStored(page);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(new File(['x'], 'Filed note.txt', { type: 'text/plain' }));
      for (const type of ['dragenter', 'drop']) {
        window.dispatchEvent(
          new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
        );
      }
    });
    const confirm = page.locator('.intake').getByRole('button', { name: 'Confirm' });
    const area = page.locator('.intake').getByRole('combobox').first();
    await expect(page.locator('.intake')).toBeVisible();
    await expect
      .poll(async () => (await area.isVisible()) && (await confirm.isVisible()))
      .toBe(true);
    await context.setOffline(true);
    await expect(confirm).toBeDisabled();
    await context.setOffline(false);
    await expect(page.locator('.sync-dot')).toHaveAttribute('data-state', 'idle');
  });
});
