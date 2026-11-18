import type { IconName } from '../icons/paths';
import type { TagIconName } from '../icons/tag-icons';

export type Range = [start: number, end: number];

export interface Segment {
  text: string;
  hit: boolean;
}

/** One searchable record, supplied by the host in display order. */
export interface Entry {
  id: number;
  title: string;
  /** Secondary line for title matches, for example the date. */
  hint?: string;
  /** Status badge shown beside the title. */
  badge?: Badge;
}

export interface Badge {
  label: string;
  /** CSS color of the dot. */
  color: string;
}

export interface Item {
  id: number;
  title: string;
  hint?: string;
  badge?: Badge;
  /** Highlighted ranges inside `title` (title matches only). */
  ranges: Range[];
  /** Full-text snippet (full-text matches only). */
  snippet: Segment[] | null;
  source: 'title' | 'text';
}

export interface FullTextHit {
  id: number;
  title: string;
  /** Raw highlight markup from the server: text with `<b>` around matches. */
  snippet: string;
}

export type OpenMode = 'open' | 'download';

export interface Command {
  title: string;
  icon: IconName | TagIconName;
  detail?: string;
  run: () => IdleContent | void;
}

export interface IdleContent {
  title?: string;
  entries?: readonly Entry[];
  commands?: readonly Command[];
  selected?: number;
}

export interface PaletteState {
  open: boolean;
  query: string;
  items: Item[];
  commands: readonly Command[];
  title: string | undefined;
  nested: boolean;
  selected: number;
  /** True while a full-text request is in flight. */
  searching: boolean;
  /** True when the last full-text request failed. Title matches still show. */
  failed: boolean;
}
