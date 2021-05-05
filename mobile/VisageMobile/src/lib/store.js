import create from 'zustand';
import produce from 'immer';

const useStore = create(set => ({
  client: null,
  streams: [],
  selfStream: null,
  set: fn => set(produce(fn)),
  addStream: stream => {
    set(
      produce(draft => {
        draft.streams.push(stream);
      }),
    );
  },
  removeStream: stream => {
    set(
      produce(draft => {
        const index = draft.streams.findIndex(strm => strm.id === stream.id);
        if (index !== -1) draft.streams.splice(index, 1);
      }),
    );
  },
}));

export default useStore;
