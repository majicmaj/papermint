import { expect, test } from '@playwright/test';
import { findVersioned, type ApiDoc } from './api';
import { isSensitive, sensitiveTagIds, withoutSensitive } from './live';

// Fake data only: no live record is read here.
const tags = [
  { id: 1, name: 'Current' },
  { id: 7, name: 'Sensitive' },
];
const doc = (id: number, tagIds: number[]): ApiDoc => ({
  id,
  title: `Doc ${id}`,
  mime_type: 'application/pdf',
  tags: tagIds,
  versions: [
    { id: id * 10 + 1, version_label: 'Signed', is_root: false },
    { id: id * 10, version_label: null, is_root: true },
    { id, version_label: null, is_root: true },
  ],
});

test('the Sensitive tag is found by name, in any case', () => {
  expect(sensitiveTagIds(tags)).toEqual([7]);
  expect(sensitiveTagIds([{ id: 3, name: ' SENSITIVE ' }])).toEqual([3]);
  expect(isSensitive(doc(1, [1, 7]), tags)).toBe(true);
  expect(isSensitive(doc(2, [1]), tags)).toBe(false);
});

test('live specs never get a Sensitive record from the index', () => {
  const docs = [doc(1, [1, 7]), doc(2, [1]), doc(3, [7])];
  expect(withoutSensitive(docs, tags).map((d) => d.id)).toEqual([2]);
});

test("the live suite's record picker skips Sensitive records", () => {
  // The Sensitive record is first and would win without the filter.
  const docs = [doc(1, [1, 7]), doc(2, [1])];
  expect(findVersioned(docs).id).toBe(1);
  expect(findVersioned(withoutSensitive(docs, tags)).id).toBe(2);
  expect(() => findVersioned(withoutSensitive([doc(1, [7])], tags))).toThrow();
});
