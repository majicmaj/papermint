/**
 * The public site around the demo: a landing page at `/`, the app under PAPERMINT_APP_BASE
 * (like `/demo/`). Only used when the app has a sub-path and PAPERMINT_LANDING names a folder.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const APP_BASE = process.env.PAPERMINT_APP_BASE ?? '/';
const APP_ROOT = APP_BASE.replace(/\/+$/, '');
const LANDING = process.env.PAPERMINT_LANDING ?? null;
const MEDIA = /^\/media\/[a-z0-9-]+\.(webp|png|jpg|svg)$/;
const TYPES = {
  html: 'text/html; charset=utf-8',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  svg: 'image/svg+xml',
  txt: 'text/plain',
};

/**
 * Earlier builds ran the app at `/` with a service worker there, which would keep serving the
 * old app in place of this page. This worker replaces it, removes itself, and reloads the page.
 */
const RETIRE_WORKER = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const pages = await self.clients.matchAll({ type: 'window' });
    for (const page of pages) page.navigate(page.url);
  })());
});
`;

/** The app path of a request path, or null when it is outside the app. */
export function appPath(path) {
  if (!APP_ROOT) return path;
  if (path === APP_ROOT) return null; // landing() redirects it to the trailing slash
  return path.startsWith(`${APP_ROOT}/`) ? path.slice(APP_ROOT.length) : null;
}

const reply = (res, status, type, body, cache = 'no-cache') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': cache });
  res.end(body);
};

/** Answer a request outside the app. */
export async function landing(req, res, url) {
  if (APP_ROOT && url.pathname === APP_ROOT) {
    res.writeHead(308, { location: `${APP_BASE}${url.search}` });
    return res.end();
  }
  if (!LANDING || !['GET', 'HEAD'].includes(req.method))
    return reply(res, 404, TYPES.txt, 'Not found');
  const path = url.pathname;
  if (path === '/sw.js') return reply(res, 200, 'text/javascript', RETIRE_WORKER);
  if (path === '/robots.txt') return reply(res, 200, TYPES.txt, 'User-agent: *\nAllow: /\n');
  if (path === '/' || path === '/index.html')
    return reply(res, 200, TYPES.html, await readFile(join(LANDING, 'index.html')));
  if (MEDIA.test(path)) {
    const bytes = await readFile(join(LANDING, path)).catch(() => null);
    if (bytes) return reply(res, 200, TYPES[path.split('.').pop()], bytes, 'public, max-age=3600');
  }
  return reply(res, 404, TYPES.txt, 'Not found');
}
