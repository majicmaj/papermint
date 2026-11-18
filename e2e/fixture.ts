import type { Page, Route } from '@playwright/test';
import { NEW_ID } from './mocks';

/**
 * A complete mocked archive: every read and write goes to memory, nothing reaches the live
 * API. The taxonomy is hierarchical: areas LLC (10) and Personal (11), topics Tax (20) and
 * Banking (21) under LLC, Health (22) under Personal. Statuses: Draft 1, Current 2,
 * Superseded 3. Signed 4 and Sensitive 5 are markers.
 */
export interface MockTag {
  id: number;
  name: string;
  slug: string;
  color: string;
  parent: number | null;
  children: number[];
}

interface MockVersion {
  id: number;
  added: string;
  version_label: string | null;
  is_root: boolean;
}

export interface MockDoc {
  id: number;
  title: string;
  tags: number[];
  created: string;
  added: string;
  modified: string;
  page_count: number | null;
  mime_type: string;
  versions: MockVersion[];
  custom_fields: { field: number; value: unknown }[];
}

export const SUCCESSOR_FIELD = 1;
export const TAG = {
  draft: 1,
  current: 2,
  superseded: 3,
  signed: 4,
  sensitive: 5,
  llc: 10,
  personal: 11,
  tax: 20,
  banking: 21,
  health: 22,
} as const;

const tag = (id: number, name: string, color: string, parent: number | null = null): MockTag => ({
  id,
  name,
  slug: name.toLowerCase(),
  color,
  parent,
  children: [],
});

function makeTags(): MockTag[] {
  const tags = [
    tag(1, 'Draft', '#757575'),
    tag(2, 'Current', '#2e7d32'),
    tag(3, 'Superseded', '#8d8d8d'),
    tag(4, 'Signed', '#3e63dd'),
    tag(5, 'Sensitive', '#8d8d8d'),
    tag(10, 'LLC', '#3e63dd'),
    tag(11, 'Personal', '#0090ff'),
    tag(20, 'Tax', '#e5484d', 10),
    tag(21, 'Banking', '#12a594', 10),
    tag(22, 'Health', '#e93d82', 11),
  ];
  for (const t of tags) {
    if (t.parent !== null) tags.find((p) => p.id === t.parent)!.children.push(t.id);
  }
  return tags;
}

const PDF = 'application/pdf';
const PNG = 'image/png';
const TXT = 'text/plain';

function makeDoc(
  id: number,
  title: string,
  tags: number[],
  created: string,
  extra: Partial<MockDoc> = {},
): MockDoc {
  return {
    id,
    title,
    tags,
    created,
    added: `${created}T10:00:00Z`,
    modified: `${created}T11:00:00Z`,
    page_count: 3,
    mime_type: PDF,
    versions: [{ id, added: `${created}T10:00:00Z`, version_label: null, is_root: true }],
    custom_fields: [],
    ...extra,
  };
}

const link = (...ids: number[]) => [{ field: SUCCESSOR_FIELD, value: ids }];

function makeDocs(): MockDoc[] {
  const versions = (id: number) => [
    {
      id: id * 10 + 2,
      added: '2026-03-04T10:00:00Z',
      version_label: 'Signed copy',
      is_root: false,
    },
    { id: id * 10 + 1, added: '2026-03-03T10:00:00Z', version_label: 'Draft', is_root: false },
    { id, added: '2026-03-02T10:00:00Z', version_label: null, is_root: true },
  ];
  return [
    makeDoc(101, 'Operating agreement', [2, 4, 10], '2026-03-01', {
      page_count: 12,
      versions: versions(101),
      custom_fields: link(103),
    }),
    makeDoc(102, 'EIN letter', [2, 10, 20], '2026-02-10', {
      page_count: 1,
      custom_fields: link(109),
    }),
    makeDoc(103, 'Operating agreement draft', [3, 10], '2026-01-05', {
      page_count: 10,
      custom_fields: link(101),
    }),
    makeDoc(104, 'Bank statement', [2, 10, 21], '2026-04-02'),
    makeDoc(105, 'Health insurance', [2, 11, 22], '2026-05-01', { page_count: 2 }),
    makeDoc(106, 'Apartment lease', [2, 5, 11], '2026-06-10', { page_count: 20 }),
    makeDoc(107, 'Joint tax return', [2, 10, 11, 20, 22], '2026-07-01', { page_count: 5 }),
    makeDoc(108, 'Draft contract', [1, 10], '2026-08-01', { page_count: null, mime_type: TXT }),
    makeDoc(109, 'EIN letter scan', [3, 10, 20], '2026-02-11', {
      page_count: 1,
      mime_type: PNG,
      custom_fields: link(102),
    }),
    makeDoc(110, 'Stripe agreement', [2, 4, 10, 21], '2026-02-02', { page_count: 8 }),
    makeDoc(111, 'Photo ID', [2, 11], '2026-01-20', { page_count: 1, mime_type: PNG }),
    makeDoc(112, 'Meeting notes', [2, 10], '2026-03-15', { page_count: null, mime_type: TXT }),
  ];
}

export interface Writes {
  tagPosts: Record<string, unknown>[];
  tagPatches: { id: number; body: Record<string, unknown> }[];
  docPatches: { id: number; body: Record<string, unknown> }[];
  settingsPosts: Record<string, unknown>[];
  merges: unknown[];
}

export interface Api {
  writes: Writes;
  tags: MockTag[];
  docs: MockDoc[];
  settings: Record<string, unknown>;
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const page = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

const INDEX_KEYS = [
  'id',
  'title',
  'tags',
  'created',
  'added',
  'page_count',
  'mime_type',
  'versions',
];

function pickDocFields(doc: MockDoc, fields: string): Partial<MockDoc> {
  const keys = fields ? fields.split(',') : INDEX_KEYS;
  return Object.fromEntries(keys.map((key) => [key, doc[key as keyof MockDoc]]));
}

type Handler = (route: Route, url: URL, method: string) => Promise<boolean>;

function readHandler(api: Api): Handler {
  return async (route, url, method) => {
    if (method !== 'GET' && method !== 'HEAD') return false;
    const path = url.pathname;
    if (path === '/api/documents/') {
      const fields = url.searchParams.get('fields') ?? '';
      const results = url.searchParams.get('query')
        ? []
        : api.docs.map((d) => pickDocFields(d, fields));
      await json(route, page(results));
    } else if (path === '/api/tags/') {
      await json(route, page(api.tags));
    } else if (path === '/api/custom_fields/') {
      await json(
        route,
        page([{ id: SUCCESSOR_FIELD, name: 'Superseded by', data_type: 'documentlink' }]),
      );
    } else if (path === '/api/ui_settings/') {
      await json(route, { user: { id: 2 }, settings: api.settings, permissions: [] });
    } else if (/^\/api\/documents\/\d+\/metadata\/$/.test(path)) {
      await json(route, { original_size: Number(path.split('/')[3]) * 1000 });
    } else if (/^\/api\/documents\/\d+\/(preview|download)\/$/.test(path)) {
      await route.fulfill({ status: 200, contentType: 'text/plain', body: 'mock file' });
    } else if (/^\/api\/documents\/\d+\/$/.test(path)) {
      const doc = api.docs.find((d) => d.id === Number(path.split('/')[3]));
      await (doc ? json(route, doc) : json(route, {}, 404));
    } else if (path === '/api/tasks/') {
      await json(route, page([{ status: 'success', related_document_ids: [NEW_ID] }]));
    } else {
      return false;
    }
    return true;
  };
}

function tagWriteHandler(api: Api): Handler {
  return async (route, url, method) => {
    const path = url.pathname;
    if (method === 'POST' && path === '/api/tags/') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      api.writes.tagPosts.push(body);
      const created = tag(
        900 + api.writes.tagPosts.length,
        String(body['name']),
        String(body['color']),
        (body['parent'] as number | null) ?? null,
      );
      api.tags.push(created);
      if (created.parent !== null)
        api.tags.find((t) => t.id === created.parent)?.children.push(created.id);
      await json(route, created, 201);
      return true;
    }
    const match = /^\/api\/tags\/(\d+)\/$/.exec(path);
    if (method === 'PATCH' && match) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const id = Number(match[1]);
      api.writes.tagPatches.push({ id, body });
      const found = api.tags.find((t) => t.id === id)!;
      Object.assign(found, body);
      await json(route, found);
      return true;
    }
    return false;
  };
}

function otherWriteHandler(api: Api): Handler {
  return async (route, url, method) => {
    const path = url.pathname;
    const doc = /^\/api\/documents\/(\d+)\/$/.exec(path);
    if (method === 'POST' && path === '/api/ui_settings/') {
      const body = route.request().postDataJSON() as { settings: Record<string, unknown> };
      api.writes.settingsPosts.push(body.settings);
      api.settings = body.settings;
      await json(route, { success: true });
    } else if (method === 'PATCH' && doc) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const id = Number(doc[1]);
      api.writes.docPatches.push({ id, body });
      Object.assign(api.docs.find((d) => d.id === id) ?? {}, body);
      await json(route, {});
    } else if (method === 'POST' && path === '/api/documents/post_document/') {
      await json(route, 'mock-task');
    } else if (method === 'POST' && path === '/api/documents/merge_as_versions/') {
      api.writes.merges.push(route.request().postDataJSON());
      await json(route, { result: 'OK' });
    } else {
      return false;
    }
    return true;
  };
}

/** Serve the whole API from memory. Returns the state and every write the app made. */
export async function mockApi(target: Page): Promise<Api> {
  const api: Api = {
    tags: makeTags(),
    docs: makeDocs(),
    settings: {
      sidebar: { hidden_items: ['dashboard'] },
      version: '3.4.2',
      saved_views: { sidebar_views_visible_ids: [1, 2, 3] },
      majin: { other: 1, tagIcons: { '10': 'landmark' } },
    },
    writes: { tagPosts: [], tagPatches: [], docPatches: [], settingsPosts: [], merges: [] },
  };
  const handlers = [readHandler(api), tagWriteHandler(api), otherWriteHandler(api)];
  await target.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    for (const handle of handlers) {
      if (await handle(route, url, route.request().method())) return;
    }
    await json(route, {}, 404);
  });
  return api;
}
