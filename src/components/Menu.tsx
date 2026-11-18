import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { popLayer, pushLayer } from '../state/modal';

interface MenuProps {
  trigger: ComponentChildren;
  label: string;
  triggerClass?: string;
  hostClass?: string;
  /** Open above the trigger (bottom bars). */
  up?: boolean;
  disabled?: boolean;
  children: (close: () => void) => ComponentChildren;
}

const ITEMS = '[role^="menuitem"]:not([disabled])';

function moveFocus(panel: HTMLElement, delta: number): void {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(ITEMS));
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = (at + delta + items.length) % items.length;
  items[at < 0 && delta < 0 ? items.length - 1 : next]?.focus();
}

export function Menu({
  trigger,
  label,
  triggerClass,
  hostClass,
  up,
  disabled,
  children,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
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
  const close = () => {
    closeMenu();
    button.current?.focus();
  };
  // A menu that unmounts while open must not leave its layer behind.
  useEffect(
    () => () => {
      if (layer.current !== null) popLayer(layer.current, false);
    },
    [],
  );

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>(ITEMS)?.focus();
  }, [open]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (panel.current) moveFocus(panel.current, event.key === 'ArrowDown' ? 1 : -1);
    }
  };

  return (
    <span
      class={`menu-host${hostClass ? ` ${hostClass}` : ''}`}
      onKeyDown={open ? onKeyDown : undefined}
    >
      <button
        ref={button}
        type="button"
        class={triggerClass ?? 'btn btn--icon'}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
      >
        {trigger}
      </button>
      {open && (
        <>
          <div class="menu-scrim" onPointerDown={closeMenu} />
          <div ref={panel} class={`menu${up ? ' menu--up' : ''}`} role="menu" aria-label={label}>
            {children(close)}
          </div>
        </>
      )}
    </span>
  );
}
