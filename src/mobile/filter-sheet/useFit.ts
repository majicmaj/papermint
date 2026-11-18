import { useLayoutEffect } from 'preact/hooks';

/**
 * The sheet fits its page without a change of layout. The drawer keeps one height (88% of the
 * screen) and moves down by the space its page leaves free, with `translate`. A transform moves
 * no layout, so a taller or a shorter page shifts nothing. The observer runs before the frame is
 * painted, so the sheet never shows a frame at the old size.
 */
export function useFit(stage: { current: HTMLElement | null }): void {
  useLayoutEffect(() => {
    const el = stage.current;
    const drawer = el?.closest<HTMLElement>('.drawer');
    if (!el || !drawer) return;
    const fit = () => {
      const free = drawer.clientHeight - el.offsetTop - el.offsetHeight;
      drawer.style.translate = free > 0 ? `0 ${free}px` : '';
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    observer.observe(drawer);
    return () => {
      observer.disconnect();
      drawer.style.translate = '';
    };
  }, []);
}
