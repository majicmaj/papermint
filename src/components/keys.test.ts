import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'RecordPane.tsx'), 'utf8');

describe('RecordPane keys', () => {
  it('keys the title wrapper once instead of giving siblings the same key', () => {
    expect(source.match(/key=\{version\}/g) ?? []).toHaveLength(0);
    expect(source).toContain('titleKey=');
  });
});
