import React, { useEffect, useCallback, useRef, useState } from 'react';
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

import { axiosApi } from './lib/axios';

registerGlobals();

const { Client, LocalStream } = require('ion-sdk-js');

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
  const { room } = route.params;

  const addStream = useStore(useCallback(state => state.addStream, []));
  const removeStream = useStore(useCallback(state => state.removeStream, []));
  const streams = useStore(useCallback(state => state.streams, []));
  const client = useStore(useCallback(state => state.client, []));
  const signal = useStore(useCallback(state => state.signal, []));
  const ready = useStore(useCallback(state => state.ready, []));
  const inRoom = useStore(useCallback(state => state.inRoom, []));
  const selfStream = useStore(useCallback(state => state.selfStream, []));
  const set = useStore(useCallback(state => state.set, []));

  const [roomToken, setRoomToken] = useState('');

  useEffect(() => {
    if (!signal) {
      return;
    }
    if (!ready) {
      return;
    }
    const joinRoom = async () => {
      await axiosApi
        .post(`/api/room/join/${room}`, { session: signal.session })
        .then(result => {
          setRoomToken(result.data);
        })
        .catch(error => {
          if (error.response.status === 404) {
            // room doesn't exist
          }
          if (error.response.data.includes('full')) {
            // room is full
          }
          // unknown error
        });
    };

    joinRoom();
  }, [room, signal, ready]);

  const loadIon = async roomToken => {
    const ionClient = new Client(signal, webrtcConfig);

    set(state => {
      state.client = ionClient;
    });

    await ionClient.join(roomToken, null);

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

  const loadIonRef = useRef(loadIon);

  useEffect(() => {
    navigation.setOptions({ headerTitle: room });
  }, [navigation, room]);

  useEffect(() => {
    if (!signal) {
      return;
    }
    if (roomToken === '') {
      return;
    }

    if (inRoom) {
      return;
    }

    loadIonRef.current(roomToken);
  }, [signal, roomToken, inRoom, set]);

  useEffect(() => {
    const cleanStream = selfStream;
    return function cleanup() {
      if (cleanStream) {
        cleanStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [selfStream]);

  useEffect(() => {
    const cleanClient = client;

    return function cleanup() {
      cleanClient && cleanClient.leave();
    };
  }, [client]);

  useEffect(() => {
    const cleanSignal = signal;

    return function cleanup() {
      cleanSignal && cleanSignal.leave();
    };
  }, [signal]);

  useEffect(() => {
    return function cleanup() {
      set(state => {
        state.inRoom = false;
      });
      set(state => {
        state.streams = [];
      });
      set(state => {
        state.selfStream = null;
      });
    };
  }, [set]);

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
