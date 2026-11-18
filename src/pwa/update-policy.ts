/**
 * When a downloaded update may replace the running app. Applying it reloads the page, so it
 * happens only when nothing is lost and the owner is not looking at the window:
 * - right after launch, before the first click or key press;
 * - while the window is hidden or the owner works in another window.
 * Never while a file uploads, a write is in flight, a menu or dialog is open, or a text field
 * holds text.
 */
export interface Activity {
  uploads: number;
  writes: number;
  layerOpen: boolean;
  /** A text field holds text that a reload would lose. */
  textHeld: boolean;
}

export interface Moment {
  hidden: boolean;
  /** The window, or a frame in it, has keyboard focus. */
  focused: boolean;
  /** The owner clicked, tapped or pressed a key since the page loaded. */
  interacted: boolean;
  sinceLoadMs: number;
}

/** How long after launch an untouched window still takes an update at once. */
export const LAUNCH_WINDOW_MS = 20_000;

/** Do not reload again this soon after an update reload. It stops any reload loop. */
export const RELOAD_GAP_MS = 30_000;

export function quiet(activity: Activity): boolean {
  return (
    activity.uploads === 0 && activity.writes === 0 && !activity.layerOpen && !activity.textHeld
  );
}

export function mayApply(moment: Moment, activity: Activity): boolean {
  if (!quiet(activity)) return false;
  if (moment.hidden || !moment.focused) return true;
  return !moment.interacted && moment.sinceLoadMs < LAUNCH_WINDOW_MS;
}

export function reloadAllowed(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt >= RELOAD_GAP_MS || now < lastReloadAt;
}
