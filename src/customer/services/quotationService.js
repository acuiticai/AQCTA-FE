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
 * Authenticated /customer-portal/quotations — every quotation issued across
 * the signed-in customer's own applications.
 */
const CustomerQuotationServices = {
  getMyQuotations: (config = {}) =>
    axios.get(`${Base_URL}/customer-portal/quotations`, authConfig(config)),
  /** Flexa Accounts Quotation + DocumentTemplate for portal preview. */
  getMyQuotationPreview: (quoteNumber, config = {}) =>
    axios.get(
      `${Base_URL}/customer-portal/quotations/${encodeURIComponent(quoteNumber)}/preview`,
      authConfig(config),
    ),
};

export default CustomerQuotationServices;
