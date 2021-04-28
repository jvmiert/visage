import { useMemo } from "react";
import create from "zustand";
import { devtools } from "zustand/middleware";
import produce from "immer";

let store;

const initialState = {
  streams: [],
  wsToken: "",
};

function initStore(preloadedState = initialState) {
  return create(
    devtools((set, get) => ({
      ...initialState,
      ...preloadedState,
      addStream: (stream) => {
        set(
          produce(get.streams(), (draft) => {
            draft.push(stream);
          })
        );
      },
    }))
  );
}

export const initializeStore = (preloadedState) => {
  let _store = store ?? initStore(preloadedState);

  // After navigating to a page with an initial Zustand state, merge that state
  // with the current state in the store, and create a new store
  if (preloadedState && store) {
    store.setState({
      ...store.getState(),
      ...preloadedState,
    });
  }

  // For SSG and SSR always create a new store
  if (typeof window === "undefined") return _store;
  // Create the store once in the client
  if (!store) store = _store;

  return _store;
};

export function useHydrate(initialState) {
  const state =
    typeof initialState === "string" ? JSON.parse(initialState) : initialState;
  const store = useMemo(() => initializeStore(state), [state]);
  return store;
}
