import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import "./App.css";

function App() {
  const videoEl = useRef(null);

  // useEffect(() => {
  //   async function loadVideo() {
  //     navigator.mediaDevices
  //       .getUserMedia({
  //         audio: false,
  //         video: true,
  //       })
  //       .then(
  //         (stream) => (videoEl.current.srcObject = stream),
  //         (err) => console.log(err)
  //       );
  //   }
  //   loadVideo();
  // }, []);

  useEffect(() => {
    const fetchData = async () => {
      const result = await axios(
        '/api/test',
      );
 
      console.log(result.data);
    };
 
    fetchData();
  }, []);

  return (
    <div>
      {/*<video ref={videoEl} autoPlay playsInline></video>*/}
      <p>Hello!</p>
    </div>
  );
}

export default App;
