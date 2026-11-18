import { useEffect, useRef } from 'preact/hooks';
import { modality } from './modality';

/**
 * Remembers the last value seen per scope, across remounts. `changed` is true only when the
 * same scope had another value before: a new record is not a change, a new status is.
 */
export function createChangeMemory<K, V>() {
  const seen = new Map<K, V>();
  return {
    changed(scope: K, value: V): boolean {
      const had = seen.has(scope);
      const before = seen.get(scope);
      seen.set(scope, value);
      return had && before !== value;
    },
    forget(): void {
      seen.clear();
    },
  };
}

const memory = createChangeMemory<string | number, string | number>();

/** True on the render where `value` replaced another value of the same `scope`. */
export function useChanged(scope: string | number, value: string | number): boolean {
  const result = useRef<boolean | null>(null);
  if (result.current === null) result.current = memory.changed(scope, value);
  return result.current;
}

/**
 * Play a short WAAPI animation on mount when `play` is true. Always interruptible. A change the
 * keyboard made is not animated: it is the same instant change as every other key action.
 */
export function useMountAnimation(
  target: { current: HTMLElement | null },
  play: boolean,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): void {
  useEffect(() => {
    const el = target.current;
    if (!play || !el || typeof el.animate !== 'function' || modality() === 'keyboard') return;
    // Reduced motion keeps the fade and drops the movement.
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frames = reduced
      ? keyframes.map((frame) =>
          Object.fromEntries(Object.entries(frame).filter(([name]) => name !== 'transform')),
        )
      : keyframes;
    const animation = el.animate(frames, options);
    return () => animation.cancel();
  }, []);
}
