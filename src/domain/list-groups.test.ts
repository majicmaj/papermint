import { describe, expect, it } from 'vitest';
import type { DetailedDoc } from './record-details';
import {
  LIST_TOP,
  PHONE_HEAD,
  PHONE_ROW,
  dateFieldFor,
  groupField,
  groupRecords,
  listItems,
  shortDate,
} from './list-groups';

const doc = (id: number, created: string, modified?: string): DetailedDoc =>
  ({
    id,
    title: `Doc ${id}`,
    tags: [],
    created,
    added: `${created}T10:00:00Z`,
    modified,
    mime: 'application/pdf',
    versions: [],
  }) as unknown as DetailedDoc;

describe('phone dates', () => {
  const now = new Date(2026, 10, 18);

  it('drops the year only in the current year', () => {
    expect(shortDate('2026-11-16', now)).toBe('Nov 16');
    expect(shortDate('2025-12-03', now)).toBe('Dec 3, 2025');
    expect(shortDate(undefined, now)).toBe('');
  });

  it('names the month of a day and of a timestamp', () => {
    const rows = [doc(1, '2026-11-01'), doc(2, '2026-03-15', '2026-03-15T12:00:00Z')];
    expect(groupRecords(rows, 'created', 'month')[0]?.label).toBe('November 2026');
    expect(groupRecords(rows, 'modified', 'month').map(({ label }) => label)).toEqual([
      'No date',
      'March 2026',
    ]);
  });

  it('shows the sorted date, else the view date', () => {
    expect(dateFieldFor('modified')).toBe('modified');
    expect(dateFieldFor('added')).toBe('added');
    expect(dateFieldFor('size')).toBe('created');
    expect(groupField('title')).toBeNull();
    expect(groupField('added')).toBe('added');
  });
});

describe('listItems', () => {
  it('preserves title order within explicitly grouped years', () => {
    const rows = [doc(1, '2025-04-16'), doc(2, '2026-02-16'), doc(3, '2025-10-30')];
    const groups = groupRecords(rows, 'title', 'year');
    expect(groups.map(({ label }) => label)).toEqual(['2026', '2025']);
    expect(groups.flatMap((group) => group.rows.map(({ id }) => id))).toEqual([2, 1, 3]);
    expect(groupRecords(rows, 'created', 'none')).toEqual([{ label: null, rows }]);
  });

  it('puts a header before each month and gives every item its offset', () => {
    const items = listItems(
      groupRecords(
        [doc(1, '2026-11-16'), doc(2, '2026-11-02'), doc(3, '2026-10-30')],
        'created',
        'auto',
      ),
    );
    expect(items.map((item) => (item.kind === 'head' ? item.label : item.doc.id))).toEqual([
      'November 2026',
      1,
      2,
      'October 2026',
      3,
    ]);
    expect(items.map((item) => item.y)).toEqual([
      LIST_TOP,
      LIST_TOP + PHONE_HEAD,
      LIST_TOP + PHONE_HEAD + PHONE_ROW,
      LIST_TOP + PHONE_HEAD + 2 * PHONE_ROW,
      LIST_TOP + 2 * PHONE_HEAD + 2 * PHONE_ROW,
    ]);
  });

  it('is one flat list without a date sort', () => {
    const items = listItems(
      groupRecords([doc(1, '2026-11-16'), doc(2, '2025-01-01')], 'title', 'auto'),
    );
    expect(items.every((item) => item.kind === 'row')).toBe(true);
    expect(items.map((item) => item.y)).toEqual([LIST_TOP, LIST_TOP + PHONE_ROW]);
  });

  it('groups records without the date under one header', () => {
    const items = listItems(
      groupRecords([doc(1, '2026-11-16'), doc(2, '2026-11-15')], 'modified', 'auto'),
    );
    expect(items.filter((item) => item.kind === 'head')).toHaveLength(1);
  });
});
