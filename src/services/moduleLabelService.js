import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const getBusinessGroupModuleLabels = (businessGroupId, config = {}) => {
  return axios.get(`${API_URL}/business-groups/${businessGroupId}/module-labels`, config);
};

export const updateBusinessGroupModuleLabels = (businessGroupId, moduleLabels, config = {}) => {
  return axios.put(`${API_URL}/business-groups/${businessGroupId}/module-labels`, {
    moduleLabels,
  }, config);
};
