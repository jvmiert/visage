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

let subCandidates = [];

function Room() {
  const videoHost = useRef(null);
  const videoPart = useRef(null);
  const pcRefPub = useRef();
  const pcRefSub = useRef();
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

  const createMessage = (
    eventType,
    user,
    room,
    payloadString,
    payloadCandidate,
    target
  ) => {
    /*
      @TODO: make it possible to create a payload candidate just like golang createmessage
    **/

    let offsetPayload;
    let Event = events.Event;
    let payloadType;
    let builder = new flatbuffers.Builder(0);

    if (payloadCandidate) {
      payloadType = events.Payload.CandidateTable;

      const candidateS = builder.createString(payloadCandidate.candidate);
      const sdpMidS = builder.createString(payloadCandidate.sdpMid);
      const usernameFragmentS = builder.createString(
        payloadCandidate.usernameFragment
      );

      let CandidateTable = events.CandidateTable;

      CandidateTable.startCandidateTable(builder);
      CandidateTable.addCandidate(builder, candidateS);
      CandidateTable.addSdpMid(builder, sdpMidS);
      CandidateTable.addSdpmLineIndex(
        builder,
        payloadCandidate.addSdpmLineIndex
      );
      CandidateTable.addUsernameFragment(builder, usernameFragmentS);

      offsetPayload = CandidateTable.endCandidateTable(builder);
    }

    if (payloadString) {
      payloadType = events.Payload.StringPayload;
      const payloadS = builder.createString(payloadString);

      let StringPayload = events.StringPayload;

      StringPayload.startStringPayload(builder);
      StringPayload.addPayload(builder, payloadS);

      offsetPayload = StringPayload.endStringPayload(builder);
    }

    var userID = builder.createString(user);
    var roomID = builder.createString(room);

    Event.startEvent(builder);

    Event.addType(builder, eventType);
    Event.addTarget(builder, target);

    Event.addPayloadType(builder, payloadType);
    Event.addPayload(builder, offsetPayload);

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
                  const targetString =
                    event.target() === events.Target.Subscriber
                      ? "subscriber"
                      : "publisher";
                  console.log(`(${targetString}) ws signal type detected!`);

                  const candidate = event.payload(new events.CandidateTable());

                  const cand = new RTCIceCandidate({
                    candidate: candidate.candidate(),
                    sdpMid: candidate.sdpMid(),
                    sdpMLineIndex: candidate.sdpmLineIndex(),
                    usernameFragment: candidate.usernameFragment(),
                  });

                  if (event.target() === events.Target.Publisher) {
                    pcRefPub.current.addIceCandidate(cand);
                  }
                  if (event.target() === events.Target.Subscriber) {
                    if (pcRefSub.current.remoteDescription) {
                      pcRefSub.current.addIceCandidate(cand);
                    } else {
                      subCandidates.push(cand);
                    }
                  }
                  break;
                case events.Type.Offer:
                  console.log("(subscriber) offer detected");
                  const offer = event
                    .payload(new events.StringPayload())
                    .payload();
                  pcRefSub.current
                    .setRemoteDescription({
                      sdp: offer,
                      type: "offer",
                    })
                    .then(() => {
                      subCandidates.forEach((c) =>
                        pcRefSub.current.addIceCandidate(c)
                      );
                      subCandidates = [];
                      pcRefSub.current.createAnswer().then((a) => {
                        pcRefSub.current.setLocalDescription(a).then(() => {
                          const message = createMessage(
                            events.Type.Answer,
                            wsToken,
                            room,
                            a.sdp,
                            null,
                            events.Target.Subscriber
                          );
                          ws.send(message);
                        });
                      });
                    });
                  break;
                case events.Type.Answer:
                  //console.log("ws answer type detected!");

                  const answer = event
                    .payload(new events.StringPayload())
                    .payload();

                  pcRefPub.current.setRemoteDescription({
                    sdp: answer,
                    type: "answer",
                  });
                  break;
                default:
                  console.log("unknown message: ", event.type());
              }
            });

            ws.onopen = function () {
              pcRefPub.current = new RTCPeerConnection({
                iceServers: [
                  {
                    urls: "stun:stun.l.google.com:19302",
                  },
                ],
              });
              pcRefSub.current = new RTCPeerConnection({
                iceServers: [
                  {
                    urls: "stun:stun1.l.google.com:19302",
                  },
                ],
              });

              pcRefPub.current.onnegotiationneeded = function () {
                console.log("(publisher) Negotiation is needed!");
              };
              pcRefSub.current.onnegotiationneeded = function () {
                console.log("(subscriber) Negotiation is needed!");
              };

              pcRefPub.current.ontrack = function (event) {
                console.log("(publisher) adding track: ", event);
              };
              pcRefSub.current.ontrack = function (event) {
                console.log("(subscriber) adding track: ", event);

                event.streams[0].onremovetrack = ({ track }) => {
                  console.log("removing: ", track);
                };
              };

              pcRefPub.current.oniceconnectionstatechange = (e) => {
                console.log(
                  "(publisher) connection state change",
                  pcRefPub.current.iceConnectionState
                );
              };
              pcRefSub.current.oniceconnectionstatechange = (e) => {
                console.log(
                  "(subscriber) connection state change",
                  pcRefSub.current.iceConnectionState
                );
              };

              pcRefSub.current.ondatachannel = (ev) => {
                console.log("(subscriber) got new data channel request");
              };
              pcRefPub.current.ondatachannel = (ev) => {
                console.log("(publisher) got new data channel request");
              };

              pcRefPub.current.onicecandidate = (e) => {
                if (!e.candidate?.candidate) {
                  return;
                }
                const message = createMessage(
                  events.Type.Signal,
                  wsToken,
                  room,
                  null,
                  e.candidate,
                  events.Target.Publisher
                );
                ws.send(message);
              };
              pcRefSub.current.onicecandidate = (e) => {
                if (!e.candidate?.candidate) {
                  return;
                }
                const message = createMessage(
                  events.Type.Signal,
                  wsToken,
                  room,
                  null,
                  e.candidate,
                  events.Target.Subscriber
                );
                ws.send(message);
              };

              pcRefPub.current.createDataChannel("ion-sfu");

              stream.getTracks().forEach((track) =>
                pcRefPub.current.addTransceiver(track, {
                  streams: [stream],
                  direction: "sendonly",
                })
              );

              pcRefPub.current.createOffer().then((d) => {
                pcRefPub.current.setLocalDescription(d);
                const message = createMessage(
                  events.Type.Join,
                  wsToken,
                  room,
                  d.sdp,
                  null,
                  events.Target.Publisher
                );
                //console.log("new candidate: ", e.candidate.candidate);
                ws.send(message);
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
