import { deleteRequest, getJson, patchJson, postJson, toLocalPath } from './http';
import type { Doc, Page, RawDoc, SearchHit, Tag } from './types';

const DOC_FIELDS = 'id,title,tags,created,added,page_count,mime_type,versions';

export function normalizeDoc(raw: RawDoc): Doc {
  return {
    id: raw.id,
    title: raw.title,
    tags: raw.tags,
    created: raw.created,
    added: raw.added,
    pageCount: raw.page_count,
    mime: raw.mime_type,
    versions: (raw.versions ?? []).map((v) => ({
      id: v.id,
      added: v.added,
      label: v.version_label,
      isRoot: v.is_root,
    })),
  };
}

async function collect<T>(firstPath: string, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  let path: string | null = firstPath;
  while (path) {
    const page: Page<T> = await getJson<Page<T>>(path, signal);
    rows.push(...page.results);
    path = page.next ? toLocalPath(page.next) : null;
  }
  return rows;
}

export async function fetchDocs(signal?: AbortSignal): Promise<Doc[]> {
  const raw = await collect<RawDoc>(
    `/api/documents/?page_size=200&ordering=-created&fields=${DOC_FIELDS}`,
    signal,
  );
  return raw.map(normalizeDoc);
}

export async function fetchTags(signal?: AbortSignal): Promise<Tag[]> {
  return collect<Tag>('/api/tags/?page_size=200&fields=id,name,slug,color', signal);
}

export async function fetchDoc(id: number, signal?: AbortSignal): Promise<Doc> {
  return normalizeDoc(await getJson<RawDoc>(`/api/documents/${id}/`, signal));
}

export async function saveTags(id: number, tags: number[]): Promise<void> {
  await patchJson(`/api/documents/${id}/`, { tags });
}

export interface DocumentPatch {
  title?: string;
  tags?: number[];
}

export async function patchDocument(id: number, body: DocumentPatch): Promise<void> {
  await patchJson(`/api/documents/${id}/`, body);
}

/**
 * Paperless 3.4.2 bulk edit: the source document becomes the newest version of the root.
 * The source stops being a document of its own. `version_label` is at most 64 characters.
 */
export async function mergeAsVersions(
  rootId: number,
  sourceId: number,
  label?: string,
): Promise<void> {
  await postJson('/api/documents/merge_as_versions/', {
    documents: [rootId, sourceId],
    root_document_id: rootId,
    ...(label ? { version_label: label.slice(0, 64) } : {}),
  });
}

export async function removeDoc(id: number): Promise<void> {
  await deleteRequest(`/api/documents/${id}/`);
}

interface RawHit {
  id: number;
  title: string;
  __search_hit__?: { highlights?: string | null };
}

export async function searchFullText(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const q = encodeURIComponent(query);
  const page = await getJson<Page<RawHit>>(
    `/api/documents/?query=${q}&page_size=12&fields=id,title`,
    signal,
  );
  return page.results.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.__search_hit__?.highlights ?? '',
  }));
}

export function previewUrl(id: number, version?: number): string {
  return `/api/documents/${id}/preview/${version ? `?version=${version}` : ''}`;
}

export function downloadUrl(id: number, version?: number): string {
  return `/api/documents/${id}/download/?original=true${version ? `&version=${version}` : ''}`;
}
