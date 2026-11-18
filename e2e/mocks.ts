import type { Page } from '@playwright/test';

/**
 * Mocked write API for intake: tests never write to the live archive.
 * Reads (index, tags) still hit the live API.
 */
export const NEW_ID = 990001;

export interface Writes {
  patches: unknown[];
  merges: unknown[];
}

export async function mockWrites(page: Page): Promise<Writes> {
  const writes: Writes = { patches: [], merges: [] };
  await page.route('**/api/documents/post_document/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '"mock-task"' }),
  );
  await page.route('**/api/tasks/?*task_id=mock-task*', async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        results: [{ status: 'success', related_document_ids: [NEW_ID] }],
      }),
    });
  });
  await page.route(`**/api/documents/${NEW_ID}/`, async (route) => {
    if (route.request().method() === 'PATCH') writes.patches.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/documents/merge_as_versions/', async (route) => {
    writes.merges.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"result":"OK"}' });
  });
  return writes;
}

export async function dropFile(page: Page, name: string): Promise<void> {
  // The drop listeners attach after the first paint.
  await page.waitForTimeout(400);
  await page.evaluate((fileName) => {
    const data = new DataTransfer();
    data.items.add(new File(['intake test'], fileName, { type: 'text/plain' }));
    for (const type of ['dragenter', 'drop']) {
      window.dispatchEvent(
        new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
      );
    }
  }, name);
}
