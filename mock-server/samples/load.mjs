/** Read the rendered sample archive (see build.mjs) for the demo server. */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadSamples() {
  const index = JSON.parse(readFileSync(join(HERE, 'index.json'), 'utf8'));
  const extra = new Map(index.docs.map((d) => [d.id, { files: d.files, sizes: d.sizes }]));
  const docs = index.docs.map(({ files, sizes, ...doc }) => {
    void files;
    void sizes;
    return doc;
  });
  return {
    tags: index.tags,
    fields: index.fields,
    docs,
    /** The size of a record's original file, as Paperless metadata gives it. */
    sizeOf: (id) => extra.get(id)?.sizes[id] ?? null,
    /** The bytes of one version of a record, or null when the record is not a sample. */
    async fileOf(id, versionId) {
      const name = extra.get(id)?.files[versionId ?? id];
      return name ? readFile(join(HERE, 'files', name)) : null;
    },
  };
}
