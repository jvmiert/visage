import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { createUseStyles } from "react-jss";

import Config from "../Config";

const useStyles = createUseStyles({
  videoContainer: {
    display: "flex",
  },
  videoChild: {
    maxWidth: "40vh",
  },
  videoElement: {
    maxWidth: "100%",
  },
});

function Room() {
  const videoHost = useRef(null);
  const videoPart = useRef(null);
  const pcRef = useRef();
  const classes = useStyles();

  const { room } = useParams();

  const [state, setState] = useState({
    loading: true,
    showVideo: false,
    full: false,
    error: false,
    notExist: false,
    isHost: false,
    tracks: [],
  });

  /*
    @TODO: how to clean up WS connection?
  **/

  const loadVideo = useCallback((reconnect, room, wsToken) => {
    async function loadVideo() {
      navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: true,
        })
        .then(
          (stream) => {
            const ws = new WebSocket(
              `${Config.wsURL}?room=${room}&token=${wsToken}`
            );

            ws.addEventListener("message", function (evt) {
              let msg = JSON.parse(evt.data);
              if (!msg) {
                return console.log("failed to parse msg");
              }

              switch (msg.Event) {
                case "reoffer":
                  pcRef.current.createOffer().then((d) => {
                    pcRef.current.setLocalDescription(d);
                    ws.send(
                      JSON.stringify({
                        event: "offer",
                        payload: JSON.stringify(d),
                      })
                    );
                  });
                  break;
                case "answer":
                  const answer = JSON.parse(msg.Payload);
                  if (!answer) {
                    return console.log("failed to parse answer");
                  }
                  pcRef.current.setRemoteDescription(answer);
                  break;

                case "candidate":
                  let candidate = JSON.parse(msg.Payload);
                  if (!candidate) {
                    return console.log("failed to parse candidate");
                  }

                  pcRef.current.addIceCandidate(candidate);
                  break;
                default:
                  console.log("unknown message: ", msg.Payload);
              }
            });

            ws.onopen = function () {
              pcRef.current = new RTCPeerConnection({
                iceServers: [
                  {
                    urls: "stun:stun.l.google.com:19302",
                  },
                ],
              });

              pcRef.current.onnegotiationneeded = function () {
                console.log("Negotiation is needed!");
              };

              pcRef.current.ontrack = function (event) {
                if (event.track.kind === "audio") {
                  return;
                }

                console.log("adding track: ", event);

                videoPart.current.srcObject = event.streams[0];

                event.streams[0].onremovetrack = ({ track }) => {
                  /* @TODO: remove the track */
                  console.log("removing: ", track);
                };
              };

              pcRef.current.oniceconnectionstatechange = (e) => {
                console.log(
                  "connection state change",
                  pcRef.current.iceConnectionState
                );
              };

              pcRef.current.onicecandidate = (e) => {
                if (!e.candidate) {
                  return;
                }
                ws.send(
                  JSON.stringify({
                    event: "candidate",
                    payload: JSON.stringify(e.candidate),
                  })
                );
              };

              stream
                .getTracks()
                .forEach((track) => pcRef.current.addTrack(track, stream));

              pcRef.current.createOffer().then((d) => {
                pcRef.current.setLocalDescription(d);
                ws.send(
                  JSON.stringify({ event: "offer", payload: JSON.stringify(d) })
                );
              });
              videoHost.current.srcObject = stream;
              setState((prevState) => ({
                ...prevState,
                ...{ loading: false },
              }));
            };
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
        if (!result.data.joinable) {
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
            isHost: result.data.isHost,
          },
        }));
        loadVideo(result.data.reconnect, room, result.data.wsToken);
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
      <p>You:</p>
      <div className={classes.videoContainer}>
        {state.showVideo && (
          <div className={classes.videoChild}>
            <video
              className={classes.videoElement}
              ref={videoHost}
              autoPlay
              playsInline
              muted
            ></video>
          </div>
        )}
      </div>
      <p>Them:</p>
      <div className={classes.videoContainer}>
        {state.showVideo && (
          <div className={classes.videoChild}>
            <video
              className={classes.videoElement}
              ref={videoPart}
              autoPlay
              playsInline
              muted
            ></video>
          </div>
        )}
      </div>
    </div>
  );
}

export default Room;
