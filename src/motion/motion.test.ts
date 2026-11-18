import { describe, expect, it } from 'vitest';
import { createChangeMemory } from './change';
import { createModality } from './modality';
import { Presence, exitDelay, type PresenceState } from './presence';
import { swap, activeSwaps, type SwapEnv } from './transition';

function fakeTarget() {
  const target = new EventTarget();
  return Object.assign(target, {});
}

describe('createModality', () => {
  it('starts as pointer, flips to keyboard on a key, back on a press', () => {
    const target = fakeTarget();
    const root = { dataset: {} as Record<string, string | undefined> };
    const tracker = createModality(target, root);
    expect(tracker.get()).toBe('pointer');
    expect(root.dataset['input']).toBe('pointer');
    target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'k' }));
    expect(tracker.get()).toBe('keyboard');
    expect(root.dataset['input']).toBe('keyboard');
    target.dispatchEvent(new Event('pointerdown'));
    expect(tracker.get()).toBe('pointer');
  });

  it('ignores a lone modifier key', () => {
    const target = fakeTarget();
    const root = { dataset: {} as Record<string, string | undefined> };
    const tracker = createModality(target, root);
    target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Meta' }));
    expect(tracker.get()).toBe('pointer');
  });

  it('stops listening', () => {
    const target = fakeTarget();
    const root = { dataset: {} as Record<string, string | undefined> };
    const tracker = createModality(target, root);
    tracker.stop();
    target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'a' }));
    expect(tracker.get()).toBe('pointer');
  });
});

function manualTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  return {
    timers: {
      set: (run: () => void) => {
        pending.set(next, run);
        return next++;
      },
      clear: (handle: unknown) => void pending.delete(handle as number),
    },
    fire: () => {
      for (const [id, run] of [...pending]) {
        pending.delete(id);
        run();
      }
    },
    count: () => pending.size,
  };
}

describe('Presence', () => {
  it('stays mounted while it leaves, then unmounts', () => {
    const clock = manualTimers();
    const seen: PresenceState[] = [];
    const presence = new Presence(300, (s) => seen.push(s), clock.timers);
    presence.set(true);
    presence.set(false);
    expect(presence.state).toBe('closing');
    clock.fire();
    expect(presence.state).toBe('closed');
    expect(seen).toEqual(['open', 'closing', 'closed']);
  });

  it('cancels the exit when it opens again', () => {
    const clock = manualTimers();
    const presence = new Presence(300, () => {}, clock.timers);
    presence.set(true);
    presence.set(false);
    presence.set(true);
    expect(clock.count()).toBe(0);
    clock.fire();
    expect(presence.state).toBe('open');
  });

  it('does nothing when closed twice', () => {
    const clock = manualTimers();
    const presence = new Presence(300, () => {}, clock.timers);
    presence.set(false);
    expect(presence.state).toBe('closed');
    expect(clock.count()).toBe(0);
  });
});

describe('createChangeMemory', () => {
  it('reports a change only for a scope seen before', () => {
    const memory = createChangeMemory<number, number>();
    expect(memory.changed(1, 10)).toBe(false);
    expect(memory.changed(1, 10)).toBe(false);
    expect(memory.changed(1, 11)).toBe(true);
    expect(memory.changed(2, 11)).toBe(false);
  });
});

function swapEnv(modality: 'pointer' | 'keyboard', hasTransition = true, covered = false) {
  const log: string[] = [];
  let finish: () => void = () => {};
  const env: SwapEnv = {
    start: hasTransition
      ? (update) => {
          log.push('start');
          const finished = new Promise<void>((resolve) => {
            finish = resolve;
          });
          void update();
          return { finished };
        }
      : null,
    modality: () => modality,
    flush: () => Promise.resolve(),
    root: { dataset: {} as Record<string, string | undefined> },
    covered: () => covered,
  };
  return { env, log, finish: () => finish() };
}

describe('swap', () => {
  it('applies a keyboard change at once, with no transition', () => {
    const { env, log } = swapEnv('keyboard');
    let applied = false;
    swap('results', () => (applied = true), env);
    expect(applied).toBe(true);
    expect(log).toEqual([]);
    expect(env.root.dataset['vt']).toBeUndefined();
  });

  it('applies the change at once where View Transitions do not exist', () => {
    const { env } = swapEnv('pointer', false);
    let applied = false;
    swap('pane', () => (applied = true), env);
    expect(applied).toBe(true);
  });

  it('changes covered results at once, so they never draw above the drawer that covers them', () => {
    const { env, log } = swapEnv('pointer', true, true);
    let applied = false;
    swap('results', () => (applied = true), env);
    expect(applied).toBe(true);
    expect(log).toEqual([]);
    expect(env.root.dataset['vt']).toBeUndefined();
  });

  it('a covering layer does not stop the record pane from cross-fading', () => {
    const { env, log, finish } = swapEnv('pointer', true, true);
    swap('pane', () => undefined, env);
    expect(log).toEqual(['start']);
    finish();
  });

  it('names the transition on the root while it runs, then clears it', async () => {
    const { env, finish } = swapEnv('pointer');
    let applied = false;
    swap('pane', () => (applied = true), env);
    expect(applied).toBe(true);
    expect(env.root.dataset['vt']).toBe('pane');
    expect(activeSwaps()).toBe(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(env.root.dataset['vt']).toBeUndefined();
    expect(activeSwaps()).toBe(0);
  });
});

describe('exitDelay', () => {
  it('never makes a key wait', () => {
    expect(exitDelay('keyboard', 360)).toBe(0);
    expect(exitDelay('pointer', 360)).toBe(360);
  });
});

describe('Presence with a key', () => {
  it('goes from open to closed at once when the exit time is 0, with no timer', () => {
    const clock = manualTimers();
    const seen: PresenceState[] = [];
    const presence = new Presence(
      () => 0,
      (s) => seen.push(s),
      clock.timers,
    );
    presence.set(true);
    presence.set(false);
    expect(presence.state).toBe('closed');
    expect(seen).toEqual(['open', 'closed']);
    expect(clock.count()).toBe(0);
  });

  it('reads the exit time when it starts to leave, not when it was made', () => {
    const clock = manualTimers();
    let by: 'pointer' | 'keyboard' = 'pointer';
    const presence = new Presence(
      () => exitDelay(by, 300),
      () => {},
      clock.timers,
    );
    presence.set(true);
    presence.set(false);
    expect(presence.state).toBe('closing');
    presence.set(true);
    by = 'keyboard';
    presence.set(false);
    expect(presence.state).toBe('closed');
  });
});
