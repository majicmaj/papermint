import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Filters } from '../../domain/filters';
import type { SortProps } from '../../components/SortRows';
import { clearOf, isSet, labelOf, type PageKind } from '../rows';
import { MenuBody, MenuHead } from './Menu';
import { DateBody, RangeBody, SortBody, TypeBody } from './Pages';
import { PageHead } from './parts';
import { AreasBody, AreasHead, TopicsBody, TopicsHead } from './TagPages';
import { useFit } from './useFit';
import { useStack, type Dir, type Page } from './useStack';

export interface SheetProps extends SortProps {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  mimes: string[];
  onClose: () => void;
}

interface Ctx extends SheetProps {
  today: Date;
  query: string;
  onQuery: (query: string) => void;
  go: (page: Page) => void;
}

function ClearButton({ kind, ctx }: { kind: PageKind; ctx: Ctx }) {
  if (!isSet(kind, ctx.filters)) return null;
  return (
    <button type="button" class="fs-clear fs-end" onClick={() => ctx.update(clearOf(kind))}>
      Clear
    </button>
  );
}

function head(page: Page, ctx: Ctx): ComponentChildren {
  const back = () => ctx.go(null);
  if (page === null)
    return <MenuHead query={ctx.query} onQuery={ctx.onQuery} onClose={ctx.onClose} />;
  if (page === 'areas') return <AreasHead onBack={back} onLeave={ctx.onClose} />;
  if (page === 'topics') return <TopicsHead onBack={back} onLeave={ctx.onClose} />;
  return (
    <PageHead title={labelOf(page)} onBack={back} end={<ClearButton kind={page} ctx={ctx} />} />
  );
}

function body(page: Page, ctx: Ctx): ComponentChildren {
  const { filters, update } = ctx;
  switch (page) {
    case null:
      return <MenuBody {...ctx} onOpen={(kind) => ctx.go(kind)} />;
    case 'areas':
      return <AreasBody onLeave={ctx.onClose} />;
    case 'topics':
      return <TopicsBody onLeave={ctx.onClose} />;
    case 'size':
    case 'pages':
      return <RangeBody kind={page} filters={filters} update={update} />;
    case 'type':
      return <TypeBody filters={filters} update={update} mimes={ctx.mimes} />;
    case 'sort':
      return <SortBody {...ctx} />;
    default:
      return <DateBody field={page} filters={filters} update={update} today={ctx.today} />;
  }
}

interface PageProps {
  page: Page;
  ctx: Ctx;
  enter?: Dir | null;
  leave?: Dir;
  /** While a search narrows the menu, the menu keeps the height it had: nothing moves up. */
  minHeight?: number | null;
}

function SheetPage({ page, ctx, enter, leave, minHeight }: PageProps) {
  return (
    <section
      class="fs-page"
      data-page={page ?? 'menu'}
      data-enter={enter ?? undefined}
      data-leave={leave}
      inert={leave !== undefined}
      style={minHeight ? { minHeight: `min(${minHeight}px, var(--fs-max))` } : undefined}
    >
      {head(page, ctx)}
      <div class="fs-body">{body(page, ctx)}</div>
    </section>
  );
}

/**
 * Focus follows the page: Back on a new sub-page, the row that opened it on the way back. The
 * menu also gets its scroll position back.
 */
function useFocusFollow(page: Page, stage: { current: HTMLElement | null }) {
  const last = useRef<Page>(null);
  const scroll = useRef(0);
  const menuBody = () =>
    stage.current?.querySelector<HTMLElement>('.fs-page[data-page="menu"] .fs-body');
  useLayoutEffect(() => {
    const prev = last.current;
    last.current = page;
    if (prev === page) return;
    const current = stage.current?.querySelector<HTMLElement>('.fs-page:not([inert])');
    const menu = menuBody();
    if (page === null && menu) menu.scrollTop = scroll.current;
    const target =
      page === null
        ? current?.querySelector<HTMLElement>(`[data-kind="${prev}"]`)
        : current?.querySelector<HTMLElement>('.fs-back');
    target?.focus({ preventScroll: true });
  }, [page]);
  /** Read before the menu leaves: a key removes it in the same render. */
  return () => {
    scroll.current = menuBody()?.scrollTop ?? 0;
  };
}

/** The body of the phone's filter sheet: a menu of filter kinds, and a page for each kind. */
export function Sheet(props: SheetProps) {
  const { page, dir, leaving, go } = useStack();
  const [query, setQuery] = useState('');
  const [lock, setLock] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const keepScroll = useFocusFollow(page, stage);
  useFit(stage);
  const onQuery = (next: string) => {
    if (next.trim() && lock === null) {
      const menu = stage.current?.querySelector<HTMLElement>('.fs-page[data-page="menu"]');
      setLock(menu?.offsetHeight ?? null);
    }
    if (!next.trim()) setLock(null);
    setQuery(next);
  };
  const open = (next: Page) => {
    if (page === null) keepScroll();
    go(next);
  };
  const ctx: Ctx = { ...props, today, query, onQuery, go: open };
  return (
    <div ref={stage} class="fs-stage">
      {leaving && (
        <SheetPage key={leaving.page ?? 'menu'} page={leaving.page} ctx={ctx} leave={leaving.dir} />
      )}
      <SheetPage
        key={page ?? 'menu'}
        page={page}
        ctx={ctx}
        enter={dir}
        minHeight={page === null ? lock : null}
      />
    </div>
  );
}
