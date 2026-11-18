import { describe, expect, it } from 'vitest';
import { parseRoute } from './routes';
import { filePath } from '../shell/recovery-files';
import { parseConfig } from '../config/config';

const file = {
  key: 'account-copy-2',
  title: 'Account backup',
  href: '/recovery-files/backup.pdf',
  kind: 'pdf',
  label: 'PDF',
  filename: 'backup.pdf',
};
const config = parseConfig({ recoveryFiles: [file] });

describe('file routes', () => {
  it('selects the Recovery view and opens a configured file in its pane', () => {
    expect(parseRoute('/recovery/', '', null, config)).toEqual({ name: 'recovery' });
    expect(parseRoute('/f/account-copy-2/', '', 'recovery', config)).toEqual({
      name: 'file',
      key: 'account-copy-2',
      from: 'recovery',
    });
  });

  it('falls back to Records for unavailable files and when Recovery is disabled', () => {
    expect(parseRoute('/f/nope', '', null, config)).toEqual({ name: 'records' });
    expect(parseRoute('/recovery')).toEqual({ name: 'records' });
    expect(parseRoute('/f/account-copy-2')).toEqual({ name: 'records' });
  });

  it('keeps deep links distinct from the actual download URL', () => {
    expect(filePath(file.key)).toBe('/f/account-copy-2');
    expect(filePath(file.key)).not.toBe(file.href);
  });
});
