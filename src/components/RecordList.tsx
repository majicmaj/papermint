import './filters.css';
import { ActiveFilters, FiltersBar } from './Filters';
import {
  filterChips,
  matchesFilters,
  sortRecords,
  type Filters,
  type SortKey,
} from '../domain/filters';
import { signed, type DetailedDoc } from '../domain/record-details';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { matchesTaxonomy } from '../domain/tags';
import { selectionOf, visibleSelection } from '../domain/taxonomy';
import { VIEW_LABEL, archiveRecords, type ViewName } from '../domain/views';
import { applyHeld, loadIndex, useApp } from '../state/app';
import { anyLayerOpen } from '../state/modal';
import { currentRoute, navigate, recordPath, type Route } from '../state/router';
import { useTopics } from '../state/topics';
import { useActiveFilterCount, useFilters } from '../state/filters';
import { PhoneList, PhoneSkeleton } from '../mobile/PhoneList';
import { PHONE_ROW, groupField, groupRecords, type RecordGroup } from '../domain/list-groups';
import { useGrouping } from '../state/grouping';
import { useMobile } from '../mobile/viewport';
import { Recovery } from './Recovery';
import { DesktopList } from './DesktopList';
import { useListPosition } from './useListPosition';

const ROWS_KEY = 'majin.rows';

/** Skeleton count: the row count of the last visit, else enough rows to fill the viewport. */
function skeletonCount(height: number): number {
  try {
    const stored = Number(localStorage.getItem(ROWS_KEY) ?? 0);
    if (stored > 0) return stored;
  } catch {
    // storage is optional
  }
  return Math.ceil(window.innerHeight / height);
}

function stepFor(key: string): number {
  if (key === 'ArrowDown' || key === 'j') return 1;
  if (key === 'ArrowUp' || key === 'k') return -1;
  return 0;
}

function typing(target: HTMLElement): boolean {
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || !!target.closest('[role="menu"]');
}

function useListKeys(ids: number[], route: Route, view: ViewName): void {
  // Same rule as the global keys: read the latest state when the key arrives.
  const current = useRef({ ids, route, view });
  current.current = { ids, route, view };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const route = currentRoute();
      const { ids, view } = current.current;
      if (event.defaultPrevented || anyLayerOpen()) return;
      const step = stepFor(event.key);
      if (step === 0 || ids.length === 0 || typing(event.target as HTMLElement)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      const at = route.name === 'record' ? ids.indexOf(route.id) : -1;
      const index = Math.min(ids.length - 1, Math.max(0, at < 0 ? 0 : at + step));
      const next = ids[index];
      if (next === undefined) return;
      navigate(recordPath(next), { replace: route.name === 'record', from: view });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useRowCountHint(count: number, ready: boolean): void {
  useEffect(() => {
    if (!ready || count === 0) return;
    try {
      localStorage.setItem(ROWS_KEY, String(Math.min(count, 24)));
    } catch {
      // storage is optional
    }
  }, [count, ready]);
}

function useRows(
  view: ViewName,
  filters: Filters,
  sort: SortKey,
  ascending: boolean,
): DetailedDoc[] {
  const model = useApp((s) => s.model);
  const docs = useApp((s) => s.docs);
  const tags = useApp((s) => s.tags);
  const { selected, areas } = useTopics();
  return useMemo(() => {
    if (view === 'recovery') return [];
    const records = archiveRecords(docs, model, filters.superseded);
    const chosen = selectionOf(model, areas);
    const topics = visibleSelection(model, chosen, selectionOf(model, selected));
    return sortRecords(
      records.filter(
        (doc) =>
          matchesTaxonomy(doc, chosen, topics) && matchesFilters(doc, filters, signed(doc, tags)),
      ),
      sort,
      ascending,
    );
  }, [docs, view, model, selected, areas, filters, tags, sort, ascending]);
}

interface Props {
  view: ViewName;
  route: Route;
}

interface RowsProps {
  groups: readonly RecordGroup[];
  grouping: string;
  view: ViewName;
  sort: SortKey;
  selectedId: number | null;
  /** The phone header's chip row is shown: the list below it starts lower. */
  band: string;
}

/** The desktop and phone share the same sorted records and date grouping. */
function ListRows({ groups, grouping, view, sort, selectedId, band }: RowsProps) {
  const model = useApp((s) => s.model);
  const phase = useApp((s) => s.phase);
  const mobile = useMobile();
  if (view === 'recovery') return null;
  if (!mobile) return <DesktopList {...{ groups, grouping, view, sort, selectedId, band }} />;
  if (phase === 'loading') return <PhoneSkeleton count={skeletonCount(PHONE_ROW)} />;
  return <PhoneList {...{ groups, model, view, sort, selectedId }} band={`${band}:${grouping}`} />;
}

export function RecordList({ view, route }: Props) {
  const phase = useApp((s) => s.phase);
  const docs = useApp((s) => s.docs);
  const filters = useFilters();
  const activeFilters = useActiveFilterCount();
  const [sort, setSort] = useState<SortKey>('created');
  const [ascending, setAscending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useRows(view, filters, sort, ascending);
  const grouping = useGrouping();
  const groups = useMemo(() => groupRecords(rows, sort, grouping), [rows, sort, grouping]);
  const ids = useMemo(() => groups.flatMap((group) => group.rows.map((doc) => doc.id)), [groups]);
  const groupingKey = `${grouping}:${groupField(sort) ?? 'flat'}`;
  const selectedId = route.name === 'record' ? route.id : null;
  const mobile = useMobile();

  // A view switch is the owner's action: it is when a held background index is drawn.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (mounted.current) applyHeld();
    mounted.current = true;
  }, [view]);
  useListKeys(ids, route, view);
  useRowCountHint(rows.length, mobile && phase === 'ready' && view !== 'recovery');
  useListPosition(scroller, selectedId, phase, mobile);
  const band = (mobile ? filterChips(filters).length : activeFilters) > 0 ? 'c' : '';

  const bar = (
    <FiltersBar
      view={view}
      split={route.name === 'record' || route.name === 'file'}
      filters={filters}
      sort={sort}
      setSort={setSort}
      ascending={ascending}
      setAscending={setAscending}
      mimes={[...new Set(docs.map((doc) => doc.mime))].filter(Boolean)}
      title={VIEW_LABEL[view]}
      count={view === 'recovery' ? 0 : rows.length}
    />
  );
  return (
    <>
      {/* On a phone the header scrolls with the list. */}
      {!mobile && bar}
      <div class="list-scroll" ref={scroller}>
        {mobile && bar}
        {!mobile && view === 'records' && <ActiveFilters />}
        {view === 'recovery' && <Recovery />}
        {phase === 'error' && (
          <div class="list-empty">
            <button type="button" class="btn btn--ghost" onClick={() => void loadIndex('now')}>
              Retry
            </button>
          </div>
        )}
        <ListRows
          groups={groups}
          grouping={groupingKey}
          view={view}
          sort={sort}
          selectedId={selectedId}
          band={band}
        />
        {phase === 'ready' && rows.length === 0 && view !== 'recovery' && (
          <div class="list-empty" key={`${band}e`}>
            {activeFilters > 0 ? 'No records match' : 'No records'}
          </div>
        )}
      </div>
    </>
  );
}
