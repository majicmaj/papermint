import { useEffect, useRef, useState } from 'preact/hooks';
import type { Modality } from './tokens';

export type PresenceState = 'closed' | 'open' | 'closing';

/** How long a leaving element stays. A key never waits: the exit is the instant change. */
export function exitDelay(by: Modality, ms: number): number {
  return by === 'keyboard' ? 0 : ms;
}

/** The exit time, read at the moment the element starts to leave. */
export type ExitMs = number | (() => number);

const resolve = (exit: ExitMs): number => (typeof exit === 'function' ? exit() : exit);

export interface PresenceTimers {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const browserTimers: PresenceTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Keeps something mounted while it leaves. `closed` is unmounted, `open` is shown, `closing`
 * is still mounted and playing its exit. Opening again during the exit cancels the exit.
 */
export class Presence {
  private current: PresenceState = 'closed';
  private handle: unknown = null;

  constructor(
    private readonly exitMs: ExitMs,
    private readonly onChange: (state: PresenceState) => void,
    private readonly timers: PresenceTimers = browserTimers,
  ) {}

  get state(): PresenceState {
    return this.current;
  }

  set(open: boolean): void {
    if (open) {
      this.cancel();
      this.move('open');
    } else if (this.current === 'open') {
      const ms = resolve(this.exitMs);
      if (ms <= 0) {
        this.move('closed');
        return;
      }
      this.move('closing');
      this.handle = this.timers.set(() => {
        this.handle = null;
        this.move('closed');
      }, ms);
    }
  }

  dispose(): void {
    this.cancel();
  }

  private cancel(): void {
    if (this.handle !== null) this.timers.clear(this.handle);
    this.handle = null;
  }

  private move(next: PresenceState): void {
    if (next === this.current) return;
    this.current = next;
    this.onChange(next);
  }
}

/** `open` drives the element. The returned state is `open`, `closing` or `closed`. */
export function usePresence(open: boolean, exitMs: ExitMs): PresenceState {
  const [state, setState] = useState<PresenceState>(open ? 'open' : 'closed');
  const presence = useRef<Presence | null>(null);
  if (!presence.current) presence.current = new Presence(exitMs, setState);
  useEffect(() => presence.current?.set(open), [open]);
  useEffect(() => () => presence.current?.dispose(), []);
  // The first frame of an opening element already reads `open`, so it never flashes closed.
  if (open && state === 'closed') return 'open';
  // A key closes at once, in this very render: not a frame later, not after a timer.
  if (!open && state !== 'closed' && resolve(exitMs) <= 0) return 'closed';
  return state;
}
