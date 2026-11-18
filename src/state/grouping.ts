import { GROUPING_OPTIONS, type Grouping } from '../domain/list-groups';
import { swap } from '../motion/transition';
import { applyHeld } from './app';
import { createStore, useStore } from './store';

const KEY = 'papermint.grouping';

function readGrouping(): Grouping {
  try {
    const value = localStorage.getItem(KEY);
    return GROUPING_OPTIONS.find(([key]) => key === value)?.[0] ?? 'auto';
  } catch {
    return 'auto';
  }
}

const store = createStore({ grouping: readGrouping() });

export function useGrouping(): Grouping {
  return useStore(store, ({ grouping }) => grouping);
}

export function setGrouping(grouping: Grouping): void {
  if (store.get().grouping === grouping) return;
  swap('results', () => {
    applyHeld();
    store.set({ grouping });
    try {
      localStorage.setItem(KEY, grouping);
    } catch {
      // Storage is optional.
    }
  });
}
