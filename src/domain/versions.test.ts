import { describe, expect, it } from 'vitest';
import type { Doc } from '../api/types';
import {
  currentVersionId,
  isCurrent,
  resolveVersion,
  selectedVersionId,
  versionName,
} from './versions';

// API order is the truth: newest by version_index first. `added` can disagree with it.
const doc: Doc = {
  id: 13,
  title: 'Operating agreement',
  tags: [],
  created: '2026-11-04',
  added: '2026-11-16T14:18:28Z',
  pageCount: 7,
  mime: 'text/plain',
  versions: [
    { id: 18, added: '2026-11-16T14:18:50Z', label: 'Signed', isRoot: false },
    { id: 37, added: '2026-11-16T14:20:11Z', label: 'Approved, unsigned', isRoot: false },
    { id: 13, added: '2026-11-16T14:18:28Z', label: null, isRoot: true },
  ],
};

describe('versions', () => {
  it('takes the current version from API order, not from the added date', () => {
    expect(currentVersionId(doc)).toBe(18);
  });

  it('addresses no `v` as the current version', () => {
    expect(selectedVersionId(doc, null)).toBe(18);
    expect(isCurrent(doc, null)).toBe(true);
  });

  it('addresses an exact older version', () => {
    expect(selectedVersionId(doc, 37)).toBe(37);
    expect(isCurrent(doc, 37)).toBe(false);
  });

  it('tells an absent version from an invalid explicit one', () => {
    expect(resolveVersion(doc, null)).toEqual({ state: 'ok', id: 18, explicit: false });
    expect(resolveVersion(doc, 37)).toEqual({ state: 'ok', id: 37, explicit: true });
    expect(resolveVersion(doc, 999999)).toEqual({ state: 'invalid', requested: 999999 });
  });

  it('treats a version of another record as invalid', () => {
    expect(resolveVersion(doc, 50).state).toBe('invalid');
  });

  it('names a version by label, else by date', () => {
    expect(versionName(doc.versions[0]!)).toBe('Signed');
    expect(versionName(doc.versions[2]!)).toBe('Nov 16, 2026');
  });
});
