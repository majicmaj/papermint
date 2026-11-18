/** The motion tokens. `styles/motion.css` carries the same values; a unit test keeps them equal. */
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
export const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Milliseconds. Press and hover are feedback; the rest are state changes. */
export const DURATION = {
  press: 120,
  hover: 100,
  menu: 160,
  swap: 160,
  pane: 220,
  panel: 220,
  toast: 400,
  drawer: 500,
} as const;

export type Modality = 'pointer' | 'keyboard';
