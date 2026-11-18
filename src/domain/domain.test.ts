import { describe, expect, it } from 'vitest';
import type { Doc, Tag } from '../api/types';
import { normalizeDoc } from '../api/documents';
import { fileKind, formatDate } from './format';
import { buildTagModel, statusKeyOf, withStatus } from './tags';
import { withTopic } from './taxonomy';
import { listView, viewFor, viewCount } from './views';
import { parseRoute, recordPath } from '../state/routes';

const tag = (id: number, name: string): Tag => ({
  id,
  name,
  slug: name.toLowerCase(),
  color: '#000000',
});

const TAGS = [
  tag(5, 'Signed'),
  tag(13, 'Final'),
  tag(9, 'Draft'),
  tag(14, 'Superseded'),
  tag(6, 'Tax'),
  tag(1, 'LLC'),
  tag(11, 'Recovery'),
];

const doc = (id: number, tags: number[], created = '2026-01-01', added = created): Doc => ({
  id,
  title: `Doc ${id}`,
  tags,
  created,
  added,
  pageCount: null,
  mime: 'application/pdf',
  versions: [],
});

describe('tag model', () => {
  const docs = Array.from({ length: 12 }, (_, i) => doc(i + 1, [1, 9]));
  const model = buildTagModel(TAGS, docs);

  it('finds status tags by name and orders them', () => {
    expect(model.statuses.map((t) => t.name)).toEqual(['Draft', 'Final', 'Superseded']);
  });

  it('treats flat non-status tags as areas', () => {
    expect(model.areas.map((t) => t.name)).toEqual(['LLC', 'Recovery', 'Tax']);
  });

  it('keeps exactly one status tag', () => {
    expect(withStatus([1, 9, 6, 5], model, 13)).toEqual([1, 6, 5, 13]);
    expect(statusKeyOf([13], model)).toBe('current');
  });

  it('toggles topics', () => {
    expect(withTopic([1], model, 6)).toEqual([1, 6]);
    expect(withTopic([1, 6], model, 6)).toEqual([1]);
  });
});

describe('views', () => {
  const model = buildTagModel(TAGS, []);
  const docs = [
    doc(1, [5, 6], '2026-02-01'),
    doc(2, [13], '2026-03-01'),
    doc(3, [9], '2026-01-01', '2026-05-01T00:00:00Z'),
    doc(4, [9], '2026-01-02', '2026-06-01T00:00:00Z'),
    doc(5, [14]),
    doc(6, [], '2026-01-01', '2026-07-01T00:00:00Z'),
    doc(7, [13, 11]),
  ];

  it('puts Signed, Final and untagged documents in Records by default', () => {
    expect(listView(docs, 'records', model, null).map((d) => d.id)).toEqual([2, 1, 7, 6]);
  });

  it('puts untagged documents in Drafts when configured, newest added first', () => {
    expect(listView(docs, 'pending', model, null, 'draft').map((d) => d.id)).toEqual([6, 4, 3]);
  });

  it('keeps Recovery separate from tagged Paperless documents', () => {
    expect(listView(docs, 'recovery', model, null).map((d) => d.id)).toEqual([]);
  });

  it('filters by topic', () => {
    expect(listView(docs, 'records', model, 6).map((d) => d.id)).toEqual([]);
  });

  it('counts and routes records', () => {
    expect(viewCount(docs, 'records', model)).toBe(4);
    expect(viewFor(docs[4]!, model)).toBe('records');
    expect(viewFor(docs[5]!, model)).toBe('records');
    expect(viewFor(docs[5]!, model, 'draft')).toBe('pending');
  });
});

describe('format and api', () => {
  it('formats date-only values without time zone drift', () => {
    expect(formatDate('2026-11-04')).toBe('Nov 4, 2026');
    expect(formatDate('garbage')).toBe('');
  });

  it('classifies mime types', () => {
    expect(fileKind('application/pdf')).toBe('pdf');
    expect(fileKind('image/png')).toBe('image');
    expect(fileKind('text/plain')).toBe('text');
    expect(fileKind('application/zip')).toBe('other');
  });

  it('normalizes API documents', () => {
    const out = normalizeDoc({
      id: 1,
      title: 'x',
      tags: [],
      created: '2026-01-01',
      added: '2026-01-01T00:00:00Z',
      page_count: 3,
      mime_type: 'application/pdf',
      versions: [{ id: 1, added: 'a', version_label: null, is_root: true }],
    });
    expect(out.pageCount).toBe(3);
    expect(out.versions[0]?.isRoot).toBe(true);
  });
});

describe('router', () => {
  it('parses views and records', () => {
    expect(parseRoute('/')).toEqual({ name: 'records' });
    expect(parseRoute('/pending/')).toEqual({ name: 'pending' });
    expect(parseRoute('/r/12', '?v=30', 'pending')).toEqual({
      name: 'record',
      id: 12,
      version: 30,
      from: 'pending',
    });
    expect(parseRoute('/nope')).toEqual({ name: 'records' });
  });

  it('builds record paths', () => {
    expect(recordPath(5)).toBe('/r/5');
    expect(recordPath(5, 9)).toBe('/r/5?v=9');
  });
});
