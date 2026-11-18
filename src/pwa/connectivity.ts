import { createStore, useStore } from '../state/store';

/**
 * Whether the browser can reach the network. While it cannot, everything that writes is
 * disabled: nothing is queued, nothing is replayed, so nothing can overwrite a newer change
 * made on another device.
 */
export interface Connectivity {
  offline: boolean;
}

export const connectivity = createStore<Connectivity>({
  offline: typeof navigator !== 'undefined' && navigator.onLine === false,
});

export function isOffline(): boolean {
  return connectivity.get().offline;
}

export function setOffline(offline: boolean): void {
  if (connectivity.get().offline !== offline) connectivity.set({ offline });
}

export function useOffline(): boolean {
  return useStore(connectivity, (s) => s.offline);
}

/** Follow the browser's online and offline events. */
export function startConnectivity(): void {
  setOffline(navigator.onLine === false);
  window.addEventListener('online', () => setOffline(false));
  window.addEventListener('offline', () => setOffline(true));
}

/** A write was refused before it left the page, because the browser is offline. */
export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

/**
 * The one guard for writes. Every function that sends a change (`postJson`, `patchJson`,
 * `deleteRequest`, the file upload) calls it first, so a new write path cannot skip it.
 * The controls are disabled as well; this covers a dialog that was open when the network went.
 */
export function requireOnline(): void {
  if (isOffline()) throw new OfflineError();
}

/** A request that never got an answer (no network, server down), or was refused for that reason. */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || error instanceof OfflineError;
}
