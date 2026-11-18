import { createStore, useStore } from './store';
import { popLayer, pushLayer } from './modal';

/** A dialog is bound to a record id captured when it opens. Navigation can never change it. */
export type DialogState = { kind: 'delete'; docId: number; title: string } | null;

const store = createStore<{ dialog: DialogState }>({ dialog: null });
let layer: number | null = null;

export function openDeleteDialog(docId: number, title: string): void {
  if (store.get().dialog) return;
  layer = pushLayer(true);
  store.set({ dialog: { kind: 'delete', docId, title } });
}

export function closeDialog(): void {
  if (layer !== null) popLayer(layer);
  layer = null;
  store.set({ dialog: null });
}

export function useDialog(): DialogState {
  return useStore(store, (s) => s.dialog);
}

export const dialogStore = store;
