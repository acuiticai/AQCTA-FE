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
 * Authenticated /customer-portal/invoices — shared Proforma_Invoice ledger
 * for the signed-in customer (same table as admin Customer Invoices).
 */
const CustomerInvoiceServices = {
  getMyInvoices: (config = {}) =>
    axios.get(`${Base_URL}/customer-portal/invoices`, authConfig(config)),

  getMyInvoicePdf: (downloadKey, config = {}) =>
    axios.get(
      `${Base_URL}/customer-portal/invoices/${encodeURIComponent(downloadKey)}/pdf`,
      { ...authConfig(config), responseType: "blob" },
    ),
};

export default CustomerInvoiceServices;
