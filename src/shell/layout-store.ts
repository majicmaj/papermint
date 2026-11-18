import { createStore, useStore } from '../state/store';
import {
  DEFAULTS,
  LAYOUT_KEY,
  clampWidth,
  parseLayout,
  serializeLayout,
  type Column,
  type Layout,
} from './layout';

function load(): Layout {
  try {
    return parseLayout(localStorage.getItem(LAYOUT_KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

export const layoutStore = createStore<Layout>(load());

function apply(layout: Layout): void {
  const style = document.documentElement.style;
  style.setProperty('--rail', `${layout.rail}px`);
  style.setProperty('--list', `${layout.list}px`);
  document.documentElement.toggleAttribute('data-rail-collapsed', layout.collapsed);
}

function save(layout: Layout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, serializeLayout(layout));
  } catch {
    // Storage is optional. The widths still apply for this visit.
  }
}

layoutStore.subscribe(() => apply(layoutStore.get()));

/** Set one column width, clamped to its limits and to the room the pane needs. */
export function setWidth(column: Column, value: number, persist = true): void {
  const current = layoutStore.get();
  const next = { ...current, [column]: clampWidth(column, value, current, window.innerWidth) };
  if (next[column] === current[column]) return;
  layoutStore.set(next);
  if (persist) save(layoutStore.get());
}

export function commitLayout(): void {
  save(layoutStore.get());
}

/** Fold the sidebar away, or bring it back. */
export function toggleRail(): void {
  layoutStore.set({ collapsed: !layoutStore.get().collapsed });
  save(layoutStore.get());
}

export function resetWidth(column: Column): void {
  setWidth(column, DEFAULTS[column]);
}

export function useLayout(): Layout {
  return useStore(layoutStore, (s) => ({ rail: s.rail, list: s.list, collapsed: s.collapsed }));
}
