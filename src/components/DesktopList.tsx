import { useEffect, useMemo } from 'preact/hooks';
import type { SortKey } from '../domain/filters';
import { dateFieldFor, groupField, listItems } from '../domain/list-groups';
import type { DetailedDoc } from '../domain/record-details';
import type { ViewName } from '../domain/views';
import { useApp } from '../state/app';
import { Row, SkeletonRows } from './Rows';

const GEOMETRY = { row: 40, heading: 32, top: 0 };
const HINT = 'papermint.desktop-rows';

function skeleton(): string {
  try {
    const hint = localStorage.getItem(HINT);
    if (hint && /^[hr]{1,24}$/.test(hint)) return hint;
  } catch {
    // Storage is optional.
  }
  return 'h' + 'r'.repeat(Math.ceil(innerHeight / GEOMETRY.row));
}

interface Props {
  rows: readonly DetailedDoc[];
  view: ViewName;
  sort: SortKey;
  selectedId: number | null;
  band: string;
}

export function DesktopList({ rows, view, sort, selectedId, band }: Props) {
  const model = useApp((state) => state.model);
  const phase = useApp((state) => state.phase);
  const group = groupField(sort);
  const items = useMemo(() => listItems(rows, group, GEOMETRY), [rows, group]);
  useEffect(() => {
    if (phase !== 'ready' || items.length === 0) return;
    try {
      localStorage.setItem(
        HINT,
        items
          .slice(0, 24)
          .map((item) => item.kind[0])
          .join(''),
      );
    } catch {
      // Storage is optional.
    }
  }, [phase, items]);
  const field = dateFieldFor(sort);
  return (
    <div class="desktop-records" key={`${band}:${group ?? 'flat'}`}>
      {phase === 'loading' && <SkeletonRows layout={skeleton()} />}
      {items.map((item) =>
        item.kind === 'head' ? (
          <h2 key={`h${item.y}`} class="record-month">
            {item.label}
          </h2>
        ) : (
          <Row
            key={`r${item.y}`}
            doc={item.doc}
            model={model}
            view={view}
            selectedId={selectedId}
            field={field}
          />
        ),
      )}
    </div>
  );
}
