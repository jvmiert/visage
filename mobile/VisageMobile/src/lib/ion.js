import * as sdpTransform from 'sdp-transform';
import { Type } from './flatbuffers/type';
import { Target } from './flatbuffers/target';
import { StringPayload } from './flatbuffers/string-payload';
import { CandidateTable } from './flatbuffers/candidate-table';
import { LatencyPayload } from './flatbuffers/latency-payload';

import { axiosApi } from './axios';

import {
  serializeJoin,
  serializeAnswer,
  serializeTrickle,
  getEventRoot,
  serializeLatency,
  serializeLeave,
  serializeOffer,
} from './flatbuffers/flatutils';

const Role = {
  pub: 0,
  sub: 1,
};

class IonSFUFlatbuffersSignal {
  constructor(wsToken, session) {
    this.token = wsToken;
    this.session = session;

    this.sendQueue = [];
    this.ready = false;

    this.checkTimes = 5;
    this.latencySequence = 0;
    this.latencySent = {};
    this.latencyResult = [];

    this.locations = [];

    this.locationResults = [];

    this.fetchLocations = () => {
      return new Promise(resolve => {
        axiosApi.get('/api/locations').then(result => {
          this.locations = result.data;
          resolve();
        });
      });
    };

    this.checkLatency = checkTimes => {
      return new Promise(resolve => {
        this.latencyResolve = resolve;
        for (let i = 0; i < checkTimes; i++) {
          const latencySerialized = serializeLatency(
            Date.now(),
            this.latencySequence,
          );
          this.latencySent[this.latencySequence] = performance.now();
          this.socket.send(latencySerialized);
          this.latencySequence += 1;
        }
      });
    };

    this.handleMessage = async evt => {
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
          let offerSDP = event.payload(new StringPayload()).payload();
          //.replace(/profile-level-id=42[0-9a-zA-Z]{4}$/gm, "profile-level-id=42e01f")
          offerSDP = offerSDP.split('640c33').join('42e01f');
          const offer = {
            sdp: offerSDP,
            type: 'offer',
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
            this.locationResults.push({ info: this.nodeInfo, avg: avg });
            this.latencySequence = 0;
            this.latencySent = {};
            this.latencyResult = [];
            this.latencyResolve();
          }
          break;
        }
      }
    };

    this.connect = async (server, check) => {
      return new Promise(resolve => {
        this.socket = new WebSocket(
          `${server}?token=${wsToken}&session=${this.session}&check=${check}`,
        );

        this.socket.binaryType = 'arraybuffer';

        this.socket.addEventListener('open', () => {
          resolve();
          this.pingTimeout = setInterval(() => {
            this.socket.send('9');
          }, (60000 * 9) / 10);
          if (this._onopen) this._onopen();
        });

        this.socket.addEventListener('error', e => {
          console.log('error!', e);
          if (this._onerror) this._onerror(e);
        });

        this.socket.addEventListener('close', e => {
          this.pingTimeout && clearInterval(this.pingTimeout);
          if (this._onclose) this._onclose(e);
        });

        this.socket.addEventListener('message', this.handleMessage);
      });
    };

    this.selectLocation = async () => {
      for (const location of this.locations) {
        this.nodeInfo = location;
        await this.connect(location.nodeURL, true);
        await this.checkLatency(this.checkTimes);
        this.socket.close();
      }
      this.locationResults.sort((a, b) => a.avg - b.avg);

      await this.connect(this.locationResults[0].info.nodeURL, false);
    };

    this.init = async () => {
      await this.fetchLocations();
      if (this.locations.length > 1) {
        await this.selectLocation();
      } else {
        await this.connect(this.locations[0].nodeURL, false);
      }
      this.ready = true;
      if (this._onready) this._onready();
      this.clearQueue();
    };

    this.init();
  }

  clearQueue() {
    while (this.sendQueue.length > 0) {
      const message = this.sendQueue.shift();
      this.socket.send(message);
    }
  }

  onnegotiate() {}
  ontrickle() {}

  async join(sid, uid, offer) {
    this.joinToken = sid;
    const message = serializeJoin(offer.sdp, sid);

    return new Promise(resolve => {
      const handler = evt => {
        const event = getEventRoot(evt.data);

        if (event.type() === Type.Answer) {
          const answer = event.payload(new StringPayload()).payload();
          resolve({
            sdp: answer,
            type: 'answer',
          });
          this.socket.removeEventListener('message', handler);
        }
      };
      this.socket.addEventListener('message', handler);
      this.socket.send(message);
    });
  }

  trickle({ target, candidate }) {
    const message = serializeTrickle(
      candidate,
      target === Role.pub ? Target.Publisher : Target.Subscriber,
    );
    if (this.ready) {
      this.socket.send(message);
    } else {
      this.sendQueue.push(message);
    }
  }

  async offer(offer) {
    offer.sdp = offer.sdp.split('640c33').join('42e01f');
    //.replace(/profile-level-id=42[0-9a-zA-Z]{4}$/gm, "profile-level-id=42e01f")

    let parsedOffer = sdpTransform.parse(offer.sdp);
    //console.log(JSON.stringify(parsedOffer.media));

    const videoIndex = parsedOffer.media.findIndex(e => e.type === 'video');

    let newPayloads = [];

    const newList = parsedOffer.media[videoIndex].rtp.filter(e => {
      if (e.codec.toUpperCase() !== 'H264') {
        return false;
      }
      newPayloads.push(e.payload);
      return e;
    });

    if (newPayloads.length > 0) {
      parsedOffer.media[videoIndex].rtp = newList;
      parsedOffer.media[videoIndex].payloads = newPayloads.join(' ');
    }
    const sdp = sdpTransform.write(parsedOffer);

    const message = serializeOffer(sdp);

    return new Promise(resolve => {
      const handler = evt => {
        const event = getEventRoot(evt.data);

        if (event.type() === Type.Answer) {
          const answer = event.payload(new StringPayload()).payload();
          resolve({
            sdp: answer,
            type: 'answer',
          });
          this.socket.removeEventListener('message', handler);
        }
      };
      this.socket.addEventListener('message', handler);
      this.socket.send(message);
    });
  }

  answer(answer) {
    answer.sdp = answer.sdp.split('42e01f').join('640c33');
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

  leave() {
    const message = serializeLeave();
    this.socket.send(message);
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
  set onready(onready) {
    this._onready = onready;
  }
}

export { IonSFUFlatbuffersSignal };
