import { describe, expect, it } from 'vitest';
import type { Tag } from '../api/types';
import { buildTagModel, matchesTaxonomy } from './tags';
import { signed, successorId, type DetailedDoc } from './record-details';
const tag = (id: number, name: string, parent: number | null) => ({
  id,
  name,
  parent,
  slug: name.toLowerCase(),
  color: '#000000',
});
const tags = [
  tag(1, 'LLC', null),
  tag(2, 'Tax', 1),
  tag(3, 'Signed', null),
  tag(4, 'Current', null),
] satisfies Tag[];
const doc = {
  id: 8,
  title: 'Test',
  tags: [1, 2, 3, 4],
  created: '',
  added: '',
  pageCount: null,
  mime: '',
  versions: [],
  customFields: [{ field: 7, value: [9] }],
} satisfies DetailedDoc;
describe('taxonomy and record details', () => {
  it('separates areas and topics and excludes reserved tags', () => {
    const model = buildTagModel(tags, [doc]);
    expect(model.areas.map((item) => item.id)).toEqual([1]);
    expect(model.topics.map((item) => item.id)).toEqual([2]);
  });
  it('combines OR within groups with AND between groups', () => {
    expect(matchesTaxonomy(doc, [1, 99], [2, 98])).toBe(true);
    expect(matchesTaxonomy(doc, [99], [2])).toBe(false);
    expect(matchesTaxonomy(doc, [1], [98])).toBe(false);
  });
  it('reads marker and document link', () => {
    expect(signed(doc, tags)).toBe(true);
    expect(successorId(doc, 7, () => false)).toBe(9);
  });
});
