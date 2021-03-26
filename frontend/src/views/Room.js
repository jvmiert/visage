import React, { useEffect, useRef, useState, useCallback } from "react";
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

  const loadVideo = useCallback((offer, candidate) => {
    async function loadVideo() {
      navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: true,
        })
        .then(
          (stream) => {
            let pc = new RTCPeerConnection({
              iceServers: [
                {
                  urls: "stun:stun.l.google.com:19302",
                },
              ],
            });

            /**
              @TODO:
                - Send the answer SDP to the backend
                - Send ice candidates to backend
            */
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.setRemoteDescription(offer);
            pc.createAnswer().then((d) => {
              pc.setLocalDescription(d);
              // we need to send this to the backend which will pass it along to the SFU
              // JSON.stringify(d)
            });

            pc.addIceCandidate(candidate);

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
  }, []);

  useEffect(() => {
    axios
      .get(`/api/room/join/${room}`)
      .then((result) => {
        if (!result.data.roomInfo.Joinable) {
          setState((prevState) => ({
            ...prevState,
            ...{
              loading: false,
              full: true,
            },
          }));
          return;
        }
        setState((prevState) => ({
          ...prevState,
          ...{
            showVideo: true,
            isHost: result.data.roomInfo.IsHost,
          },
        }));
        loadVideo(
          JSON.parse(result.data.hostOffer),
          JSON.parse(result.data.hostCandidate)
        );
      })
      .catch((error) => {
        let newState = {};
        error.response.status === 404 &&
          Object.assign(newState, { notExist: true });

        Object.assign(newState, { loading: false });
        setState((prevState) => ({ ...prevState, ...newState }));
      });
  }, [room, loadVideo]);

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
