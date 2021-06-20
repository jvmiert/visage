/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, { useEffect, useCallback } from 'react';
import axios from 'axios';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SecureStore from 'expo-secure-store';

import Config from 'react-native-config';

import useStore from './lib/store';

import { axiosApi } from './lib/axios';

import { IonSFUFlatbuffersSignal } from './lib/ion';

import Home from './Home';
import Room from './Room';

const Stack = createStackNavigator();

const linking = {
  prefixes: ['visage://', 'https://visage.vanmiert.eu'],
  config: {
    screens: {
      Home: ':room',
    },
  },
};

function App() {
  const set = useStore(useCallback(state => state.set, []));
  const token = useStore(useCallback(state => state.token, []));

  useEffect(() => {
    async function getOrSetToken() {
      let storedToken = await SecureStore.getItemAsync(Config.TOKEN_KEY);
      if (storedToken) {
        set(state => {
          state.token = storedToken;
        });
      } else {
        axios
          .get(`${Config.API_URL}/api/token`)
          .then(result => {
            set(state => {
              state.token = storedToken;
            });
            SecureStore.setItemAsync(Config.TOKEN_KEY, result.data);
          })
          .catch(error => {
            console.log(error);
          });
      }
    }
    getOrSetToken();
  }, [set]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const connectSignal = async () => {
      await axiosApi.get('/api/user-token').then(result => {
        const signal = new IonSFUFlatbuffersSignal(
          result.data.userID,
          result.data.sessionID,
        );
        signal.onopen = () => {
          set(state => {
            state.signal = signal;
          });
        };
        signal.onready = () => {
          set(state => {
            state.ready = true;
          });
        };
      });
    };
    connectSignal();
  }, [set, token]);

  return (
    <NavigationContainer linking={linking} fallback={<Text>Loading...</Text>}>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          options={{ headerShown: false }}
          name="Home"
          component={Home}
          initialParams={{ room: null }}
        />
        <Stack.Screen name="Room" component={Room} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default App;
