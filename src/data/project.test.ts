import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { dbGet, openDb, resetDb } from './idb';
import { readStoredIndex, writeStoredIndex } from './index-store';
import { projectDoc, projectIndex } from './project';

const SENTINEL_CONTENT = 'SENSITIVE-CONTENT-SENTINEL';
const SENTINEL_NOTE = 'SENSITIVE-NOTE-SENTINEL';
const SENTINEL_FIELD = 'SENSITIVE-CUSTOM-FIELD-SENTINEL';

/** A record the way a careless caller or an older app version might hold it: far too much. */
const hostile = {
  id: 106,
  title: 'Apartment lease',
  tags: [2, 5],
  created: '2026-06-10',
  added: '2026-06-10T10:00:00Z',
  modified: '2026-06-11T10:00:00Z',
  pageCount: 20,
  mime: 'application/pdf',
  content: SENTINEL_CONTENT,
  notes: [{ note: SENTINEL_NOTE }],
  original_file_name: 'ssn-card.pdf',
  checksum: 'abc',
  versions: [
    {
      id: 106,
      added: '2026-06-10T10:00:00Z',
      label: 'Signed',
      isRoot: true,
      content: SENTINEL_CONTENT,
      checksum: 'x',
    },
  ],
  customFields: [
    { field: 1, value: [107, 108] },
    { field: 2, value: SENTINEL_FIELD },
  ],
};

describe('what is kept on disk', () => {
  it('keeps exactly the allowlisted fields of a record', () => {
    const doc = projectDoc(hostile, 1)!;
    expect(Object.keys(doc).sort()).toEqual(
      [
        'added',
        'created',
        'customFields',
        'id',
        'mime',
        'modified',
        'pageCount',
        'tags',
        'title',
        'versions',
      ].sort(),
    );
    expect(Object.keys(doc.versions[0]!).sort()).toEqual(['added', 'id', 'isRoot', 'label']);
  });

  it('never keeps text, notes, file names, checksums or other custom fields', () => {
    const json = JSON.stringify(projectIndex({ docs: [hostile], tags: [] }, 1));
    for (const secret of [
      SENTINEL_CONTENT,
      SENTINEL_NOTE,
      SENTINEL_FIELD,
      'ssn-card',
      'checksum',
    ]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it('keeps only the ids of the "Superseded by" links', () => {
    expect(projectDoc(hostile, 1)!.customFields).toEqual([{ field: 1, value: [107, 108] }]);
    // Without a known link field, no custom field is kept at all.
    expect(projectDoc(hostile, null)!.customFields).toEqual([]);
  });

  it('keeps tags with their hierarchy and nothing else', () => {
    const index = projectIndex(
      {
        docs: [],
        tags: [
          { id: 1, name: 'A', slug: 'a', color: 'x', parent: null, children: [2], secret: 'S' },
        ],
      },
      null,
    )!;
    expect(index.tags).toEqual([
      { id: 1, name: 'A', slug: 'a', color: 'x', parent: null, children: [2] },
    ]);
  });

  it('drops anything that is not a record', () => {
    const index = projectIndex(
      { docs: [null, 'x', { title: 'no id' }, { id: 1 }], tags: [] },
      null,
    )!;
    expect(index.docs.map((d) => d.id)).toEqual([1]);
    expect(projectIndex('nope')).toBeNull();
    expect(projectIndex({ docs: 1, tags: [] })).toBeNull();
  });
});

describe('through IndexedDB', () => {
  beforeEach(() => {
    resetDb();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('a Sensitive record with secret text and notes never reaches the database', async () => {
    await writeStoredIndex({ docs: [hostile as never], tags: [], successorField: 1 });
    const raw = JSON.stringify(await dbGet('index', 'index'));
    expect(raw).toContain('Apartment lease');
    for (const secret of [SENTINEL_CONTENT, SENTINEL_NOTE, SENTINEL_FIELD]) {
      expect(raw, secret).not.toContain(secret);
    }
  });

  it('an old, wider copy already on disk is cut down when it is read', async () => {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('index', 'readwrite');
      tx.objectStore('index').put({ docs: [hostile], tags: [], successorField: 1 }, 'index');
      tx.oncomplete = () => resolve();
    });
    const read = JSON.stringify(await readStoredIndex());
    for (const secret of [SENTINEL_CONTENT, SENTINEL_NOTE, SENTINEL_FIELD]) {
      expect(read, secret).not.toContain(secret);
    }
  });
});
