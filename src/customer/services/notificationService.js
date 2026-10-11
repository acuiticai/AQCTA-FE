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
 * The signed-in customer's own in-app notifications — the portal counterpart
 * of the milestone emails PC&I already sends.
 */
const CustomerNotificationServices = {
  getMyNotifications: (config = {}) =>
    axios.get(`${Base_URL}/customer-portal/notifications`, authConfig(config)),

  markRead: (id, config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/notifications/${id}/read`,
      {},
      authConfig(config),
    ),

  markAllRead: (config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/notifications/read-all`,
      {},
      authConfig(config),
    ),
};

export default CustomerNotificationServices;
