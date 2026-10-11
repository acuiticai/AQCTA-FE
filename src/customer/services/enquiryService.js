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
 * Guest /customer/enquiry — public routes (no Bearer).
 * Authenticated /customer/enquiries — scoped to the signed-in customer only.
 */
const CustomerEnquiryServices = {
  getMeta: (config = {}) =>
    axios.get(`${Base_URL}/public/enquiries/meta`, config),

  createEnquiry: (data, config = {}) =>
    axios.post(`${Base_URL}/public/enquiries`, data, config),

  /** Signed-in portal: list only this customer's enquiries. */
  getMyEnquiries: (params = {}, config = {}) =>
    axios.get(`${Base_URL}/customer-portal/enquiries`, {
      ...authConfig(config),
      params,
    }),

  getMyEnquiryById: (id, config = {}) =>
    axios.get(`${Base_URL}/customer-portal/enquiries/${id}`, authConfig(config)),

  createMyEnquiry: (data, config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/enquiries`,
      data,
      authConfig(config),
    ),

  updateMyEnquiry: (id, data, config = {}) =>
    axios.put(
      `${Base_URL}/customer-portal/enquiries/${id}`,
      data,
      authConfig(config),
    ),

  deleteMyEnquiry: (id, config = {}) =>
    axios.delete(
      `${Base_URL}/customer-portal/enquiries/${id}`,
      authConfig(config),
    ),
};

export default CustomerEnquiryServices;
