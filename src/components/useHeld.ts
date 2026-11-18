import { useRef, useState } from 'preact/hooks';

/**
 * A menu that swaps its content (status list to successor picker) keeps its size, so a menu
 * that hangs from the bottom or the right edge of the screen never moves while the owner types.
 */
export function useHeldHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<{ width: number; height: number } | null>(null);
  const hold = () =>
    setHeld(
      ref.current ? { width: ref.current.offsetWidth, height: ref.current.offsetHeight } : null,
    );
  /** The style for the swapped content: at least as large as what it replaced. */
  const style = held && { minWidth: `${held.width}px`, minHeight: `${held.height}px` };
  return { ref, hold, style: style ?? undefined };
}
