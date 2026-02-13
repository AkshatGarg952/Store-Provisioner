import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getStores = async () => {
  const response = await api.get('/stores');
  return response.data;
};

export const getStore = async (id) => {
  const response = await api.get(`/stores/${id}`);
  return response.data;
};

export const createStore = async (storeData) => {
  const response = await api.post('/stores', storeData);
  return response.data;
};

export const deleteStore = async (id) => {
  const response = await api.delete(`/stores/${id}`);
  return response.data;
};

export const getStoreEvents = async (id) => {
  const response = await api.get(`/stores/${id}/events`);
  return response.data;
};
