import { describe, expect, it, vi } from 'vitest';
import { createTagMutator } from './mutations';

function setup(options: { failOn?: number[]; truth?: number[] | null } = {}) {
  const tags = new Map<number, number[]>([[1, [9, 6]]]);
  const saved: number[][] = [];
  let calls = 0;
  const onFailure = vi.fn();
  const resolvers: (() => void)[] = [];
  const mutator = createTagMutator({
    getTags: (id) => tags.get(id) ?? null,
    setTags: (id, next) => void tags.set(id, next),
    save: async (id, next) => {
      calls += 1;
      const call = calls;
      await new Promise<void>((resolve) => resolvers.push(resolve));
      if (options.failOn?.includes(call)) throw new Error('boom');
      saved.push(next);
      void id;
    },
    load: async () => (options.truth === undefined ? null : options.truth),
    onFailure,
  });
  /** Let the fake server answer every write until the given changes are done. */
  const settle = async (...changes: Promise<void>[]) => {
    let done = false;
    void Promise.all(changes).then(() => (done = true));
    while (!done) {
      await new Promise((r) => setTimeout(r, 0));
      resolvers.splice(0).forEach((resolve) => resolve());
    }
  };
  return { tags, saved, mutator, onFailure, settle };
}

describe('tag mutator', () => {
  it('applies the change to the UI before the server answers', async () => {
    const { tags, mutator, settle } = setup();
    const done = mutator.change(1, (t) => [...t, 5]);
    expect(tags.get(1)).toEqual([9, 6, 5]);
    await settle(done);
  });

  it('serializes writes for one record and sends the latest state', async () => {
    const { tags, saved, mutator, settle } = setup();
    const a = mutator.change(1, (t) => [...t, 5]);
    const b = mutator.change(1, (t) => t.filter((x) => x !== 6));
    expect(tags.get(1)).toEqual([9, 5]);
    await settle(a, b);
    expect(saved.at(-1)).toEqual([9, 5]);
    expect(saved.length).toBeLessThanOrEqual(2);
  });

  it('reconciles to the server state after a failure, not to a stale snapshot', async () => {
    const { tags, mutator, onFailure, settle } = setup({ failOn: [1], truth: [9, 6] });
    const a = mutator.change(1, (t) => [...t, 5]);
    const b = mutator.change(1, (t) => [...t, 7]);
    await settle(a, b);
    expect(onFailure).toHaveBeenCalled();
    expect(tags.get(1)).toEqual([9, 6]);
  });

  it('falls back to the last confirmed state when the server cannot be read', async () => {
    const { tags, mutator, settle } = setup({ failOn: [1], truth: null });
    const a = mutator.change(1, (t) => [...t, 5]);
    await settle(a);
    expect(tags.get(1)).toEqual([9, 6]);
  });

  it('skips the write when the state is back to the confirmed one', async () => {
    const { saved, mutator, settle } = setup();
    const a = mutator.change(1, (t) => [...t, 5]);
    const b = mutator.change(1, (t) => t.filter((x) => x !== 5));
    await settle(a, b);
    expect(saved).toEqual([]);
  });

  it('ignores unknown records', async () => {
    const { mutator } = setup();
    await expect(mutator.change(42, (t) => t)).resolves.toBeUndefined();
  });
});
