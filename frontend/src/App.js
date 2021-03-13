import React, { useState, useEffect, useRef } from "react";
import "./App.css";

function App() {
  const videoEl = useRef(null);

  useEffect(() => {
    async function loadVideo() {
      navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: true,
        })
        .then(
          (stream) => (videoEl.current.srcObject = stream),
          (err) => console.log(err)
        );
    }
    loadVideo();
  }, []);
  return (
    <div>
      <video ref={videoEl} autoPlay playsInline></video>
    </div>
  );
}

export default App;
