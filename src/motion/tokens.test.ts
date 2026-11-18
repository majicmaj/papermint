import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DURATION, EASE_DRAWER, EASE_IN_OUT, EASE_OUT } from './tokens';

const css = readFileSync(join(__dirname, '../styles/motion.css'), 'utf8');
const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

describe('motion tokens', () => {
  it('keeps the TypeScript and CSS curves equal', () => {
    expect(token('ease-out')).toBe(EASE_OUT);
    expect(token('ease-in-out')).toBe(EASE_IN_OUT);
    expect(token('ease-drawer')).toBe(EASE_DRAWER);
  });

  it('keeps the TypeScript and CSS durations equal', () => {
    for (const [name, ms] of Object.entries(DURATION)) {
      expect(token(`t-${name}`), name).toBe(`${ms}ms`);
    }
  });

  it('never animates layout properties or uses transition: all', () => {
    expect(css).not.toMatch(/transition:\s*all/);
    expect(css).not.toMatch(/transition[^;]*\b(width|height|margin|padding|top|left)\b/);
    expect(css).not.toMatch(/ease-in[^-]/);
  });

  it('gates every movement for reduced motion', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
