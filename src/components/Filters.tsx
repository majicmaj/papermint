import { useRef, useState } from 'preact/hooks';
import { filterChips, type FilterChip, type Filters } from '../domain/filters';
import type { ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { FilterDrawer } from '../mobile/FilterDrawer';
import { TopBar } from '../mobile/TopBar';
import { useMobile } from '../mobile/viewport';
import { swap } from '../motion/transition';
import { useTopics } from '../state/topics';
import { FilterPanel } from './FilterPanel';
import { Menu } from './Menu';
import { SortRows, type SortProps } from './SortRows';
import { Taxonomy } from './Taxonomy';

function SortMenu(props: SortProps) {
  return (
    <Menu label="Sort" triggerClass="chip" trigger="Sort">
      {(close) => <SortRows {...props} role="menuitemradio" toggleRole="menuitem" done={close} />}
    </Menu>
  );
}

/** Areas and topics as a menu. Phones have no sidebar, so the same rows live here. */
function AreasMenu() {
  const { areas, selected } = useTopics();
  const count = areas.length + selected.length;
  return (
    <Menu
      label="Areas"
      triggerClass={count > 0 ? 'chip chip--active' : 'chip'}
      hostClass="areas-host"
      trigger="Areas"
    >
      {(close) => (
        <div class="taxonomy-menu">
          <Taxonomy onAct={close} />
        </div>
      )}
    </Menu>
  );
}

/** Chips in the order the owner made them: a new chip goes last, so no chip moves. */
function useChipOrder(chips: FilterChip[]): FilterChip[] {
  const order = useRef<string[]>([]);
  order.current = [
    ...order.current.filter((id) => chips.some((chip) => chip.id === id)),
    ...chips.map((chip) => chip.id).filter((id) => !order.current.includes(id)),
  ];
  return order.current.flatMap((id) => chips.filter((chip) => chip.id === id));
}

interface Props extends SortProps {
  view: ViewName;
  /** The view name and its row count, first in the desktop toolbar. */
  title: string;
  count: number;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  mimes: string[];
}

/** A change to the results cross-fades the results, except while the keyboard types. */
function withSwap(sort: SortProps): SortProps {
  return {
    ...sort,
    setSort: (key) => swap('results', () => sort.setSort(key)),
    setAscending: (value) => swap('results', () => sort.setAscending(value)),
  };
}

export function FiltersBar({
  view,
  title,
  count,
  filters,
  setFilters,
  mimes,
  ...sortProps
}: Props) {
  const update = (patch: Partial<Filters>) =>
    swap('results', () => setFilters({ ...filters, ...patch }));
  const sort = withSwap(sortProps);
  const chips = useChipOrder(filterChips(filters));
  const mobile = useMobile();
  const [open, setOpen] = useState(false);
  const { areas, selected } = useTopics();
  if (mobile) {
    return (
      <>
        <TopBar
          view={view}
          chips={chips}
          active={areas.length + selected.length > 0}
          expanded={open}
          onFilter={() => setOpen(true)}
          onRemove={(chip) => update(chip.clear)}
          superseded={filters.superseded}
          onSuperseded={(superseded) => update({ superseded })}
        />
        <FilterDrawer
          open={open}
          onClose={() => setOpen(false)}
          view={view}
          filters={filters}
          update={update}
          mimes={mimes}
          {...sort}
        />
      </>
    );
  }
  return (
    <div class="list-head" role="toolbar">
      <span class="list-title">
        {title}
        <span class="list-count">{count > 0 ? count : ''}</span>
      </span>
      <Menu label="Filter" triggerClass="chip" trigger="Filter">
        {() => <FilterPanel filters={filters} update={update} mimes={mimes} />}
      </Menu>
      <SortMenu {...sort} />
      <AreasMenu />
      <div class="chips">
        {chips.map((chip) => (
          <button
            key={chip.id}
            class="chip chip--active"
            type="button"
            aria-label={`Remove ${chip.label}`}
            onClick={() => update(chip.clear)}
          >
            {chip.label}
            <Icon name="x" size={12} />
          </button>
        ))}
      </div>
    </div>
  );
}
