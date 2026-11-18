import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, type Filters } from '../domain/filters';
import {
  MENU,
  bytesToKb,
  clearOf,
  datePresets,
  dateSummary,
  isSet,
  kbToBytes,
  namesSummary,
  presetOf,
  searchMenu,
  searchNames,
  shortDay,
  summaryOf,
  type SummaryContext,
} from './rows';

const TODAY = new Date(2026, 10, 18);
const ctx = (patch: Partial<Filters> = {}, more: Partial<SummaryContext> = {}): SummaryContext => ({
  filters: { ...EMPTY_FILTERS, ...patch },
  sort: 'created',
  sortLabel: 'Created',
  areaNames: [],
  topicNames: [],
  today: TODAY,
  ...more,
});

describe('the menu', () => {
  it('lists every filter kind once, in the order of the spec', () => {
    expect(MENU.map((item) => item.label)).toEqual([
      'Areas',
      'Topics',
      'Created',
      'Added',
      'Modified',
      'Size',
      'Pages',
      'Type',
      'Signed',
      'Versions',
      'Sort',
    ]);
  });

  it('narrows by label, without case or accents', () => {
    expect(searchMenu('').length).toBe(MENU.length);
    expect(searchMenu('  ').length).toBe(MENU.length);
    expect(searchMenu('ED').map((item) => item.kind)).toEqual([
      'created',
      'added',
      'modified',
      'signed',
    ]);
    expect(searchMenu('sïgn').map((item) => item.kind)).toEqual(['signed']);
    expect(searchMenu('zzz')).toEqual([]);
  });
});

describe('dates', () => {
  it('builds presets that end today, and calendar years', () => {
    const presets = datePresets(TODAY);
    expect(presets.map((p) => [p.label, p.from, p.to])).toEqual([
      ['Last 7 days', '2026-11-12', ''],
      ['Last 30 days', '2026-10-20', ''],
      ['Last 90 days', '2026-08-21', ''],
      ['This year', '2026-01-01', ''],
      ['Last year', '2025-01-01', '2025-12-31'],
    ]);
  });

  it('crosses a month and a year boundary', () => {
    expect(datePresets(new Date(2026, 0, 3))[0]!.from).toBe('2025-12-28');
  });

  it('names a preset, or the range, or nothing', () => {
    expect(presetOf('', '', TODAY)).toBeUndefined();
    expect(presetOf('2026-10-20', '', TODAY)?.label).toBe('Last 30 days');
    expect(dateSummary('created', ctx({ createdFrom: '2026-10-20' }).filters, TODAY)).toBe(
      'Last 30 days',
    );
    expect(dateSummary('added', ctx({ addedFrom: '2026-03-01' }).filters, TODAY)).toBe(
      'From Mar 1',
    );
    expect(dateSummary('added', ctx({ addedTo: '2025-12-03' }).filters, TODAY)).toBe(
      'To Dec 3, 2025',
    );
    expect(
      dateSummary(
        'modified',
        ctx({ modifiedFrom: '2026-03-01', modifiedTo: '2026-04-02' }).filters,
        TODAY,
      ),
    ).toBe('Mar 1 – Apr 2');
    expect(dateSummary('created', EMPTY_FILTERS, TODAY)).toBe('');
  });

  it('shows the year only when it is not this year', () => {
    expect(shortDay('2026-11-16', TODAY)).toBe('Nov 16');
    expect(shortDay('2025-12-03', TODAY)).toBe('Dec 3, 2025');
  });
});

describe('summaries', () => {
  it('names one choice and counts several', () => {
    expect(namesSummary([])).toBe('');
    expect(namesSummary(['LLC'])).toBe('LLC');
    expect(namesSummary(['Tax', 'Banking', 'Health'])).toBe('3');
    expect(summaryOf('areas', ctx({}, { areaNames: ['LLC'] }))).toBe('LLC');
    expect(summaryOf('topics', ctx({}, { topicNames: ['Tax', 'Banking'] }))).toBe('2');
  });

  it('reads sizes, pages and the type like their chips, without the name', () => {
    expect(summaryOf('size', ctx({ minSize: '105000' }))).toBe('From 105 KB');
    expect(summaryOf('pages', ctx({ minPages: '2', maxPages: '9' }))).toBe('2 – 9');
    expect(summaryOf('type', ctx({ mime: 'application/pdf' }))).toBe('PDF');
    expect(summaryOf('type', ctx())).toBe('');
    expect(summaryOf('sort', ctx())).toBe('Created');
  });

  it('knows what a page can clear', () => {
    expect(isSet('size', ctx({ maxSize: '1000' }).filters)).toBe(true);
    expect(isSet('created', ctx({ createdTo: '2026-01-01' }).filters)).toBe(true);
    expect(isSet('type', EMPTY_FILTERS)).toBe(false);
    expect(isSet('sort', EMPTY_FILTERS)).toBe(false);
    expect(clearOf('added')).toEqual({ addedFrom: '', addedTo: '' });
    expect(clearOf('pages')).toEqual({ minPages: '', maxPages: '' });
  });
});

describe('search and units', () => {
  const tags = [{ name: 'Banking' }, { name: 'Stripe' }, { name: 'Tax' }, { name: 'Mercury' }];

  it('finds names that contain the query, the ones that start with it first', () => {
    expect(searchNames(tags, 'r').map((t) => t.name)).toEqual(['Stripe', 'Mercury']);
    expect(searchNames(tags, 'ta').map((t) => t.name)).toEqual(['Tax']);
    expect(searchNames(tags, 'a').map((t) => t.name)).toEqual(['Banking', 'Tax']);
    expect(searchNames(tags, '')).toEqual([]);
  });

  it('types sizes in KB and stores bytes', () => {
    expect(bytesToKb('105000')).toBe('105');
    expect(bytesToKb('')).toBe('');
    expect(kbToBytes('1.5')).toBe('1500');
    expect(kbToBytes('')).toBe('');
  });
});
