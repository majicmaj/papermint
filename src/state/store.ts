import { useEffect, useRef, useState } from 'preact/hooks';

type Listener = () => void;

export interface Store<S> {
  get: () => S;
  set: (patch: Partial<S> | ((state: S) => Partial<S>)) => void;
  subscribe: (listener: Listener) => () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Subscribe to a slice of a store. Select raw slices; derive values with useMemo. */
export function useStore<S, T>(store: Store<S>, select: (state: S) => T): T {
  const selectRef = useRef(select);
  selectRef.current = select;
  const [value, setValue] = useState(() => select(store.get()));
  useEffect(() => {
    const sync = () => setValue(() => selectRef.current(store.get()));
    sync();
    return store.subscribe(sync);
  }, [store]);
  return value;
}
