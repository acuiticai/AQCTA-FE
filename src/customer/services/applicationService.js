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
 * Authenticated /customer/applications — scoped to the signed-in customer only.
 */
const CustomerApplicationServices = {
  getMyApplications: (params = {}, config = {}) =>
    axios.get(`${Base_URL}/customer-portal/applications`, {
      ...authConfig(config),
      params,
    }),

  getMyApplicationById: (id, config = {}) =>
    axios.get(
      `${Base_URL}/customer-portal/applications/${id}`,
      authConfig(config),
    ),

  /** Documents PC&I has issued for this application (contract review, etc.). */
  getMyApplicationDocuments: (id, config = {}) =>
    axios.get(
      `${Base_URL}/customer-portal/applications/${id}/documents`,
      authConfig(config),
    ),

  /** Confirming a factory audit notice — by signing, or by returning a scan. */
  acknowledgeAuditNotice: (id, data, config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/applications/${id}/documents/FOR-01-11/acknowledge`,
      data,
      authConfig(config),
    ),

  /** Accepting the quotation is what turns the application into a project. */
  decideMyQuotation: (id, data, config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/applications/${id}/quotation/decision`,
      data,
      authConfig(config),
    ),

  getMyApplicationDocumentPdf: (id, formKey, config = {}) =>
    axios.get(
      `${Base_URL}/customer-portal/applications/${id}/documents/${formKey}`,
      { ...authConfig(config), responseType: "blob" },
    ),

  createMyApplication: (data, config = {}) =>
    axios.post(
      `${Base_URL}/customer-portal/applications`,
      data,
      authConfig(config),
    ),

  updateMyApplication: (id, data, config = {}) =>
    axios.put(
      `${Base_URL}/customer-portal/applications/${id}`,
      data,
      authConfig(config),
    ),

  deleteMyApplication: (id, config = {}) =>
    axios.delete(
      `${Base_URL}/customer-portal/applications/${id}`,
      authConfig(config),
    ),
};

export default CustomerApplicationServices;
