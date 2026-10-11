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
 * Active inventory categories (+ productFields) for the certification wizard.
 */
const CustomerCategoryServices = {
  getActiveCategories: (params = {}, config = {}) =>
    axios.get(`${Base_URL}/customer-portal/categories`, {
      ...authConfig(config),
      params: {
        ...(import.meta.env.VITE_APP_DEFAULT_BUSINESS_ID
          ? { businessId: import.meta.env.VITE_APP_DEFAULT_BUSINESS_ID }
          : {}),
        ...params,
      },
    }),
};

export default CustomerCategoryServices;
