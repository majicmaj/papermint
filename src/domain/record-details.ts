import type { Doc, Tag } from '../api/types';

export interface CustomValue {
  field: number;
  value: unknown;
}
export type DetailedDoc = Doc & {
  modified?: string;
  customFields?: CustomValue[];
  size?: number | null;
};
function marked(doc: Doc, tags: readonly Tag[], name: string): boolean {
  return doc.tags.some((id) =>
    tags.some((tag) => tag.id === id && tag.name.trim().toLowerCase() === name),
  );
}
export const signed = (doc: Doc, tags: readonly Tag[]) => marked(doc, tags, 'signed');
/** The privacy marker. It is never an area or a topic. */
export const sensitive = (doc: Doc, tags: readonly Tag[]) => marked(doc, tags, 'sensitive');

/**
 * Document links are symmetric in Paperless: linking A to B also lists A in B's field.
 * So the field of a Superseded record holds its successor, and the field of a Current
 * record holds the records it replaced. The status of the linked record tells them apart.
 */
export function linkedIds(doc: DetailedDoc, fieldId: number | null): number[] {
  const value = doc.customFields?.find((field) => field.field === fieldId)?.value;
  return Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
}

/**
 * The successor of a Superseded record. The one linked record that is not Superseded, if
 * there is exactly one. If every link is itself Superseded, follow the chain forward (each
 * record's own links) to the single Current record it ends at. Each record is visited once,
 * so a cycle cannot loop. If more than one record could be the successor, or none can be
 * found, there is no successor: showing a guess would be worse than showing nothing.
 *
 * `linksOf` gives the links of another record, so a chain can be followed.
 */
export function successorId(
  doc: DetailedDoc,
  fieldId: number | null,
  isSuperseded: (id: number) => boolean,
  linksOf: (id: number) => number[] = () => [],
): number | null {
  const links = linkedIds(doc, fieldId);
  const direct = links.filter((id) => id !== doc.id && !isSuperseded(id));
  if (direct.length > 0) return direct.length === 1 ? direct[0]! : null;
  const ends = new Set<number>();
  const seen = new Set<number>([doc.id]);
  const queue = [...links];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (isSuperseded(id)) queue.push(...linksOf(id));
    else ends.add(id);
  }
  return ends.size === 1 ? [...ends][0]! : null;
}

/** The linked records that are Superseded: what a Current record replaced. */
export function replacedIds(
  doc: DetailedDoc,
  fieldId: number | null,
  isSuperseded: (id: number) => boolean,
): number[] {
  return linkedIds(doc, fieldId).filter(isSuperseded);
}

/**
 * New field value for a record whose status was just set. Only this record's field is
 * written; Paperless mirrors it into the successor. A successor that is no longer wanted
 * is dropped, and links to replaced records stay.
 */
export function nextLinks(
  doc: DetailedDoc,
  fieldId: number | null,
  isSuperseded: (id: number) => boolean,
  successor: number | null,
): number[] {
  const kept = linkedIds(doc, fieldId).filter(isSuperseded);
  return successor === null ? kept : [...kept.filter((id) => id !== successor), successor];
}
