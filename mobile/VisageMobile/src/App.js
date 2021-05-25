/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, { useEffect, useCallback } from 'react';
import axios from 'axios';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SecureStore from 'expo-secure-store';

import Config from 'react-native-config';

import useStore from './lib/store';

import Home from './Home';
import Room from './Room';

const Stack = createStackNavigator();

function App() {
  const set = useStore(useCallback(state => state.set, []));

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
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          options={{ headerShown: false }}
          name="Home"
          component={Home}
        />
        <Stack.Screen name="Room" component={Room} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default App;
