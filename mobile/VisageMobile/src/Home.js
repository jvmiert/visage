import React, { useState, useCallback } from 'react';
import axios from 'axios';
import Config from 'react-native-config';
import {
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  StyleSheet,
  Button,
} from 'react-native';

import useStore from './lib/store';

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

  const token = useStore(useCallback(state => state.token, []));

  const joinRoom = () => {
    if (room === '') {
      return;
    }
    setLoading(true);
    axios
      .get(`${Config.API_URL}/api/room/join/${room}`)
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
