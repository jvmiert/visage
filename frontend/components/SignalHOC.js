import axios from "axios";
import { useEffect, useCallback } from "react";

import { useStore } from "../lib/store";
import { IonSFUFlatbuffersSignal } from "../lib/ion";

function SignalHOC({ children }) {
  const set = useStore(useCallback((state) => state.set, []));
  useEffect(() => {
    const connectSignal = async () => {
      await axios.get("/api/user-token").then((result) => {
        const signal = new IonSFUFlatbuffersSignal(
          result.data.userID,
          result.data.sessionID
        );
        signal.onopen = () => {
          set((state) => {
            state.signal = signal;
          });
        };
        signal.onready = () => {
          set((state) => {
            state.ready = true;
          });
        };
      });
    };
    connectSignal();
  }, [set]);

  return children;
}

export default SignalHOC;
