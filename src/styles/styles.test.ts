import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith('.css'));
const css = files.map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const);

/** Text roles: gray 11-12 only. Inverse text on solids is allowed. */
const TEXT_OK = new Set([
  '--mw-gray-11',
  '--mw-gray-12',
  '--mw-gray-1', // inverse text on a gray-12 solid
  '--mw-contrast', // text on the indigo primary solid
]);

describe('Radix roles', () => {
  it('uses only gray 11/12 for text', () => {
    const bad: string[] = [];
    for (const [file, text] of css) {
      for (const match of text.matchAll(/(?<![-\w])color:\s*var\((--mw-[\w-]+)\)/g)) {
        if (!TEXT_OK.has(match[1]!)) bad.push(`${file}: color ${match[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('does not use hex or named colors outside the tokens', () => {
    for (const [file, text] of css) {
      expect(text.match(/#[0-9a-fA-F]{3,8}\b/g), file).toBeNull();
    }
  });

  it('keeps indigo for primary and selected states only', () => {
    const brand = css.find(([f]) => f === 'rail.css')![1];
    const mark = /\.brand-mark\s*{[^}]*}/.exec(brand)![0];
    expect(mark).not.toContain('indigo');
  });
});

describe('layout honesty', () => {
  it('never places list rows by transform', () => {
    const list = css.find(([f]) => f === 'list.css')![1];
    expect(list).not.toMatch(/translate[XY]?\(/);
    expect(list).not.toContain('.rows');
  });
});
