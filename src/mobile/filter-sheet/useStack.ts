import { useEffect, useRef, useState } from 'preact/hooks';
import { modality } from '../../motion/modality';
import { exitDelay } from '../../motion/presence';
import type { PageKind } from '../rows';

export type Dir = 'forward' | 'back';
/** The menu is the page with no kind. */
export type Page = PageKind | null;

interface Stack {
  page: Page;
  /** How the current page came in. None from a key, or on the first page. */
  dir: Dir | null;
  /** The page that slides out, kept for the length of the slide. */
  leaving: { page: Page; dir: Dir } | null;
}

/** The drawer curve over this time. The CSS carries the same number. */
export const SLIDE_MS = 280;

/**
 * Pages inside one sheet. A sub-page comes in from the right and goes back out to the right; the
 * menu moves a little the other way. The old page stays mounted only while it slides, out of the
 * layout, so the new page takes its place in the first frame. A key moves at once.
 */
export function useStack() {
  const [stack, setStack] = useState<Stack>({ page: null, dir: null, leaving: null });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (page: Page) => {
    const dir: Dir = page === null ? 'back' : 'forward';
    const ms = exitDelay(modality(), SLIDE_MS);
    clearTimeout(timer.current);
    setStack((s) => ({
      page,
      dir: ms > 0 ? dir : null,
      leaving: ms > 0 ? { page: s.page, dir } : null,
    }));
    if (ms > 0) timer.current = setTimeout(() => setStack((s) => ({ ...s, leaving: null })), ms);
  };
  return { ...stack, go };
}
