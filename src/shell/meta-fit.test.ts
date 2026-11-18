import { describe, expect, it } from 'vitest';
import { keepItems } from './meta-fit';

const line = (...widths: [number, number][]) => widths.map(([rank, width]) => ({ rank, width }));

describe('the meta line', () => {
  it('keeps everything when it fits', () => {
    const items = line([1, 60], [2, 70], [4, 30], [5, 80], [6, 80], [3, 90]);
    expect(keepItems(items, 1000, 10)).toEqual([true, true, true, true, true, true]);
  });

  it('drops the last topic, then the first, then the page count', () => {
    // version 60, date 70, context 90 (required), pages 30, topic 80, topic 80; gap 10.
    const items = line([1, 60], [2, 70], [4, 30], [5, 80], [6, 80], [3, 90]);
    expect(keepItems(items, 420, 10)).toEqual([true, true, true, true, false, true]);
    expect(keepItems(items, 330, 10)).toEqual([true, true, true, false, false, true]);
    expect(keepItems(items, 260, 10)).toEqual([true, true, false, false, false, true]);
  });

  it('never drops the date, the version label or the status link, however narrow', () => {
    const items = line([1, 60], [2, 70], [3, 90], [4, 30], [5, 80]);
    expect(keepItems(items, 50, 10)).toEqual([true, true, true, false, false]);
  });

  it('does not keep a smaller item behind one that was dropped', () => {
    const items = line([1, 60], [2, 70], [4, 200], [5, 20]);
    expect(keepItems(items, 220, 10)).toEqual([true, true, false, false]);
  });

  it('ignores items with no width, such as an empty status slot', () => {
    const items = line([1, 60], [2, 70], [3, 0], [4, 30]);
    expect(keepItems(items, 180, 10)).toEqual([true, true, true, true]);
  });
});
