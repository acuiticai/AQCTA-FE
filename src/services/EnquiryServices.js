import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) => axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
  patch: (url, data, config = {}) => axios.patch(`${Base_URL}${url}`, data, config),
};

const EnquiryServices = {
  getMeta: (config = {}) => requests.get("/enquiries/meta", config),
  getAllEnquiries: (params = {}, config = {}) =>
    requests.get("/enquiries", { ...config, params }),
  getEnquiryById: (id, config = {}) => requests.get(`/enquiries/${id}`, config),
  getEnquiryPdf: (id, config = {}) =>
    requests.get(`/enquiries/${id}/pdf`, {
      ...config,
      responseType: "blob",
    }),
  createEnquiry: (data, config = {}) => requests.post("/enquiries", data, config),
  updateEnquiry: (id, data, config = {}) =>
    requests.put(`/enquiries/${id}`, data, config),
  updateEnquiryStatus: (id, status, config = {}) =>
    requests.patch(`/enquiries/${id}/status`, { status }, config),
  createCustomerFromEnquiry: (id, config = {}) =>
    requests.post(`/enquiries/${id}/create-customer`, {}, config),
  ensureCustomerForApplication: (id, config = {}) =>
    requests.post(`/enquiries/${id}/ensure-customer-for-application`, {}, config),
  deleteEnquiry: (id, config = {}) => requests.delete(`/enquiries/${id}`, config),
};

export { ENQUIRING_FOR_OPTIONS } from "@/config/aqctaServices";
export const ENQUIRY_CHANNEL_OPTIONS = ["Walk-in", "Domestic", "International"];
export const ENQUIRY_STATUS_OPTIONS = ["Spam", "Open", "Converted", "Closed"];

export const INSPECTION_OTHERS_VALUE = "Others (Please Specify)";

export const MANDATORY_INSPECTION_SERVICE_OPTIONS = [
  "Review and verification of design drawing and stress calculations of steam boilers, unfired pressure vessels and pipelines",
  "Witnessing, inspection, verification and approval of new, used or in-services local or imported steam boilers, unfired pressure vessels and pipelines",
  "Witnessing, verification and approval of Welding Procedure Specification (WPS), WPQT and electrode approval performed by competent firms for steam boilers, unfired pressure vessels, gas pipelines and hoisting machines",
  INSPECTION_OTHERS_VALUE,
];

export const THIRD_PARTY_INSPECTION_SERVICE_OPTIONS = [
  "Inspection Before, During and After Construction",
  "Compliance Inspection on Imported and In-service Industrial Equipment and Machinery",
  "Condition monitoring and Plant Assessment",
  "Non-Destructive Evaluation (Witness and Verification of Test Report)",
  "Endorsement of Failure Investigation and Analysis Report",
  INSPECTION_OTHERS_VALUE,
];

export const includesInspectionOthers = (selected = []) => {
  if (!Array.isArray(selected)) return false;
  return selected.some((item) => {
    const value = String(item || "")
      .trim()
      .toLowerCase();
    return (
      value === String(INSPECTION_OTHERS_VALUE).toLowerCase() ||
      value.startsWith("others")
    );
  });
};

export const emptyInspectionEnquiryFields = () => ({
  mandatoryInspectionServices: [],
  mandatoryInspectionOthers: "",
  thirdPartyInspectionServices: [],
  thirdPartyInspectionOthers: "",
});

export default EnquiryServices;
