import { describe, expect, it } from 'vitest';
import { dampen, progress, shouldDismiss, velocityOf, wrapFocus } from './drag';

describe('dampen', () => {
  it('follows the finger 1:1 downward', () => {
    expect(dampen(0)).toBe(0);
    expect(dampen(120)).toBe(120);
  });

  it('gives upward drags friction with a ceiling', () => {
    expect(dampen(-4)).toBeGreaterThan(-6);
    expect(dampen(-400)).toBeGreaterThanOrEqual(-28);
    expect(Math.abs(dampen(-100))).toBeLessThan(100);
    expect(dampen(-100)).toBeLessThan(dampen(-10));
  });
});

describe('progress', () => {
  it('is the dragged share, clamped', () => {
    expect(progress(100, 400)).toBe(0.25);
    expect(progress(-20, 400)).toBe(0);
    expect(progress(900, 400)).toBe(1);
    expect(progress(10, 0)).toBe(0);
  });
});

describe('velocityOf', () => {
  it('reads the last 100 ms only', () => {
    const samples = [
      { y: 0, t: 0 },
      { y: 10, t: 50 },
      { y: 60, t: 200 },
      { y: 90, t: 250 },
    ];
    expect(velocityOf(samples, 250)).toBeCloseTo(0.6, 5);
  });

  it('is zero without enough samples', () => {
    expect(velocityOf([], 10)).toBe(0);
    expect(velocityOf([{ y: 5, t: 10 }], 10)).toBe(0);
  });
});

describe('shouldDismiss', () => {
  it('dismisses a short flick down', () => {
    expect(shouldDismiss(30, 600, 0.3)).toBe(true);
  });

  it('dismisses a slow drag past 40% of the height', () => {
    expect(shouldDismiss(300, 600, 0.02)).toBe(true);
    expect(shouldDismiss(200, 600, 0.02)).toBe(false);
  });

  it('keeps the drawer after a flick up, however far it went down first', () => {
    expect(shouldDismiss(500, 600, -0.4)).toBe(false);
  });

  it('ignores a tap that moved a few pixels', () => {
    expect(shouldDismiss(3, 600, 0.9)).toBe(false);
  });
});

describe('wrapFocus', () => {
  it('wraps forward from the last item and backward from the first', () => {
    expect(wrapFocus(2, 3, false)).toBe(0);
    expect(wrapFocus(0, 3, true)).toBe(2);
    expect(wrapFocus(-1, 3, true)).toBe(2);
  });

  it('lets the browser move inside the drawer', () => {
    expect(wrapFocus(0, 3, false)).toBeNull();
    expect(wrapFocus(2, 3, true)).toBeNull();
    expect(wrapFocus(0, 0, false)).toBeNull();
  });
});
