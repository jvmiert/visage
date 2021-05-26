import axios from 'axios';
import Config from 'react-native-config';

import useStore from './store';

const { token } = useStore.getState();

const axiosApi = axios.create({
  baseURL: Config.API_URL,
  timeout: 10000,
  withCredentials: false,
});

axiosApi.interceptors.request.use(
  config => {
    config.headers = {
      Authorization: token,
    };
    return config;
  },
  error => {
    Promise.reject(error);
  },
);

export { axiosApi };
