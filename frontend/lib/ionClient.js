import { createMessage, events, flatbuffers } from "../flatbuffers";

function handleWS(evt, pcPub, pcSub, subCandidates, wsToken, room, ws) {
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
      const offer = event.payload(new events.StringPayload()).payload();
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

      const answer = event.payload(new events.StringPayload()).payload();

      pcPub.setRemoteDescription({
        sdp: answer,
        type: "answer",
      });
      break;
    }
    default:
      console.log("unknown message: ", event.type());
  }
}

const loadClient = async function load(
  subCandidates,
  pcPub,
  pcSub,
  setState,
  room,
  wsToken,
  loadStream
) {
  const ws = new WebSocket(
    `${process.env.wsURL}?room=${room}&token=${wsToken}`
  );
  ws.binaryType = "arraybuffer";

  ws.addEventListener("message", (evt) =>
    handleWS(evt, pcPub, pcSub, subCandidates, wsToken, room, ws)
  );

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
            (strm) => strm.stream.id !== event.streams[0].id
          );
          return {
            ...prevState,
            ...{
              streams: newStreamList,
            },
          };
        });
      };

      setState((prevState) => {
        const newStreamList = prevState.streams.concat({
          stream: event.streams[0],
          muted: false,
          menuActive: false,
          isFull: false,
        });
        //console.log("New stream list: ", newStreamList);
        return {
          ...prevState,
          ...{
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

    loadStream.getTracks().forEach((track) => {
      //console.log("adding track: ", track);
      const trans = pcPub.addTransceiver(track, {
        streams: [loadStream],
        direction: "sendonly",
      });
      if (track.kind === "video") {
        if ("setCodecPreferences" in trans) {
          const cap = RTCRtpSender.getCapabilities("video");
          if (!cap) return;

          const allCodecProfiles = cap.codecs.filter(
            (c) => c.mimeType.toLowerCase() === `video/vp8`
          );

          const selCodec = allCodecProfiles[0];
          trans.setCodecPreferences([selCodec]);
        }
      }
    });

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
    setState((prevState) => {
      const newStreamList = prevState.streams.concat({
        stream: loadStream,
        muted: true,
        menuActive: false,
        isFull: false,
      });
      return {
        ...prevState,
        ...{
          streams: newStreamList,
          loading: false,
        },
      };
    });
  };
};

export { loadClient };
