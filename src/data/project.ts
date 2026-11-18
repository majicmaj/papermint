import type { Doc, DocVersion, Tag } from '../api/types';
import type { TagIcons } from '../api/ui-settings';
import type { CustomValue, DetailedDoc } from '../domain/record-details';

/**
 * What the app keeps on disk, and nothing more. The record index is built here from an explicit
 * allowlist of fields: id, title, tags, dates, page count, type, a summary of each version, and
 * the ids a record is linked to as "Superseded by". Never the text of a record, never notes,
 * never any other custom field, whatever the API or an older version of the app put in the
 * object. Everything is rebuilt field by field, so an unexpected field cannot get through.
 */
export interface StoredIndex {
  docs: DetailedDoc[];
  tags: Tag[];
  icons?: TagIcons;
  /** The id of the "Superseded by" custom field, so the links can be read before the network answers. */
  successorField?: number | null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const whole = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;
const wholes = (value: unknown): number[] =>
  Array.isArray(value) ? value.flatMap((item) => whole(item) ?? []) : [];

function projectVersion(raw: unknown): DocVersion | null {
  if (!isObject(raw)) return null;
  const id = whole(raw['id']);
  if (id === null) return null;
  return {
    id,
    added: text(raw['added']),
    label: typeof raw['label'] === 'string' ? raw['label'] : null,
    isRoot: raw['isRoot'] === true,
  };
}

/** Only the links of the successor field survive, as plain ids. */
function projectLinks(raw: unknown, successorField: number | null): CustomValue[] {
  if (successorField === null || !Array.isArray(raw)) return [];
  const field = raw.find((item) => isObject(item) && item['field'] === successorField);
  return isObject(field) ? [{ field: successorField, value: wholes(field['value']) }] : [];
}

export function projectDoc(raw: unknown, successorField: number | null): DetailedDoc | null {
  if (!isObject(raw)) return null;
  const id = whole(raw['id']);
  if (id === null) return null;
  const doc: Doc = {
    id,
    title: text(raw['title']),
    tags: wholes(raw['tags']),
    created: text(raw['created']),
    added: text(raw['added']),
    pageCount: whole(raw['pageCount']),
    mime: text(raw['mime']),
    versions: Array.isArray(raw['versions'])
      ? raw['versions'].flatMap((v) => projectVersion(v) ?? [])
      : [],
  };
  const modified = typeof raw['modified'] === 'string' ? raw['modified'] : undefined;
  return { ...doc, modified, customFields: projectLinks(raw['customFields'], successorField) };
}

function projectTag(raw: unknown): Tag | null {
  if (!isObject(raw)) return null;
  const id = whole(raw['id']);
  if (id === null) return null;
  const parent = whole(raw['parent']);
  const tag: Tag = {
    id,
    name: text(raw['name']),
    slug: text(raw['slug']),
    color: text(raw['color']),
  };
  if (parent !== null || raw['parent'] === null) tag.parent = parent;
  if (Array.isArray(raw['children'])) tag.children = wholes(raw['children']);
  return tag;
}

function projectIcons(raw: unknown): TagIcons {
  if (!isObject(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

/** Build the stored form of the index. Anything not on the allowlist is dropped. */
export function projectIndex(raw: unknown, successorField?: number | null): StoredIndex | null {
  if (!isObject(raw) || !Array.isArray(raw['docs']) || !Array.isArray(raw['tags'])) return null;
  const field = successorField !== undefined ? successorField : whole(raw['successorField']);
  return {
    docs: raw['docs'].flatMap((doc) => projectDoc(doc, field) ?? []),
    tags: raw['tags'].flatMap((tag) => projectTag(tag) ?? []),
    icons: projectIcons(raw['icons']),
    successorField: field,
  };
}
