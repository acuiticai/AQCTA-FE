import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const getActivityTimeline = (params = {}) => {
  return axios.get(`${API_URL}/activity-timeline`, { params });
};
