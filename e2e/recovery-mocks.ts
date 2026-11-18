import type { Page, Route } from '@playwright/test';

/**
 * The three recovery downloads, mocked. They are real secrets (recovery codes, a backup
 * archive), so no test ever requests them from the live server. The mock answers exactly as
 * Nginx does: an attachment that must not be cached.
 */
export const FAKE_CODE = 'FAKE-CODE-0000-1111-2222';

const MINIMAL_PDF = [
  '%PDF-1.1',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj',
  'trailer<</Root 1 0 R>>',
  '%%EOF',
].join('\n');

const ARCHIVE_SIZE = 412_345_678;

function headers(filename: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/octet-stream',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

export interface RecoveryRequests {
  /** Method and path of every request that reached a recovery file. */
  seen: { method: string; path: string; headers: Record<string, string> }[];
}

export async function mockRecoveryFiles(page: Page): Promise<RecoveryRequests> {
  const requests: RecoveryRequests = { seen: [] };
  const log = async (route: Route) => {
    const request = route.request();
    requests.seen.push({
      method: request.method(),
      path: new URL(request.url()).pathname,
      headers: await request.allHeaders(),
    });
  };
  await page.route('**/recovery-files/code.txt', async (route) => {
    await log(route);
    const body = `Your code is: ${FAKE_CODE}\n`;
    await route.fulfill({ status: 200, headers: headers('example-recovery-code.txt'), body });
  });
  await page.route('**/recovery-files/packet.pdf', async (route) => {
    await log(route);
    await route.fulfill({
      status: 200,
      headers: headers('example-recovery.pdf'),
      body: MINIMAL_PDF,
    });
  });
  await page.route('**/backups/originals', async (route) => {
    await log(route);
    const length = String(ARCHIVE_SIZE);
    if (route.request().method() === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: headers('example-records.tar.gz', { 'content-length': length }),
      });
    } else {
      // Fetching the body is a bug: the archive is only ever described, never loaded.
      await route.fulfill({ status: 200, headers: headers('x.tar.gz'), body: 'unexpected body' });
    }
  });
  return requests;
}
