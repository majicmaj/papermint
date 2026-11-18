import { runtimeConfig } from '../config/runtime';
import './filters.css';
import { FiltersBar } from './Filters';
import {
  EMPTY_FILTERS,
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
import { PhoneList, PhoneSkeleton } from '../mobile/PhoneList';
import { PHONE_ROW } from '../mobile/groups';
import { useMobile } from '../mobile/viewport';
import { Recovery } from './Recovery';
import { Row, SkeletonRows } from './Rows';

const ROW_HEIGHT = 56;
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
  rows: DetailedDoc[];
  view: ViewName;
  sort: SortKey;
  selectedId: number | null;
  /** The phone header's chip row is shown: the list below it starts lower. */
  band: string;
}

/** The rows of a list view: the desktop rows, or the phone's grouped one-line rows. */
function ListRows({ rows, view, sort, selectedId, band }: RowsProps) {
  const model = useApp((s) => s.model);
  const phase = useApp((s) => s.phase);
  const mobile = useMobile();
  if (view === 'recovery') return null;
  if (phase === 'loading') {
    return mobile ? (
      <PhoneSkeleton count={skeletonCount(PHONE_ROW)} />
    ) : (
      <SkeletonRows count={skeletonCount(ROW_HEIGHT)} />
    );
  }
  if (mobile) {
    return (
      <PhoneList
        rows={rows}
        model={model}
        view={view}
        sort={sort}
        selectedId={selectedId}
        band={band}
      />
    );
  }
  return (
    <>
      {rows.map((doc, index) => (
        // Keyed by position: a new result set swaps the content of the same rows in place.
        // Keyed by id, Preact would move rows around and every row below a removed one would shift.
        <Row key={index} doc={doc} model={model} view={view} selectedId={selectedId} />
      ))}
    </>
  );
}

export function RecordList({ view, route }: Props) {
  const phase = useApp((s) => s.phase);
  const docs = useApp((s) => s.docs);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('created');
  const [ascending, setAscending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useRows(view, filters, sort, ascending);
  const ids = useMemo(() => rows.map((d) => d.id), [rows]);
  const selectedId = route.name === 'record' ? route.id : null;
  const mobile = useMobile();

  // A view switch is the owner's action: it is when a held background index is drawn.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (mounted.current) applyHeld();
    mounted.current = true;
  }, [view]);
  useListKeys(ids, route, view);
  useRowCountHint(rows.length, phase === 'ready' && view !== 'recovery');
  useEffect(() => {
    scroller.current
      ?.querySelector(`[data-id="${selectedId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId, phase]);

  const bar = (
    <FiltersBar
      view={view}
      filters={filters}
      setFilters={setFilters}
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
      {runtimeConfig().readOnly && <div class="demo-label">Demo · Read only</div>}
      {/* On a phone the header scrolls with the list. */}
      {!mobile && bar}
      <div class="list-scroll" ref={scroller}>
        {mobile && bar}
        {view === 'recovery' && <Recovery />}
        {phase === 'error' && (
          <div class="list-empty">
            <button type="button" class="btn btn--ghost" onClick={() => void loadIndex('now')}>
              Retry
            </button>
          </div>
        )}
        <ListRows
          rows={rows}
          view={view}
          sort={sort}
          selectedId={selectedId}
          band={filterChips(filters).length > 0 ? 'c' : ''}
        />
        {phase === 'ready' && rows.length === 0 && view !== 'recovery' && (
          <div class="list-empty" key={filterChips(filters).length > 0 ? 'ce' : 'e'}>
            None
          </div>
        )}
      </div>
    </>
  );
}
