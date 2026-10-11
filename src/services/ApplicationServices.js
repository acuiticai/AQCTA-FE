import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) =>
    axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  patch: (url, data, config = {}) =>
    axios.patch(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
};

const ApplicationServices = {
  getMeta: (config = {}) => requests.get("/applications/meta", config),
  getAllApplications: (params = {}, config = {}) =>
    requests.get("/applications", { ...config, params }),
  getApplicationById: (id, config = {}) =>
    requests.get(`/applications/${id}`, config),
  createApplication: (data, config = {}) =>
    requests.post("/applications", data, config),
  updateApplication: (id, data, config = {}) =>
    requests.put(`/applications/${id}`, data, config),
  updateApplicationStatus: (id, status, config = {}) => {
    const body =
      status && typeof status === "object" ? status : { status };
    return requests.patch(`/applications/${id}/status`, body, config);
  },
  assignApplication: (id, data, config = {}) =>
    requests.patch(`/applications/${id}/assign`, data, config),
  getAssignableSystemUsers: (config = {}) =>
    requests.post(
      "/SystemUsers/get_all",
      {
        FilterStatus: "true",
        FilterName: "",
        FilterRole: "",
        page: 1,
        limit: 99999,
      },
      config,
    ),
  reviewApplication: (id, data, config = {}) =>
    requests.patch(`/applications/${id}/review`, data, config),
  deleteApplication: (id, config = {}) =>
    requests.delete(`/applications/${id}`, config),

  /* Controlled forms (contract review and the stages that follow). */
  getApplicationForm: (id, formKey, config = {}) =>
    requests.get(`/applications/${id}/forms/${formKey}`, config),
  saveApplicationForm: (id, formKey, data, config = {}) =>
    requests.put(`/applications/${id}/forms/${formKey}`, data, config),
  decideApplicationForm: (id, formKey, data, config = {}) =>
    requests.post(`/applications/${id}/forms/${formKey}/decision`, data, config),
  applicationFormPdfUrl: (id, formKey) =>
    `${Base_URL}/applications/${id}/forms/${formKey}/pdf`,
  getApplicationFormPdf: (id, formKey, config = {}) =>
    requests.get(`/applications/${id}/forms/${formKey}/pdf`, {
      ...config,
      responseType: "blob",
    }),

  /* ---- Audit phase: signed rather than approved ---------------------- */

  /** The awaited party answers: accepts and signs, or declines. */
  signForm: (id, formKey, data, config = {}) =>
    requests.post(`/applications/${id}/forms/${formKey}/sign`, data, config),
  /** Recording a customer confirmation that arrived outside the portal. */
  acknowledgeForm: (id, formKey, data, config = {}) =>
    requests.post(`/applications/${id}/forms/${formKey}/acknowledge`, data, config),
  /** Who can be assigned as an auditor. */
  getAuditors: (params = {}, config = {}) =>
    requests.get(`/applications/forms/auditors`, { ...config, params }),
  assignAuditor: (id, data, config = {}) =>
    requests.post(`/applications/${id}/auditor`, data, config),
  /** Who can be assigned as an inspector (inspection projects). */
  getInspectors: (params = {}, config = {}) =>
    requests.get(`/applications/forms/inspectors`, { ...config, params }),
  assignInspector: (id, data, config = {}) =>
    requests.post(`/applications/${id}/inspector`, data, config),
  formSignatureUrl: (id, formKey, role) =>
    `${Base_URL}/applications/${id}/forms/${formKey}/signatures/${role}`,
  formAttachmentUrl: (id, formKey, purpose) =>
    `${Base_URL}/applications/${id}/forms/${formKey}/attachments/${purpose}`,
  getFormAttachment: (id, formKey, purpose, config = {}) =>
    requests.get(
      `/applications/${id}/forms/${formKey}/attachments/${encodeURIComponent(purpose)}`,
      { ...config, responseType: "blob" },
    ),

  /** Record a quotation decision that arrived outside the customer portal. */
  decideQuotation: (id, data, config = {}) =>
    requests.post(`/applications/${id}/quotation/decision`, data, config),

  /** After customer rejection — unlock costing to revise & resend. */
  reviseQuotation: (id, data = {}, config = {}) =>
    requests.post(`/applications/${id}/quotation/revise`, data, config),

  /** Cross-application listing for one form — e.g. every costing sheet. */
  getFormSubmissions: (formKey, params = {}, config = {}) =>
    requests.get(`/applications/forms/${formKey}/submissions`, {
      ...config,
      params,
    }),
};

/** Same 4 AQCTA schemes as Enquiring For / Create Application. */
export { APPLICATION_SCHEME_PICKER_OPTIONS as APPLICATION_TYPE_OPTIONS } from "@/config/aqctaServices";

export const APPLICATION_STATUS_OPTIONS = [
  "Draft",
  "Under Review",
  "Action Required",
  "Resubmitted",
  "Approved",
  "Rejected",
  "Scheduled",
  "In Progress",
  "Certified",
  "Completed",
];

export { APPLICATION_SERVICE_OPTIONS } from "@/config/aqctaServices";

export default ApplicationServices;
