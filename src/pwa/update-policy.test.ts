import { describe, expect, it } from 'vitest';
import {
  LAUNCH_WINDOW_MS,
  RELOAD_GAP_MS,
  mayApply,
  reloadAllowed,
  type Activity,
  type Moment,
} from './update-policy';

const idle: Activity = { uploads: 0, writes: 0, layerOpen: false, textHeld: false };
const looking: Moment = { hidden: false, focused: true, interacted: true, sinceLoadMs: 60_000 };

describe('when an update may reload the app', () => {
  it('at launch, before the first click or key press', () => {
    expect(mayApply({ ...looking, interacted: false, sinceLoadMs: 1500 }, idle)).toBe(true);
    expect(mayApply({ ...looking, interacted: true, sinceLoadMs: 1500 }, idle)).toBe(false);
    expect(mayApply({ ...looking, interacted: false, sinceLoadMs: LAUNCH_WINDOW_MS }, idle)).toBe(
      false,
    );
  });

  it('never while the owner works in the window', () => {
    expect(mayApply(looking, idle)).toBe(false);
  });

  it('while the window is hidden or another window has focus', () => {
    expect(mayApply({ ...looking, hidden: true }, idle)).toBe(true);
    expect(mayApply({ ...looking, focused: false }, idle)).toBe(true);
  });

  it('never while work would be lost', () => {
    const away: Moment = { ...looking, hidden: true };
    expect(mayApply(away, { ...idle, uploads: 1 })).toBe(false);
    expect(mayApply(away, { ...idle, writes: 1 })).toBe(false);
    expect(mayApply(away, { ...idle, layerOpen: true })).toBe(false);
    expect(mayApply(away, { ...idle, textHeld: true })).toBe(false);
    const launch: Moment = { ...looking, interacted: false, sinceLoadMs: 100 };
    expect(mayApply(launch, { ...idle, writes: 1 })).toBe(false);
  });
});

describe('reload loop guard', () => {
  it('allows one update reload, then waits', () => {
    expect(reloadAllowed(null, 1000)).toBe(true);
    expect(reloadAllowed(1000, 1000 + RELOAD_GAP_MS - 1)).toBe(false);
    expect(reloadAllowed(1000, 1000 + RELOAD_GAP_MS)).toBe(true);
  });

  it('a clock that went back does not block updates for good', () => {
    expect(reloadAllowed(50_000, 1000)).toBe(true);
  });
});
