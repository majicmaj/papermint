import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filterChips, matchesFilters, sortRecords } from './filters';
import type { DetailedDoc } from './record-details';
const doc: DetailedDoc = {
  id: 1,
  title: 'B',
  tags: [],
  created: '2026-01-02',
  added: '2026-02-01',
  modified: '2026-03-01',
  size: 100,
  pageCount: 2,
  mime: 'application/pdf',
  versions: [
    { id: 1, added: '', label: null, isRoot: true },
    { id: 2, added: '', label: null, isRoot: false },
  ],
};
describe('filters and sort', () => {
  it('combines date, size, pages, type, versions and signed', () => {
    const filters = {
      ...EMPTY_FILTERS,
      createdFrom: '2026-01-01',
      modifiedTo: '2026-03-02',
      minSize: '99',
      maxPages: '2',
      mime: 'application/pdf',
      versions: true,
      signed: true,
    };
    expect(matchesFilters(doc, filters, true)).toBe(true);
    expect(matchesFilters(doc, filters, false)).toBe(false);
    expect(matchesFilters(doc, { ...filters, minSize: '101' }, true)).toBe(false);
    expect(matchesFilters(doc, { ...filters, modifiedTo: '2026-02-01' }, true)).toBe(false);
  });
  it('sorts without mutating the index', () => {
    const docs = [doc, { ...doc, id: 2, title: 'A', size: 200 }];
    expect(sortRecords(docs, 'title', true).map((item) => item.id)).toEqual([2, 1]);
    expect(sortRecords(docs, 'size', false).map((item) => item.id)).toEqual([2, 1]);
    expect(docs[0]?.id).toBe(1);
  });
});

describe('filter chips', () => {
  it('has no chip when nothing is filtered', () => {
    expect(filterChips(EMPTY_FILTERS)).toEqual([]);
  });

  it('makes one chip for a paired range and clears both fields', () => {
    const chips = filterChips({
      ...EMPTY_FILTERS,
      createdFrom: '2026-01-01',
      createdTo: '2026-02-03',
    });
    expect(chips).toHaveLength(1);
    expect(chips[0]!.label).toBe('Created Jan 1, 2026 – Feb 3, 2026');
    expect(chips[0]!.clear).toEqual({ createdFrom: '', createdTo: '' });
  });

  it('labels one-sided ranges, size, pages, type and flags', () => {
    const chips = filterChips({
      ...EMPTY_FILTERS,
      addedFrom: '2026-03-04',
      minSize: '1500',
      maxPages: '9',
      mime: 'application/pdf',
      signed: true,
      superseded: true,
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      'Added from Mar 4, 2026',
      'Size from 1.5 KB',
      'Pages to 9',
      'PDF',
      'Signed',
      'Superseded',
    ]);
  });
});
