import { describe, expect, it } from 'vitest';
import type { Tag } from '../api/types';
import { buildTagModel } from './tags';
import {
  effectiveAreas,
  intakeSelection,
  topicsIn,
  visibleSelection,
  withArea,
  withTopic,
} from './taxonomy';

const tag = (id: number, name: string, parent: number | null = null): Tag => ({
  id,
  name,
  parent,
  slug: name.toLowerCase(),
  color: 'x',
});
const tags = [
  tag(1, 'LLC'),
  tag(2, 'Personal'),
  tag(3, 'Tax', 1),
  tag(4, 'Health', 2),
  tag(5, 'Draft'),
  tag(6, 'Final'),
  tag(7, 'Signed'),
  tag(8, 'Mac'),
  tag(9, 'Sensitive'),
];
const model = buildTagModel(tags, []);

describe('areas and topics', () => {
  it('derives areas from top-level tags except the reserved names, Sensitive included', () => {
    expect(model.areas.map((t) => t.name)).toEqual(['LLC', 'Mac', 'Personal']);
    expect(model.topics.map((t) => t.name)).toEqual(['Health', 'Tax']);
    expect(model.areaOf.get(3)).toBe(1);
  });

  it('keeps a flat taxonomy as areas without topics', () => {
    const flat = buildTagModel([tag(1, 'LLC'), tag(2, 'Tax'), tag(3, 'Draft')], []);
    expect(flat.areas.map((t) => t.name)).toEqual(['LLC', 'Tax']);
    expect(flat.topics).toEqual([]);
  });

  it('shows the topics of the chosen areas, or of every area when none is chosen', () => {
    expect(effectiveAreas(model, [])).toHaveLength(3);
    expect(topicsIn(model, [1]).map((t) => t.id)).toEqual([3]);
    expect(
      topicsIn(
        model,
        effectiveAreas(model, [2]).map((t) => t.id),
      ).map((t) => t.id),
    ).toEqual([4]);
  });

  it('drops a selected topic whose area is no longer chosen', () => {
    expect(visibleSelection(model, [1], [3, 4])).toEqual([3]);
    expect(visibleSelection(model, [], [3, 4])).toEqual([3, 4]);
  });

  it('adds the area when a topic is added, as Paperless does', () => {
    expect(withTopic([5], model, 3).sort()).toEqual([1, 3, 5]);
    expect(withTopic([1, 3], model, 3)).toEqual([1]);
  });

  it('removes the topics of an area that is removed', () => {
    expect(withArea([1, 2, 3, 4], model, 1)).toEqual([2, 4]);
    expect(withArea([2], model, 1)).toEqual([2, 1]);
  });

  it('limits intake topics to the chosen areas', () => {
    expect(intakeSelection(model, [1], [3, 4])).toEqual([1, 3]);
    expect(intakeSelection(model, [1, 2], [3, 4])).toEqual([1, 2, 3, 4]);
  });
});
