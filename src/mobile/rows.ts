import type { IconName } from '../icons/paths';
import type { TagIconName } from '../icons/tag-icons';
import { filterChips, type Filters, type SortKey } from '../domain/filters';

/** The pure model of the phone's filter sheet: its menu, the summaries, presets and search. */

export type DateField = 'created' | 'added' | 'modified';
/** A row that opens a page of its own inside the sheet. */
export type PageKind = 'areas' | 'topics' | DateField | 'size' | 'pages' | 'type' | 'sort';
/** A row that is a switch: it never opens a page. */
export type SwitchKind = 'signed' | 'versions' | 'superseded';
export type MenuKind = PageKind | SwitchKind;

export interface MenuItem {
  kind: MenuKind;
  label: string;
  icon: IconName | TagIconName;
}

/** The rows of the menu, in order. */
export const MENU: readonly MenuItem[] = [
  { kind: 'areas', label: 'Areas', icon: 'folder' },
  { kind: 'topics', label: 'Topics', icon: 'tag' },
  { kind: 'created', label: 'Created', icon: 'calendar' },
  { kind: 'added', label: 'Added', icon: 'upload' },
  { kind: 'modified', label: 'Modified', icon: 'clock' },
  { kind: 'size', label: 'Size', icon: 'scale' },
  { kind: 'pages', label: 'Pages', icon: 'files' },
  { kind: 'type', label: 'Type', icon: 'file_text' },
  { kind: 'signed', label: 'Signed', icon: 'badge_check' },
  { kind: 'versions', label: 'Versions', icon: 'layers' },
  { kind: 'sort', label: 'Sort', icon: 'arrow_up_down' },
];

export const isSwitch = (kind: MenuKind): kind is SwitchKind =>
  kind === 'signed' || kind === 'versions' || kind === 'superseded';

export type FilterPageKind = Exclude<PageKind, 'areas' | 'topics' | 'sort'>;

export const isFilterPage = (kind: PageKind): kind is FilterPageKind =>
  kind !== 'areas' && kind !== 'topics' && kind !== 'sort';

export const DESKTOP_MENU: readonly MenuItem[] = [
  ...MENU.filter(({ kind }) => isSwitch(kind) || isFilterPage(kind)),
  { kind: 'superseded', label: 'Superseded', icon: 'archive' },
];

export const labelOf = (kind: MenuKind): string =>
  MENU.find((item) => item.kind === kind)?.label ?? '';

/** A local calendar day as `YYYY-MM-DD`. Filters compare these strings. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface Preset {
  id: string;
  label: string;
  from: string;
  to: string;
}

/** Ranges that end today, and two calendar years. Each is stored as plain dates. */
export function datePresets(today: Date): Preset[] {
  const back = (days: number) =>
    isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
  const year = today.getFullYear();
  return [
    { id: '7', label: 'Last 7 days', from: back(6), to: '' },
    { id: '30', label: 'Last 30 days', from: back(29), to: '' },
    { id: '90', label: 'Last 90 days', from: back(89), to: '' },
    { id: 'year', label: 'This year', from: `${year}-01-01`, to: '' },
    { id: 'last-year', label: 'Last year', from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
  ];
}

export function presetOf(from: string, to: string, today: Date): Preset | undefined {
  if (!from && !to) return undefined;
  return datePresets(today).find((preset) => preset.from === from && preset.to === to);
}

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const FULL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** "Mar 1", or "Mar 1, 2025" when the year is not this year. */
export function shortDay(value: string, today: Date): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return (date.getFullYear() === today.getFullYear() ? MONTH_DAY : FULL).format(date);
}

export function dateSummary(field: DateField, filters: Filters, today: Date): string {
  const from = filters[`${field}From`];
  const to = filters[`${field}To`];
  if (!from && !to) return '';
  const preset = presetOf(from, to, today);
  if (preset) return preset.label;
  if (from && to) return `${shortDay(from, today)} – ${shortDay(to, today)}`;
  return from ? `From ${shortDay(from, today)}` : `To ${shortDay(to, today)}`;
}

/** The chip label without its leading name: "Size from 105 KB" reads "From 105 KB". */
function chipSummary(filters: Filters, id: string, name: string): string {
  const label = filterChips(filters).find((chip) => chip.id === id)?.label ?? '';
  const rest = label.startsWith(`${name} `) ? label.slice(name.length + 1) : label;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** One chosen name, or how many. */
export function namesSummary(names: readonly string[]): string {
  if (names.length === 0) return '';
  return names.length === 1 ? names[0]! : String(names.length);
}

export interface SummaryContext {
  filters: Filters;
  sort: SortKey;
  sortLabel: string;
  areaNames: readonly string[];
  topicNames: readonly string[];
  today: Date;
}

/** The muted value at the end of a menu row. Empty when the filter is not set. */
export function summaryOf(kind: PageKind, ctx: SummaryContext): string {
  switch (kind) {
    case 'areas':
      return namesSummary(ctx.areaNames);
    case 'topics':
      return namesSummary(ctx.topicNames);
    case 'size':
      return chipSummary(ctx.filters, 'size', 'Size');
    case 'pages':
      return chipSummary(ctx.filters, 'pages', 'Pages');
    case 'type':
      return chipSummary(ctx.filters, 'mime', '');
    case 'sort':
      return ctx.sortLabel;
    default:
      return dateSummary(kind, ctx.filters, ctx.today);
  }
}

/** True when a page has something to clear. Sort always has a value, so it has none. */
export function isSet(kind: PageKind, filters: Filters): boolean {
  switch (kind) {
    case 'size':
      return !!(filters.minSize || filters.maxSize);
    case 'pages':
      return !!(filters.minPages || filters.maxPages);
    case 'type':
      return !!filters.mime;
    case 'created':
    case 'added':
    case 'modified':
      return !!(filters[`${kind}From`] || filters[`${kind}To`]);
    default:
      return false;
  }
}

/** The fields a page's Clear resets. */
export function clearOf(kind: PageKind): Partial<Filters> {
  switch (kind) {
    case 'size':
      return { minSize: '', maxSize: '' };
    case 'pages':
      return { minPages: '', maxPages: '' };
    case 'type':
      return { mime: '' };
    case 'created':
    case 'added':
    case 'modified':
      return { [`${kind}From`]: '', [`${kind}To`]: '' };
    default:
      return {};
  }
}

/** Sizes are stored in bytes and typed in KB. */
export const bytesToKb = (bytes: string): string => (bytes ? String(Number(bytes) / 1000) : '');
export const kbToBytes = (kb: string): string => (kb ? String(Math.round(Number(kb) * 1000)) : '');

/** Lower case, without accents: "Café" matches "cafe". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Names that contain the query, the ones that start with it first. */
export function searchNames<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const q = fold(query.trim());
  if (!q) return [];
  const hits = items.filter((item) => fold(item.name).includes(q));
  const starts = (item: T) => (fold(item.name).startsWith(q) ? 0 : 1);
  return [...hits].sort((a, b) => starts(a) - starts(b));
}

/** Menu rows whose label contains the query. An empty query keeps them all. */
export function searchMenu(query: string, items = MENU): readonly MenuItem[] {
  const q = fold(query.trim());
  return q ? items.filter((item) => fold(item.label).includes(q)) : items;
}
