import { useEffect, useRef, useState } from 'preact/hooks';
import { LIMITS, maxWidth, type Column } from './layout';
import { commitLayout, resetWidth, setWidth, useLayout } from './layout-store';

const STEP = 16;
const BIG_STEP = 64;

interface HandleProps {
  column: Column;
  label: string;
  width: number;
  max: number;
}

/** A vertical separator the owner drags, or moves with the arrow keys. Double-click resets it. */
function Handle({ column, label, width, max }: HandleProps) {
  const drag = useRef<{ x: number; start: number } | null>(null);
  const [active, setActive] = useState(false);
  const { min } = LIMITS[column];

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const next: Record<string, number> = {
      ArrowLeft: width - step,
      ArrowRight: width + step,
      Home: min,
      End: max,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setWidth(column, target);
  };

  return (
    <div
      class={`handle handle--${column}`}
      data-active={active}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDblClick={() => resetWidth(column)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, start: width };
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (drag.current) setWidth(column, drag.current.start + e.clientX - drag.current.x, false);
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        drag.current = null;
        setActive(false);
        commitLayout();
      }}
      onPointerCancel={() => {
        drag.current = null;
        setActive(false);
        commitLayout();
      }}
    />
  );
}

export function ResizeHandles({ showList }: { showList: boolean }) {
  const layout = useLayout();
  const [viewport, setViewport] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <>
      <Handle
        column="rail"
        label="Resize sidebar"
        width={layout.rail}
        max={maxWidth('rail', layout, viewport)}
      />
      {showList && (
        <Handle
          column="list"
          label="Resize list"
          width={layout.list}
          max={maxWidth('list', layout, viewport)}
        />
      )}
    </>
  );
}
