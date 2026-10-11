import requests from "./httpService";

const ConfigurationServices = {
  getConfigurationById: async (id) => {
    return requests.get(`configuration/${id}`);
  },
  getAllConfigurations: async () => {
    return requests.get("configuration");
  },
  updateConfiguration: async (id, data) => {
    return requests.put(`configuration/${id}`, data);
  },
  deleteConfiguration: async (id) => {
    return requests.delete(`configuration/${id}`);
  },
  // New methods for user configuration
  getUserConfiguration: async (email) => {
    return requests.get(`configuration/user/${email}`);
  },
  updateUserConfiguration: async (email, data) => {
    return requests.put(`configuration/user/${email}`, data);
  },
  // 2FA methods
  enable2FA: async (email) => {
    return requests.post(`configuration/2fa/enable`, { email });
  },
  disable2FA: async (email) => {
    return requests.post(`configuration/2fa/disable`, { email });
  },
};

export default ConfigurationServices;
