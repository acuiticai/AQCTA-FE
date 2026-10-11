import axios from "axios";
import Cookies from "js-cookie";

import { notifyError, notifySuccess } from "@/utils/toast";

// Do something before request is sent
let adminInfo = localStorage.getItem("adminInfo")
  ? JSON.parse(localStorage.getItem("adminInfo"))
  : null;

const instance = axios.create({
  baseURL: `${import.meta.env.VITE_APP_API_BASE_URL}`,
  timeout: 50000,
  headers: {
    Accept: "application/json",
    "Content-Type": "multipart/form-data",
  },
});

const logout = () => {
  notifyError("Session expired", () => {
    window.location.href = "/login";
    localStorage.clear();
    Cookies.remove("adminInfo");
  });
};

// Add a request interceptor
instance.interceptors.request.use(function (config) {
  console.log("adminInfo", adminInfo);
  let company;

  if (Cookies.get("company")) {
    company = Cookies.get("company");
  }

  // console.log('Admin Http Services Cookie Read : ' + company);
  // let companyName = JSON.stringify(company);

  return {
    ...config,
    headers: {
      authorization: adminInfo ? `Bearer ${adminInfo.token}` : null,
      company: company ? company : null,
    },
  };
});

const responseBody = (response) => {
  console.log("response", response);
  console.log("window.location.pathname", window.location.pathname);
  if (
    response.data.token === "expired" ||
    response.message === "Invalid or expired token"
  ) {
    logout();
  } else {
    return response?.data || response;
  }
};

const handleError = (error) => {
  console.debug("error", error);
  if (
    error?.response?.data?.message === "Invalid or expired token" ||
    error?.message === "Invalid or expired token" ||
    error === "Invalid or expired token" ||
    error?.response?.message === "Invalid or expired token" ||
    error?.status === 401
  ) {
    console.debug("logout");
    logout();
  }
  throw error;
};

const requests = {
  get: (url, body, headers) =>
    instance.get(url, body, headers).then(responseBody).catch(handleError),

  post: (url, body) =>
    instance.post(url, body).then(responseBody).catch(handleError),

  put: (url, body, headers) =>
    instance.put(url, body, headers).then(responseBody).catch(handleError),

  patch: (url, body) =>
    instance.patch(url, body).then(responseBody).catch(handleError),

  delete: (url, body) =>
    instance.delete(url, body).then(responseBody).catch(handleError),
};

const UploadDocumentServices = {
  uploadDocument: (file, businessId, folderName, fileName) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploadedBy", adminInfo.id);
    formData.append("file_path", `${folderName}/${fileName}`);
    formData.append("business_id", businessId);
    formData.append("file_type", file.type);
    formData.append("file_size", file.size.toString());
    formData.append("file_name", fileName);

    return requests.post("documents/uploadDocument", formData);
  },
  uploadDocumentPublic: (file, businessId, folderName, fileName) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploadedBy", adminInfo.id);
    formData.append("file_path", `${folderName}/${fileName}`);
    formData.append("business_id", businessId);
    formData.append("file_type", file.type);
    formData.append("file_size", file.size.toString());
    formData.append("file_name", fileName);

    return requests.post("public/documents/uploadDocument", formData);
  },
};

export default UploadDocumentServices;
