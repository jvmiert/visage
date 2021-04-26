import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, Text, StyleSheet } from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';

import { createMessage, events, flatbuffers } from './lib/flatbuffers';

let pcPub;
let pcSub;
let subCandidates = [];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 20,
    fontWeight: 'bold',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
});

export default function Room({ route }) {
  const { room, wsToken } = route.params;
  const [loading, setLoading] = useState(true);

  const [remoteStream, setRemoteStream] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://192.168.1.137:8080/ws?room=${room}&token=${wsToken}`,
    );

    ws.onopen = () => {
      ws.binaryType = 'arraybuffer';
      console.log('WS connected!');

      mediaDevices
        .getUserMedia({
          audio: true,
          video: true,
        })
        .then(stream => {
          console.log('got stream');
          pcPub = new RTCPeerConnection({
            iceServers: [
              {
                urls: 'stun:stun.l.google.com:19302',
              },
            ],
            sdpSemantics: 'unified-plan',
          });
          pcSub = new RTCPeerConnection({
            iceServers: [
              {
                urls: 'stun:stun1.l.google.com:19302',
              },
            ],
            sdpSemantics: 'unified-plan',
          });

          // pcPub.oniceconnectionstatechange = e => {
          //   console.log(
          //     '(publisher) connection state change',
          //     pcPub.iceConnectionState,
          //   );
          // };
          // pcSub.oniceconnectionstatechange = e => {
          //   console.log(
          //     '(subscriber) connection state change',
          //     pcSub.iceConnectionState,
          //   );
          // };

          pcSub.onaddstream = function (event) {
            console.log('got new sub stream', event.stream);
            setRemoteStream(event.stream);
          };
          pcPub.onicecandidate = e => {
            if (!e.candidate?.candidate) {
              return;
            }
            //console.log('got pub candidate!', e.candidate?.candidate);
            const message = createMessage(
              events.Type.Signal,
              wsToken,
              room,
              null,
              e.candidate,
              events.Target.Publisher,
            );
            ws.send(message);
          };

          pcSub.onicecandidate = e => {
            if (!e.candidate?.candidate) {
              return;
            }
            //console.log('got sub candidate!', e.candidate?.candidate);
            const message = createMessage(
              events.Type.Signal,
              wsToken,
              room,
              null,
              e.candidate,
              events.Target.Subscriber,
            );
            ws.send(message);
          };

          pcPub.createDataChannel('ion-sfu');

          stream.getTracks().forEach(track => {
            //console.log('adding track: ', track);
            pcPub.addTransceiver(track, {
              streams: [stream],
              direction: 'sendonly',
            });
          });

          pcPub
            .createOffer()
            .then(d => {
              //console.log('new offer made: ', d.sdp);
              pcPub.setLocalDescription(d).then(() => {
                const message = createMessage(
                  events.Type.Join,
                  wsToken,
                  room,
                  d.sdp,
                  null,
                  events.Target.Publisher,
                );
                ws.send(message);
              });
            })
            .catch(error => console.log('offer error: ', error));
        })
        .catch(error => {
          console.log('CATCHING ERROR: ', error);
        });
    };

    ws.onmessage = e => {
      const bytes = new Uint8Array(e.data);
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

          //console.log('got candidate: ', cand.candidate);

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
          console.log('(subscriber) offer detected');
          let offer = event.payload(new events.StringPayload()).payload();
          pcSub
            .setRemoteDescription({
              sdp: offer,
              type: 'offer',
            })
            .then(() => {
              subCandidates.forEach(c => pcSub.addIceCandidate(c));
              subCandidates = [];
              pcSub.createAnswer().then(a => {
                pcSub.setLocalDescription(a).then(() => {
                  const message = createMessage(
                    events.Type.Answer,
                    wsToken,
                    room,
                    a.sdp,
                    null,
                    events.Target.Subscriber,
                  );
                  ws.send(message);
                });
              });
            });
          break;
        }
        case events.Type.Answer: {
          console.log('ws answer type detected!');

          const answer = event.payload(new events.StringPayload()).payload();

          pcPub.setRemoteDescription({
            sdp: answer,
            type: 'answer',
          });
          break;
        }
      }
    };

    ws.onerror = e => {
      console.log('ws error: ', e);
    };
    ws.onclose = e => {
      // connection closed
      console.log('ws on close: ', e);
    };

    return function cleanup() {
      console.log('cleaning up...!');
      ws.close();
      pcPub.close();
      pcSub.close();
    };
  }, [room, wsToken, setRemoteStream]);
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      {loading && <Text>Joining room...</Text>}
      {!loading && <Text style={styles.header}>{room}</Text>}
      {remoteStream && (
        <RTCView streamURL={remoteStream.toURL()} style={styles.video} />
      )}
    </SafeAreaView>
  );
}
