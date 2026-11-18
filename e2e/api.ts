import type { Page } from '@playwright/test';
import { withoutSensitive, type NamedTag } from './live';

export interface ApiVersion {
  id: number;
  version_label: string | null;
  is_root: boolean;
}

export interface ApiDoc {
  id: number;
  title: string;
  mime_type: string;
  tags: number[];
  versions: ApiVersion[];
}

let docsCache: Promise<ApiDoc[]> | null = null;

/** The synthetic index without Sensitive records, read once per run. Read-only. */
export function apiDocs(page: Page): Promise<ApiDoc[]> {
  docsCache ??= (async () => {
    const docs = (await (
      await page.request.get(
        '/api/documents/?page_size=200&fields=id,title,mime_type,tags,versions',
      )
    ).json()) as { results: ApiDoc[] };
    const tags = (await (
      await page.request.get('/api/tags/?page_size=200&fields=id,name')
    ).json()) as {
      results: NamedTag[];
    };
    return withoutSensitive(docs.results, tags.results);
  })();
  return docsCache;
}

/** Content-Type the preview endpoint really serves for one version. */
export async function previewType(page: Page, id: number, version: number): Promise<string> {
  const response = await page.request.fetch(`/api/documents/${id}/preview/?version=${version}`, {
    method: 'HEAD',
  });
  return (response.headers()['content-type'] ?? '').split(';')[0]!.trim();
}

/** First record whose CURRENT version serves the given Content-Type. */
export async function recordWithHeadType(page: Page, type: string): Promise<ApiDoc> {
  for (const doc of await apiDocs(page)) {
    if ((await previewType(page, doc.id, doc.versions[0]!.id)) === type) return doc;
  }
  throw new Error(`no record with a current ${type} file`);
}

/** A record whose root mime type differs from what its current version serves. */
export async function recordWithMismatchedRoot(page: Page): Promise<ApiDoc> {
  for (const doc of await apiDocs(page)) {
    if (doc.versions.length < 2) continue;
    const head = await previewType(page, doc.id, doc.versions[0]!.id);
    if (head !== doc.mime_type) return doc;
  }
  throw new Error('no record whose root mime differs from its current file');
}

/** The first record with at least `min` versions, at least one of them labeled. */
export function findVersioned(docs: readonly ApiDoc[], min = 3): ApiDoc {
  const doc = docs.find((d) => d.versions.length >= min && d.versions.some((v) => v.version_label));
  if (!doc) throw new Error('no multi-version record');
  return doc;
}

/** A record with at least three versions, for version identity checks. */
export async function recordWithVersions(page: Page, min = 3): Promise<ApiDoc> {
  return findVersioned(await apiDocs(page), min);
}

/** Any (record, version) pair whose file is served with the given Content-Type. */
export async function versionWithType(
  page: Page,
  type: string,
): Promise<{ doc: ApiDoc; version: number }> {
  for (const doc of await apiDocs(page)) {
    for (const version of doc.versions) {
      if ((await previewType(page, doc.id, version.id)) === type)
        return { doc, version: version.id };
    }
  }
  throw new Error(`no version serving ${type}`);
}
