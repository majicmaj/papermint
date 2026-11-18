export function createRecordQueue<T>(deps: {
  get: (id: number) => T | null;
  set: (id: number, value: T) => void;
  save: (id: number, value: T) => Promise<void>;
  load: (id: number) => Promise<T | null>;
  onFailure: () => void;
}) {
  const queues = new Map<number, Promise<void>>();
  const confirmed = new Map<number, T>();
  const pending = new Map<number, number>();
  async function flush(id: number) {
    const desired = deps.get(id);
    const base = confirmed.get(id);
    if (!desired || !base || JSON.stringify(desired) === JSON.stringify(base)) return;
    try {
      await deps.save(id, desired);
      confirmed.set(id, desired);
    } catch {
      const truth = (await deps.load(id).catch(() => null)) ?? base;
      confirmed.set(id, truth);
      deps.set(id, truth);
      deps.onFailure();
    }
  }
  return {
    change(id: number, compute: (value: T) => T): Promise<void> {
      const current = deps.get(id);
      if (!current) return Promise.resolve();
      if (!confirmed.has(id) || !pending.get(id)) confirmed.set(id, current);
      deps.set(id, compute(current));
      pending.set(id, (pending.get(id) ?? 0) + 1);
      const next = (queues.get(id) ?? Promise.resolve())
        .then(() => flush(id))
        .finally(() => pending.set(id, (pending.get(id) ?? 1) - 1));
      queues.set(id, next);
      return next;
    },
    isPending: (id: number) => (pending.get(id) ?? 0) > 0,
  };
}
