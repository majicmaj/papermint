import type { SortKey } from './filters';
import type { DetailedDoc } from './record-details';

/** List geometry is fixed so each item’s offset is known before layout. */
export const PHONE_ROW = 52;
export const PHONE_HEAD = 40;
/** The space between the header and the first item. */
export const LIST_TOP = 8;

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

export function monthLabel(value: string | undefined): string {
  const date = parse(value);
  return date ? MONTH.format(date) : 'No date';
}

/** The date a row shows: the sorted date, else the document's creation date. */
export function dateFieldFor(sort: SortKey): DateField {
  if (sort === 'created' || sort === 'added' || sort === 'modified') return sort;
  return 'created';
}

/** A date sort groups by month; a title or size sort is one flat list. */
export function groupField(sort: SortKey): DateField | null {
  return sort === 'created' || sort === 'added' || sort === 'modified' ? sort : null;
}

/** Headers and rows in order, each with its offset from the top of the list. */
export function listItems(
  rows: readonly DetailedDoc[],
  field: DateField | null,
  { row, heading, top } = { row: PHONE_ROW, heading: PHONE_HEAD, top: LIST_TOP },
): ListItem[] {
  const items: ListItem[] = [];
  let y = top;
  let last: string | null = null;
  for (const doc of rows) {
    if (field) {
      const label = monthLabel(doc[field]);
      if (label !== last) {
        items.push({ kind: 'head', label, y });
        y += heading;
        last = label;
      }
    }
    items.push({ kind: 'row', doc, y });
    y += row;
  }
  return items;
}
