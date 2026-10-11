import axios from "axios";

import { getCustomerToken } from "../utils/session";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const authConfig = (config = {}) => {
  const token = getCustomerToken();
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

const CustomerDocumentTypeServices = {
  /** Active supporting-document types for an application service. */
  getActiveTypes: (params = {}, config = {}) =>
    axios.get(`${Base_URL}/customer-portal/application-document-types`, {
      ...authConfig(config),
      params,
    }),

  /** Download a pre-filled certification declaration/authorization form. */
  downloadForm: (payload = {}, config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/application-document-types/download-form`,
      payload,
      {
        ...authConfig(config),
        responseType: "blob",
      }
    ),
};

export default CustomerDocumentTypeServices;
