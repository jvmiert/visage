import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  Text,
  StyleSheet,
  ScrollView,
  View,
  Dimensions,
} from 'react-native';

import { RTCView, registerGlobals } from 'react-native-webrtc';

import useStore from './lib/store';

registerGlobals();

const { Client, LocalStream } = require('ion-sdk-js');
import { IonSFUFlatbuffersSignal } from './lib/ion';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  header: {
    marginBottom: 20,
    fontWeight: 'bold',
  },
  video: {
    flex: 1,
  },
  borderContainer: {
    overflow: 'hidden',
    borderRadius: 20,
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  itemContainer: {
    width: windowWidth,
    //height: windowWidth / 2,
    padding: 8,
    aspectRatio: 1.7778,
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
  const client = useStore(useCallback(state => state.client, []));
  const set = useStore(useCallback(state => state.set, []));

  const loadIon = useCallback(
    async (roomParam, token) => {
      const signal = new IonSFUFlatbuffersSignal(roomParam, token);
      const ionClient = new Client(signal, webrtcConfig);

      set(state => {
        state.client = ionClient;
      });

      signal.onopen = async () => {
        await ionClient.join(roomParam, token);

        const local = await LocalStream.getUserMedia({
          resolution: 'hd',
          codec: 'h264',
          audio: true,
          video: true,
          simulcast: true, // enable simulcast
        });

        ionClient.publish(local);

        ionClient.transports[1].pc.onaddstream = (e: any) => {
          //console.log('on add stream: ', e);
          addStream(e.stream);
        };

        ionClient.transports[1].pc.onremovestream = (e: any) => {
          //console.log('on remove stream', e.stream);
          removeStream(e.stream);
        };
      };
    },
    [addStream, removeStream, set],
  );

  useEffect(() => {
    loadIon(room, wsToken);
  }, [room, wsToken, loadIon]);

  useEffect(() => {
    const cleanClient = client;

    return function cleanup() {
      if (cleanClient) {
        cleanClient.close();
        set(state => {
          state.client = null;
        });
        set(state => {
          state.streams = [];
        });
      }
    };
  }, [client, set]);

  return (
    <SafeAreaView>
      <StatusBar />
      <Text>{streams.length}</Text>
      <View style={styles.container}>
        {streams.map(s => (
          <View key={s.toURL()} style={styles.itemContainer}>
            <View style={styles.borderContainer}>
              <RTCView
                objectFit="contain"
                streamURL={s.toURL()}
                style={styles.video}
              />
            </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
