import { FavoriteGlyph, useDescribe, useFavoriteCounts } from '../../components/Favorites';
import type { Favorite } from '../../domain/favorites';
import { Icon } from '../../icons/Icon';
import {
  applyFavorite,
  openFavoriteEditor,
  openFavoriteMenu,
  useActiveFavorite,
  useFavorites,
} from '../../state/favorites';
import { useActiveFilterCount } from '../../state/filters';
import { searchNames } from '../rows';
import { Group, Label, Tick } from './parts';

/** Where a popover opens: under the pressed control. The sheet closes first. */
function below(element: Element) {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.bottom + 4 };
}

interface RowProps {
  favorite: Favorite;
  pressed: boolean;
  count: number | undefined;
  detail: string;
  onClose: () => void;
}

function FavoriteRow({ favorite, pressed, count, detail, onClose }: RowProps) {
  return (
    <div class="fs-row fs-tag fs-fav" data-favorite={favorite.id}>
      <button
        type="button"
        class="fs-tag-toggle"
        aria-pressed={pressed}
        aria-description={detail}
        onClick={() => {
          applyFavorite(favorite.id);
          onClose();
        }}
      >
        <FavoriteGlyph icon={favorite.icon} color={favorite.color} />
        <span class="fs-text fs-fav-name">{favorite.name}</span>
        <span class="fs-summary">{count ?? ''}</span>
        <Tick on={pressed} />
      </button>
      <button
        type="button"
        class="fs-more"
        aria-label={`Options for ${favorite.name}`}
        aria-haspopup="menu"
        onClick={(event) => {
          const at = below(event.currentTarget);
          onClose();
          openFavoriteMenu({ id: favorite.id, ...at });
        }}
      >
        <Icon name="ellipsis" size={20} />
      </button>
    </div>
  );
}

/** True when a search of the sheet finds a favorite by name. */
export function useFavoriteHits(query: string): boolean {
  return searchNames(useFavorites(), query).length > 0;
}

/**
 * The phone's favorites, first in the filter sheet. A row applies its filters and closes the
 * sheet; a search narrows them by name. Hidden until the first favorite.
 */
export function FavoriteSection({ query, onClose }: { query: string; onClose: () => void }) {
  const items = useFavorites();
  const active = useActiveFavorite();
  const counts = useFavoriteCounts(items);
  const describe = useDescribe();
  const shown = query.trim() ? searchNames(items, query) : items;
  if (shown.length === 0) return null;
  return (
    <div class="fs-section">
      <Label>Favorites</Label>
      <Group>
        {shown.map((favorite) => (
          <FavoriteRow
            key={favorite.id}
            favorite={favorite}
            pressed={favorite.id === active?.id}
            count={counts.get(favorite.id)}
            detail={describe(favorite)}
            onClose={onClose}
          />
        ))}
      </Group>
    </div>
  );
}

/**
 * The last row of the sheet: save the current filters as a favorite. It is always there, and
 * off while there is nothing new to save, so a filter choice above never moves a row.
 */
export function SaveFavoriteRow({ onClose }: { onClose: () => void }) {
  const active = useActiveFavorite();
  const filtered = useActiveFilterCount() > 0;
  return (
    <div class="fs-section">
      <Group>
        <button
          type="button"
          class="fs-row fs-nav fs-fav-save"
          data-kind="favorite-save"
          disabled={!filtered || !!active}
          onClick={(event) => {
            const at = below(event.currentTarget);
            onClose();
            openFavoriteEditor(at);
          }}
        >
          <span class="fs-icon">
            <Icon name="star" size={20} />
          </span>
          <span class="fs-text">Save as favorite</span>
          <span class="fs-summary">{active ? active.name : ''}</span>
        </button>
      </Group>
    </div>
  );
}
