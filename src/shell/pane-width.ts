import { useEffect, useState } from 'preact/hooks';
import { PANE_MIN, maxWidth } from './layout';
import { useLayout } from './layout-store';

/**
 * How much of the record toolbar fits, from the width of the pane. Secondary actions leave
 * the toolbar for the ⋯ menu before the title is squeezed:
 *   full    everything
 *   compact Copy link moves into ⋯
 *   tight   and Versions moves into ⋯
 *   icon    and Download keeps only its icon
 */
export type BarLevel = 'full' | 'compact' | 'tight' | 'icon';

/** Pane widths below these lose the action named above. Measured against the real buttons. */
export const BAR_BREAKS = { compact: 650, tight: 545, icon: 470 } as const;

/** The desktop layout starts here. Narrower windows use the phone layout. */
export const DESKTOP_MIN = 860;

/** The width the record pane gets: what the sidebar and the list leave over. */
export function paneWidth(
  viewport: number,
  rail: number,
  list: number,
  collapsed: boolean,
): number {
  const railWidth = collapsed ? 0 : rail;
  const listWidth = Math.min(list, maxWidth('list', { rail, list, collapsed }, viewport));
  return Math.max(PANE_MIN, viewport - railWidth - listWidth);
}

export function barLevel(width: number): BarLevel {
  if (width < BAR_BREAKS.icon) return 'icon';
  if (width < BAR_BREAKS.tight) return 'tight';
  if (width < BAR_BREAKS.compact) return 'compact';
  return 'full';
}

/** The level for this window. It is known at the first render, so nothing moves afterwards. */
export function usePaneBar(): BarLevel {
  const layout = useLayout();
  const [viewport, setViewport] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (viewport < DESKTOP_MIN) return 'full';
  return barLevel(paneWidth(viewport, layout.rail, layout.list, layout.collapsed));
}
