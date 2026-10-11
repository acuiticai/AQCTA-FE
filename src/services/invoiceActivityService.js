import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const getInvoiceActivityLogs = (invoiceId, params = {}) => {
  return axios.get(`${API_URL}/proforma-invoice/${invoiceId}/activity-logs`, {
    params,
  });
};
