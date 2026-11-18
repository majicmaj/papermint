import { createStore, useStore } from '../state/store';

const KEY = 'papermint.appearance';
export const APPEARANCES = [
  ['system', 'System', 'monitor'],
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
] as const;

type Appearance = (typeof APPEARANCES)[number][0];

function readAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

const store = createStore({ appearance: readAppearance() });

export function useAppearance(): Appearance {
  return useStore(store, (state) => state.appearance);
}

function applyAppearance(appearance: Appearance): void {
  const html = document.documentElement;
  const tint = document.getElementById('theme-override');
  if (appearance === 'system') {
    html.removeAttribute('data-bs-theme');
    tint?.setAttribute('media', 'not all');
  } else {
    html.setAttribute('data-bs-theme', appearance);
    tint?.setAttribute('content', appearance === 'dark' ? '#111113' : '#fcfcfd');
    tint?.setAttribute('media', 'all');
  }
  store.set({ appearance });
}

export function setAppearance(appearance: Appearance): void {
  applyAppearance(appearance);
  try {
    localStorage.setItem(KEY, appearance);
  } catch {
    // The choice still applies for this visit.
  }
}

window.addEventListener('storage', (event) => {
  if (event.key === KEY || event.key === null) applyAppearance(readAppearance());
});
