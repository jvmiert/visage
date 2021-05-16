import * as sdpTransform from "sdp-transform";
import { parseMessage, createMessage, events } from "../flatbuffers";

const Role = {
  pub: 0,
  sub: 1,
};

class IonSFUFlatbuffersSignal {
  constructor(room, wsToken) {
    this.socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WSURL}?token=${wsToken}`
    );

    /*

    todo:
    this.socket.onerror = function (event) {
    };

    */

    this.room = room;
    this.token = wsToken;

    this.pingTimeout = setInterval(() => {
      this.socket.send(0x9);
    }, (60000 * 9) / 10);

    this.socket.binaryType = "arraybuffer";

    this.socket.addEventListener("open", () => {
      if (this._onopen) this._onopen();
    });

    this.socket.addEventListener("error", (e) => {
      if (this._onerror) this._onerror(e);
    });

    this.socket.addEventListener("close", (e) => {
      if (this._onclose) this._onclose(e);
    });

    this.socket.addEventListener("message", async (evt) => {
      const event = parseMessage(evt.data);

      switch (event.type()) {
        case events.Type.Signal: {
          const candidate = event.payload(new events.CandidateTable());

          const cand = new RTCIceCandidate({
            candidate: candidate.candidate(),
            sdpMid: candidate.sdpMid(),
            sdpMLineIndex: candidate.sdpmLineIndex(),
            usernameFragment: candidate.usernameFragment(),
          });

          const target =
            event.target() === events.Target.Publisher ? Role.pub : Role.sub;

          this.ontrickle({ candidate: cand, target: target });
          break;
        }
        case events.Type.Offer: {
          const offerSDP = event.payload(new events.StringPayload()).payload();
          const offer = {
            sdp: offerSDP,
            type: "offer",
          };
          this.onnegotiate(offer);
          break;
        }
      }
    });
  }

  onnegotiate() {}
  ontrickle() {}

  async join(sid, uid, offer) {
    const message = createMessage(
      events.Type.Join,
      uid,
      sid,
      offer.sdp,
      null,
      events.Target.Publisher
    );

    // todo: handle error with reject
    return new Promise((resolve, reject) => {
      const handler = (evt) => {
        const event = parseMessage(evt.data);

        if (event.type() === events.Type.Answer) {
          const answer = event.payload(new events.StringPayload()).payload();
          resolve({
            sdp: answer,
            type: "answer",
          });
          this.socket.removeEventListener("message", handler);
        }
      };
      this.socket.addEventListener("message", handler);
      this.socket.send(message);
    });
  }

  trickle({ target, candidate }) {
    events.Target.Publisher;
    const message = createMessage(
      events.Type.Signal,
      this.token,
      this.room,
      null,
      candidate,
      target === Role.pub ? events.Target.Publisher : events.Target.Subscriber
    );
    this.socket.send(message);
  }

  async offer(offer) {
    let sdp = offer.sdp;

    // Force Firefox to use h264
    if (navigator.userAgent.includes("Firefox")) {
      let parsedOffer = sdpTransform.parse(offer.sdp);

      const videoIndex = parsedOffer.media.findIndex((e) => e.type === "video");

      const newList = parsedOffer.media[videoIndex].rtp.filter((e) => {
        if (e.codec.toUpperCase() !== "H264") {
          return false;
        }
        return e;
      });

      parsedOffer.media[videoIndex].rtp = newList;
      sdp = sdpTransform.write(parsedOffer);
    }

    const message = createMessage(
      events.Type.Join,
      this.token,
      this.room,
      sdp,
      null,
      events.Target.Publisher
    );

    // todo: handle error with reject
    return new Promise((resolve, reject) => {
      const handler = (evt) => {
        const event = parseMessage(evt.data);

        if (event.type() === events.Type.Answer) {
          const answer = event.payload(new events.StringPayload()).payload();
          resolve({
            sdp: answer,
            type: "answer",
          });
          this.socket.removeEventListener("message", handler);
        }
      };
      this.socket.addEventListener("message", handler);
      this.socket.send(message);
    });
  }

  answer(answer) {
    const message = createMessage(
      events.Type.Answer,
      this.token,
      this.room,
      answer.sdp,
      null,
      events.Target.Subscriber
    );
    this.socket.send(message);
  }

  close() {
    if (this.pingTimeout) {
      clearInterval(this.pingTimeout);
    }
    this.socket.readyState === WebSocket.OPEN && this.socket.close();
  }

  set onopen(onopen) {
    if (this.socket.readyState === WebSocket.OPEN) {
      onopen();
    }
    this._onopen = onopen;
  }
  set onerror(onerror) {
    this._onerror = onerror;
  }
  set onclose(onclose) {
    this._onclose = onclose;
  }
}

export { IonSFUFlatbuffersSignal };
