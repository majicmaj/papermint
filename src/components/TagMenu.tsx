import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../state/app';
import {
  closeTagMenu,
  openTagEditor,
  useTagMenu,
  type EditorFocus,
  type TagKind,
} from '../state/tag-editor';

const ITEMS: { focus: EditorFocus; label: string }[] = [
  { focus: 'name', label: 'Rename' },
  { focus: 'icon', label: 'Icon' },
  { focus: 'color', label: 'Color' },
];

/** The menu of a rail row: rename, icon, color. All three open the same editor. */
export function TagMenu() {
  const menu = useTagMenu();
  const model = useApp((s) => s.model);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menu) panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menu]);
  const tag = menu ? model.byId.get(menu.tagId) : null;
  if (!menu || !tag) return null;
  const kind: TagKind = model.areaOf.has(tag.id) ? 'topic' : 'area';
  const open = (focus: EditorFocus) =>
    openTagEditor({
      tagId: tag.id,
      kind,
      parent: model.areaOf.get(tag.id) ?? null,
      focus,
      x: menu.x,
      y: menu.y,
    });
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeTagMenu();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(
      panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(at + step + items.length) % items.length]?.focus();
  };
  return (
    <>
      <div class="menu-scrim" onPointerDown={closeTagMenu} onContextMenu={closeTagMenu} />
      <div
        ref={panel}
        class="menu tag-menu"
        role="menu"
        aria-label={tag.name}
        style={{ '--x': `${menu.x}px`, '--y': `${menu.y}px` }}
        onKeyDown={onKeyDown}
      >
        {ITEMS.map((item) => (
          <button
            key={item.focus}
            type="button"
            role="menuitem"
            class="menu-item tag-menu-item"
            onClick={() => open(item.focus)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
