import { VIEW_PATH, type ViewName } from '../domain/views';
import { isMobileViewport } from '../mobile/viewport';
import { swap } from '../motion/transition';
import { parseRoute, recordPath, transitionFor, type Route } from './routes';
import { createStore, useStore } from './store';

export { recordPath, parseRoute };
export type { Route };

function readLocation(): Route {
  const state = history.state as { from?: ViewName } | null;
  return parseRoute(location.pathname, location.search, state?.from ?? null);
}

/** The route in the address bar right now. navigate() writes the URL before any transition
 * starts, so key handlers read this instead of render state, which can lag a frame behind. */
export function currentRoute(): Route {
  return readLocation();
}

export const routeStore = createStore<{ route: Route }>({ route: readLocation() });

export function refreshRoute(): void {
  routeStore.set({ route: readLocation() });
}

window.addEventListener('popstate', refreshRoute);

export interface NavigateOptions {
  replace?: boolean;
  from?: ViewName | null;
}

export function navigate(path: string, options: NavigateOptions = {}): void {
  const state = options.from ? { from: options.from } : null;
  const before = routeStore.get().route;
  if (options.replace) history.replaceState(state, '', path);
  else history.pushState(state, '', path);
  const apply = () => routeStore.set({ route: readLocation() });
  const kind = transitionFor(before, readLocation(), isMobileViewport());
  if (kind) swap(kind, apply);
  else apply();
}

export function goToView(view: ViewName): void {
  navigate(VIEW_PATH[view]);
}

export function useRoute(): Route {
  return useStore(routeStore, (s) => s.route);
}
