import { isTagIcon, type TagIconName } from '../icons/tag-icons';
import { EMPTY_FILTERS, filterChips, type Filters } from './filters';
import { DEFAULT_TAG_COLOR } from './tag-palette';
import type { TagModel } from './tags';
import { visibleSelection } from './taxonomy';

/**
 * Favorites: named filter combinations the owner pins to the top of the sidebar. A favorite holds
 * the same state the rail and the Filter menu write (filter fields, areas, topics), so applying
 * one is the same as choosing those filters by hand. Sort and grouping stay as they are.
 */

export interface FavoriteQuery {
  /** Only the fields that differ from no filter. */
  filters: Partial<Filters>;
  areas: number[];
  topics: number[];
}

export interface Favorite {
  id: string;
  name: string;
  icon: TagIconName | null;
  /** Hex, from the tag palette. */
  color: string;
  query: FavoriteQuery;
}

export const FAVORITES_KEY = 'papermint.favorites';
export const MAX_FAVORITES = 50;
export const MAX_NAME = 60;

const HEX = /^#[0-9a-f]{6}$/i;
const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof Filters)[];

function ids(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const numbers = value.filter((id): id is number => Number.isInteger(id));
  return [...new Set(numbers)].sort((a, b) => a - b);
}

/** Keep the fields that are set and have the right type; drop anything else. */
export function compactFilters(filters: Partial<Record<keyof Filters, unknown>>): Partial<Filters> {
  const out: Record<string, string | boolean> = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    const empty = EMPTY_FILTERS[key];
    if (typeof value !== typeof empty || value === empty) continue;
    out[key] = value as string | boolean;
  }
  return out as Partial<Filters>;
}

export function normalizeQuery(query: {
  filters?: unknown;
  areas?: unknown;
  topics?: unknown;
}): FavoriteQuery {
  const filters = query.filters && typeof query.filters === 'object' ? query.filters : {};
  return {
    filters: compactFilters(filters as Partial<Record<keyof Filters, unknown>>),
    areas: ids(query.areas),
    topics: ids(query.topics),
  };
}

/** The query of the current state: every filter field, and the areas and topics that count. */
export function captureQuery(
  filters: Filters,
  areas: readonly number[],
  topics: readonly number[],
): FavoriteQuery {
  return normalizeQuery({ filters, areas, topics });
}

function queryKey(query: FavoriteQuery): string {
  const { filters, areas, topics } = normalizeQuery(query);
  const fields = FILTER_KEYS.flatMap((key) => (key in filters ? [[key, filters[key]]] : []));
  return JSON.stringify([fields, areas, topics]);
}

export function sameQuery(a: FavoriteQuery, b: FavoriteQuery): boolean {
  return queryKey(a) === queryKey(b);
}

export function isEmptyQuery(query: FavoriteQuery): boolean {
  return (
    query.areas.length === 0 &&
    query.topics.length === 0 &&
    Object.keys(compactFilters(query.filters)).length === 0
  );
}

export function filtersOf(query: FavoriteQuery): Filters {
  return { ...EMPTY_FILTERS, ...compactFilters(query.filters) };
}

/** The readable parts of a query, in rail order: areas, topics, then the filter chips. */
export function describeQuery(
  query: FavoriteQuery,
  nameOf: (id: number) => string | undefined,
): string[] {
  const names = [...query.areas, ...query.topics].flatMap((id) => nameOf(id) ?? []);
  return [...names, ...filterChips(filtersOf(query)).map((chip) => chip.label)];
}

/** A first name for a new favorite: the most specific part of what it filters. */
export function suggestName(query: FavoriteQuery, nameOf: (id: number) => string | undefined) {
  const topics = query.topics.flatMap((id) => nameOf(id) ?? []);
  const areas = query.areas.flatMap((id) => nameOf(id) ?? []);
  const chips = filterChips(filtersOf(query)).map((chip) => chip.label);
  const first = [topics.join(' & '), areas.join(' & '), chips[0] ?? ''].find(Boolean) ?? '';
  return first.length > MAX_NAME ? `${first.slice(0, MAX_NAME - 1)}…` : first;
}

function parseOne(value: unknown): Favorite | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === 'string' ? item.name.trim().slice(0, MAX_NAME) : '';
  if (typeof item.id !== 'string' || !item.id || !name) return null;
  const query = normalizeQuery((item.query ?? {}) as Record<string, unknown>);
  if (isEmptyQuery(query)) return null;
  return {
    id: item.id,
    name,
    icon: typeof item.icon === 'string' && isTagIcon(item.icon) ? item.icon : null,
    color:
      typeof item.color === 'string' && HEX.test(item.color)
        ? item.color.toLowerCase()
        : DEFAULT_TAG_COLOR,
    query,
  };
}

/** Read stored favorites. Anything that does not parse is dropped, never thrown. */
export function parseFavorites(raw: string | null): Favorite[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: Favorite[] = [];
  for (const entry of items) {
    const favorite = parseOne(entry);
    if (!favorite || seen.has(favorite.id)) continue;
    seen.add(favorite.id);
    out.push(favorite);
  }
  return out.slice(0, MAX_FAVORITES);
}

export function serializeFavorites(items: readonly Favorite[]): string {
  return JSON.stringify({ version: 1, items });
}

/** Move one favorite up (-1) or down (+1). The list is unchanged at either end. */
export function moveFavorite(items: readonly Favorite[], id: string, delta: number): Favorite[] {
  const from = items.findIndex((item) => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Applying a favorite must preserve every saved filter. */
export function queryIsAvailable(query: FavoriteQuery, model: TagModel): boolean {
  const { areas, topics } = query;
  return (
    areas.every((id) => model.areas.some((area) => area.id === id)) &&
    visibleSelection(model, areas, topics).length === topics.length
  );
}

export function newFavoriteId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
