/**
 * Tag mutations, serialized per record. The UI changes first. Server writes for one
 * record run one at a time, each sending the latest desired tags. If a write fails,
 * the record returns to the last state the server confirmed (re-read from the server
 * when possible), never to a stale snapshot taken before other queued changes.
 */
export interface MutatorDeps {
  getTags: (id: number) => number[] | null;
  setTags: (id: number, tags: number[]) => void;
  save: (id: number, tags: number[]) => Promise<void>;
  /** Server truth for a record, or null when it cannot be read. */
  load: (id: number) => Promise<number[] | null>;
  onFailure: () => void;
}

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function createTagMutator(deps: MutatorDeps) {
  const queues = new Map<number, Promise<void>>();
  const confirmed = new Map<number, number[]>();
  const inflight = new Map<number, number>();

  async function flush(id: number): Promise<void> {
    const desired = deps.getTags(id);
    const base = confirmed.get(id);
    if (!desired || !base || same(desired, base)) return;
    try {
      await deps.save(id, desired);
      confirmed.set(id, desired);
    } catch {
      const truth = (await deps.load(id).catch(() => null)) ?? base;
      confirmed.set(id, truth);
      deps.setTags(id, truth);
      deps.onFailure();
    }
  }

  return {
    change(id: number, compute: (tags: number[]) => number[]): Promise<void> {
      const current = deps.getTags(id);
      if (!current) return Promise.resolve();
      if (!confirmed.has(id)) confirmed.set(id, current);
      deps.setTags(id, compute(current));
      inflight.set(id, (inflight.get(id) ?? 0) + 1);
      const next = (queues.get(id) ?? Promise.resolve())
        .then(() => flush(id))
        .finally(() => inflight.set(id, (inflight.get(id) ?? 1) - 1));
      queues.set(id, next);
      return next;
    },
    /** True while a change for this record is waiting for the server. */
    isPending: (id: number): boolean => (inflight.get(id) ?? 0) > 0,
  };
}
