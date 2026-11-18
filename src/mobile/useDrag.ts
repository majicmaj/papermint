import { useRef } from 'preact/hooks';
import { START_SLOP, dampen, progress, shouldDismiss, velocityOf, type Sample } from './drag';

/** Where a drag may start: the grip, the header of the record or of a filter page. Never on a control. */
const DRAG_ZONES = '.drawer-grip, .pane-head, .fs-head';
const CONTROLS = 'button, a, input, select, textarea, label, [role="menu"]';

interface Drag {
  id: number;
  startY: number;
  height: number;
  moving: boolean;
  samples: Sample[];
}

interface Parts {
  root: { current: HTMLElement | null };
  sheet: { current: HTMLElement | null };
  scrim: { current: HTMLElement | null };
}

function startDrag(event: PointerEvent, sheet: HTMLElement): Drag | null {
  const target = event.target as HTMLElement;
  if (event.button > 0 || !target.closest(DRAG_ZONES) || target.closest(CONTROLS)) return null;
  return {
    id: event.pointerId,
    startY: event.clientY,
    // The part on screen: the filter sheet keeps its height and moves down to fit its page.
    height: Math.min(sheet.offsetHeight, window.innerHeight - sheet.getBoundingClientRect().top),
    moving: false,
    samples: [{ y: 0, t: event.timeStamp }],
  };
}

/** Hand the sheet back to CSS: it transitions from where the finger left it. */
function clearInline({ root, sheet, scrim }: Parts, dismiss: boolean): void {
  if (sheet.current) {
    sheet.current.style.transform = '';
    sheet.current.style.transition = '';
  }
  if (scrim.current) {
    scrim.current.style.opacity = '';
    scrim.current.style.transition = '';
  }
  if (root.current) {
    delete root.current.dataset['dragging'];
    if (dismiss) root.current.dataset['release'] = 'drag';
  }
}

/**
 * While a finger is down the sheet is the finger: `transform` is written straight to the element,
 * with no transition and no state. On release the inline styles go and one CSS transition (the
 * drawer curve) finishes the motion, so a catch mid-flight retargets from where the sheet is.
 * A flick or 40% of the height dismisses. A second finger never takes over a running drag.
 */
export function useDrag(parts: Parts, onClose: () => void) {
  const drag = useRef<Drag | null>(null);
  const { root, sheet, scrim } = parts;

  const onPointerDown = (event: PointerEvent) => {
    if (drag.current || !sheet.current) return;
    drag.current = startDrag(event, sheet.current);
  };

  const onPointerMove = (event: PointerEvent) => {
    const d = drag.current;
    const el = sheet.current;
    if (!d || !el || event.pointerId !== d.id) return;
    const offset = event.clientY - d.startY;
    if (!d.moving) {
      if (Math.abs(offset) < START_SLOP) return;
      d.moving = true;
      el.setPointerCapture(event.pointerId);
      el.style.transition = 'none';
      if (scrim.current) scrim.current.style.transition = 'none';
      if (root.current) root.current.dataset['dragging'] = 'true';
    }
    d.samples.push({ y: offset, t: event.timeStamp });
    if (d.samples.length > 12) d.samples.shift();
    el.style.transform = `translate3d(0, ${dampen(offset)}px, 0)`;
    if (scrim.current) scrim.current.style.opacity = String(1 - progress(offset, d.height));
  };

  const release = (event: PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moving) return;
    const velocity = velocityOf(d.samples, event.timeStamp);
    const dismiss = !cancelled && shouldDismiss(event.clientY - d.startY, d.height, velocity);
    clearInline(parts, dismiss);
    if (dismiss) onClose();
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: PointerEvent) => release(event, false),
    onPointerCancel: (event: PointerEvent) => release(event, true),
  };
}
