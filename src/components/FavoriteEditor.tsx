import './tag-editor.css';
import './favorites.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MAX_NAME, describeQuery, isEmptyQuery, sameQuery } from '../domain/favorites';
import { isTagIcon, type TagIconName } from '../icons/tag-icons';
import { useApp } from '../state/app';
import {
  addFavorite,
  closeFavoriteEditor,
  closeFavoriteMenu,
  draftFor,
  moveFavorite,
  openFavoriteEditor,
  removeFavorite,
  updateFavorite,
  updateFavoriteQuery,
  useCurrentQuery,
  useFavoriteEditor,
  useFavoriteMenu,
  useFavorites,
  type FavoriteDraft,
  type FavoriteEditorState,
} from '../state/favorites';
import { FavoriteGlyph } from './Favorites';
import { IconGrid, Swatches } from './TagPickers';

function asIcon(name: string | null): TagIconName | null {
  const value = name ?? undefined;
  return isTagIcon(value) ? value : null;
}

function Foot({ id, valid }: { id: string | null; valid: boolean }) {
  return (
    <div class="editor-foot fav-foot">
      {id && (
        <button
          type="button"
          class="btn btn--ghost fav-remove"
          onClick={() => {
            removeFavorite(id);
            closeFavoriteEditor();
          }}
        >
          Remove
        </button>
      )}
      <button type="submit" class="btn btn--primary" disabled={!valid}>
        {id ? 'Save' : 'Add to favorites'}
      </button>
    </div>
  );
}

function Summary({ parts }: { parts: string[] }) {
  if (parts.length === 0) return <p class="fav-summary">Removed areas or topics</p>;
  return (
    <ul class="fav-summary" aria-label="Filters">
      {parts.map((part, index) => (
        <li key={index} class="fav-part">
          {part}
        </li>
      ))}
    </ul>
  );
}

function Form({ editor }: { editor: FavoriteEditorState }) {
  const existing = useFavorites().find((item) => item.id === editor.id);
  const model = useApp((s) => s.model);
  const current = useCurrentQuery();
  const [draft, setDraft] = useState<FavoriteDraft>(() =>
    existing
      ? { name: existing.name, icon: existing.icon, color: existing.color }
      : draftFor(editor.query),
  );
  const [useCurrent, setUseCurrent] = useState(false);
  const root = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const input = root.current?.querySelector('input');
    input?.focus();
    input?.select();
  }, []);
  const differs = !!existing && !isEmptyQuery(current) && !sameQuery(existing.query, current);
  const query = existing && useCurrent && differs ? current : editor.query;
  const parts = describeQuery(query, (id) => model.byId.get(id)?.name);
  const valid = draft.name.trim().length > 0;
  const set = (patch: Partial<FavoriteDraft>) => setDraft((value) => ({ ...value, ...patch }));
  const submit = (event: Event) => {
    event.preventDefault();
    if (!valid) return;
    const next = { ...draft, name: draft.name.trim() };
    if (existing) updateFavorite(existing.id, { ...next, query });
    else if (addFavorite(next, editor.query) === null) return;
    closeFavoriteEditor();
  };
  return (
    <form
      ref={root}
      class="editor fav-editor"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        closeFavoriteEditor();
      }}
    >
      <div class="fav-name">
        <FavoriteGlyph icon={draft.icon} color={draft.color} size={18} />
        <input
          class="field"
          aria-label="Name"
          placeholder="Name"
          maxLength={MAX_NAME}
          value={draft.name}
          spellcheck={false}
          autocomplete="off"
          onInput={(event) => set({ name: event.currentTarget.value })}
        />
      </div>
      <Summary parts={parts} />
      {differs && (
        <label class="fav-current">
          <input
            type="checkbox"
            checked={useCurrent}
            onChange={(event) => setUseCurrent(event.currentTarget.checked)}
          />
          Use the current filters
        </label>
      )}
      <Swatches color={draft.color} onChange={(color) => set({ color })} />
      <IconGrid
        icon={draft.icon}
        color={draft.color}
        onChange={(icon) => set({ icon: asIcon(icon) })}
      />
      <Foot id={existing?.id ?? null} valid={valid} />
    </form>
  );
}

/** The popover that names a favorite and gives it an icon and a color. */
export function FavoriteEditor() {
  const editor = useFavoriteEditor();
  if (!editor) return null;
  return (
    <div class="editor-scrim" onPointerDown={closeFavoriteEditor}>
      <div
        class="editor-pop fav-pop"
        role="dialog"
        aria-label={editor.id ? 'Edit favorite' : 'New favorite'}
        style={{ '--x': `${editor.x}px`, '--y': `${editor.y}px` }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Form key={editor.id ?? 'new'} editor={editor} />
      </div>
    </div>
  );
}

/** Focus goes back to the row the menu came from, when it is on screen. */
function refocus(id: string): void {
  document.querySelector<HTMLElement>(`[data-favorite="${id}"] .fav-toggle`)?.focus();
}

function menuKeys(event: KeyboardEvent, panel: HTMLElement | null, id: string): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeFavoriteMenu();
    refocus(id);
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const items = Array.from(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const at = items.indexOf(document.activeElement as HTMLElement);
  const step = event.key === 'ArrowDown' ? 1 : -1;
  items[(at + step + items.length) % items.length]?.focus();
}

/** The menu of a favorite row: edit, update, move, remove. */
export function FavoriteMenu() {
  const menu = useFavoriteMenu();
  const items = useFavorites();
  const current = useCurrentQuery();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menu) panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menu]);
  const index = menu ? items.findIndex((item) => item.id === menu.id) : -1;
  const favorite = items[index];
  if (!menu || !favorite) return null;
  const run = (action: () => void) => () => {
    closeFavoriteMenu();
    refocus(favorite.id);
    action();
  };
  const actions = [
    {
      label: 'Edit…',
      run: run(() => openFavoriteEditor({ id: favorite.id, x: menu.x, y: menu.y })),
    },
    ...(!isEmptyQuery(current) && !sameQuery(favorite.query, current)
      ? [{ label: 'Use current filters', run: run(() => updateFavoriteQuery(favorite.id)) }]
      : []),
    ...(index > 0 ? [{ label: 'Move up', run: run(() => moveFavorite(favorite.id, -1)) }] : []),
    ...(index < items.length - 1
      ? [{ label: 'Move down', run: run(() => moveFavorite(favorite.id, 1)) }]
      : []),
    { label: 'Remove from favorites', run: run(() => removeFavorite(favorite.id)) },
  ];
  return (
    <>
      <div class="menu-scrim" onPointerDown={closeFavoriteMenu} onContextMenu={closeFavoriteMenu} />
      <div
        ref={panel}
        class="menu tag-menu fav-menu"
        role="menu"
        aria-label={favorite.name}
        style={{ '--x': `${menu.x}px`, '--y': `${menu.y}px` }}
        onKeyDown={(event) => menuKeys(event, panel.current, favorite.id)}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            class="menu-item tag-menu-item"
            onClick={action.run}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
