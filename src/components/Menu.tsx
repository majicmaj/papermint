import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { popLayer, pushLayer } from '../state/modal';

interface MenuProps {
  trigger: ComponentChildren;
  label: string;
  triggerClass?: string;
  hostClass?: string;
  /** A popover with form fields instead of ARIA menu items. */
  dialog?: boolean;
  /** Open above the trigger (bottom bars). */
  up?: boolean;
  disabled?: boolean;
  children: (close: () => void) => ComponentChildren;
}

const ITEMS = '[role^="menuitem"]:not([disabled])';
const CONTROLS = 'button:not([disabled]), input:not([disabled]), select:not([disabled])';

function moveFocus(panel: HTMLElement, delta: number, selector: string): void {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(selector));
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = (at + delta + items.length) % items.length;
  items[at < 0 && delta < 0 ? items.length - 1 : next]?.focus();
}

function useMenuLayer() {
  const [open, setOpen] = useState(false);
  const layer = useRef<number | null>(null);
  const openMenu = () => {
    layer.current = pushLayer(false);
    setOpen(true);
  };
  const closeMenu = () => {
    if (layer.current !== null) popLayer(layer.current, false);
    layer.current = null;
    setOpen(false);
  };
  // A menu that unmounts while open must not leave its layer behind.
  useEffect(
    () => () => {
      if (layer.current !== null) popLayer(layer.current, false);
    },
    [],
  );
  return { open, openMenu, closeMenu };
}

function menuKey(
  event: KeyboardEvent,
  panel: HTMLElement | null,
  close: () => void,
  dialog = false,
): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
    return;
  }
  if (!panel || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
  // Native date and number controls use these keys to change the value.
  const target = event.target as HTMLElement;
  if (dialog && target.matches('input[type="date"], input[type="number"], select')) return;
  event.preventDefault();
  moveFocus(panel, event.key === 'ArrowDown' ? 1 : -1, dialog ? CONTROLS : ITEMS);
}

export function Menu({
  trigger,
  label,
  triggerClass,
  hostClass,
  dialog,
  up,
  disabled,
  children,
}: MenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const { open, openMenu, closeMenu } = useMenuLayer();
  const close = () => {
    closeMenu();
    button.current?.focus();
  };
  useEffect(() => {
    if (open)
      panel.current?.querySelector<HTMLElement>(dialog ? '[data-popover-focus]' : ITEMS)?.focus();
  }, [open, dialog]);

  return (
    <span
      class={`menu-host${hostClass ? ` ${hostClass}` : ''}`}
      onKeyDown={open ? (event) => menuKey(event, panel.current, close, dialog) : undefined}
      onFocusOut={
        dialog && open
          ? (event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget)
              )
                closeMenu();
            }
          : undefined
      }
    >
      <button
        ref={button}
        type="button"
        class={triggerClass ?? 'btn btn--icon'}
        aria-label={label}
        aria-haspopup={dialog ? 'dialog' : 'menu'}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
      >
        {trigger}
      </button>
      {open && (
        <>
          <div class="menu-scrim" onPointerDown={closeMenu} />
          <div
            ref={panel}
            class={`menu${up ? ' menu--up' : ''}`}
            role={dialog ? 'dialog' : 'menu'}
            aria-label={label}
          >
            {children(close)}
          </div>
        </>
      )}
    </span>
  );
}
