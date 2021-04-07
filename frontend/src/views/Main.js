import React, { useEffect } from "react";

//import { flatbuffers } from "flatbuffers";
import { events } from "../event_generated.js";

import { flatbuffers } from "flatbuffers";

function Main() {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/api/ws");
    ws.binaryType = "arraybuffer";

    ws.addEventListener("message", function (evt) {
      const bytes = new Uint8Array(evt.data);
      const buffer = new flatbuffers.ByteBuffer(bytes);

      const event = events.Event.getRootAsEvent(buffer);
      console.log(event.room());
    });
  }, []);

  return (
    <div>
      <p>Main</p>
    </div>
  );
}

export default Main;
