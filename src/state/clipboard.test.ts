import { describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  it('reports success only when the write succeeds', async () => {
    const write = vi.fn(async () => undefined);
    expect(await copyText('x', { write })).toBe(true);
    expect(write).toHaveBeenCalledWith('x');
  });

  it('falls back to the legacy copy when the async API refuses', async () => {
    const write = vi.fn(async () => {
      throw new Error('denied');
    });
    const legacy = vi.fn(() => true);
    expect(await copyText('x', { write, legacy })).toBe(true);
    expect(legacy).toHaveBeenCalled();
  });

  it('reports failure when both paths fail', async () => {
    const write = vi.fn(async () => {
      throw new Error('denied');
    });
    expect(await copyText('x', { write, legacy: () => false })).toBe(false);
  });
});
