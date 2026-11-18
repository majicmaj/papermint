import { createTag, updateTag } from '../api/tags';
import type { Tag } from '../api/types';
import { saveTagIcon } from '../api/ui-settings';
import { appStore, notify, persist, toggleArea, toggleTopic } from './app';
import { buildTagModel } from '../domain/tags';
import { popLayer, pushLayer } from './modal';
import { createStore, useStore } from './store';

export type TagKind = 'area' | 'topic';
export type EditorFocus = 'name' | 'icon' | 'color';

export interface EditorState {
  /** Null while creating. */
  tagId: number | null;
  kind: TagKind;
  /** Area to preselect for a new topic. */
  parent: number | null;
  focus: EditorFocus;
  /** Where the popover opens: the point the owner pressed. */
  x: number;
  y: number;
  /** A record that receives the new tag, when it is made from that record's menu. */
  recordId: number | null;
}

export interface MenuState {
  tagId: number;
  x: number;
  y: number;
}

const store = createStore<{ editor: EditorState | null; menu: MenuState | null }>({
  editor: null,
  menu: null,
});
export const tagEditorStore = store;
let editorLayer: number | null = null;
let menuLayer: number | null = null;

export function useTagEditor(): EditorState | null {
  return useStore(store, (s) => s.editor);
}
export function useTagMenu(): MenuState | null {
  return useStore(store, (s) => s.menu);
}

export function openTagMenu(menu: MenuState): void {
  closeTagMenu();
  menuLayer = pushLayer(false);
  store.set({ menu });
}

export function closeTagMenu(): void {
  if (menuLayer !== null) popLayer(menuLayer, false);
  menuLayer = null;
  store.set({ menu: null });
}

export function openTagEditor(editor: Partial<EditorState> & { x: number; y: number }): void {
  closeTagMenu();
  if (store.get().editor) return;
  editorLayer = pushLayer(true);
  store.set({
    editor: { tagId: null, kind: 'area', parent: null, focus: 'name', recordId: null, ...editor },
  });
}

export function closeTagEditor(): void {
  if (editorLayer !== null) popLayer(editorLayer);
  editorLayer = null;
  store.set({ editor: null });
}

export interface TagInput {
  name: string;
  color: string;
  kind: TagKind;
  parent: number | null;
  icon: string | null;
}

function putTag(tag: Tag): void {
  appStore.set((s) => {
    const tags = s.tags.some((t) => t.id === tag.id)
      ? s.tags.map((t) => (t.id === tag.id ? { ...t, ...tag } : t))
      : [...s.tags, tag];
    return { tags, model: buildTagModel(tags, s.docs) };
  });
}

function putIcons(icons: Record<string, string>): void {
  appStore.set({ icons });
}

async function saveIcon(tagId: number, icon: string | null): Promise<void> {
  const before = appStore.get().icons;
  if ((before[String(tagId)] ?? null) === icon) return;
  const next = { ...before };
  if (icon) next[String(tagId)] = icon;
  else delete next[String(tagId)];
  putIcons(next);
  try {
    putIcons(await saveTagIcon(tagId, icon));
  } catch {
    putIcons(before);
    notify('Save failed');
  }
}

/** Create a tag, then its icon. A topic is always made under an area. */
export async function createTagFrom(input: TagInput, recordId: number | null): Promise<boolean> {
  const parent = input.kind === 'topic' ? input.parent : null;
  if (input.kind === 'topic' && parent === null) return false;
  try {
    const tag = await createTag({ name: input.name, color: input.color, parent });
    putTag(tag);
    persist();
    if (input.icon) await saveIcon(tag.id, input.icon);
    const doc = recordId === null ? null : appStore.get().docs.find((d) => d.id === recordId);
    if (doc) await (parent === null ? toggleArea(doc, tag.id) : toggleTopic(doc, tag.id));
    return true;
  } catch {
    notify('Save failed');
    return false;
  }
}

export async function updateTagFrom(tag: Tag, input: TagInput): Promise<boolean> {
  const patch: { name?: string; color?: string } = {};
  if (input.name !== tag.name) patch.name = input.name;
  if (input.color !== tag.color) patch.color = input.color;
  try {
    if (Object.keys(patch).length > 0) {
      putTag(await updateTag(tag.id, patch));
      persist();
    }
    await saveIcon(tag.id, input.icon);
    return true;
  } catch {
    notify('Save failed');
    return false;
  }
}
