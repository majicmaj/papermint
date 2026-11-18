import { swap } from '../motion/transition';
import { applyHeld } from './app';
import { createStore, useStore } from './store';

const AREAS_KEY = 'majin.areas';
const TOPICS_KEY = 'majin.topics';

function readIds(key: string): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage is optional.
  }
}

/** The rail selection. No area or topic selected means no restriction. It survives a reload. */
const store = createStore({ areas: readIds(AREAS_KEY), selected: readIds(TOPICS_KEY) });

export function useTopics() {
  return useStore(store, (state) => state);
}

export const selection = store;

/** A choice here changes the results, so they cross-fade (never while the keyboard acts). */
export function selectTopics(selected: number[]): void {
  swap('results', () => {
    applyHeld();
    store.set({ selected });
    writeIds(TOPICS_KEY, selected);
  });
}

export function selectAreas(areas: number[]): void {
  swap('results', () => {
    applyHeld();
    store.set({ areas });
    writeIds(AREAS_KEY, areas);
  });
}
