import { describe, expect, it } from 'vitest';
import {
  linkedIds,
  nextLinks,
  replacedIds,
  sensitive,
  signed,
  successorId,
  type DetailedDoc,
} from './record-details';

const FIELD = 1;
const doc = (id: number, links: number[] | null): DetailedDoc => ({
  id,
  title: `Doc ${id}`,
  tags: [],
  created: '',
  added: '',
  pageCount: null,
  mime: '',
  versions: [],
  customFields: links === null ? [] : [{ field: FIELD, value: links }],
});

// Live shape: #15 and #16 are superseded by #50 and #13. Links are symmetric, so the
// successors list the records they replaced. #50 holds [15, 61]; #13 holds [16, 38, 40].
const superseded = new Set([15, 16, 38, 40, 61]);
const isSuperseded = (id: number) => superseded.has(id);

describe('successor and replaces from symmetric links', () => {
  it('reads the successor of a Superseded record as the linked record that is not Superseded', () => {
    expect(successorId(doc(15, [50]), FIELD, isSuperseded)).toBe(50);
    expect(successorId(doc(16, [13]), FIELD, isSuperseded)).toBe(13);
  });

  it('ignores the order of the links', () => {
    expect(successorId(doc(15, [61, 50]), FIELD, isSuperseded)).toBe(50);
  });

  it('has no successor without a link, or when the field is missing', () => {
    expect(successorId(doc(15, []), FIELD, isSuperseded)).toBeNull();
    expect(successorId(doc(15, null), FIELD, isSuperseded)).toBeNull();
    expect(successorId(doc(15, [50]), null, isSuperseded)).toBeNull();
  });

  it('has no successor when every link is Superseded and the chain cannot be followed', () => {
    expect(successorId(doc(15, [61]), FIELD, isSuperseded)).toBeNull();
  });

  it('lists what a Current record replaced and never calls it a successor', () => {
    expect(replacedIds(doc(50, [15, 61]), FIELD, isSuperseded)).toEqual([15, 61]);
    expect(replacedIds(doc(13, [16, 38, 40]), FIELD, isSuperseded)).toEqual([16, 38, 40]);
    expect(replacedIds(doc(15, [50]), FIELD, isSuperseded)).toEqual([]);
  });

  it('ignores values that are not document ids', () => {
    const odd = { ...doc(1, null), customFields: [{ field: FIELD, value: 'x' }] };
    expect(linkedIds(odd, FIELD)).toEqual([]);
    expect(linkedIds({ ...odd, customFields: [{ field: 2, value: [9] }] }, FIELD)).toEqual([]);
  });
});

describe('following a chain of supersessions', () => {
  // A is superseded by B, B by C, C is Current. Links are symmetric: B holds [A, C].
  const links: Record<number, number[]> = { 1: [2], 2: [1, 3], 3: [2] };
  const gone = new Set([1, 2]);
  const linksOf = (id: number) => links[id] ?? [];
  const find = (start: number, set = gone, graph = linksOf) =>
    successorId(doc(start, links[start] ?? []), FIELD, (id) => set.has(id), graph);

  it('ends at the single Current record', () => {
    expect(find(1)).toBe(3);
    expect(find(2)).toBe(3);
  });

  it('follows a longer chain', () => {
    const long: Record<number, number[]> = { 1: [2], 2: [1, 3], 3: [2, 4], 4: [3, 5], 5: [4] };
    expect(
      successorId(
        doc(1, [2]),
        FIELD,
        (id) => id < 5,
        (id) => long[id] ?? [],
      ),
    ).toBe(5);
  });

  it('stops at a cycle and shows nothing', () => {
    const loop: Record<number, number[]> = { 1: [2], 2: [1, 3], 3: [2] };
    expect(
      successorId(
        doc(1, [2]),
        FIELD,
        () => true,
        (id) => loop[id] ?? [],
      ),
    ).toBeNull();
  });

  it('shows nothing when two Current records are linked', () => {
    expect(successorId(doc(1, [2, 3]), FIELD, (id) => id === 1)).toBeNull();
  });

  it('shows nothing when the chain forks to two Current records', () => {
    const fork: Record<number, number[]> = { 2: [1, 3, 4] };
    expect(
      successorId(
        doc(1, [2]),
        FIELD,
        (id) => id <= 2,
        (id) => fork[id] ?? [],
      ),
    ).toBeNull();
  });

  it('never names the record itself', () => {
    expect(successorId(doc(1, [1]), FIELD, () => false)).toBeNull();
  });
});

describe('next links when the status is set', () => {
  it('writes only the successor to a record that becomes Superseded', () => {
    expect(nextLinks(doc(7, []), FIELD, isSuperseded, 50)).toEqual([50]);
  });

  it('keeps the records it replaced and swaps the old successor for the new one', () => {
    expect(nextLinks(doc(7, [15, 50]), FIELD, isSuperseded, 13)).toEqual([15, 13]);
    expect(nextLinks(doc(7, [15]), FIELD, isSuperseded, 13)).toEqual([15, 13]);
  });

  it('removes the successor when the record leaves Superseded', () => {
    expect(nextLinks(doc(15, [50]), FIELD, isSuperseded, null)).toEqual([]);
    expect(nextLinks(doc(7, [15, 50]), FIELD, isSuperseded, null)).toEqual([15]);
  });

  it('does not list the same record twice', () => {
    expect(nextLinks(doc(7, [13]), FIELD, isSuperseded, 13)).toEqual([13]);
  });
});

describe('markers', () => {
  const tags = [
    { id: 1, name: 'Signed', slug: 'signed', color: 'x' },
    { id: 2, name: 'Sensitive', slug: 'sensitive', color: 'x' },
  ];
  it('reads Signed and Sensitive by tag name', () => {
    expect(signed({ ...doc(1, null), tags: [1] }, tags)).toBe(true);
    expect(sensitive({ ...doc(1, null), tags: [1] }, tags)).toBe(false);
    expect(sensitive({ ...doc(1, null), tags: [2] }, tags)).toBe(true);
  });
});
