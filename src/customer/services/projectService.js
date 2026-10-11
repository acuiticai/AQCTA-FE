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
 * Authenticated /customer-portal/projects — the customer's own certification
 * projects, opened once they accept a quotation.
 */
const CustomerProjectServices = {
  getMyProjects: (config = {}) =>
    axios.get(`${Base_URL}/customer-portal/projects`, authConfig(config)),

  /** Fallback quotation document path, keyed by the project rather than the
      application — used when the primary application-scoped fetch fails. */
  getMyProjectQuotationPdf: (projectNumber, config = {}) =>
    axios.get(
      `${Base_URL}/customer-portal/projects/${projectNumber}/quotation`,
      { ...authConfig(config), responseType: "blob" },
    ),
};

export default CustomerProjectServices;
