import './favorites.css';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { describeQuery, filtersOf, queryIsAvailable, type Favorite } from '../domain/favorites';
import { recordsMatching } from '../domain/matching';
import { Icon } from '../icons/Icon';
import type { TagIconName } from '../icons/tag-icons';
import { useApp } from '../state/app';
import {
  applyFavorite,
  moveFavorite,
  openFavoriteEditor,
  openFavoriteMenu,
  useActiveFavorite,
  useFavorites,
} from '../state/favorites';
import { Dot } from './Pill';

/** A favorite's icon in its color, or its color dot. A 16px slot, like a tag's glyph. */
export function FavoriteGlyph({
  icon,
  color,
  size = 16,
}: {
  icon: TagIconName | null;
  color: string;
  size?: number;
}) {
  return (
    <span class="glyph fav-glyph" style={{ color }}>
      {icon ? <Icon name={icon} size={size} /> : <Dot color={color} />}
    </span>
  );
}

/** How many records each favorite shows now, by id. Empty until the index is in. */
export function useFavoriteCounts(items: readonly Favorite[]): Map<string, number> {
  const docs = useApp((s) => s.docs);
  const model = useApp((s) => s.model);
  const tags = useApp((s) => s.tags);
  const ready = useApp((s) => s.phase === 'ready');
  return useMemo(() => {
    const counts = new Map<string, number>();
    if (!ready) return counts;
    for (const { id, query } of items) {
      if (!queryIsAvailable(query, model)) continue;
      const filters = filtersOf(query);
      const rows = recordsMatching(docs, model, tags, { ...query, filters });
      counts.set(id, rows.length);
    }
    return counts;
  }, [items, docs, model, tags, ready]);
}

/** "Finance · Invoices · PDF": what a favorite filters, for a tooltip or a second line. */
export function useDescribe(): (favorite: Favorite) => string {
  const model = useApp((s) => s.model);
  return (favorite) =>
    describeQuery(favorite.query, (id) => model.byId.get(id)?.name).join(' · ') ||
    'Removed areas or topics';
}

function pointBelow(element: Element) {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.bottom + 4 };
}

interface RowProps {
  favorite: Favorite;
  count: number | undefined;
  pressed: boolean;
  detail: string;
  onMoved: (id: string) => void;
}

function FavoriteRow({ favorite, count, pressed, detail, onMoved }: RowProps) {
  const { id, name } = favorite;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'F2') {
      event.preventDefault();
      openFavoriteEditor({ id, ...pointBelow(event.currentTarget as Element) });
      return;
    }
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    moveFavorite(id, event.key === 'ArrowUp' ? -1 : 1);
    onMoved(id);
  };
  return (
    <div
      class="fav-row"
      data-favorite={id}
      onContextMenu={(event) => {
        event.preventDefault();
        openFavoriteMenu({ id, x: event.clientX, y: event.clientY });
      }}
    >
      <button
        type="button"
        class="fav-toggle"
        aria-pressed={pressed}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown F2"
        title={detail}
        onClick={() => applyFavorite(id)}
        onKeyDown={onKeyDown}
      >
        <FavoriteGlyph icon={favorite.icon} color={favorite.color} />
        <span class="fav-label">{name}</span>
        <span class="fav-count">{count ?? ''}</span>
      </button>
      <button
        type="button"
        class="fav-more"
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        onClick={(event) => openFavoriteMenu({ id, ...pointBelow(event.currentTarget) })}
      >
        <Icon name="ellipsis" />
      </button>
    </div>
  );
}

/** Keep focus on a row that a key moved: the row re-renders at its new place. */
function useFollowFocus(root: { current: HTMLElement | null }, order: string) {
  const moving = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = moving.current;
    moving.current = null;
    if (!id) return;
    root.current?.querySelector<HTMLElement>(`[data-favorite="${id}"] .fav-toggle`)?.focus();
  }, [order]);
  return (id: string) => {
    moving.current = id;
  };
}

/**
 * Pinned filter combinations at the top of the rail. A row applies its filters; pressed means the
 * list shows exactly that combination, and a second press clears it. The star in the filter strip,
 * the palette and the phone's filter sheet save new ones.
 */
export function Favorites() {
  const items = useFavorites();
  const active = useActiveFavorite();
  const counts = useFavoriteCounts(items);
  const describe = useDescribe();
  const root = useRef<HTMLDivElement>(null);
  const onMoved = useFollowFocus(root, items.map((item) => item.id).join());
  // Hidden until the first favorite, so choosing a filter never moves the rail below.
  if (items.length === 0) return null;
  return (
    <div class="favorites" ref={root} role="group" aria-label="Favorites">
      <div class="tag-head">
        <span class="tag-head-title">Favorites</span>
      </div>
      {items.map((favorite) => (
        <FavoriteRow
          key={favorite.id}
          favorite={favorite}
          count={counts.get(favorite.id)}
          pressed={favorite.id === active?.id}
          detail={describe(favorite)}
          onMoved={onMoved}
        />
      ))}
    </div>
  );
}

/**
 * The star at the end of the active filter chips. Empty: save these filters as a favorite.
 * Filled: these filters are a favorite; a press edits it, where it can also be removed.
 */
export function FavoriteStar() {
  const active = useActiveFavorite();
  const label = active ? `Edit favorite ${active.name}` : 'Save as favorite';
  return (
    <button
      type="button"
      class="chip fav-star"
      data-on={active ? 'true' : undefined}
      aria-label={label}
      title={label}
      onClick={(event) =>
        openFavoriteEditor({ id: active?.id, ...pointBelow(event.currentTarget) })
      }
    >
      <span
        class={`fav-star-icon${active && (active.icon ?? 'star') === 'star' ? ' fav-star-fill' : ''}`}
        style={active ? { color: active.color } : undefined}
      >
        <Icon name={active?.icon ?? 'star'} size={14} />
      </span>
      <span class="filter-chip-label">{active ? active.name : 'Save'}</span>
    </button>
  );
}
