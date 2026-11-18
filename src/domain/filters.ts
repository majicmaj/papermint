import { formatBytes } from '../shell/bytes';
import { formatDate } from './format';
import type { DetailedDoc } from './record-details';
export interface Filters {
  createdFrom: string;
  createdTo: string;
  addedFrom: string;
  addedTo: string;
  modifiedFrom: string;
  modifiedTo: string;
  minSize: string;
  maxSize: string;
  minPages: string;
  maxPages: string;
  mime: string;
  versions: boolean;
  signed: boolean;
  sensitive: boolean;
  unfiled: boolean;
  /** Show Superseded records in Records as well. */
  superseded: boolean;
}
export const EMPTY_FILTERS: Filters = {
  createdFrom: '',
  createdTo: '',
  addedFrom: '',
  addedTo: '',
  modifiedFrom: '',
  modifiedTo: '',
  minSize: '',
  maxSize: '',
  minPages: '',
  maxPages: '',
  mime: '',
  versions: false,
  signed: false,
  sensitive: false,
  unfiled: false,
  superseded: false,
};
export type SortKey = 'created' | 'added' | 'modified' | 'title' | 'size';
function matchesNumbers(doc: DetailedDoc, filters: Filters): boolean {
  for (const [value, min, max] of [
    [doc.size, filters.minSize, filters.maxSize],
    [doc.pageCount, filters.minPages, filters.maxPages],
  ] as const) {
    if ((min || max) && value == null) return false;
    if (min && value! < Number(min)) return false;
    if (max && value! > Number(max)) return false;
  }
  return true;
}
interface RecordFlags {
  signed: boolean;
  sensitive: boolean;
  unfiled: boolean;
}

export function matchesFilters(doc: DetailedDoc, filters: Filters, flags: RecordFlags): boolean {
  for (const key of ['created', 'added', 'modified'] as const) {
    const value = (doc[key] ?? '').slice(0, 10);
    if (filters[`${key}From`] && value < filters[`${key}From`]) return false;
    if (filters[`${key}To`] && (!value || value > filters[`${key}To`])) return false;
  }
  if (!matchesNumbers(doc, filters)) return false;
  return (
    (!filters.mime || doc.mime === filters.mime) &&
    (!filters.versions || doc.versions.length > 1) &&
    (!filters.signed || flags.signed) &&
    (!filters.sensitive || flags.sensitive) &&
    (!filters.unfiled || flags.unfiled)
  );
}
export function sortRecords(docs: DetailedDoc[], key: SortKey, ascending: boolean): DetailedDoc[] {
  return [...docs].sort((a, b) => {
    const av = a[key] ?? '';
    const bv = b[key] ?? '';
    const comparison =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
    return (ascending ? comparison : -comparison) || a.id - b.id;
  });
}

export interface FilterChip {
  id: string;
  label: string;
  /** The fields to reset when the chip is removed. */
  clear: Partial<Filters>;
}

function range(from: string, to: string, show: (value: string) => string): string {
  if (from && to) return `${show(from)} – ${show(to)}`;
  return from ? `from ${show(from)}` : `to ${show(to)}`;
}

/** A short name for a MIME type: "PDF", "PNG", "Text". */
export function typeName(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return mime.slice(6).toUpperCase();
  return mime.startsWith('text/') ? 'Text' : mime;
}

const DATES = [
  ['created', 'Created'],
  ['added', 'Added'],
  ['modified', 'Modified'],
] as const;

function dateChips(filters: Filters): FilterChip[] {
  return DATES.flatMap(([key, name]) => {
    const from = filters[`${key}From`];
    const to = filters[`${key}To`];
    if (!from && !to) return [];
    const label = `${name} ${range(from, to, (value) => formatDate(value))}`;
    return [{ id: key, label, clear: { [`${key}From`]: '', [`${key}To`]: '' } }];
  });
}

function numberChips(filters: Filters): FilterChip[] {
  const out: FilterChip[] = [];
  const size = (value: string) => formatBytes(Number(value));
  if (filters.minSize || filters.maxSize) {
    const label = `Size ${range(filters.minSize, filters.maxSize, size)}`;
    out.push({ id: 'size', label, clear: { minSize: '', maxSize: '' } });
  }
  if (filters.minPages || filters.maxPages) {
    const label = `Pages ${range(filters.minPages, filters.maxPages, (value) => value)}`;
    out.push({ id: 'pages', label, clear: { minPages: '', maxPages: '' } });
  }
  return out;
}

/** One chip per active filter, in a fixed order. Paired fields share a chip. */
export function filterChips(filters: Filters): FilterChip[] {
  const flags: FilterChip[] = [
    ...(filters.mime ? [{ id: 'mime', label: typeName(filters.mime), clear: { mime: '' } }] : []),
    ...(filters.versions
      ? [{ id: 'versions', label: 'Versions', clear: { versions: false } }]
      : []),
    ...(filters.signed ? [{ id: 'signed', label: 'Signed', clear: { signed: false } }] : []),
    ...(filters.sensitive
      ? [{ id: 'sensitive', label: 'Sensitive', clear: { sensitive: false } }]
      : []),
    ...(filters.unfiled ? [{ id: 'unfiled', label: 'Unfiled', clear: { unfiled: false } }] : []),
    ...(filters.superseded
      ? [{ id: 'superseded', label: 'Superseded', clear: { superseded: false } }]
      : []),
  ];
  return [...dateChips(filters), ...numberChips(filters), ...flags];
}
