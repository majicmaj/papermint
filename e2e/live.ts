import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Privacy for runs against the test archive. A record tagged Sensitive is never listed to a
 * test, never opened, previewed, downloaded or screenshotted. Everything that reads the live
 * index goes through this file.
 */
export interface NamedTag {
  id: number;
  name: string;
}
export interface Tagged {
  id: number;
  tags?: number[];
}

export function sensitiveTagIds(tags: readonly NamedTag[]): number[] {
  return tags.filter((tag) => tag.name.trim().toLowerCase() === 'sensitive').map((tag) => tag.id);
}

export function isSensitive(doc: Tagged, tags: readonly NamedTag[]): boolean {
  const marked = sensitiveTagIds(tags);
  return (doc.tags ?? []).some((id) => marked.includes(id));
}

/** The records a browser test may use: everything except Sensitive. */
export function withoutSensitive<T extends Tagged>(
  docs: readonly T[],
  tags: readonly NamedTag[],
): T[] {
  return docs.filter((doc) => !isSensitive(doc, tags));
}

interface Listing<T> {
  results: T[];
}

let known: Promise<Set<number>> | null = null;

/** Ids of every Sensitive record, read once per worker. Read-only. */
export function sensitiveIds(request: APIRequestContext): Promise<Set<number>> {
  known ??= (async () => {
    const tags = (await (
      await request.get('/api/tags/?page_size=200&fields=id,name')
    ).json()) as Listing<NamedTag>;
    const docs = (await (
      await request.get('/api/documents/?page_size=200&fields=id,tags')
    ).json()) as Listing<Required<Tagged>>;
    return new Set(
      docs.results.filter((doc) => isSensitive(doc, tags.results)).map((doc) => doc.id),
    );
  })();
  return known;
}

/** Paths that serve secrets. A browser test never fetches them; a test that needs them mocks them. */
const SECRET_PATH = /^\/(recovery|recovery-files|backups)\//;

/** A test can end with requests in flight. Then the page is gone and there is nothing to answer. */
async function guarded(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (!/closed|disposed|aborted/i.test(String((error as Error).message))) throw error;
  }
}

/**
 * Keep private data away from the page under test. Sensitive records leave every document
 * list and search result, and any request for one of them gets a 404 before it reaches the
 * server. The recovery downloads and backups are blocked: a test that needs them mocks them,
 * and its own route wins because it is registered later.
 */
export async function excludeSensitive(page: Page): Promise<void> {
  await page.route(
    (url) => SECRET_PATH.test(url.pathname),
    (route) => guarded(() => route.fulfill({ status: 403, body: 'blocked in browser tests' })),
  );
  const hidden = await sensitiveIds(page.request);
  if (hidden.size === 0) return;
  await page.route(
    (url) => /^\/api\/documents\/\d+\//.test(url.pathname),
    (route) =>
      guarded(async () => {
        const id = Number(new URL(route.request().url()).pathname.split('/')[3]);
        if (hidden.has(id)) await route.fulfill({ status: 404, body: '{}' });
        else await route.fallback();
      }),
  );
  await page.route(
    (url) => url.pathname === '/api/documents/',
    (route) =>
      guarded(async () => {
        const response = await route.fetch();
        const body = (await response.json()) as { count?: number; results?: Tagged[] };
        if (!Array.isArray(body.results)) return route.fulfill({ response });
        const results = body.results.filter((doc) => !hidden.has(doc.id));
        const count = (body.count ?? 0) - (body.results.length - results.length);
        return route.fulfill({ response, json: { ...body, count, results } });
      }),
  );
}
