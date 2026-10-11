import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) =>
    axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
};

const BroadcastServices = {
  generateCampaignQr: async (id, headers = {}) =>
    requests.post(`/broadcasts/${id}/qr/generate`, {}, { headers }),

  revokeCampaignQr: async (id, headers = {}) =>
    requests.post(`/broadcasts/${id}/qr/revoke`, {}, { headers }),

  runCampaignManually: async (id, headers = {}) =>
    requests.post(`/broadcasts/${id}/run`, {}, { headers }),

  listRecipientLists: async (params, headers = {}) =>
    requests.get("/broadcasts/lists", { params, headers }),

  getRecipientList: async (id, params, headers = {}) =>
    requests.get(`/broadcasts/lists/${id}`, { params, headers }),

  createRecipientList: async (data, headers = {}) =>
    requests.post("/broadcasts/lists", data, { headers }),

  updateRecipientList: async (id, data, headers = {}) =>
    requests.put(`/broadcasts/lists/${id}`, data, { headers }),

  deleteRecipientList: async (id, headers = {}) =>
    requests.delete(`/broadcasts/lists/${id}`, { headers }),

  exportRecipientList: async (id, headers = {}) =>
    requests.get(`/broadcasts/lists/${id}/members/export`, {
      responseType: "blob",
      headers,
    }),
};

export default BroadcastServices;
