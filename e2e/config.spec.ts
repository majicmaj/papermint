import { expect, test } from '@playwright/test';
import { mockApi } from './fixture';
import { NEW_ID, dropFile } from './mocks';

test('an unconfigured, untagged archive can browse and file documents', async ({ page }) => {
  const api = await mockApi(page);
  api.tags.length = 0;
  for (const doc of api.docs) doc.tags = [];
  await page.route('**/config.json', (route) => route.fulfill({ status: 404 }));

  await page.goto('/recovery');
  await expect(page.locator('.list-title, .topbar-title')).toContainText('Records');
  await expect(page.locator('.list-scroll [data-id="101"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Recovery' })).toHaveCount(0);
  await dropFile(page, 'Incoming.pdf');

  const confirm = page.locator('.intake').getByRole('button', { name: 'Confirm' });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.locator('.intake')).toHaveCount(0);
  expect(api.writes.docPatches).toContainEqual({
    id: NEW_ID,
    body: { title: 'Incoming', tags: [] },
  });
});

test('a configured recovery deep link opens its pane on first load', async ({ page }) => {
  await mockApi(page);
  await page.route('**/config.json', (route) =>
    route.fulfill({
      json: {
        recoveryFiles: [
          {
            key: 'account-copy-2',
            title: 'Account backup',
            href: '/recovery-files/backup.txt',
            kind: 'text',
            label: 'TXT',
            filename: 'backup.txt',
          },
        ],
      },
    }),
  );
  await page.route('**/recovery-files/backup.txt', (route) =>
    route.fulfill({ body: 'Synthetic backup', contentType: 'text/plain' }),
  );

  await page.goto('/f/account-copy-2');
  await expect(page.locator('.pane-title h1')).toHaveText('Account backup');
  await expect(page.locator('.pane-body pre')).toHaveText('Synthetic backup');
});
