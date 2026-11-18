import { useLayoutEffect, useRef } from 'preact/hooks';

/** Items up to this rank are never dropped: the version label, the date and the status link. */
export const REQUIRED_RANK = 3;

export interface Fit {
  rank: number;
  width: number;
}

/**
 * Which items of the meta line stay. Required items always stay. The others stay in order of
 * rank while they fit whole; the first that does not fit, and every one after it, is dropped.
 * Nothing is ever cut in half.
 */
export function keepItems(items: readonly Fit[], available: number, gap: number): boolean[] {
  const shown = items.filter((item) => item.width > 0);
  const count = (list: readonly Fit[]) =>
    list.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, list.length - 1);
  let used = count(shown.filter((item) => item.rank <= REQUIRED_RANK));
  let open = true;
  const kept = new Set<Fit>(shown.filter((item) => item.rank <= REQUIRED_RANK));
  for (const item of shown.filter((i) => i.rank > REQUIRED_RANK).sort((a, b) => a.rank - b.rank)) {
    const next = used + (used > 0 ? gap : 0) + item.width;
    open = open && next <= available;
    if (!open) break;
    kept.add(item);
    used = next;
  }
  return items.map((item) => item.width === 0 || kept.has(item));
}

function natural(el: HTMLElement): number {
  return Math.max(el.getBoundingClientRect().width, el.scrollWidth);
}

/** Show or hide the children of the line by `data-rank`, so that what shows fits in one line. */
export function fitMeta(line: HTMLElement): void {
  const children = Array.from(line.children) as HTMLElement[];
  const items = children.map((el) => ({ rank: Number(el.dataset.rank ?? 0), width: natural(el) }));
  const gap = parseFloat(getComputedStyle(line).columnGap) || 0;
  // A pixel of margin: widths are fractions and must never round into the neighbour.
  const keep = keepItems(items, line.getBoundingClientRect().width - 1, gap);
  children.forEach((el, i) => {
    if (keep[i]) el.removeAttribute('data-dropped');
    else el.setAttribute('data-dropped', '');
  });
}

/**
 * Put the returned ref on a flex line whose children carry `data-rank`. The fit runs before
 * paint and again whenever the line or an item changes size, so nothing flashes or moves.
 */
export function useMetaFit() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const line = ref.current;
    if (!line) return;
    const run = () => fitMeta(line);
    run();
    const observer = new ResizeObserver(run);
    observer.observe(line);
    for (const child of Array.from(line.children)) observer.observe(child);
    return () => observer.disconnect();
  });
  return ref;
}
