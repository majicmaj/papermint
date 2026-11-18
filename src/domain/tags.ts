import type { Doc, Tag } from '../api/types';

export type StatusKey = 'current' | 'superseded';

/** Display order of statuses in menus. */
export const STATUS_ORDER: readonly StatusKey[] = ['current', 'superseded'];

/** Names that are never an area or a topic. `Signed` is a marker, `Final` is the legacy `Current`. */
export const RESERVED_TAGS: readonly string[] = ['current', 'superseded', 'signed', 'final'];

export type HierarchicalTag = Tag;

export interface TagModel {
  byId: Map<number, Tag>;
  /** Status tags present in Paperless, in menu order. */
  statuses: Tag[];
  statusKey: Map<number, StatusKey>;
  /** Top-level tags that are not reserved. Without any hierarchy every such tag is an area. */
  areas: Tag[];
  /** Tags below an area. */
  topics: Tag[];
  /** Topic id to the id of the area it belongs to. */
  areaOf: Map<number, number>;
}

function isStatusKey(slug: string): slug is StatusKey {
  return (STATUS_ORDER as readonly string[]).includes(slug);
}

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name);

/** The top-level ancestor of a tag, or the tag itself when it has no parent. */
function rootOf(tag: Tag, byId: Map<number, Tag>): Tag {
  let current = tag;
  for (let depth = 0; depth < 8 && current.parent != null; depth++) {
    const parent = byId.get(current.parent);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function buildTagModel(tags: readonly Tag[], docs: readonly Doc[]): TagModel {
  void docs;
  const byId = new Map(tags.map((t) => [t.id, t]));
  const statusKey = new Map<number, StatusKey>();
  const statuses: Tag[] = [];
  const topics: Tag[] = [];
  const areas: Tag[] = [];
  const areaOf = new Map<number, number>();
  for (const tag of tags) {
    const name = tag.name.trim().toLowerCase();
    const slug = name === 'final' ? 'current' : name;
    if (name === 'signed' || name === 'sensitive') continue;
    if (isStatusKey(slug)) {
      statusKey.set(tag.id, slug);
      statuses.push(tag);
    } else if (tag.parent != null && byId.has(tag.parent)) {
      topics.push(tag);
      areaOf.set(tag.id, rootOf(tag, byId).id);
    } else {
      areas.push(tag);
    }
  }
  statuses.sort(
    (a, b) =>
      STATUS_ORDER.indexOf(statusKey.get(a.id)!) - STATUS_ORDER.indexOf(statusKey.get(b.id)!),
  );
  return {
    byId,
    statuses,
    statusKey,
    areas: areas.sort(byName),
    topics: topics.sort(byName),
    areaOf,
  };
}

export function statusKeyOf(tags: readonly number[], model: TagModel): StatusKey | null {
  for (const id of tags) {
    const key = model.statusKey.get(id);
    if (key) return key;
  }
  return tags.some((id) => model.byId.get(id)?.name.trim().toLowerCase() === 'signed')
    ? 'current'
    : null;
}

export function statusOf(doc: Doc, model: TagModel): StatusKey | null {
  return statusKeyOf(doc.tags, model);
}

export function statusTag(doc: Doc, model: TagModel): Tag | null {
  for (const id of doc.tags) {
    if (model.statusKey.has(id)) return model.byId.get(id) ?? null;
  }
  return null;
}

export function topicsOf(doc: Doc, model: TagModel): Tag[] {
  const topicIds = new Set(model.topics.map((t) => t.id));
  return doc.tags.flatMap((id) => (topicIds.has(id) ? [model.byId.get(id)!] : []));
}

export function areasOf(doc: Doc, model: TagModel): Tag[] {
  const areaIds = new Set(model.areas.map((t) => t.id));
  return doc.tags.flatMap((id) => (areaIds.has(id) ? [model.byId.get(id)!] : []));
}

/** Exactly one status tag per document: drop every status tag, then add the chosen one. */
export function withStatus(tags: readonly number[], model: TagModel, statusId: number): number[] {
  return [...tags.filter((id) => !model.statusKey.has(id)), statusId];
}

export function matchesTaxonomy(
  doc: Doc,
  areas: readonly number[],
  topics: readonly number[],
): boolean {
  return (
    (areas.length === 0 || areas.some((id) => doc.tags.includes(id))) &&
    (topics.length === 0 || topics.some((id) => doc.tags.includes(id)))
  );
}
