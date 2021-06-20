import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  StyleSheet,
  Button,
} from 'react-native';

import { axiosApi } from './lib/axios';

const styles = StyleSheet.create({
  input: {
    height: 40,
    width: '50%',
    margin: 12,
    backgroundColor: '#fff',
    color: '#000',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 20,
    fontWeight: 'bold',
  },
});

export default function Home({ route, navigation }) {
  const [roomInput, setRoomInput] = useState('poopies');
  const [loading, setLoading] = useState(false);

  const { room } = route.params;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(false);
    });

    return unsubscribe;
  }, [navigation]);

  const joinRoom = useCallback(
    roomToJoin => {
      if (roomToJoin === '') {
        return;
      }
      setLoading(true);

      axiosApi
        .post(`/api/room/create/${roomToJoin}`)
        .then(result => {
          navigation.navigate('Room', {
            room: roomToJoin,
          });
        })
        .catch(error => {
          if (error.response.data.includes('exists')) {
            navigation.navigate('Room', {
              room: roomToJoin,
            });
          } else {
            setLoading(false);
            console.log(error, error.response.data);
          }
        });
    },
    [navigation],
  );

  useEffect(() => {
    if (room) {
      joinRoom(room);
    }
  }, [room, joinRoom]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <Text style={styles.header}>Welcome to Visage</Text>

      {loading ? (
        <Text>Loading room: {roomInput}...</Text>
      ) : (
        <>
          <Text>Input a room you want to join: </Text>
          <TextInput
            style={styles.input}
            value={roomInput}
            onChangeText={text => setRoomInput(text)}
          />
          <Button title="Join" onPress={() => joinRoom(roomInput)} />
        </>
      )}
    </SafeAreaView>
  );
}
