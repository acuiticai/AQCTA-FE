import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Projects — opened when a customer accepts a quotation. */
const ProjectServices = {
  getMeta: (config = {}) => axios.get(`${Base_URL}/projects/meta`, config),
  getAllProjects: (params = {}, config = {}) =>
    axios.get(`${Base_URL}/projects`, { ...config, params }),
  getProjectById: (id, config = {}) =>
    axios.get(`${Base_URL}/projects/${id}`, config),
  /** The project an application became, if any — returns null when it has none. */
  getProjectByApplication: (applicationId, config = {}) =>
    axios.get(`${Base_URL}/projects/by-application/${applicationId}`, config),
  updateProject: (id, data, config = {}) =>
    axios.patch(`${Base_URL}/projects/${id}`, data, config),
  /** Every invoice raised across every project — admin, business-scoped. */
  getAllInvoices: (params = {}, config = {}) =>
    axios.get(`${Base_URL}/invoices`, { ...config, params }),

  /* The documents as issued, read back from the archive rather than redrawn. */
  getProjectQuotationPdf: (id, config = {}) =>
    axios.get(`${Base_URL}/projects/${id}/quotation/pdf`, {
      ...config,
      responseType: "blob",
    }),
  getProjectInvoicePdf: (id, config = {}) =>
    axios.get(`${Base_URL}/projects/${id}/invoice/pdf`, {
      ...config,
      responseType: "blob",
    }),
};

export const PROJECT_STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

export default ProjectServices;
