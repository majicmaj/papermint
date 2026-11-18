import { describe, expect, it } from 'vitest';
import { formatBytes } from './bytes';

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(2_000_000)).toBe('2 MB');
    expect(formatBytes(412_345_678)).toBe('412 MB');
    expect(formatBytes(3_210_000_000)).toBe('3.21 GB');
  });

  it('returns nothing for unknown sizes', () => {
    expect(formatBytes(Number.NaN)).toBe('');
    expect(formatBytes(-1)).toBe('');
  });
});
