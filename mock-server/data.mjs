/**
 * A fake archive for tests, measurements and Lighthouse: the same shape as Paperless-ngx 3.4.2
 * answers, with fake titles and fake bytes. Nothing here comes from the live archive.
 */
export const SENSITIVE_TAG = 5;
export const SENSITIVE_BYTES = 'SENSITIVE-MOCK-BYTES';
export const SENSITIVE_CONTENT = 'SENSITIVE-CONTENT-SENTINEL';
export const SENSITIVE_NOTE = 'SENSITIVE-NOTE-SENTINEL';
export const SENSITIVE_FIELD = 'SENSITIVE-CUSTOM-FIELD-SENTINEL';
export const FAKE_CODE = 'FAKE-CODE-0000-1111-2222';

const TAGS = [
  [1, 'Review', '#757575', 10],
  [2, 'Current', '#2e7d32', null],
  [3, 'Superseded', '#8d8d8d', null],
  [4, 'Signed', '#3e63dd', null],
  [5, 'Sensitive', '#8d8d8d', null],
  [10, 'LLC', '#3e63dd', null],
  [11, 'Personal', '#0090ff', null],
  [20, 'Tax', '#e5484d', 10],
  [21, 'Banking', '#12a594', 10],
  [22, 'Health', '#e93d82', 11],
];

export function makeTags() {
  return TAGS.map(([id, name, color, parent]) => ({
    id,
    name,
    slug: name.toLowerCase(),
    color,
    parent,
    children: TAGS.filter((t) => t[3] === id).map((t) => t[0]),
  }));
}

function doc(id, title, tags, created, extra = {}) {
  return {
    id,
    title,
    tags,
    created,
    added: `${created}T10:00:00Z`,
    modified: `${created}T11:00:00Z`,
    page_count: 3,
    mime_type: 'application/pdf',
    versions: [{ id, added: `${created}T10:00:00Z`, version_label: null, is_root: true }],
    custom_fields: [],
    content: `content of record ${id}`,
    notes: [],
    ...extra,
  };
}

const HAND = [
  doc(101, 'Operating agreement', [2, 4, 10], '2026-03-01', {
    page_count: 12,
    mime_type: 'text/plain',
    versions: [
      { id: 1012, added: '2026-03-04T10:00:00Z', version_label: 'Signed copy', is_root: false },
      { id: 1011, added: '2026-03-03T10:00:00Z', version_label: 'Draft', is_root: false },
      { id: 101, added: '2026-03-02T10:00:00Z', version_label: null, is_root: true },
    ],
  }),
  doc(102, 'EIN letter', [2, 10, 20], '2026-02-10', { page_count: 1 }),
  doc(104, 'Bank statement', [2, 10, 21], '2026-04-02'),
  doc(105, 'Health insurance', [2, 11, 22], '2026-05-01', {
    page_count: 2,
    mime_type: 'image/png',
  }),
  doc(106, 'Apartment lease', [2, 5, 11], '2026-06-10', {
    page_count: 20,
    content: SENSITIVE_CONTENT,
    notes: [{ id: 1, note: SENSITIVE_NOTE }],
    custom_fields: [
      { field: 1, value: [105] },
      { field: 2, value: SENSITIVE_FIELD },
    ],
  }),
  doc(108, 'Draft contract', [1, 10], '2026-08-01', { mime_type: 'text/plain', page_count: null }),
  doc(112, 'Meeting notes', [2, 10], '2026-03-15', { mime_type: 'text/plain', page_count: null }),
  doc(113, 'Operating agreement template', [1, 10], '2026-07-01'),
  doc(114, 'Operating agreement review notes', [2, 10], '2026-07-02'),
  doc(115, 'Operating agreement clarification', [2, 10], '2026-07-03'),
  doc(116, 'Lease addendum', [2, 11], '2026-07-04', {
    content:
      'The tenant and the landlord confirm the terms of the rental agreement for the apartment, and the agreement continues for another year.',
  }),
];

const TOPICS = [
  [2, 10],
  [2, 10, 20],
  [2, 10, 21],
  [2, 11],
  [1, 10],
  [2, 11, 22],
];

/** `count` records: the hand-made ones first, then generated ones. */
export function makeDocs(count) {
  const docs = HAND.slice(0, Math.min(count, HAND.length)).map((d) => structuredClone(d));
  for (let i = docs.length; i < count; i += 1) {
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    docs.push(
      doc(
        1000 + i,
        `Record ${i} ${['agreement', 'statement', 'letter', 'return'][i % 4]}`,
        TOPICS[i % TOPICS.length],
        `2026-${month}-${day}`,
      ),
    );
  }
  return docs;
}

/** A 1x1 PNG, so an image preview really decodes. */
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHmEO0QAAAABJRU5ErkJggg==',
  'base64',
);

/** A minimal PDF, so a PDF preview has the right type and signature. */
export const PDF_BYTES = [
  '%PDF-1.1',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj',
  'trailer<</Root 1 0 R>>',
  '%%EOF',
].join('\n');

/** Versions whose file is a PDF although the root of their record is not. */
export const PDF_VERSIONS = new Set([1011, 1012]);

/** The record Paperless files for an upload, as the mock's task answer names it. */
export const UPLOADED_ID = 990001;
export const uploadedDoc = () => doc(UPLOADED_ID, 'Uploaded file', [], '2026-11-16');
