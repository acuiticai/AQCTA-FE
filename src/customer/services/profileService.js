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

/**
 * Authenticated customer account / profile (company + key contacts from admin).
 */
const CustomerProfileServices = {
  getMyProfile: (config = {}) =>
    axios.get(`${Base_URL}/customer-portal/me`, authConfig(config)),

  updateMySignature: (payload = {}, config = {}) =>
    axios.put(
      `${Base_URL}/customer-portal/me/signature`,
      payload,
      authConfig(config),
    ),

  updateMyCompanyChop: (payload = {}, config = {}) =>
    axios.put(
      `${Base_URL}/customer-portal/me/company-chop`,
      payload,
      authConfig(config),
    ),

  changePassword: (payload = {}, config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/me/change-password`,
      payload,
      authConfig(config),
    ),
};

export default CustomerProfileServices;
