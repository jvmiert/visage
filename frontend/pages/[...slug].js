import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

import { useRouter } from "next/router";
import Link from "next/link";

import { Box } from "grommet";

import { createMessage, events, flatbuffers } from "../flatbuffers";
import VideoElement from "../components/VideoElement";

let subCandidates = [];
let pcPub;
let pcSub;

export default function RoomView({ data }) {
  const videoHost = useRef(null);
  const router = useRouter();
  const slug = router.query.slug || [];

  const invalidRoom = slug
    .join("/")
    .match(
      /[^A-Za-z0-9ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ-]+/g
    );

  if (invalidRoom) {
    return <p>404, not found</p>;
  }

  const room = slug.join("");
  const [state, setState] = useState({
    loading: data.loading,
    showVideo: data.showVideo,
    showThemVideo: false,
    full: data.full,
    error: false,
    notExist: false,
    isHost: data.isHost,
    wsToken: data.wsToken,
    streams: [],
  });

  const loadVideo = useCallback((room, wsToken) => {
    async function loadVideo() {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: true,
        })
        .then(
          (stream) => {
            const ws = new WebSocket(
              `${process.env.wsURL}?room=${room}&token=${wsToken}`
            );
            ws.binaryType = "arraybuffer";

            ws.addEventListener("message", function (evt) {
              const bytes = new Uint8Array(evt.data);
              const buffer = new flatbuffers.ByteBuffer(bytes);
              const event = events.Event.getRootAsEvent(buffer);

              switch (event.type()) {
                case events.Type.Signal: {
                  const candidate = event.payload(new events.CandidateTable());

                  const cand = new RTCIceCandidate({
                    candidate: candidate.candidate(),
                    sdpMid: candidate.sdpMid(),
                    sdpMLineIndex: candidate.sdpmLineIndex(),
                    usernameFragment: candidate.usernameFragment(),
                  });

                  if (event.target() === events.Target.Publisher) {
                    pcPub.addIceCandidate(cand);
                  }
                  if (event.target() === events.Target.Subscriber) {
                    if (pcSub.remoteDescription) {
                      pcSub.addIceCandidate(cand);
                    } else {
                      subCandidates.push(cand);
                    }
                  }
                  break;
                }
                case events.Type.Offer: {
                  //console.log("(subscriber) offer detected");
                  const offer = event
                    .payload(new events.StringPayload())
                    .payload();
                  pcSub
                    .setRemoteDescription({
                      sdp: offer,
                      type: "offer",
                    })
                    .then(() => {
                      subCandidates.forEach((c) => pcSub.addIceCandidate(c));
                      subCandidates = [];
                      pcSub.createAnswer().then((a) => {
                        pcSub.setLocalDescription(a).then(() => {
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
                }
                case events.Type.Answer: {
                  //console.log("ws answer type detected!");

                  const answer = event
                    .payload(new events.StringPayload())
                    .payload();

                  pcPub.setRemoteDescription({
                    sdp: answer,
                    type: "answer",
                  });
                  break;
                }
                default:
                  console.log("unknown message: ", event.type());
              }
            });

            ws.onopen = function () {
              pcPub = new RTCPeerConnection({
                iceServers: [
                  {
                    urls: "stun:stun.l.google.com:19302",
                  },
                ],
              });
              pcSub = new RTCPeerConnection({
                iceServers: [
                  {
                    urls: "stun:stun1.l.google.com:19302",
                  },
                ],
              });

              pcPub.onnegotiationneeded = function () {
                //console.log("(publisher) Negotiation is needed!");
              };
              pcSub.onnegotiationneeded = function () {
                //console.log("(subscriber) Negotiation is needed!");
              };

              pcPub.ontrack = function (event) {
                //console.log("(publisher) adding track: ", event);
              };
              pcSub.ontrack = function (event) {
                //console.log("(subscriber) adding track: ", event);
                if (event.track.kind === "audio") {
                  return;
                }

                event.streams[0].onremovetrack = ({ track }) => {
                  if (track.kind === "audio") {
                    return;
                  }
                  setState((prevState) => {
                    const newStreamList = prevState.streams.filter(
                      (strm) => strm.id !== event.streams[0].id
                    );
                    const showValue = newStreamList.length > 0;
                    return {
                      ...prevState,
                      ...{
                        showThemVideo: showValue,
                        streams: newStreamList,
                      },
                    };
                  });
                };

                setState((prevState) => {
                  const newStreamList = prevState.streams.concat(
                    event.streams[0]
                  );
                  const showValue = newStreamList.length > 0;
                  return {
                    ...prevState,
                    ...{
                      showThemVideo: showValue,
                      streams: newStreamList,
                    },
                  };
                });
              };

              // pcPub.oniceconnectionstatechange = (e) => {
              //   console.log(
              //     "(publisher) connection state change",
              //     pcPub.iceConnectionState
              //   );
              // };
              // pcSub.oniceconnectionstatechange = (e) => {
              //   console.log(
              //     "(subscriber) connection state change",
              //     pcSub.iceConnectionState
              //   );
              // };

              pcSub.ondatachannel = (ev) => {
                //console.log("(subscriber) got new data channel request");
                ev.channel.onmessage = (e) => {
                  //console.log(JSON.parse(e.data));
                };
              };
              pcPub.ondatachannel = (ev) => {
                //console.log("(publisher) got new data channel request");
              };

              pcPub.onicecandidate = (e) => {
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
              pcSub.onicecandidate = (e) => {
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

              pcPub.createDataChannel("ion-sfu");

              stream.getTracks().forEach((track) =>
                pcPub.addTransceiver(track, {
                  streams: [stream],
                  direction: "sendonly",
                })
              );

              pcPub.createOffer().then((d) => {
                pcPub.setLocalDescription(d);
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

  const closeWS = useCallback(() => {
    pcPub.close();
    pcSub.close();
  }, []);

  useEffect(() => {
    if (data.wsToken) {
      loadVideo(room, data.wsToken);
    }

    return () => {
      closeWS();
    };
  }, [room, loadVideo, closeWS, data]);

  return (
    <div>
      <p>{room}</p>
      {state.loading && <p>Loading...</p>}
      {(state.notExist || state.full) && (
        <p>
          Sorry, this room {state.notExist ? "does not exist." : "is full."}{" "}
          <Link href="/">Go Home</Link>
        </p>
      )}
      <p>You:</p>
      <div>
        {state.showVideo && (
          <div>
            <Box
              as={"video"}
              ref={videoHost}
              autoPlay
              playsInline
              muted
              round={"xsmall"}
              elevation={"small"}
            />
          </div>
        )}
      </div>
      <p>Them:</p>
      <div>
        {state.streams.map((stream) => (
          <div key={stream.id}>
            <VideoElement srcObject={stream} autoPlay playsInline muted />
          </div>
        ))}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const room = context.query.slug.join("");

  let data = {};

  await axios
    .get(`http://localhost:8080/api/room/join/${room}`)
    .then((result) => {
      if (!result.data.joinable) {
        data = {
          loading: false,
          full: true,
        };
        return;
      }
      data = {
        showVideo: true,
        wsToken: result.data.wsToken,
        isHost: result.data.isHost,
      };
    })
    .catch((error) => {
      if (error.response.status === 404) {
        data = { notExist: true };
      }

      data.loading = false;
    });
  return { props: { data } };
}
