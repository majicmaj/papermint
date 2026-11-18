import type { SortKey } from '../domain/filters';
import { Icon } from '../icons/Icon';
import { loadSizes } from '../state/sizes';

export const SORTS: [SortKey, string][] = [
  ['created', 'Created'],
  ['added', 'Added'],
  ['modified', 'Modified'],
  ['title', 'Title'],
  ['size', 'Size'],
];

export interface SortProps {
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  ascending: boolean;
  setAscending: (value: boolean) => void;
}

interface RowsProps extends SortProps {
  /** `menuitemradio` inside a menu, `radio` inside a group on a page. */
  role: 'menuitemradio' | 'radio';
  /** The direction row's role follows the same rule. */
  toggleRole: 'menuitem' | undefined;
  /** Runs after a choice. A menu closes here; a drawer stays open. */
  done?: () => void;
}

/** The sort keys and the direction. One list for the desktop menu and the phone drawer. */
export function SortRows({
  sort,
  setSort,
  ascending,
  setAscending,
  role,
  toggleRole,
  done,
}: RowsProps) {
  return (
    <>
      {SORTS.map(([key, name]) => (
        <button
          type="button"
          role={role}
          aria-checked={sort === key}
          class="menu-item"
          key={key}
          onClick={() => {
            setSort(key);
            if (key === 'size') void loadSizes();
            done?.();
          }}
        >
          <span class="menu-check">{sort === key && <Icon name="check" size={14} />}</span>
          {name}
        </button>
      ))}
      <div class="menu-sep" />
      <button
        type="button"
        role={toggleRole}
        class="menu-item"
        onClick={() => {
          setAscending(!ascending);
          done?.();
        }}
      >
        <span class="menu-check">
          <Icon name="arrow_up_down" size={14} />
        </span>
        {ascending ? 'Ascending' : 'Descending'}
      </button>
    </>
  );
}
