import type { Modality } from './tokens';
import { modality } from './modality';
import { layers } from '../state/modal';

/** What a swap changes. The kind names the element that is cross-faded; CSS reads `data-vt`. */
export type SwapKind = 'pane' | 'results';

interface ViewTransitionLike {
  finished: Promise<unknown>;
}

export interface SwapEnv {
  /** `document.startViewTransition`, or null when the browser has none. */
  start: ((update: () => Promise<void>) => ViewTransitionLike) | null;
  modality: () => Modality;
  /** Resolves after the framework rendered what the update changed. */
  flush: () => Promise<void>;
  root: { dataset: Record<string, string | undefined> };
  /** True while a modal layer (the phone's filter drawer, a dialog) covers the page. */
  covered: () => boolean;
}

function browserEnv(): SwapEnv {
  const doc = document as Document & {
    startViewTransition?: (update: () => Promise<void>) => ViewTransitionLike;
  };
  return {
    start: doc.startViewTransition ? (update) => doc.startViewTransition!(update) : null,
    modality,
    // A timer, never requestAnimationFrame: while the update runs the browser paints nothing, so
    // a frame callback would wait until the browser gives up on the transition (4 seconds).
    flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
    root: document.documentElement,
    covered: layers.isModal,
  };
}

let active = 0;

/**
 * Run a state change so the old and the new picture cross-fade.
 * - Keyboard actions, and browsers without View Transitions, apply the change at once.
 * - So do results that a modal layer covers: the cross-fade would draw them above it.
 * - The root carries `data-vt` while the transition runs; CSS names the element only then, so a
 *   named element never changes how the page is drawn at any other time.
 * - An update that starts while one runs replaces it. The browser skips the older transition.
 */
export function swap(kind: SwapKind, update: () => void, env?: SwapEnv): void {
  const e = env ?? (typeof document === 'undefined' ? null : browserEnv());
  // A named element is drawn above every layer while it cross-fades, so the list would show
  // through a drawer or dialog that covers it. Covered results change at once.
  const covered = kind === 'results' && e?.covered();
  if (!e?.start || e.modality() === 'keyboard' || covered) {
    update();
    return;
  }
  active += 1;
  e.root.dataset['vt'] = kind;
  const run = e.start(async () => {
    update();
    await e.flush();
  });
  const done = () => {
    active -= 1;
    if (active === 0) delete e.root.dataset['vt'];
  };
  void run.finished.then(done, done);
}

/** For tests: how many swaps are still running. */
export function activeSwaps(): number {
  return active;
}
