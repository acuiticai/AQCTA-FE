import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ApplicationDocumentTypeServices = {
  downloadForm: (payload = {}, config = {}) =>
    axios.post(`${Base_URL}/application-document-types/download-form`, payload, {
      ...config,
      responseType: "blob",
    }),
};

export default ApplicationDocumentTypeServices;
