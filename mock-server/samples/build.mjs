/**
 * Render the sample archive to real files: PDFs, JPEG pictures and plain text, plus
 * `index.json` with the records in the Paperless shape. Run it after a change to the catalog:
 *   node mock-server/samples/build.mjs
 * The output is committed, so the demo server needs no browser.
 */
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ENTRIES, SUCCESSOR_FIELD, TAGS } from './catalog.mjs';
import { FORMAT, PDF_FOOTER, renderHtml } from './render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = join(HERE, 'files');
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', txt: 'text/plain' };

/** Reuse an installed Chromium when this Playwright's pinned build is missing. */
function executablePath() {
  if (process.env.PAPERMINT_CHROMIUM) return process.env.PAPERMINT_CHROMIUM;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return undefined;
  const app =
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  return readdirSync(cache)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
    .map((name) => join(cache, name, app))
    .find((path) => existsSync(path));
}

const pageCount = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

/** One file of one entry. Returns its name, bytes, text and page count. */
async function renderFile(browser, entry, name, variant) {
  const format = FORMAT[entry.kind];
  const file = `${name}.${format}`;
  if (format === 'txt') {
    const bytes = Buffer.from(`${entry.data.text}\n`);
    return { file, bytes, text: entry.data.text, pages: null };
  }
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 600, height: 400 },
  });
  await page.setContent(renderHtml(entry, variant), { waitUntil: 'load' });
  const text = (await page.innerText('body')).trim();
  const bytes =
    format === 'pdf'
      ? await page.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: PDF_FOOTER,
        })
      : await page.locator('body').screenshot({ type: 'jpeg', quality: 82 });
  await page.close();
  return { file, bytes, text, pages: format === 'pdf' ? pageCount(bytes) : 1 };
}

function stamp(date, hour) {
  return `${date}T${String(hour).padStart(2, '0')}:${String((hour * 7) % 60).padStart(2, '0')}:00Z`;
}

function linksOf(entry) {
  const links = ENTRIES.filter((other) => other.successor === entry.id).map((other) => other.id);
  if (entry.successor) links.push(entry.successor);
  return links.length ? [{ field: SUCCESSOR_FIELD.id, value: links }] : [];
}

async function buildEntry(browser, entry) {
  const hasVersions = Boolean(entry.versions?.length);
  const root = await renderFile(browser, entry, String(entry.id), { draft: hasVersions });
  const files = { [entry.id]: root.file };
  const versions = [
    {
      id: entry.id,
      added: stamp(entry.created, 15),
      version_label: hasVersions ? 'Draft' : null,
      is_root: true,
    },
  ];
  let newest = root;
  for (const [i, version] of (entry.versions ?? []).entries()) {
    newest = await renderFile(browser, entry, String(version.id), { draft: false });
    files[version.id] = newest.file;
    versions.unshift({
      id: version.id,
      added: stamp(entry.created, 16 + i),
      version_label: version.label,
      is_root: false,
    });
  }
  await Promise.all(
    [root, ...(newest === root ? [] : [newest])].map((f) =>
      writeFile(join(FILES, f.file), f.bytes),
    ),
  );
  return {
    id: entry.id,
    title: entry.title,
    tags: entry.tags,
    created: entry.created,
    added: stamp(entry.created, 15),
    modified: stamp(entry.created, 17),
    page_count: root.pages,
    mime_type: MIME[FORMAT[entry.kind]],
    versions,
    custom_fields: linksOf(entry),
    content: newest.text,
    notes: [],
    files,
    sizes: {
      [entry.id]: root.bytes.length,
      ...(newest === root ? {} : { [entry.versions.at(-1).id]: newest.bytes.length }),
    },
  };
}

async function main() {
  await rm(FILES, { recursive: true, force: true });
  await mkdir(FILES, { recursive: true });
  const browser = await chromium.launch({ executablePath: executablePath() });
  const docs = [];
  for (const entry of ENTRIES) docs.push(await buildEntry(browser, entry));
  await browser.close();
  const index = { tags: TAGS, fields: [SUCCESSOR_FIELD], docs };
  await writeFile(join(HERE, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
  console.log(`${docs.length} sample records in ${FILES}`);
}

await main();
