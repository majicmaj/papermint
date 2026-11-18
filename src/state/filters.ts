import { EMPTY_FILTERS, filterChips, type Filters } from '../domain/filters';
import type { TagModel } from '../domain/tags';
import { selectionOf, visibleSelection } from '../domain/taxonomy';
import { swap } from '../motion/transition';
import { appStore, applyHeld, useApp } from './app';
import { createStore, useStore } from './store';
import { selection, useTopics, writeSelection } from './topics';

const store = createStore({ filters: EMPTY_FILTERS });

export function useFilters(): Filters {
  return useStore(store, (s) => s.filters);
}

export function updateFilters(patch: Partial<Filters>): void {
  swap('results', () => {
    applyHeld();
    store.set((s) => ({ filters: { ...s.filters, ...patch } }));
  });
}

function activeTags(model: TagModel, { areas, selected }: ReturnType<typeof selection.get>) {
  const activeAreas = selectionOf(model, areas);
  return { areas: activeAreas, topics: visibleSelection(model, activeAreas, selected) };
}

export function useFilterTags() {
  const model = useApp((s) => s.model);
  const chosen = useTopics();
  return { ...activeTags(model, chosen), model };
}

export function useActiveFilterCount(): number {
  const filters = useFilters();
  const { areas, topics } = useFilterTags();
  return areas.length + topics.length + filterChips(filters).length;
}

/** Replace every filter, area and topic at once, in one results change. */
export function replaceFilters(filters: Filters, areas: number[], selected: number[]): void {
  swap('results', () => {
    applyHeld();
    store.set({ filters });
    writeSelection({ areas, selected });
  });
}

export const filtersStore = store;

export function clearFilters(): void {
  replaceFilters(EMPTY_FILTERS, [], []);
}

export function clearFiltersCommand(): (() => void) | undefined {
  const { areas, topics } = activeTags(appStore.get().model, selection.get());
  return areas.length + topics.length + filterChips(store.get().filters).length > 0
    ? clearFilters
    : undefined;
}
