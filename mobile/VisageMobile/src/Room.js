import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { RTCView, registerGlobals } from 'react-native-webrtc';

import useStore from './lib/store';

registerGlobals();

const { Client, LocalStream } = require('ion-sdk-js');
import { IonSFUFlatbuffersSignal } from './lib/ion';

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

const webrtcConfig = {
  codec: 'h264',
  sdpSemantics: 'unified-plan',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function Room({ route }) {
  const { room, wsToken } = route.params;

  const addStream = useStore(useCallback(state => state.addStream, []));
  const removeStream = useStore(useCallback(state => state.removeStream, []));
  const streams = useStore(useCallback(state => state.streams, []));

  const loadIon = useCallback(
    async (roomParam, token) => {
      const signal = new IonSFUFlatbuffersSignal(roomParam, token);
      const client = new Client(signal, webrtcConfig);

      signal.onopen = async () => {
        await client.join(roomParam, token);

        const local = await LocalStream.getUserMedia({
          resolution: 'hd',
          codec: 'h264',
          audio: true,
          video: true,
          simulcast: true, // enable simulcast
        });

        client.publish(local);

        client.transports[1].pc.onaddstream = (e: any) => {
          //console.log('on add stream: ', e.stream);
          addStream(e.stream);
        };

        client.transports[1].pc.onremovestream = (e: any) => {
          //console.log('on remove stream', e.stream);
          removeStream(e.stream);
        };
      };
    },
    [addStream, removeStream],
  );

  useEffect(() => {
    loadIon(room, wsToken);
  }, [room, wsToken, loadIon]);
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      {streams.map(s => (
        <RTCView key={s.toURL()} streamURL={s.toURL()} style={styles.video} />
      ))}
    </SafeAreaView>
  );
}
