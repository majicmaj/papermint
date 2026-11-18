import { createStore, useStore } from './store';

/**
 * One stack for everything that sits above the page: palette, dialogs, menus.
 * While any layer is open, global shortcuts are suspended. While a modal layer is
 * open, the page behind it is inert. Closing a modal layer restores focus to its opener.
 */
export interface Layer {
  id: number;
  modal: boolean;
  opener: HTMLElement | null;
}

export interface LayerEnv {
  activeElement: () => HTMLElement | null;
  /** Run after the page behind a modal became focusable again. */
  later: (run: () => void) => void;
}

const browserEnv: LayerEnv = {
  activeElement: () =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  later: (run) => void requestAnimationFrame(run),
};

export function createLayerStack(env: LayerEnv = browserEnv) {
  const store = createStore<{ layers: Layer[] }>({ layers: [] });
  let seq = 0;
  return {
    store,
    /** Open a layer. The opener is captured now, before anything behind it goes inert. */
    push(modal: boolean): number {
      seq += 1;
      const layer: Layer = { id: seq, modal, opener: env.activeElement() };
      store.set((s) => ({ layers: [...s.layers, layer] }));
      return layer.id;
    },
    pop(id: number, restoreFocus = true): void {
      const layer = store.get().layers.find((l) => l.id === id);
      if (!layer) return;
      store.set((s) => ({ layers: s.layers.filter((l) => l.id !== id) }));
      const opener = layer.opener;
      if (layer.modal && restoreFocus && opener) {
        env.later(() => {
          if (opener.isConnected) opener.focus();
        });
      }
    },
    /** True while any palette, dialog or menu is open. Global shortcuts check this. */
    isOpen: (): boolean => store.get().layers.length > 0,
    isModal: (): boolean => store.get().layers.some((l) => l.modal),
  };
}

export const layers = createLayerStack();

export const pushLayer = layers.push;
export const popLayer = layers.pop;
export const anyLayerOpen = layers.isOpen;

/** True while a modal layer is open: the page behind it must be inert. */
export function useModalOpen(): boolean {
  return useStore(layers.store, (s) => s.layers.some((l) => l.modal));
}
