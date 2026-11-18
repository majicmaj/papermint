import { useEffect, useState } from 'preact/hooks';

/** The phone layout: one column, a tab bar, drawers. Matches the breakpoint in mobile.css. */
export const MOBILE_QUERY = '(max-width: 859px)';

export function isMobileViewport(): boolean {
  return typeof matchMedia === 'function' && matchMedia(MOBILE_QUERY).matches;
}

/** Read at the first render, so the right layout is drawn at once and nothing moves later. */
export function useMobile(): boolean {
  const [mobile, setMobile] = useState(isMobileViewport);
  useEffect(() => {
    const query = matchMedia(MOBILE_QUERY);
    const sync = () => setMobile(query.matches);
    query.addEventListener('change', sync);
    sync();
    return () => query.removeEventListener('change', sync);
  }, []);
  return mobile;
}

/**
 * Keep an element as tall as the part of the screen the keyboard leaves. The height goes on that
 * element only: a variable on the root would restyle the whole page on every keyboard frame.
 */
export function useVisualHeight(target: { current: HTMLElement | null }, active: boolean): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const apply = () =>
      target.current?.style.setProperty('--vvh', `${Math.round(viewport.height)}px`);
    apply();
    viewport.addEventListener('resize', apply);
    return () => viewport.removeEventListener('resize', apply);
  }, [active]);
}
