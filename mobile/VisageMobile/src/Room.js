import React, { useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  Text,
  StyleSheet,
  View,
  Dimensions,
} from 'react-native';

import { useKeepAwake } from 'expo-keep-awake';

import { RTCView, registerGlobals } from 'react-native-webrtc';

import { useHeaderHeight } from '@react-navigation/stack';

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
  videoLarge: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 1,
  },
  borderContainer: {
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: 'black',
    flex: 1,
  },
  itemContainer: {
    padding: 5,
  },
  videoSelfContainer: {
    height: 100,
    width: 70,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'black',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.8,
    shadowRadius: 1.41,
  },
  selfContainer: {
    position: 'absolute',
    right: 10,
    overflow: 'hidden',
  },
});

const webrtcConfig = {
  codec: 'h264',
  sdpSemantics: 'unified-plan',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function Room({ route, navigation }) {
  useKeepAwake();
  const headerHeight = useHeaderHeight();
  const { room, wsToken } = route.params;

  const addStream = useStore(useCallback(state => state.addStream, []));
  const removeStream = useStore(useCallback(state => state.removeStream, []));
  const streams = useStore(useCallback(state => state.streams, []));
  const client = useStore(useCallback(state => state.client, []));
  const signal = useStore(useCallback(state => state.signal, []));
  const selfStream = useStore(useCallback(state => state.selfStream, []));
  const set = useStore(useCallback(state => state.set, []));

  const loadIon = async () => {
    const ionSignal = new IonSFUFlatbuffersSignal(room, wsToken);
    const ionClient = new Client(ionSignal, webrtcConfig);

    set(state => {
      state.client = ionClient;
    });

    set(state => {
      state.signal = ionSignal;
    });

    ionSignal.onopen = async () => {
      await ionClient.join(room, wsToken);

      const local = await LocalStream.getUserMedia({
        resolution: 'hd',
        codec: 'h264',
        audio: true,
        video: true,
        simulcast: true, // enable simulcast
      });

      ionClient.publish(local);

      set(state => {
        state.selfStream = local;
      });

      ionClient.transports[1].pc.onaddstream = (e: any) => {
        //console.log('on add stream: ', e);
        addStream(e.stream);
      };

      ionClient.transports[1].pc.onremovestream = (e: any) => {
        //console.log('on remove stream', e.stream);
        removeStream(e.stream);
      };
    };
  };

  const loadIonRef = useRef(loadIon);

  useEffect(() => {
    navigation.setOptions({ headerTitle: room });
  }, [navigation, room]);

  useEffect(() => {
    loadIonRef.current();
  }, []);

  useEffect(() => {
    return () => {
      if (signal?.connected) {
        client.leave();
        signal.close();
        set(state => {
          state.selfStream = null;
        });
        set(state => {
          state.streams = [];
        });
      }
    };
  }, [client, signal, set]);

  const getWidth = useCallback(() => {
    const participants = streams.length;

    if (participants < 3) {
      return '100%';
    }
    if (participants > 2) {
      return '50%';
    }
  }, [streams]);

  return (
    <SafeAreaView>
      <StatusBar />
      {selfStream && (
        <View
          style={[
            styles.selfContainer,
            {
              top:
                windowHeight -
                headerHeight -
                StatusBar.currentHeight -
                100 -
                10,
            },
          ]}>
          <View style={styles.videoSelfContainer}>
            <RTCView
              objectFit="cover"
              streamURL={selfStream.toURL()}
              style={styles.video}
              zOrder={1}
            />
          </View>
        </View>
      )}
      <View style={styles.container}>
        {streams.length > 0 && streams.length < 2 && (
          <RTCView
            objectFit="cover"
            zOrder={0}
            streamURL={streams[0].toURL()}
            style={[
              styles.videoLarge,
              { height: windowHeight - headerHeight, width: windowWidth },
            ]}
          />
        )}
        {streams.length > 1 &&
          streams.map(s => (
            <View
              key={s.toURL()}
              style={[
                styles.itemContainer,
                {
                  height:
                    (windowHeight - headerHeight - StatusBar.currentHeight) / 2,
                  width: getWidth(),
                },
              ]}>
              <View style={styles.borderContainer}>
                <RTCView
                  objectFit="cover"
                  streamURL={s.toURL()}
                  style={styles.video}
                  zOrder={0}
                />
              </View>
            </View>
          ))}
      </View>
    </SafeAreaView>
  );
}
