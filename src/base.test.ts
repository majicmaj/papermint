import { describe, expect, it } from 'vitest';
import { withBase, withoutBase } from './base';

describe('base path', () => {
  it('changes nothing at the root', () => {
    expect(withBase('/r/5', '/')).toBe('/r/5');
    expect(withoutBase('/r/5', '/')).toBe('/r/5');
  });

  it('adds and removes a sub-path', () => {
    expect(withBase('/', '/demo/')).toBe('/demo/');
    expect(withBase('/r/5', '/demo/')).toBe('/demo/r/5');
    expect(withoutBase('/demo/r/5', '/demo/')).toBe('/r/5');
    expect(withoutBase('/demo', '/demo/')).toBe('/');
    expect(withoutBase('/demo/', '/demo/')).toBe('/');
    expect(withoutBase('/demolition', '/demo/')).toBeNull();
    expect(withoutBase('/api/tags/', '/demo/')).toBeNull();
  });
});
