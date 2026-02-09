import axios from 'axios';

const API_URL = 'http://localhost:3000/api'; // Adjust if your backend runs on a different port

export const getStores = async () => {
  const response = await axios.get(`${API_URL}/stores`);
  return response.data;
};

export const getStore = async (id) => {
  const response = await axios.get(`${API_URL}/stores/${id}`);
  return response.data;
};

export const createStore = async (storeData) => {
  const response = await axios.post(`${API_URL}/stores`, storeData);
  return response.data;
};

export const deleteStore = async (id) => {
  const response = await axios.delete(`${API_URL}/stores/${id}`);
  return response.data;
};