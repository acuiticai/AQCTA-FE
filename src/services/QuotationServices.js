import axios from "axios";
import { formatCurrencyAmount } from "@/components/formatAmount";

const coerceAmount = (value) => {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value !== null && "$numberDecimal" in value) {
    const n = Number(value.$numberDecimal);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) => axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
  patch: (url, data, config = {}) => axios.patch(`${Base_URL}${url}`, data, config),
};

const QuotationServices = {
  getAllQuotations: (params = {}) => requests.get("/quotations", { params }),
  getQuotationById: (id) => requests.get(`/quotations/${id}`),
  getPciLetterheadPdf: (id, config = {}) =>
    requests.get(`/quotations/${id}/letterhead-pdf`, {
      ...config,
      responseType: "blob",
    }),
  getLatestQuotationNumber: (params = {}) =>
    requests.get("/quotations/latest", { params }),
  createQuotation: (quotationData) => requests.post("/quotations", quotationData),
  updateQuotation: (id, quotationData) => requests.put(`/quotations/${id}`, quotationData),
  deleteQuotation: (id) => requests.delete(`/quotations/${id}`),
  updateQuotationStatus: (id, status) =>
    requests.patch(`/quotations/${id}/status`, { status }),
  convertQuotation: (id) => requests.post(`/quotations/${id}/convert`),
  convertQuotationToSalesOrder: (id) =>
    requests.post(`/quotations/${id}/convert-sales-order`),
  sendQuotationEmail: (id, data, config = {}) =>
    requests.post(`/quotations/${id}/send-email`, data, config),

  formatCurrency: (amount, currency = "USD", currenciesList = []) => {
    return formatCurrencyAmount(currency, coerceAmount(amount), true, currenciesList);
  },

  normalizeStatus: (status) => String(status || "draft").trim().toLowerCase(),

  getStatusLabel: (status) => {
    const normalized = QuotationServices.normalizeStatus(status);
    return {
      draft: "Draft",
      sent: "Sent",
      accepted: "Accepted",
      rejected: "Rejected",
      expired: "Expired",
      invoiced: "Invoiced",
    }[normalized] || "Draft";
  },
};

export default QuotationServices;
