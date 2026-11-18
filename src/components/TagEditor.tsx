import './tag-editor.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Tag } from '../api/types';
import { DEFAULT_TAG_COLOR } from '../domain/tag-palette';
import { useOffline } from '../pwa/connectivity';
import { useApp } from '../state/app';
import {
  closeTagEditor,
  createTagFrom,
  updateTagFrom,
  useTagEditor,
  type EditorState,
  type TagInput,
  type TagKind,
} from '../state/tag-editor';
import { IconGrid, KindPicker, Swatches } from './TagPickers';

function startingInput(
  editor: EditorState,
  tag: Tag | null,
  icon: string | null,
  only: number | null,
): TagInput {
  if (tag) {
    return {
      name: tag.name,
      color: tag.color,
      kind: editor.kind,
      parent: tag.parent ?? null,
      icon,
    };
  }
  return {
    name: '',
    color: DEFAULT_TAG_COLOR,
    kind: editor.kind,
    parent: editor.parent ?? only,
    icon: null,
  };
}

function focusFor(root: HTMLElement | null, focus: EditorState['focus']): void {
  const selector = {
    name: 'input',
    icon: '.icon-cell[aria-pressed="true"], .icon-cell',
    color: '.swatch[aria-checked="true"], .swatch',
  }[focus];
  const target = root?.querySelector<HTMLInputElement>(selector);
  target?.focus();
  if (focus === 'name') target?.select();
}

function Form({ editor }: { editor: EditorState }) {
  const model = useApp((s) => s.model);
  const icons = useApp((s) => s.icons);
  const tag = editor.tagId === null ? null : (model.byId.get(editor.tagId) ?? null);
  const only = model.areas.length === 1 ? model.areas[0]!.id : null;
  const [input, setInput] = useState(() =>
    startingInput(editor, tag, tag ? (icons[String(tag.id)] ?? null) : null, only),
  );
  const offline = useOffline();
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLFormElement>(null);
  useEffect(() => focusFor(root.current, editor.focus), [editor.focus]);
  const valid = input.name.trim().length > 0 && (input.kind === 'area' || input.parent !== null);
  const set = (patch: Partial<TagInput>) => setInput((current) => ({ ...current, ...patch }));
  const submit = async (event: Event) => {
    event.preventDefault();
    if (!valid || busy || offline) return;
    setBusy(true);
    const next = { ...input, name: input.name.trim() };
    const ok = tag ? await updateTagFrom(tag, next) : await createTagFrom(next, editor.recordId);
    setBusy(false);
    if (ok) closeTagEditor();
  };
  return (
    <form
      ref={root}
      class="editor"
      onSubmit={(event) => void submit(event)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        closeTagEditor();
      }}
    >
      <KindPicker
        kind={input.kind}
        disabled={tag !== null}
        onChange={(kind: TagKind) => set({ kind })}
      />
      <div class={`editor-pair${input.kind === 'topic' ? ' editor-pair--two' : ''}`}>
        <input
          class="field"
          aria-label="Name"
          placeholder="Name"
          value={input.name}
          spellcheck={false}
          autocomplete="off"
          onInput={(event) => set({ name: event.currentTarget.value })}
        />
        {input.kind === 'topic' && (
          <select
            class="field"
            aria-label="Area"
            disabled={tag !== null}
            value={input.parent ?? ''}
            onChange={(event) => set({ parent: Number(event.currentTarget.value) || null })}
          >
            <option value="">Area</option>
            {model.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <Swatches color={input.color} onChange={(color) => set({ color })} />
      <IconGrid icon={input.icon} color={input.color} onChange={(icon) => set({ icon })} />
      <div class="editor-foot">
        <button type="submit" class="btn btn--primary" disabled={!valid || busy || offline}>
          {tag ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  );
}

/** The create and edit popover for areas and topics. It opens at the point the owner pressed. */
export function TagEditor() {
  const editor = useTagEditor();
  if (!editor) return null;
  return (
    <div class="editor-scrim" onPointerDown={closeTagEditor}>
      <div
        class="editor-pop"
        role="dialog"
        aria-label={editor.tagId === null ? 'New tag' : 'Edit tag'}
        style={{ '--x': `${editor.x}px`, '--y': `${editor.y}px` }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Form key={`${editor.tagId}-${editor.kind}`} editor={editor} />
      </div>
    </div>
  );
}
