import type { SortKey } from './filters';
import type { DetailedDoc } from './record-details';

/** List geometry is fixed so each item’s offset is known before layout. */
export const PHONE_ROW = 52;
export const PHONE_HEAD = 40;
/** The space between the header and the first item. */
export const LIST_TOP = 8;

export const GROUPING_OPTIONS = [
  ['auto', 'Automatic'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['none', 'None'],
] as const;

export type Grouping = (typeof GROUPING_OPTIONS)[number][0];

export interface RecordGroup {
  label: string | null;
  rows: readonly DetailedDoc[];
}

export type DateField = 'created' | 'added' | 'modified';

export type ListItem =
  { kind: 'head'; label: string; y: number } | { kind: 'row'; doc: DetailedDoc; y: number };

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const LONG = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** `YYYY-MM-DD` is a calendar day and never shifts with the time zone; a timestamp is local. */
function parse(value: string | undefined): Date | null {
  if (!value) return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Nov 16" this year, "Dec 3, 2025" in any other year. */
export function shortDate(value: string | undefined, now = new Date()): string {
  const date = parse(value);
  if (!date) return '';
  return date.getFullYear() === now.getFullYear() ? SHORT.format(date) : LONG.format(date);
}

/** The date a row shows: the sorted date, else the document's creation date. */
export function dateFieldFor(sort: SortKey): DateField {
  return groupField(sort) ?? 'created';
}

/** A date sort groups by month; a title or size sort is one flat list. */
export function groupField(sort: SortKey): DateField | null {
  return sort === 'created' || sort === 'added' || sort === 'modified' ? sort : null;
}

function groupDate(value: string | undefined, yearOnly: boolean): [number, string] {
  const date = parse(value);
  if (!date) return [-1, 'No date'];
  const year = date.getFullYear();
  const month = yearOnly ? 0 : date.getMonth();
  return [year * 12 + month, yearOnly ? String(year) : MONTH.format(date)];
}

/** Keep the active sort inside each group. For title and size sorts, newer groups come first. */
export function groupRecords(
  rows: readonly DetailedDoc[],
  sort: SortKey,
  grouping: Grouping,
): RecordGroup[] {
  const sortedDate = groupField(sort);
  if (grouping === 'none' || (grouping === 'auto' && !sortedDate)) return [{ label: null, rows }];
  const field = sortedDate ?? 'created';
  const buckets = new Map<number, { label: string; rows: DetailedDoc[] }>();
  for (const doc of rows) {
    const [key, label] = groupDate(doc[field], grouping === 'year');
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, rows: [] };
      buckets.set(key, bucket);
    }
    bucket.rows.push(doc);
  }
  const ordered = [...buckets];
  if (!sortedDate) ordered.sort(([a], [b]) => b - a);
  return ordered.map(([, group]) => group);
}

/** Headers and rows in display order, each with its offset from the top of the list. */
export function listItems(
  groups: readonly RecordGroup[],
  { row, heading, top } = { row: PHONE_ROW, heading: PHONE_HEAD, top: LIST_TOP },
): ListItem[] {
  const items: ListItem[] = [];
  let y = top;
  for (const group of groups) {
    if (group.label) {
      items.push({ kind: 'head', label: group.label, y });
      y += heading;
    }
    for (const doc of group.rows) {
      items.push({ kind: 'row', doc, y });
      y += row;
    }
  }
  return items;
}
