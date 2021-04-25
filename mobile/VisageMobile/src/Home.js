import React, { useState } from 'react';
import axios from 'axios';
import {
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  StyleSheet,
  Button,
} from 'react-native';

const styles = StyleSheet.create({
  input: {
    height: 40,
    width: '50%',
    margin: 12,
    backgroundColor: '#fff',
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
  const [room, setRoom] = useState('');
  const [loading, setLoading] = useState(false);

  const joinRoom = roomID => {
    navigation.navigate('Room', {
      room: 'poopies',
      wsToken: '1234',
    });
    return;
    if (roomID === '') {
      return;
    }
    setLoading(true);
    axios
      .get(`http://192.168.1.137:8080/api/room/join/${room}`)
      .then(result => {
        navigation.navigate('Room', {
          room: room,
          wsToken: result.data.wsToken,
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
          <Button title="Join" onPress={() => joinRoom(room)} />
        </>
      )}
    </SafeAreaView>
  );
}
