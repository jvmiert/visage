import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { createUseStyles } from "react-jss";

import { flatbuffers } from "flatbuffers";
import { events } from "../event_generated.js";

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
    showThemVideo: false,
    full: false,
    error: false,
    notExist: false,
    isHost: false,
    tracks: [],
  });

  /*
    @TODO: how to clean up WS connection?
  **/

  const createMessage = (eventType, user, room, payload) => {
    let builder = new flatbuffers.Builder(0);

    var payloadString = builder.createString(payload);
    var userID = builder.createString(user);
    var roomID = builder.createString(room);

    let Event = events.Event;

    Event.startEvent(builder);

    Event.addType(builder, eventType);
    Event.addTarget(builder, events.Target.Publisher);
    Event.addPayload(builder, payloadString);
    Event.addUid(builder, userID);
    Event.addRoom(builder, roomID);

    let offset = Event.endEvent(builder);
    builder.finish(offset);

    const bytes = builder.asUint8Array();

    return bytes;
  };

  const loadVideo = useCallback((reconnect, room, wsToken) => {
    async function loadVideo() {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: true,
        })
        .then(
          (stream) => {
            const ws = new WebSocket(
              `${Config.wsURL}?room=${room}&token=${wsToken}`
            );
            ws.binaryType = "arraybuffer";

            ws.addEventListener("message", function (evt) {
              const bytes = new Uint8Array(evt.data);
              const buffer = new flatbuffers.ByteBuffer(bytes);
              const event = events.Event.getRootAsEvent(buffer);

              switch (event.type()) {
                case events.Type.Signal:
                  console.log("ws signal type detected: ", event.payload());
                  //pcRef.current.addIceCandidate(JSON.parse(event.payload()));
                  break;
                default:
                  console.log(
                    "unknown message: ",
                    event.type(),
                    event.payload()
                  );
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
              };

              pcRef.current.oniceconnectionstatechange = (e) => {
                console.log(
                  "connection state change",
                  pcRef.current.iceConnectionState
                );
              };

              pcRef.current.onicecandidate = (e) => {
                if (!e.candidate?.candidate) {
                  return;
                }
                const message = createMessage(
                  events.Type.Signal,
                  wsToken,
                  room,
                  e.candidate.candidate
                );
                //console.log("new candidate: ", e.candidate.candidate);
                ws.send(message);
              };

              stream.getTracks().forEach((track) =>
                pcRef.current.addTransceiver(track, {
                  streams: [stream],
                  direction: "sendonly",
                })
              );

              pcRef.current.createOffer().then((d) => {
                pcRef.current.setLocalDescription(d);
                //console.log(d);
                //SEND OFFER
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
              style={{ display: state.showThemVideo ? "inline" : "none" }}
            ></video>
          </div>
        )}
      </div>
    </div>
  );
}

export default Room;
