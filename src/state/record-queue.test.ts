import { describe, expect, it, vi } from 'vitest';
import { createRecordQueue } from './record-queue';

describe('record queue', () => {
  it('writes status and successor together and serializes concurrent updates', async () => {
    let value = { tags: [1], customFields: [] as { field: number; value: number[] }[] };
    const save = vi.fn(async (_id: number, next: typeof value) => {
      await Promise.resolve();
      void next;
    });
    const queue = createRecordQueue({
      get: () => value,
      set: (_id, next) => {
        value = next;
      },
      save,
      load: async () => value,
      onFailure: vi.fn(),
    });
    const first = queue.change(1, () => ({ tags: [3], customFields: [{ field: 4, value: [8] }] }));
    const second = queue.change(1, (current) => ({ ...current, tags: [...current.tags, 9] }));
    await Promise.all([first, second]);
    expect(save).toHaveBeenCalledWith(1, {
      tags: [3, 9],
      customFields: [{ field: 4, value: [8] }],
    });
  });
  it('restores confirmed data when a write fails', async () => {
    let value = { tags: [1] };
    const failed = vi.fn();
    const queue = createRecordQueue({
      get: () => value,
      set: (_id, next) => {
        value = next;
      },
      save: async () => {
        throw Error('failed');
      },
      load: async () => null,
      onFailure: failed,
    });
    await queue.change(1, () => ({ tags: [2] }));
    expect(value.tags).toEqual([1]);
    expect(failed).toHaveBeenCalledOnce();
  });
});
