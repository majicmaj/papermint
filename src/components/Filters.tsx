import { runtimeConfig } from '../config/runtime';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { filterChips, type Filters } from '../domain/filters';
import { visibleSelection } from '../domain/taxonomy';
import type { ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { FilterDrawer } from '../mobile/FilterDrawer';
import { TopBar } from '../mobile/TopBar';
import { useMobile } from '../mobile/viewport';
import { swap } from '../motion/transition';
import { applyHeld } from '../state/app';
import { updateFilters, useFilters, useFilterTags } from '../state/filters';
import { selectTaxonomy, selectTopics, useTopics } from '../state/topics';
import { FilterPanel } from './FilterPanel';
import { Menu } from './Menu';
import { GroupMenu } from './GroupMenu';
import { SortRows, type SortProps } from './SortRows';

function SortMenu(props: SortProps) {
  return (
    <Menu label="Sort" triggerClass="chip" trigger="Sort">
      {(close) => <SortRows {...props} role="menuitemradio" toggleRole="menuitem" done={close} />}
    </Menu>
  );
}

/** A new chip goes last, so the existing ones keep their positions. */
function useChipOrder<T extends { id: string }>(chips: T[]): T[] {
  const order = useRef<string[]>([]);
  order.current = [
    ...order.current.filter((id) => chips.some((chip) => chip.id === id)),
    ...chips.map((chip) => chip.id).filter((id) => !order.current.includes(id)),
  ];
  return order.current.flatMap((id) => chips.filter((chip) => chip.id === id));
}

interface Props extends SortProps {
  view: ViewName;
  split: boolean;
  title: string;
  count: number;
  filters: Filters;
  mimes: string[];
}

/** A change to the results cross-fades the results, except while the keyboard types. */
function withSwap(sort: SortProps): SortProps {
  return {
    ...sort,
    setSort: (key) =>
      swap('results', () => {
        applyHeld();
        sort.setSort(key);
      }),
    setAscending: (value) =>
      swap('results', () => {
        applyHeld();
        sort.setAscending(value);
      }),
  };
}

function MobileFilters({
  view,
  filters,
  mimes,
  ...sort
}: Omit<Props, 'split' | 'title' | 'count'>) {
  const chips = useChipOrder(filterChips(filters));
  const [open, setOpen] = useState(false);
  const { areas, selected } = useTopics();
  return (
    <>
      {runtimeConfig().readOnly && <div class="demo-label">Demo · Read only</div>}
      <TopBar
        view={view}
        chips={chips}
        active={areas.length + selected.length > 0}
        expanded={open}
        onFilter={() => setOpen(true)}
        onRemove={(chip) => updateFilters(chip.clear)}
        superseded={filters.superseded}
        onSuperseded={(superseded) => updateFilters({ superseded })}
      />
      <FilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        view={view}
        filters={filters}
        update={updateFilters}
        mimes={mimes}
        {...sort}
      />
    </>
  );
}

function DesktopFilterControls({
  filters,
  mimes,
  ...sort
}: Omit<Props, 'view' | 'split' | 'title' | 'count'>) {
  return (
    <>
      <Menu label="Filter" dialog triggerClass="chip" hostClass="filter-host" trigger="Filter">
        {() => <FilterPanel filters={filters} update={updateFilters} mimes={mimes} {...sort} />}
      </Menu>
      <SortMenu {...sort} />
      <GroupMenu />
    </>
  );
}

export function FiltersBar({ view, split, title, count, filters, mimes, ...sortProps }: Props) {
  const sort = withSwap(sortProps);
  const mobile = useMobile();
  if (mobile) return <MobileFilters view={view} filters={filters} mimes={mimes} {...sort} />;
  return (
    <div class="list-head" role="toolbar">
      <span class="list-title">
        {title}
        <span class="list-count">{count > 0 ? count : ''}</span>
      </span>
      {runtimeConfig().readOnly && (
        <span class="demo-label" title="Read-only demo">
          Demo
        </span>
      )}
      {view === 'records' && (
        <DesktopFilterControls
          key={split ? 'split' : 'wide'}
          filters={filters}
          mimes={mimes}
          {...sort}
        />
      )}
    </div>
  );
}

function useActiveChips() {
  const filters = useFilters();
  const { areas, topics, model } = useFilterTags();
  const removeArea = (id: number) => {
    const next = areas.filter((area) => area !== id);
    selectTaxonomy(next, visibleSelection(model, next, topics));
  };
  return useChipOrder([
    ...filterChips(filters).map((chip) => ({ ...chip, remove: () => updateFilters(chip.clear) })),
    ...areas.map((id) => ({
      id: `area-${id}`,
      label: model.byId.get(id)!.name,
      remove: () => removeArea(id),
    })),
    ...topics.map((id) => ({
      id: `topic-${id}`,
      label: model.byId.get(id)!.name,
      remove: () => selectTopics(topics.filter((topic) => topic !== id)),
    })),
  ]);
}

export function ActiveFilters() {
  const chips = useActiveChips();
  const strip = useRef<HTMLDivElement>(null);
  const removing = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (removing.current === null) return;
    const buttons = strip.current?.querySelectorAll<HTMLButtonElement>('button');
    const next =
      buttons?.[Math.min(removing.current, chips.length - 1)] ??
      document.querySelector<HTMLButtonElement>('.filter-host > button');
    removing.current = null;
    next?.focus({ preventScroll: true });
  }, [chips.length]);
  if (chips.length === 0) return null;
  return (
    <div class="desktop-filter-strip chips" role="group" aria-label="Active filters" ref={strip}>
      {chips.map((chip, index) => (
        <button
          key={chip.id}
          class="chip chip--active"
          type="button"
          aria-label={`Remove ${chip.label}`}
          onClick={() => {
            removing.current = index;
            chip.remove();
          }}
        >
          <span class="filter-chip-label">{chip.label}</span>
          <Icon name="x" size={12} />
        </button>
      ))}
    </div>
  );
}
