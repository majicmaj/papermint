/** Pure drag math for the bottom drawer. The component only wires pointer events to it. */

/** A drag faster than this (px per ms) dismisses, however short it was. */
export const FLICK = 0.11;
/** A slower drag dismisses once it passed this share of the drawer height. */
export const DISMISS_FRACTION = 0.4;
/** A drag shorter than this never dismisses: it was a tap that moved. */
export const MIN_TRAVEL = 8;
/** Pixels of pointer travel before a press becomes a drag. */
export const START_SLOP = 4;
const MAX_STRETCH = 28;
const VELOCITY_WINDOW = 100;

export interface Sample {
  y: number;
  t: number;
}

/** Past the top edge a drawer follows the finger less and less: friction, not a wall. */
export function dampen(offset: number): number {
  return offset >= 0 ? offset : -Math.min(MAX_STRETCH, Math.sqrt(-offset) * 2.4);
}

/** Share of the drawer that is dragged away, from 0 to 1. Drives the scrim. */
export function progress(offset: number, height: number): number {
  if (height <= 0) return 0;
  return Math.min(1, Math.max(0, offset / height));
}

/** Downward speed in px per ms over the last 100 ms of samples. Up is negative. */
export function velocityOf(samples: readonly Sample[], now: number): number {
  const recent = samples.filter((sample) => now - sample.t <= VELOCITY_WINDOW);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last.t === first.t) return 0;
  return (last.y - first.y) / (last.t - first.t);
}

/** Dismiss on distance or on a flick down. A flick up always keeps the drawer open. */
export function shouldDismiss(offset: number, height: number, velocity: number): boolean {
  if (velocity < -FLICK) return false;
  if (offset < MIN_TRAVEL) return false;
  return velocity > FLICK || offset >= height * DISMISS_FRACTION;
}

/**
 * Where Tab must go to keep focus inside the drawer, or null to let the browser decide.
 * `at` is the index of the focused item (-1 when focus is on the drawer itself).
 */
export function wrapFocus(at: number, count: number, shift: boolean): number | null {
  if (count === 0) return null;
  if (shift && at <= 0) return count - 1;
  if (!shift && at === count - 1) return 0;
  return null;
}
