import React, { useState, useEffect } from 'react';
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

export default function Home({ navigation }) {
  const [room, setRoom] = useState('poopies');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(false);
    });

    return unsubscribe;
  }, [navigation]);

  const joinRoom = () => {
    if (room === '') {
      return;
    }
    setLoading(true);
    axiosApi
      .get(`/api/room/join/${room}`)
      .then(result => {
        navigation.navigate('Room', {
          room: 'poopies',
          wsToken: result.data,
        });
      })
      .catch(error => {
        setLoading(false);
        console.log(error);
      });
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <Text style={styles.header}>Welcome to Visage</Text>

      {loading ? (
        <Text>Loading room: {room}...</Text>
      ) : (
        <>
          <Text>Input a room you want to join: </Text>
          <TextInput
            style={styles.input}
            value={room}
            onChangeText={text => setRoom(text)}
          />
          <Button title="Join" onPress={() => joinRoom()} />
        </>
      )}
    </SafeAreaView>
  );
}
