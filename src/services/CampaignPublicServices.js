import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CampaignPublicServices = {
  getContext: async (token) =>
    axios.get(`${Base_URL}/public/broadcasts/qr/${token}`),

  submitSignup: async (token, payload) =>
    axios.post(`${Base_URL}/public/broadcasts/qr/${token}/signup`, payload),
};

export default CampaignPublicServices;
