import { describe, expect, it } from 'vitest';
import { BAR_BREAKS, barLevel, paneWidth } from './pane-width';

describe('pane width', () => {
  it('is what the sidebar and the list leave over', () => {
    expect(paneWidth(1440, 216, 440, false)).toBe(1440 - 216 - 440);
  });

  it('adds the sidebar back when it is folded', () => {
    expect(paneWidth(1440, 216, 440, true)).toBe(1440 - 440);
  });

  it('never goes below the pane minimum, however wide the list was dragged', () => {
    // The reported case: a 1000px window with a 720px list saved.
    expect(paneWidth(1000, 216, 720, false)).toBe(1000 - 216 - 424);
    expect(paneWidth(1000, 216, 720, false)).toBeGreaterThanOrEqual(360);
  });
});

describe('what fits in the toolbar', () => {
  it('shows everything on a wide pane', () => {
    expect(barLevel(1000)).toBe('full');
    expect(barLevel(BAR_BREAKS.compact)).toBe('full');
  });

  it('moves Copy link first, then Versions, then shrinks Download to its icon', () => {
    expect(barLevel(BAR_BREAKS.compact - 1)).toBe('compact');
    expect(barLevel(BAR_BREAKS.tight - 1)).toBe('tight');
    expect(barLevel(BAR_BREAKS.icon - 1)).toBe('icon');
    expect(barLevel(360)).toBe('icon');
  });

  it('is decided by the pane, so the reported window gets the smallest toolbar', () => {
    expect(barLevel(paneWidth(1000, 216, 720, false))).toBe('icon');
  });
});
