import type { Modality } from './tokens';

/** The slice of `window` the tracker needs. Tests pass a plain EventTarget. */
export interface ModalityTarget {
  addEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: { capture: boolean },
  ) => void;
  removeEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: { capture: boolean },
  ) => void;
}

export interface ModalityRoot {
  dataset: Record<string, string | undefined>;
}

const CAPTURE = { capture: true };
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/**
 * Who acted last: the keyboard or a pointer. Keyboard actions repeat hundreds of times a day, so
 * they never animate. The answer is also written to `data-input` on the root, for CSS.
 */
export function createModality(target: ModalityTarget, root: ModalityRoot) {
  let current: Modality = 'pointer';
  const set = (next: Modality) => {
    current = next;
    root.dataset['input'] = next;
  };
  const onKey = (event: Event) => {
    if (!MODIFIER_KEYS.has((event as KeyboardEvent).key)) set('keyboard');
  };
  const onPointer = () => set('pointer');
  set('pointer');
  target.addEventListener('keydown', onKey, CAPTURE);
  target.addEventListener('pointerdown', onPointer, CAPTURE);
  return {
    get: (): Modality => current,
    stop: () => {
      target.removeEventListener('keydown', onKey, CAPTURE);
      target.removeEventListener('pointerdown', onPointer, CAPTURE);
    },
  };
}

type Tracker = ReturnType<typeof createModality>;
let shared: Tracker | null = null;

/** The one tracker of the page. Safe to call from any component; it starts once. */
export function modality(): Modality {
  if (!shared && typeof window !== 'undefined') {
    shared = createModality(window, document.documentElement);
  }
  return shared?.get() ?? 'pointer';
}

/** Start tracking before the first interaction. */
export function startModality(): void {
  modality();
}
