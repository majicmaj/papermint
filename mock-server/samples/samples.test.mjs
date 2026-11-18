import { describe, expect, it } from 'vitest';
import { loadSamples } from './load.mjs';

const samples = loadSamples();
const tagIds = new Set(samples.tags.map((tag) => tag.id));

describe('the sample archive of the demo', () => {
  it('has a file for every record and every version', async () => {
    for (const doc of samples.docs) {
      for (const version of doc.versions) {
        const bytes = await samples.fileOf(doc.id, version.id);
        expect(bytes?.length, `${doc.title} ${version.id}`).toBeGreaterThan(100);
        if (doc.mime_type === 'application/pdf')
          expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      }
    }
  });

  it('uses only known tags, and text for full-text search', () => {
    for (const doc of samples.docs) {
      expect(
        doc.tags.every((id) => tagIds.has(id)),
        doc.title,
      ).toBe(true);
      expect(doc.content.length, doc.title).toBeGreaterThan(100);
    }
  });

  it('links each superseded record to its successor both ways', () => {
    const byId = new Map(samples.docs.map((doc) => [doc.id, doc]));
    for (const doc of samples.docs) {
      for (const id of doc.custom_fields[0]?.value ?? []) {
        expect(byId.get(id)?.custom_fields[0]?.value).toContain(doc.id);
      }
    }
  });
});
