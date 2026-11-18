import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig } from './config';

const sample = {
  key: 'offline-copy-2',
  href: '/recovery-files/account/backup.pdf',
  title: 'Account backup',
  kind: 'pdf',
  label: 'PDF',
  filename: 'Account backup.pdf',
};

describe('runtime config', () => {
  it('ignores the legacy untagged status preference and defaults to no recovery links', () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig({ untaggedStatus: 'draft', successorField: ' ' })).toEqual(DEFAULT_CONFIG);
  });

  it('accepts deployment preferences and keeps the first record for each key', () => {
    expect(
      parseConfig({
        readOnly: true,
        successorField: '  Replaced by  ',
        recoveryFiles: [sample, { ...sample, title: 'Duplicate' }],
      }),
    ).toEqual({
      readOnly: true,
      successorField: 'Replaced by',
      recoveryFiles: [sample],
    });
  });

  it.each([
    '//example.org/recovery/file',
    'https://example.org/recovery/file',
    '/api/documents/1/download/',
    '/recovery/../api',
    '/recovery/%2e%2e/api',
    '/recovery/file?token=example',
    '/recovery/file#section',
    '/recovery/file\\other',
    '/backups/',
  ])('rejects an invalid recovery URL %s', (href) => {
    expect(parseConfig({ recoveryFiles: [{ ...sample, href }] }).recoveryFiles).toEqual([]);
  });

  it('ignores invalid keys, file types and filenames', () => {
    expect(
      parseConfig({
        recoveryFiles: [
          { ...sample, key: '../other' },
          { ...sample, kind: 'html' },
          { ...sample, filename: '../other' },
          { ...sample, filename: '..' },
          { ...sample, label: '' },
          null,
        ],
      }).recoveryFiles,
    ).toEqual([]);
  });
});
