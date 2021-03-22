import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";

function Room() {
  const videoEl = useRef(null);

  const { room } = useParams();

  const [state, setState] = useState({
    loading: true,
    showVideo: false,
    full: false,
    error: false,
    notExist: false,
    isHost: false,
  });

  useEffect(() => {
    axios
      .get(`/api/room/join/${room}`)
      .then((result) => {
        if (!result.data.Joinable) {
          setState((prevState) => ({
            ...prevState,
            ...{ loading: false, full: true },
          }));
          return;
        }
        setState((prevState) => ({
          ...prevState,
          ...{ showVideo: true, isHost: result.data.IsHost },
        }));
        loadVideo();
      })
      .catch((error) => {
        let newState = {};
        error.response.status === 404 &&
          Object.assign(newState, { notExist: true });

        Object.assign(newState, { loading: false });
        setState((prevState) => ({ ...prevState, ...newState }));
      });
  }, [room]);

  const loadVideo = () => {
    async function loadVideo() {
      navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: true,
        })
        .then(
          (stream) => {
            let pc = new RTCPeerConnection();

            /**
              @TODO:
                We want to create an offer (createOffer) when we are the 
                host (first in the room -> state.isHost) and wait for other peers to join.

                When we are a joining the room as a peer (host is waiting for us). We want to 
                receive an offer and answer this (onicecandidate -> createAnswer).

                We should base encode the SDP (btoa) and exchange it...

                Maybe the server should reply an offer with data channel when there is no peer
                in the room yet. Then message client through data channel to change to video
                when the peer joins?
            */
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
            pc.createOffer().then((d) => console.log(d.sdp));

            pc.onicecandidate = (e) => {
              console.log(e);
            };
            videoEl.current.srcObject = stream;
            setState((prevState) => ({
              ...prevState,
              ...{ loading: false },
            }));
          },
          (err) => console.log(err)
        );
    }
    loadVideo();
  };

  return (
    <div>
      <p>{room}</p>
      {state.loading && <p>Loading...</p>}
      {(state.notExist || state.full) && (
        <p>
          Sorry, this room {state.notExist ? "does not exist." : "is full."}{" "}
          <Link to="/">Go Home</Link>
        </p>
      )}
      {state.showVideo && <video ref={videoEl} autoPlay playsInline></video>}
    </div>
  );
}

export default Room;
