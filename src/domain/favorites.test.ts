import { describe, expect, it } from 'vitest';
import type { Doc, Tag } from '../api/types';
import {
  MAX_FAVORITES,
  captureQuery,
  describeQuery,
  filtersOf,
  isEmptyQuery,
  moveFavorite,
  parseFavorites,
  queryIsAvailable,
  sameQuery,
  serializeFavorites,
  suggestName,
  type Favorite,
} from './favorites';
import { EMPTY_FILTERS } from './filters';
import { recordsMatching } from './matching';
import { buildTagModel } from './tags';

const names: Record<number, string> = { 1: 'LLC', 2: 'Personal', 6: 'Tax', 8: 'Finance' };
const nameOf = (id: number) => names[id];

const favorite = (id: string, patch: Partial<Favorite> = {}): Favorite => ({
  id,
  name: id.toUpperCase(),
  icon: 'star',
  color: '#3e63dd',
  query: { filters: { mime: 'application/pdf' }, areas: [], topics: [] },
  ...patch,
});

describe('favorite queries', () => {
  it('keeps only the set filter fields, and sorted unique ids', () => {
    const query = captureQuery(
      { ...EMPTY_FILTERS, mime: 'application/pdf', signed: true, createdFrom: '2026-01-01' },
      [2, 1, 2],
      [8, 6],
    );
    expect(query).toEqual({
      filters: { createdFrom: '2026-01-01', mime: 'application/pdf', signed: true },
      areas: [1, 2],
      topics: [6, 8],
    });
    expect(filtersOf(query)).toEqual({
      ...EMPTY_FILTERS,
      createdFrom: '2026-01-01',
      mime: 'application/pdf',
      signed: true,
    });
  });

  it('compares queries by content, not by order', () => {
    const a = captureQuery({ ...EMPTY_FILTERS, signed: true }, [1, 2], [6]);
    const b = { filters: { signed: true, mime: '' }, areas: [2, 1], topics: [6] };
    expect(sameQuery(a, b)).toBe(true);
    expect(sameQuery(a, { ...b, topics: [] })).toBe(false);
    expect(sameQuery(a, { ...b, filters: { signed: true, versions: true } })).toBe(false);
  });

  it('knows an empty query', () => {
    expect(isEmptyQuery(captureQuery(EMPTY_FILTERS, [], []))).toBe(true);
    expect(isEmptyQuery(captureQuery({ ...EMPTY_FILTERS, superseded: true }, [], []))).toBe(false);
    expect(isEmptyQuery(captureQuery(EMPTY_FILTERS, [1], []))).toBe(false);
  });

  it('describes and names a query from its tags and chips', () => {
    const query = captureQuery({ ...EMPTY_FILTERS, mime: 'application/pdf' }, [1], [6, 8]);
    expect(describeQuery(query, nameOf)).toEqual(['LLC', 'Tax', 'Finance', 'PDF']);
    expect(suggestName(query, nameOf)).toBe('Tax & Finance');
    expect(suggestName(captureQuery(EMPTY_FILTERS, [2], []), nameOf)).toBe('Personal');
    expect(suggestName(captureQuery({ ...EMPTY_FILTERS, signed: true }, [], []), nameOf)).toBe(
      'Signed',
    );
  });
});

describe('stored favorites', () => {
  it('round-trips through storage', () => {
    const items = [favorite('a'), favorite('b', { icon: null, color: '#e5484d' })];
    expect(parseFavorites(serializeFavorites(items))).toEqual(items);
  });

  it('never throws on bad data, and repairs what it can', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('not json')).toEqual([]);
    expect(parseFavorites('{"items": 3}')).toEqual([]);
    const raw = JSON.stringify({
      items: [
        { id: 'ok', name: '  Bills  ', icon: 'no-such-icon', color: 'red', query: { areas: [1] } },
        { id: 'ok', name: 'Duplicate', query: { areas: [1] } },
        { id: 'empty', name: 'Nothing', query: { filters: { mime: '' } } },
        { id: 'unnamed', name: ' ', query: { areas: [1] } },
        { id: 'typed', name: 'Typed', query: { filters: { signed: 'yes', maxPages: '3' } } },
        null,
      ],
    });
    expect(parseFavorites(raw)).toEqual([
      {
        id: 'ok',
        name: 'Bills',
        icon: null,
        color: '#8d8d8d',
        query: { filters: {}, areas: [1], topics: [] },
      },
      {
        id: 'typed',
        name: 'Typed',
        icon: null,
        color: '#8d8d8d',
        query: { filters: { maxPages: '3' }, areas: [], topics: [] },
      },
    ]);
  });

  it('keeps at most the limit', () => {
    const items = Array.from({ length: MAX_FAVORITES + 5 }, (_, i) => favorite(`f${i}`));
    expect(parseFavorites(serializeFavorites(items))).toHaveLength(MAX_FAVORITES);
  });

  it('moves a favorite within the list, and not past either end', () => {
    const items = [favorite('a'), favorite('b'), favorite('c')];
    const ids = (list: Favorite[]) => list.map((item) => item.id);
    expect(ids(moveFavorite(items, 'c', -1))).toEqual(['a', 'c', 'b']);
    expect(ids(moveFavorite(items, 'a', 1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveFavorite(items, 'a', -1))).toEqual(['a', 'b', 'c']);
    expect(ids(moveFavorite(items, 'c', 1))).toEqual(['a', 'b', 'c']);
    expect(ids(items)).toEqual(['a', 'b', 'c']);
  });
});

describe('favorite counts', () => {
  const tag = (id: number, name: string, parent: number | null = null): Tag => ({
    id,
    name,
    parent,
    slug: name.toLowerCase(),
    color: '#000000',
  });
  const tags = [tag(1, 'LLC'), tag(2, 'Personal'), tag(6, 'Tax', 1), tag(9, 'Superseded')];
  const doc = (id: number, ids: number[], mime = 'application/pdf'): Doc => ({
    id,
    title: `Doc ${id}`,
    tags: ids,
    created: '2026-01-01',
    added: '2026-01-01',
    pageCount: 1,
    mime,
    versions: [],
  });
  const docs = [doc(1, [1, 6]), doc(2, [1], 'image/png'), doc(3, [2]), doc(4, [1, 6, 9])];
  const model = buildTagModel(tags, docs);
  const count = (query: ReturnType<typeof captureQuery>) =>
    recordsMatching(docs, model, tags, { ...query, filters: filtersOf(query) }).length;

  it('requires every saved area and topic to still apply', () => {
    expect(queryIsAvailable(captureQuery(EMPTY_FILTERS, [1], [6]), model)).toBe(true);
    expect(queryIsAvailable(captureQuery(EMPTY_FILTERS, [1], [6, 98]), model)).toBe(false);
    expect(queryIsAvailable(captureQuery(EMPTY_FILTERS, [2], [6]), model)).toBe(false);
    expect(queryIsAvailable(captureQuery(EMPTY_FILTERS, [98], []), model)).toBe(false);
  });

  it('counts the records a favorite shows, with the same rules as the list', () => {
    expect(count(captureQuery(EMPTY_FILTERS, [1], []))).toBe(2);
    expect(count(captureQuery(EMPTY_FILTERS, [1], [6]))).toBe(1);
    expect(count(captureQuery({ ...EMPTY_FILTERS, superseded: true }, [1], [6]))).toBe(2);
    expect(count(captureQuery({ ...EMPTY_FILTERS, mime: 'image/png' }, [], []))).toBe(1);
  });
});
