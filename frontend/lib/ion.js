import axios from "axios";
import * as sdpTransform from "sdp-transform";
import { Type } from "../flatbuffers/type";
import { Target } from "../flatbuffers/target";
import { StringPayload } from "../flatbuffers/string-payload";
import { CandidateTable } from "../flatbuffers/candidate-table";
import { LatencyPayload } from "../flatbuffers/latency-payload";

import {
  serializeJoin,
  serializeAnswer,
  serializeTrickle,
  getEventRoot,
  serializeLatency,
} from "../flatbuffers/flatutils";

const Role = {
  pub: 0,
  sub: 1,
};

class IonSFUFlatbuffersSignal {
  constructor(wsToken) {
    this.token = wsToken;

    this.checkTimes = 5;
    this.latencySequence = 0;
    this.latencySent = {};
    this.latencyResult = [];

    this.locations = [];

    this.locationResults = [];

    this.fetchLocations = () => {
      return new Promise((resolve) => {
        axios.get("/api/locations").then((result) => {
          this.locations = result.data;
          resolve();
        });
      });
    };

    this.checkLatency = (checkTimes) => {
      return new Promise((resolve) => {
        this.latencyResolve = resolve;
        for (let i = 0; i < checkTimes; i++) {
          const latencySerialized = serializeLatency(
            Date.now(),
            this.latencySequence
          );
          this.latencySent[this.latencySequence] = performance.now();
          this.socket.send(latencySerialized);
          this.latencySequence += 1;
        }
      });
    };

    this.handleMessage = async (evt) => {
      const event = getEventRoot(evt.data);

      switch (event.type()) {
        case Type.Signal: {
          const candidate = event.payload(new CandidateTable());

          const cand = new RTCIceCandidate({
            candidate: candidate.candidate(),
            sdpMid: candidate.sdpMid(),
            sdpMLineIndex: candidate.sdpmLineIndex(),
            usernameFragment: candidate.usernameFragment(),
          });

          const target =
            event.target() === Target.Publisher ? Role.pub : Role.sub;

          this.ontrickle({ candidate: cand, target: target });
          break;
        }
        case Type.Offer: {
          const offerSDP = event.payload(new StringPayload()).payload();
          const offer = {
            sdp: offerSDP,
            type: "offer",
          };
          this.onnegotiate(offer);
          break;
        }
        case Type.Latency: {
          const latency = event.payload(new LatencyPayload());
          const result = performance.now() - this.latencySent[latency.id()];
          this.latencyResult.push(result);
          if (this.latencyResult.length === this.checkTimes) {
            const sum = this.latencyResult.reduce((a, b) => a + b, 0);
            const avg = sum / this.latencyResult.length || 0;
            this.locationResults.push({ server: this.currentServer, avg: avg });
            this.latencySequence = 0;
            this.latencySent = {};
            this.latencyResult = [];
            this.latencyResolve();
          }
          break;
        }
      }
    };

    this.connect = async (server) => {
      return new Promise((resolve) => {
        this.socket = new WebSocket(`${server}?token=${wsToken}`);

        this.socket.binaryType = "arraybuffer";

        this.socket.addEventListener("open", () => {
          resolve();
          this.pingTimeout = setInterval(() => {
            this.socket.send(0x9);
          }, (60000 * 9) / 10);
          if (this._onopen) this._onopen();
        });

        this.socket.addEventListener("error", (e) => {
          if (this._onerror) this._onerror(e);
        });

        this.socket.addEventListener("close", (e) => {
          this.pingTimeout && clearInterval(this.pingTimeout);
          if (this._onclose) this._onclose(e);
        });

        this.socket.addEventListener("message", this.handleMessage);
      });
    };

    this.selectLocation = async () => {
      await this.fetchLocations();
      for (const location of this.locations) {
        this.currentServer = location;
        await this.connect(location);
        await this.checkLatency(this.checkTimes);
        this.socket.close();
      }
      this.locationResults.sort((a, b) => a.avg - b.avg);
      this.connect(this.locationResults[0].server);
    };

    this.selectLocation();
  }

  onnegotiate() {}
  ontrickle() {}

  async join(sid, uid, offer) {
    this.joinToken = sid;
    const message = serializeJoin(offer.sdp, sid);

    return new Promise((resolve) => {
      const handler = (evt) => {
        const event = getEventRoot(evt.data);

        if (event.type() === Type.Answer) {
          const answer = event.payload(new StringPayload()).payload();
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
    const message = serializeTrickle(
      candidate,
      target === Role.pub ? Target.Publisher : Target.Subscriber
    );
    this.socket.send(message);
  }

  async offer(offer) {
    let sdp = offer.sdp;

    // Force Firefox to use h264
    if (navigator.userAgent.includes("Firefox")) {
      let parsedOffer = sdpTransform.parse(offer.sdp);

      const videoIndex = parsedOffer.media.findIndex((e) => e.type === "video");

      let newPayloads = [];

      const newList = parsedOffer.media[videoIndex].rtp.filter((e) => {
        if (e.codec.toUpperCase() !== "H264") {
          return false;
        }
        newPayloads.push(e.payload);
        return e;
      });

      parsedOffer.media[videoIndex].rtp = newList;
      parsedOffer.media[videoIndex].payloads = newPayloads.join(" ");
      sdp = sdpTransform.write(parsedOffer);
    }

    const message = serializeJoin(sdp, this.joinToken);

    return new Promise((resolve) => {
      const handler = (evt) => {
        const event = getEventRoot(evt.data);

        if (event.type() === Type.Answer) {
          const answer = event.payload(new StringPayload()).payload();
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
    const message = serializeAnswer(answer);
    this.socket.send(message);
  }

  close() {
    if (this.pingTimeout) {
      clearInterval(this.pingTimeout);
    }
    this.socket &&
      this.socket.readyState === WebSocket.OPEN &&
      this.socket.close();
  }

  set onopen(onopen) {
    if (this?.socket?.readyState === WebSocket.OPEN) {
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
