import { describe, expect, it } from 'vitest';
import { buildProxy } from './proxy';

describe('dev proxy', () => {
  const proxy = buildProxy('https://example.test');

  it('forwards the API, files and recovery downloads', () => {
    for (const path of [
      '/api/',
      '/media/',
      '/static/',
      '/accounts/',
      '/recovery/',
      '/recovery-files/',
      '/backups/',
    ]) {
      expect(proxy[path]?.target).toBe('https://example.test');
    }
  });

  it('is disabled without a target', () => expect(buildProxy()).toEqual({}));

  it('does not forward app routes', () => {
    for (const path of ['/', '/pending', '/recovery', '/r']) expect(proxy[path]).toBeUndefined();
  });

  it('sets a same-origin Referer for writes', () => {
    expect(proxy['/api/']?.headers).toMatchObject({ Referer: 'https://example.test/' });
  });
});
