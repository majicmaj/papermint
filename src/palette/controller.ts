import { matchTitle } from './match';
import { parseHighlights } from './snippet';
import type { Entry, FullTextHit, Item, OpenMode, PaletteState } from './types';

export interface PaletteOptions {
  /** Current index in display order. Called on every keystroke. */
  getEntries: () => readonly Entry[];
  /** Full-text search. Must honor `signal`. */
  fullText: (query: string, signal: AbortSignal) => Promise<FullTextHit[]>;
  onActivate: (id: number, mode: OpenMode) => void;
  debounceMs?: number;
  maxTitleItems?: number;
  maxTextItems?: number;
}

type Listener = (state: PaletteState) => void;

/**
 * Framework-free palette logic: instant title matches from the cached index,
 * then full-text results. No DOM, no framework; any view layer can subscribe.
 */
export class PaletteController {
  private state: PaletteState = {
    open: false,
    query: '',
    items: [],
    selected: 0,
    searching: false,
    failed: false,
  };
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private textItems: Item[] = [];

  constructor(private readonly options: PaletteOptions) {}

  getState(): PaletteState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  open(): void {
    this.update({ open: true, query: '', selected: 0 });
    this.recompute();
  }

  close(): void {
    this.cancelSearch();
    this.textItems = [];
    this.update({
      open: false,
      query: '',
      items: [],
      selected: 0,
      searching: false,
      failed: false,
    });
  }

  setQuery(query: string): void {
    this.cancelSearch();
    this.textItems = [];
    this.update({ query, selected: 0, failed: false });
    this.recompute();
    if (query.trim().length >= 2) this.scheduleFullText(query.trim());
  }

  /** Run the full-text search again after a failure. */
  retry(): void {
    const query = this.state.query.trim();
    if (query.length < 2) return;
    this.cancelSearch();
    this.update({ failed: false });
    this.scheduleFullText(query);
  }

  /** Re-run title matching, for example after the index refreshed. */
  refresh(): void {
    if (this.state.open) this.recompute();
  }

  move(delta: number): void {
    const count = this.state.items.length;
    if (count === 0) return;
    this.update({ selected: (this.state.selected + delta + count) % count });
  }

  select(index: number): void {
    if (index >= 0 && index < this.state.items.length) this.update({ selected: index });
  }

  /** Act on one item. Pass `index` to act on a clicked item, not on the highlighted one. */
  activate(mode: OpenMode, index: number = this.state.selected): void {
    const item = this.state.items[index];
    if (!item) return;
    this.options.onActivate(item.id, mode);
    if (mode === 'open') this.close();
  }

  private update(patch: Partial<PaletteState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private titleItems(): Item[] {
    const { query } = this.state;
    const limit = this.options.maxTitleItems ?? 8;
    const entries = this.options.getEntries();
    if (query.trim() === '') return entries.slice(0, limit).map((e) => toItem(e, []));
    const scored: { entry: Entry; score: number; ranges: [number, number][] }[] = [];
    for (const entry of entries) {
      const hit = matchTitle(entry.title, query);
      if (hit) scored.push({ entry, score: hit.score, ranges: hit.ranges });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => toItem(s.entry, s.ranges));
  }

  private recompute(): void {
    const titles = this.titleItems();
    const seen = new Set(titles.map((item) => item.id));
    // Hits that are already shown as title matches do not use up the full-text budget.
    const limit = this.options.maxTextItems ?? 6;
    const extra = this.textItems.filter((item) => !seen.has(item.id)).slice(0, limit);
    const merged = [...titles, ...extra];
    const selected = Math.min(this.state.selected, Math.max(0, merged.length - 1));
    this.update({ items: merged, selected });
  }

  private cancelSearch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    this.abort = null;
  }

  private scheduleFullText(query: string): void {
    this.update({ searching: true });
    this.timer = setTimeout(() => void this.runFullText(query), this.options.debounceMs ?? 120);
  }

  private async runFullText(query: string): Promise<void> {
    const abort = new AbortController();
    this.abort = abort;
    try {
      const hits = await this.options.fullText(query, abort.signal);
      if (abort.signal.aborted) return;
      const entries = new Map(this.options.getEntries().map((e) => [e.id, e]));
      this.textItems = hits.map((hit) => ({
        id: hit.id,
        title: hit.title,
        hint: entries.get(hit.id)?.hint,
        badge: entries.get(hit.id)?.badge,
        ranges: [],
        snippet: parseHighlights(hit.snippet),
        source: 'text',
      }));
      this.update({ searching: false, failed: false });
      this.recompute();
    } catch {
      if (!abort.signal.aborted) this.update({ searching: false, failed: true });
    }
  }
}

function toItem(entry: Entry, ranges: [number, number][]): Item {
  return {
    id: entry.id,
    title: entry.title,
    hint: entry.hint,
    badge: entry.badge,
    ranges,
    snippet: null,
    source: 'title',
  };
}
