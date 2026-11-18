import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Filters } from '../domain/filters';
import { MenuBody, MenuHead } from '../mobile/filter-sheet/Menu';
import { DateBody, RangeBody, TypeBody } from '../mobile/filter-sheet/Pages';
import { PageHead } from '../mobile/filter-sheet/parts';
import { clearOf, isFilterPage, isSet, labelOf, type FilterPageKind } from '../mobile/rows';
import type { SortProps } from './SortRows';

interface Props extends SortProps {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  mimes: string[];
}

function Fields({ kind, today, ...props }: Props & { kind: FilterPageKind; today: Date }) {
  if (kind === 'size' || kind === 'pages') return <RangeBody {...props} kind={kind} />;
  if (kind === 'type') return <TypeBody {...props} />;
  return <DateBody {...props} field={kind} today={today} />;
}

/** A searchable menu with one page for each kind of filter. */
export function FilterPanel(props: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<FilterPageKind | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lastKind = useRef<FilterPageKind | null>(null);
  const today = useMemo(() => new Date(), []);
  useLayoutEffect(() => {
    if (page) panel.current?.querySelector<HTMLElement>('.fs-back')?.focus();
    else if (lastKind.current && document.activeElement?.tagName !== 'INPUT') {
      panel.current?.querySelector<HTMLElement>(`[data-kind="${lastKind.current}"]`)?.focus();
    }
  }, [page]);
  return (
    <div class="filter-panel" ref={panel}>
      <MenuHead
        query={query}
        onQuery={(next) => {
          setPage(null);
          setQuery(next);
        }}
      />
      {page && (
        <PageHead
          title={labelOf(page)}
          onBack={() => setPage(null)}
          end={
            isSet(page, props.filters) && (
              <button type="button" class="fs-clear" onClick={() => props.update(clearOf(page))}>
                Clear
              </button>
            )
          }
        />
      )}
      <div key={page ?? 'menu'} class="filter-options">
        {page ? (
          <Fields {...props} kind={page} today={today} />
        ) : (
          <MenuBody
            {...props}
            query={query}
            today={today}
            desktop
            onOpen={(kind) => {
              if (!isFilterPage(kind)) return;
              lastKind.current = kind;
              setPage(kind);
            }}
          />
        )}
      </div>
    </div>
  );
}
