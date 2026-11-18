import { useMemo } from 'preact/hooks';
import {
  FAVORITES_KEY,
  MAX_FAVORITES,
  captureQuery,
  filtersOf,
  isEmptyQuery,
  moveFavorite as moved,
  newFavoriteId,
  parseFavorites,
  queryIsAvailable,
  sameQuery,
  serializeFavorites,
  suggestName,
  type Favorite,
  type FavoriteQuery,
} from '../domain/favorites';
import { TAG_COLORS, DEFAULT_TAG_COLOR } from '../domain/tag-palette';
import type { TagModel } from '../domain/tags';
import { selectionOf, visibleSelection } from '../domain/taxonomy';
import { isTagIcon, type TagIconName } from '../icons/tag-icons';
import type { Command, IdleContent } from '../palette/types';
import { appStore, notify, useApp } from './app';
import { clearFilters, filtersStore, replaceFilters, useFilters } from './filters';
import { popLayer, pushLayer } from './modal';
import { currentRoute, goToView } from './router';
import { createStore, useStore } from './store';
import { selection, useTopics } from './topics';

function load(): Favorite[] {
  try {
    return parseFavorites(localStorage.getItem(FAVORITES_KEY));
  } catch {
    return [];
  }
}

const store = createStore<{ items: Favorite[] }>({ items: load() });

function save(items: Favorite[]): void {
  store.set({ items });
  try {
    localStorage.setItem(FAVORITES_KEY, serializeFavorites(items));
  } catch {
    // Storage is optional. The favorites still work for this visit.
  }
}

// Another tab saved its favorites: show the same list here.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === FAVORITES_KEY) store.set({ items: parseFavorites(event.newValue) });
  });
}

export function useFavorites(): Favorite[] {
  return useStore(store, (s) => s.items);
}

function queryFrom(
  model: TagModel,
  filters = filtersStore.get().filters,
  chosen = selection.get(),
) {
  const areas = selectionOf(model, chosen.areas);
  return captureQuery(filters, areas, visibleSelection(model, areas, chosen.selected));
}

/** The query of what the list shows now. */
export function currentQuery(): FavoriteQuery {
  return queryFrom(appStore.get().model);
}

export function useCurrentQuery(): FavoriteQuery {
  const filters = useFilters();
  const chosen = useTopics();
  const model = useApp((s) => s.model);
  return useMemo(() => queryFrom(model, filters, chosen), [model, filters, chosen]);
}

/** The favorite that matches the current filters exactly, if any. */
export function useActiveFavorite(): Favorite | undefined {
  const items = useFavorites();
  const query = useCurrentQuery();
  return useMemo(() => items.find((item) => sameQuery(item.query, query)), [items, query]);
}

/** Favorites that were removed in this visit. Saving the same filters again starts from them. */
let removed: Favorite[] = [];

export interface FavoriteDraft {
  name: string;
  icon: TagIconName | null;
  color: string;
}

/** A first name, icon and color for new favorite: from its first topic or area. */
export function draftFor(query: FavoriteQuery): FavoriteDraft {
  const before = removed.find((item) => sameQuery(item.query, query));
  if (before) return { name: before.name, icon: before.icon, color: before.color };
  const { model, icons } = appStore.get();
  const nameOf = (id: number) => model.byId.get(id)?.name;
  const lead = [...query.topics, ...query.areas].map((id) => model.byId.get(id)).find(Boolean);
  const icon = lead ? icons[String(lead.id)] : undefined;
  const palette = TAG_COLORS.some((swatch) => swatch.hex === lead?.color.toLowerCase());
  return {
    name: suggestName(query, nameOf),
    icon: isTagIcon(icon) ? icon : 'star',
    color: palette && lead ? lead.color.toLowerCase() : DEFAULT_TAG_COLOR,
  };
}

/** Save a new favorite at the end of the list. Returns its id, or null when it cannot. */
export function addFavorite(draft: FavoriteDraft, query: FavoriteQuery): string | null {
  const items = store.get().items;
  if (isEmptyQuery(query) || !draft.name.trim()) return null;
  if (items.length >= MAX_FAVORITES) {
    notify(`You can keep ${MAX_FAVORITES} favorites`);
    return null;
  }
  const favorite: Favorite = { id: newFavoriteId(), ...draft, name: draft.name.trim(), query };
  removed = removed.filter((item) => !sameQuery(item.query, query));
  save([...items, favorite]);
  return favorite.id;
}

export function updateFavorite(id: string, patch: Partial<Omit<Favorite, 'id'>>): void {
  const items = store.get().items;
  if (!items.some((item) => item.id === id)) return;
  save(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

/** Point a favorite at the current filters. */
export function updateFavoriteQuery(id: string): void {
  const query = currentQuery();
  if (isEmptyQuery(query)) return;
  updateFavorite(id, { query });
  notify('Favorite updated');
}

export function removeFavorite(id: string): void {
  const items = store.get().items;
  const gone = items.find((item) => item.id === id);
  if (!gone) return;
  removed = [gone, ...removed.filter((item) => item.id !== id)].slice(0, 10);
  save(items.filter((item) => item.id !== id));
  notify(`Removed “${gone.name}” from favorites`);
}

export function moveFavorite(id: string, delta: number): void {
  save(moved(store.get().items, id, delta));
}

/**
 * Show a favorite's records. A favorite that is already showing turns off again, the same as a
 * pressed area or topic.
 */
export function applyFavorite(id: string): void {
  const favorite = store.get().items.find((item) => item.id === id);
  if (!favorite) return;
  if (sameQuery(favorite.query, currentQuery())) {
    clearFilters();
    return;
  }
  const { model, phase } = appStore.get();
  const { query } = favorite;
  if (!queryIsAvailable(query, model)) {
    notify(phase === 'loading' ? 'Records are still loading' : 'An area or topic has changed');
    return;
  }
  replaceFilters(filtersOf(query), query.areas, query.topics);
  const route = currentRoute().name;
  if (route === 'recovery' || route === 'file') goToView('records');
}

// The editor popover and the row menu. They open at the point the owner pressed, like the tag
// editor, and each is one modal layer.

export interface FavoriteEditorState {
  /** Null while creating. */
  id: string | null;
  /** What a new favorite saves: the filters when the editor opened. */
  query: FavoriteQuery;
  x: number;
  y: number;
}

export interface FavoriteMenuState {
  id: string;
  x: number;
  y: number;
}

const ui = createStore<{ editor: FavoriteEditorState | null; menu: FavoriteMenuState | null }>({
  editor: null,
  menu: null,
});
let editorLayer: number | null = null;
let menuLayer: number | null = null;

export function useFavoriteEditor(): FavoriteEditorState | null {
  return useStore(ui, (s) => s.editor);
}

export function useFavoriteMenu(): FavoriteMenuState | null {
  return useStore(ui, (s) => s.menu);
}

export function openFavoriteMenu(menu: FavoriteMenuState): void {
  closeFavoriteMenu();
  menuLayer = pushLayer(false);
  ui.set({ menu });
}

export function closeFavoriteMenu(): void {
  if (menuLayer !== null) popLayer(menuLayer, false);
  menuLayer = null;
  ui.set({ menu: null });
}

/** Edit a favorite, or (with no id) save the current filters as a new one. */
export function openFavoriteEditor(at: { id?: string | null; x: number; y: number }): void {
  closeFavoriteMenu();
  if (ui.get().editor) return;
  const id = at.id ?? null;
  const existing = id ? store.get().items.find((item) => item.id === id) : undefined;
  if (id && !existing) return;
  const query = existing?.query ?? currentQuery();
  if (!existing && isEmptyQuery(query)) return;
  editorLayer = pushLayer(true);
  ui.set({ editor: { id, query, x: at.x, y: at.y } });
}

export function closeFavoriteEditor(): void {
  if (editorLayer !== null) popLayer(editorLayer);
  editorLayer = null;
  ui.set({ editor: null });
}

/** Open the editor for the current filters from the palette, once the palette has closed. */
function saveFromPalette(): void {
  const at = { x: Math.max(8, window.innerWidth / 2 - 160), y: window.innerHeight / 4 };
  // The palette gives focus back to its opener on the next frame; the editor opens after that.
  requestAnimationFrame(() => requestAnimationFrame(() => openFavoriteEditor(at)));
}

function favoriteList(): IdleContent {
  const items = store.get().items;
  const query = currentQuery();
  const active = items.findIndex((item) => sameQuery(item.query, query));
  return {
    title: 'Favorites',
    selected: Math.max(0, active),
    commands: items.map((item, index) => ({
      title: item.name,
      icon: item.icon ?? 'star',
      detail: index === active ? 'Showing' : undefined,
      run: () => applyFavorite(item.id),
    })),
  };
}

/** Palette commands: the list of favorites, and (in Records) saving the current filters. */
export function favoriteCommands(canSave: boolean): Command[] {
  const items = store.get().items;
  const query = currentQuery();
  const saved = items.some((item) => sameQuery(item.query, query));
  return [
    ...(items.length > 0 ? [{ title: 'Favorites', icon: 'star' as const, run: favoriteList }] : []),
    ...(canSave && !isEmptyQuery(query) && !saved
      ? [{ title: 'Save as favorite', icon: 'star' as const, run: saveFromPalette }]
      : []),
  ];
}
