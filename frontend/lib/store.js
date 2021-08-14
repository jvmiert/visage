import { useLayoutEffect } from "react";
import create from "zustand";
import createContext from "zustand/context";
import { devtools } from "zustand/middleware";
import produce from "immer";

let store;

const initialState = {
  streams: [],
  ready: false,
  //currentVideoStream: null,
  //wsToken: "",
  inRoom: false,
  devices: {
    audio: [],
    video: [],
  },
  tracks: {
    audio: {},
    video: {},
  },
  //activeVideo: null,
  //activeAudio: null,
};

const zustandContext = createContext();
export const Provider = zustandContext.Provider;
export const useStore = zustandContext.useStore;

export const initializeStore = (preloadedState = {}) => {
  return create(
    devtools((set, get) => ({
      ...initialState,
      ...preloadedState,
      set: (fn) => set(produce(fn)),
      updateSpeakers: (activeSpeakers) =>
        set((state) => ({
          streams: state.streams.map((stream) => {
            if (activeSpeakers.includes(stream.id)) {
              stream.speaking = true;
            } else {
              stream.speaking = false;
            }
            return stream;
          }),
        })),
      addStream: (stream, muted) => {
        set(
          produce((draft) => {
            stream.muted = muted;
            draft.streams.push(stream);
          })
        );
      },
      removeStream: (stream) => {
        set(
          produce((draft) => {
            const index = draft.streams.findIndex(
              (strm) => strm.id === stream.id
            );
            if (index !== -1) draft.streams.splice(index, 1);
          })
        );
      },
      addDevice: (deviceType, deviceInfo) => {
        set(
          produce((draft) => {
            draft.devices[deviceType].push(deviceInfo);
          })
        );
      },
      addTrack: (trackType, trackInfo, deviceId) => {
        set(
          produce((draft) => {
            draft.tracks[trackType][deviceId] = trackInfo;
          })
        );
      },
      removeTrack: (trackType, deviceId) => {
        set(
          produce((draft) => {
            delete draft.tracks[trackType][deviceId];
          })
        );
      },
    }))
  );
};

export function useCreateStore(initialState) {
  // For SSR & SSG, always use a new store.
  if (typeof window === "undefined") {
    return () => initializeStore(initialState);
  }

  // For CSR, always re-use same store.
  store = store ?? initializeStore(initialState);
  // And if initialState changes, then merge states in the next render cycle.
  //
  // eslint complaining "React Hooks must be called in the exact same order in every component render"
  // is ignorable as this code runs in same order in a given environment
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useLayoutEffect(() => {
    if (initialState && store) {
      store.setState({
        ...store.getState(),
        ...initialState,
      });
    }
  }, [initialState]);

  return () => store;
}
