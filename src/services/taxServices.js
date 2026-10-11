import axios from 'axios';

const API_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const getTaxes = (business) => {
  return axios.get(`${API_URL}/taxes?business=${business}`);
};

export const getTax = (id) => {
  return axios.get(`${API_URL}/taxes/${id}`);
};

export const createTax = (taxData) => {
  return axios.post(`${API_URL}/taxes`, taxData);
};

export const updateTax = (id, taxData) => {
  return axios.put(`${API_URL}/taxes/${id}`, taxData);
};

export const deleteTax = (id) => {
  return axios.delete(`${API_URL}/taxes/${id}`);
};