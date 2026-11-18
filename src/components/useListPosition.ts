import type { RefObject } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Phase } from '../state/app';

function recordRow(list: HTMLElement, id: number): HTMLElement | null {
  return list.querySelector<HTMLElement>(`[data-id="${id}"]`);
}

/** Keep the archive's scroll position and return focus to the row that opened the preview. */
export function useListPosition(
  scroller: RefObject<HTMLDivElement | null>,
  id: number | null,
  phase: Phase,
  mobile: boolean,
): void {
  const previous = useRef(id);
  const origin = useRef<{ id: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const list = scroller.current;
    const before = previous.current;
    previous.current = id;
    if (!list) return;
    if (id !== null) {
      if (!mobile && before === null) origin.current = { id, top: list.scrollTop };
      recordRow(list, id)?.scrollIntoView({ block: 'nearest' });
    } else if (!mobile && before !== null) {
      const restore = origin.current;
      origin.current = null;
      if (restore) list.scrollTop = restore.top;
      const target = recordRow(list, restore?.id ?? before);
      target?.focus({ preventScroll: true });
    }
  }, [scroller, id, phase, mobile]);
}
