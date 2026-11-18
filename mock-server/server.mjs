/**
 * Serve a built app and a fake Paperless API on one origin, so a service worker can be tested
 * against it. Usage: DIST=dist PORT=4673 node mock-server/server.mjs
 *
 * PAPERMINT_SAMPLES=1 (and the public demo) serves the rendered sample archive in
 * mock-server/samples: real PDFs, pictures and notes. Tests use the small generated archive.
 *
 * Control: POST /__control {docs, latency, swVersion, sensitive:[ids]}; GET /__log; POST /__reset.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import {
  FAKE_CODE,
  PDF_BYTES,
  PDF_VERSIONS,
  PNG_BYTES,
  SENSITIVE_BYTES,
  SENSITIVE_TAG,
  makeDocs,
  UPLOADED_ID,
  makeTags,
  uploadedDoc,
} from './data.mjs';
import { appPath, landing } from './landing.mjs';
import { loadSamples } from './samples/load.mjs';

const PORT = Number(process.env.PORT ?? 4673);
const DIST = process.env.DIST ?? 'dist';
const PUBLIC = process.env.PAPERMINT_PUBLIC_DEMO === '1';
const samples = PUBLIC || process.env.PAPERMINT_SAMPLES === '1' ? loadSamples() : null;
const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'text/plain': 'txt' };
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

const state = {
  docs: samples ? structuredClone(samples.docs) : makeDocs(Number(process.env.DOCS ?? 40)),
  latency: Number(process.env.LATENCY ?? 0),
  swVersion: 1,
  log: [],
  patches: [],
  posts: [],
};
const tags = samples ? samples.tags : makeTags();

const send = (res, status, body, headers = {}) => {
  const isJson = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { 'content-type': isJson ? 'application/json' : 'text/plain', ...headers });
  res.end(isJson ? JSON.stringify(body) : body);
};
const page = (results) => ({ count: results.length, next: null, previous: null, results });
const pick = (d, fields) =>
  Object.fromEntries(
    (fields
      ? fields.split(',')
      : ['id', 'title', 'tags', 'created', 'added', 'page_count', 'mime_type', 'versions']
    ).map((k) => [k, d[k]]),
  );
const secret = (filename, extra = {}) => ({
  'content-type': 'application/octet-stream',
  'cache-control': 'no-store',
  'content-disposition': `attachment; filename="${filename}"`,
  ...extra,
});

function secrets(req, res, path) {
  if (path === '/recovery-files/code.txt')
    return send(res, 200, `Your code is: ${FAKE_CODE}\n`, secret('example-recovery-code.txt'));
  if (path === '/recovery-files/packet.pdf')
    return send(res, 200, PDF_BYTES, secret('example-recovery.pdf'));
  if (path === '/backups/originals')
    return send(
      res,
      200,
      req.method === 'HEAD' ? '' : 'x',
      secret('example-records.tar.gz', { 'content-length': '412345678' }),
    );
  return false;
}

// The demo archive is generated. These routes and labels exercise the optional download UI.
const demoConfig = {
  recoveryFiles: [
    {
      key: 'code',
      title: 'Example recovery code',
      href: '/recovery-files/code.txt',
      kind: 'text',
      label: 'TXT',
      filename: 'example-recovery-code.txt',
    },
    {
      key: 'packet',
      title: 'Example recovery PDF',
      href: '/recovery-files/packet.pdf',
      kind: 'pdf',
      label: 'PDF',
      filename: 'example-recovery.pdf',
    },
    {
      key: 'originals',
      title: 'Original records archive',
      href: '/backups/originals',
      kind: 'archive',
      label: 'TAR.GZ',
      filename: 'example-records.tar.gz',
    },
  ],
};

/** What one version of a record serves, as Paperless does: a type, bytes and a file extension. */
function fileOf(doc, kind, versionId) {
  if (doc.tags.includes(SENSITIVE_TAG))
    return { type: 'text/plain', bytes: SENSITIVE_BYTES, ext: 'txt' };
  if (kind === 'thumb') return { type: 'image/png', bytes: PNG_BYTES, ext: 'png' };
  if (PDF_VERSIONS.has(versionId)) return { type: 'application/pdf', bytes: PDF_BYTES, ext: 'pdf' };
  if (doc.mime_type.startsWith('image/'))
    return { type: 'image/png', bytes: PNG_BYTES, ext: 'png' };
  return { type: 'text/plain', bytes: `mock ${kind} of ${doc.id} ${versionId ?? ''}`, ext: 'txt' };
}

/** A rendered sample file, or null for a record that has none (or for a thumbnail). */
async function sampleFile(doc, kind, versionId) {
  if (!samples || kind === 'thumb') return null;
  const bytes = await samples.fileOf(doc.id, versionId);
  return bytes ? { type: doc.mime_type, bytes, ext: EXT[doc.mime_type] ?? 'bin' } : null;
}

async function files(res, doc, kind, version) {
  const wanted = version === null ? null : Number(version);
  const known = [doc.id, ...doc.versions.map((v) => v.id)];
  if (wanted !== null && !known.includes(wanted)) return send(res, 404, { detail: 'Not found.' });
  const versionId = wanted ?? doc.versions[0]?.id;
  const file = (await sampleFile(doc, kind, versionId)) ?? fileOf(doc, kind, versionId);
  const headers = { 'content-type': file.type };
  if (kind === 'download')
    headers['content-disposition'] =
      `attachment; filename="${doc.created} ${doc.title}.${file.ext}"`;
  return send(res, 200, file.bytes, headers);
}

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlight markup like Paperless: the matched word in <b>, a little text around it. */
function highlights(d, terms) {
  for (const text of [d.content, d.title]) {
    const at = text.toLowerCase().indexOf(terms[0]);
    if (at < 0) continue;
    const from = Math.max(0, at - 40);
    const hit = text.slice(at, at + terms[0].length);
    const before = escapeHtml(text.slice(from, at));
    const after = escapeHtml(text.slice(at + hit.length, at + hit.length + 60));
    return `${before}<b class="match term0">${escapeHtml(hit)}</b>${after}`;
  }
  return '';
}

/** Full-text search over titles and text, all words required, like Paperless `?query=`. */
function search(query, fields, size) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return state.docs
    .filter((d) => {
      const text = `${d.title} ${d.content}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    })
    .slice(0, Number(size) || 25)
    .map((d) => ({ ...pick(d, fields), __search_hit__: { highlights: highlights(d, terms) } }));
}

function lists(res, url) {
  const path = url.pathname;
  const fields = url.searchParams.get('fields');
  if (path === '/api/documents/') {
    const query = url.searchParams.get('query');
    if (query)
      return send(res, 200, page(search(query, fields, url.searchParams.get('page_size'))));
    return send(res, 200, page(state.docs.map((d) => pick(d, fields))));
  }
  if (path === '/api/tags/') return send(res, 200, page(tags));
  if (path === '/api/custom_fields/') {
    if (samples) return send(res, 200, page(samples.fields));
    return send(
      res,
      200,
      page([
        { id: 1, name: 'Superseded by', data_type: 'documentlink' },
        { id: 2, name: 'Secret text', data_type: 'string' },
      ]),
    );
  }
  if (path === '/api/ui_settings/')
    return send(res, 200, { user: { id: 2 }, settings: {}, permissions: [] });
  if (path === '/api/tasks/')
    return send(res, 200, page([{ status: 'success', related_document_ids: [UPLOADED_ID] }]));
  return false;
}

function documentApi(req, res, url, body) {
  const m = /^\/api\/documents\/(\d+)\/(preview|thumb|download|metadata)?\/?$/.exec(url.pathname);
  if (!m) return false;
  const id = Number(m[1]);
  const doc = state.docs.find((d) => d.id === id);
  if (!doc) return send(res, 404, { detail: 'No Document matches the given query.' });
  if (req.method === 'PATCH') {
    const patch = JSON.parse(body || '{}');
    state.patches.push({ id, body: patch });
    Object.assign(doc, patch);
    return send(res, 200, {});
  }
  if (m[2] === 'metadata')
    return send(res, 200, { original_size: samples?.sizeOf(id) ?? id * 1000 });
  if (m[2]) return files(res, doc, m[2], url.searchParams.get('version'));
  return send(res, 200, doc);
}

function api(req, res, url, body) {
  if (url.pathname === '/api/documents/post_document/' && req.method === 'POST') {
    state.posts.push(url.pathname);
    if (!state.docs.some((d) => d.id === UPLOADED_ID)) state.docs.push(uploadedDoc());
    return send(res, 200, JSON.stringify('mock-task'), { 'content-type': 'application/json' });
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && lists(res, url) !== false)
    return undefined;
  const answered = documentApi(req, res, url, body);
  if (answered !== false) return answered;
  return send(res, 404, {});
}

async function control(req, res, body) {
  const data = JSON.parse(body || '{}');
  if (data.docs) state.docs = makeDocs(data.docs);
  if (data.latency !== undefined) state.latency = data.latency;
  if (data.swVersion) state.swVersion = data.swVersion;
  for (const id of data.sensitive ?? [])
    state.docs.find((d) => d.id === id)?.tags.push(SENSITIVE_TAG);
  send(res, 200, { ok: true });
}

async function staticFile(res, path) {
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, safe === '/' ? 'index.html' : safe);
  let bytes = await readFile(file).catch(() => null);
  if (!bytes) {
    file = join(DIST, 'index.html');
    bytes = await readFile(file);
  }
  let out = bytes;
  const headers = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' };
  if (file.endsWith('sw.js')) {
    headers['cache-control'] = 'no-cache';
    // A second version of the worker: the same code under a different build id.
    if (state.swVersion > 1)
      out = Buffer.from(
        bytes.toString().replace(/precache-[0-9a-f]{12}/g, `precache-v${state.swVersion}`),
      );
  } else if (safe.startsWith('/assets/')) {
    headers['cache-control'] = 'public, max-age=31536000, immutable';
  } else if (file.endsWith('index.html')) {
    headers['cache-control'] = 'no-cache';
  }
  res.writeHead(200, headers);
  res.end(out);
}

const PUBLIC_ASSET = /^\/(?:assets|icons)\/[a-zA-Z0-9_-]+\.(?:js|css|png|svg|woff2)$/;
const PUBLIC_ROUTE = /^\/(?:pending|r\/\d+)?\/?$/;
const PUBLIC_FILES = new Set([
  '/index.html',
  '/sw.js',
  '/favicon.png',
  '/manifest.webmanifest',
  '/robots.txt',
]);

function allowPublic(req, res, url, path) {
  if (url.pathname.startsWith('/__')) {
    send(res, 404, { detail: 'Not found' });
    return false;
  }
  if (
    !['GET', 'HEAD'].includes(req.method) ||
    req.headers['transfer-encoding'] ||
    Number(req.headers['content-length'] ?? 0) > 0
  ) {
    send(res, 405, { detail: 'Demo is read only' }, { Allow: 'GET, HEAD' });
    return false;
  }
  if (
    path === '/config.json' ||
    url.pathname.startsWith('/api/') ||
    PUBLIC_ROUTE.test(path) ||
    PUBLIC_ASSET.test(path) ||
    PUBLIC_FILES.has(path)
  )
    return true;
  send(res, 404, { detail: 'Not found' });
  return false;
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const root = /^\/(?:api|__)\//.test(url.pathname);
  // The path inside the app. The API and the test controls stay at the root of the origin.
  const path = root ? url.pathname : appPath(url.pathname);
  if (PUBLIC) {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'same-origin');
    res.setHeader('cache-control', 'no-store');
  }
  if (path === null) return landing(req, res, url);
  if (PUBLIC && !allowPublic(req, res, url, path)) return;
  if (path === '/config.json') {
    const config = PUBLIC ? { readOnly: true } : demoConfig;
    return send(res, 200, config, { 'cache-control': 'no-store' });
  }
  const body = PUBLIC ? '' : await readBody(req);
  if (url.pathname.startsWith('/__')) return testControl(req, res, url, body);
  if (!PUBLIC) {
    state.log.push({ method: req.method, path: url.pathname + url.search });
    if (state.latency && url.pathname.startsWith('/api/'))
      await new Promise((r) => setTimeout(r, state.latency));
    if (secrets(req, res, path) !== false) return undefined;
  }
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('cache-control', 'no-store');
    return api(req, res, url, body);
  }
  return staticFile(res, path);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}

function testControl(req, res, url, body) {
  if (url.pathname === '/__log')
    return send(res, 200, { log: state.log, patches: state.patches, posts: state.posts });
  if (url.pathname === '/__reset') {
    state.log = [];
    state.patches = [];
    state.posts = [];
    return send(res, 200, { ok: true });
  }
  return control(req, res, body);
}

createServer((req, res) => {
  void handle(req, res).catch(() => {
    if (!res.headersSent) send(res, 500, { detail: 'Request failed' });
    else res.destroy();
  });
}).listen(PORT, '127.0.0.1', () => console.log(`mock server on ${PORT}`));
