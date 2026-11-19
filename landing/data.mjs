/**
 * Write the demo records into landing/index.html, between the `records:start` and
 * `records:end` markers, so the landing search works with no request. Run it after a change
 * to the sample archive:  npm run landing
 * The document pictures in landing/media/docs come from the same archive.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(readFileSync(join(HERE, '../mock-server/samples/index.json'), 'utf8'));
const tags = new Map(index.tags.map((t) => [t.id, t]));
const STATUS = new Set([1, 2, 3]);

const records = index.docs.map((doc) => {
  const own = doc.tags.map((id) => tags.get(id));
  const topic = own.find((t) => t.parent !== null) ?? own.find((t) => !STATUS.has(t.id));
  const status = own.find((t) => t.id === 1 || t.id === 2);
  return {
    id: doc.id,
    t: doc.title,
    d: doc.created,
    g: topic?.name ?? '',
    c: topic?.color ?? '#8d8d8d',
    s: status?.name ?? '',
    x: doc.content.replace(/\s+/g, ' ').slice(0, 420),
    k: doc.mime_type === 'text/plain' ? 'txt' : 'doc',
  };
});

const file = join(HERE, 'index.html');
const html = readFileSync(file, 'utf8');
const block = `/* records:start */\n      // prettier-ignore\n      const RECORDS = ${JSON.stringify(records)};\n      /* records:end */`;
const next = html.replace(/\/\* records:start \*\/[\s\S]*?\/\* records:end \*\//, block);
if (next === html && !html.includes(block)) throw new Error('records markers not found');
writeFileSync(file, next);
console.log(`${records.length} records written to landing/index.html`);
