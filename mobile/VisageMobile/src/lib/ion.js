import Config from 'react-native-config';
import * as sdpTransform from 'sdp-transform';
import { parseMessage, createMessage, events } from './flatbuffers';

const Role = {
  pub: 0,
  sub: 1,
};

class IonSFUFlatbuffersSignal {
  constructor(room, wsToken) {
    this.connected = false;
    this.socket = new WebSocket(
      `${Config.API_URL}/ws?room=${room}&token=${wsToken}`,
    );

    this.room = room;
    this.token = wsToken;

    this.pingTimeout = setInterval(() => {
      this.socket.send('9');
    }, (60000 * 9) / 10);

    this.socket.binaryType = 'arraybuffer';

    this.socket.addEventListener('open', () => {
      this.connected = true;
      if (this._onopen) this._onopen();
    });

    this.socket.addEventListener('error', e => {
      this.connected = false;
      if (this._onerror) this._onerror(e);
    });

    this.socket.addEventListener('close', e => {
      this.connected = false;
      if (this._onclose) this._onclose(e);
    });

    this.socket.addEventListener('message', async evt => {
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
          let offerSDP = event.payload(new events.StringPayload()).payload();
          // added this to allow chrome -> android h264
          offerSDP = offerSDP.split('42001f').join('42e034');
          const offer = {
            sdp: offerSDP,
            type: 'offer',
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
      events.Target.Publisher,
    );

    // todo: handle error with reject
    return new Promise((resolve, reject) => {
      const handler = evt => {
        const event = parseMessage(evt.data);

        if (event.type() === events.Type.Answer) {
          const answer = event.payload(new events.StringPayload()).payload();
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
    events.Target.Publisher;
    const message = createMessage(
      events.Type.Signal,
      this.token,
      this.room,
      null,
      candidate,
      target === Role.pub ? events.Target.Publisher : events.Target.Subscriber,
    );
    this.socket.send(message);
  }

  async offer(offer) {
    let parsedOffer = sdpTransform.parse(offer.sdp);

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

    //console.log(JSON.stringify(offer.sdp, null, 2));

    const message = createMessage(
      events.Type.Join,
      this.token,
      this.room,
      //offer.sdp,
      sdp,
      null,
      events.Target.Publisher,
    );

    // todo: handle error with reject
    return new Promise((resolve, reject) => {
      const handler = evt => {
        const event = parseMessage(evt.data);

        if (event.type() === events.Type.Answer) {
          const answer = event.payload(new events.StringPayload()).payload();
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
    const message = createMessage(
      events.Type.Answer,
      this.token,
      this.room,
      answer.sdp,
      null,
      events.Target.Subscriber,
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
