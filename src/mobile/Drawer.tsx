import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { modality } from '../motion/modality';
import { exitDelay, usePresence } from '../motion/presence';
import { popLayer, pushLayer } from '../state/modal';
import { wrapFocus } from './drag';
import { Portal } from './Portal';
import { useDrag } from './useDrag';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EXIT_MS = 360;

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  variant: 'filter' | 'record';
  children: ComponentChildren;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

/** Tab stays inside the drawer. The page behind is inert, so focus has nowhere else to go. */
function trapTab(event: KeyboardEvent, root: HTMLElement): void {
  const items = focusables(root);
  const at = items.indexOf(document.activeElement as HTMLElement);
  const target = wrapFocus(at, items.length, event.shiftKey);
  if (target !== null) {
    event.preventDefault();
    items[target]?.focus();
  } else if (items.length === 0) {
    event.preventDefault();
  }
}

function useModalLayer(open: boolean): void {
  const layer = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (open && layer.current === null) layer.current = pushLayer(true);
    if (!open && layer.current !== null) {
      popLayer(layer.current);
      layer.current = null;
    }
  }, [open]);
  useEffect(
    () => () => {
      if (layer.current !== null) popLayer(layer.current, false);
    },
    [],
  );
}

/**
 * A bottom drawer with iOS sheet physics. While a finger is down the sheet is the finger:
 * `transform` is written straight to the element, with no transition and no state. On release
 * the inline styles go and one CSS transition (the drawer curve) finishes the motion, so a
 * catch mid-flight retargets from where the sheet is. A flick or 40% of the height dismisses.
 */
export function Drawer({ open, onClose, label, variant, children }: Props) {
  const state = usePresence(open, () => exitDelay(modality(), EXIT_MS));
  const root = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useModalLayer(open);
  useEffect(() => {
    if (open) sheet.current?.focus({ preventScroll: true });
  }, [open, state === 'closed']);

  const dragging = useDrag({ root, sheet, scrim }, onClose);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab' && sheet.current) trapTab(event, sheet.current);
  };
  // Escape works wherever focus is: a tap on plain text leaves it on the page. A menu or a dialog
  // above the drawer takes the key first and marks it handled. A layout effect, so the key works
  // from the first painted frame.
  useLayoutEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  if (state === 'closed') return null;
  return (
    <Portal>
      <div
        ref={root}
        class="drawer-root"
        data-state={state}
        data-variant={variant}
        onKeyDown={onKeyDown}
      >
        <div ref={scrim} class="drawer-scrim" onClick={onClose} />
        <div
          ref={sheet}
          class={`drawer drawer--${variant}`}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          {...dragging}
        >
          <div class="drawer-grip" aria-hidden="true">
            <span class="drawer-bar" />
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}
