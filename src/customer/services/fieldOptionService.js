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

const CustomerFieldOptionServices = {
  /** Active dropdown options for application wizard select fields. */
  getActiveOptions: (params = {}, config = {}) =>
    axios.get(`${Base_URL}/customer-portal/application-field-options`, {
      ...authConfig(config),
      params,
    }),
};

export default CustomerFieldOptionServices;
