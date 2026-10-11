import axios from "axios";
import Cookies from "js-cookie";
// console.log("base url", import.meta.env.VITE_APP_API_BASE_URL);
import { notifyError, notifySuccess } from "@/utils/toast";

const responseBody = (response) => {
  console.log("response", response);
  console.log("window.location.pathname", window.location.pathname);
  if (
    response.data.token === "expired" ||
    response.message === "Invalid or expired token"
  ) {
    // logout();
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
    // logout();
  }
  throw error;
};

const getHeadersObject = () => {
  const adminInfo = localStorage.getItem("adminInfo")
    ? JSON.parse(localStorage.getItem("adminInfo"))
    : null;

  return {
    headers: {
      Authorization: adminInfo?.token ? `Bearer ${adminInfo.token}` : undefined,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    withCredentials: true,
  };
};

const baseURL = import.meta.env.VITE_APP_API_BASE_URL;
const getURL = (url) =>
  url.startsWith("http") || url.startsWith("https")
    ? url
    : `${baseURL}${url[0] === "/" ? url : `/${url}`}`;

const requests = {
  get: (url, body, headers) =>
    axios
      .get(getURL(url), {
        ...getHeadersObject(),
        ...headers,
        withCredentials: true,

        ...(body && { ...body }),
      })
      .then(responseBody)
      .catch(handleError),

  post: (url, body, customHeaders = {}) =>
    axios
      .post(getURL(url), body, {
        ...getHeadersObject(),
        headers: {
          ...getHeadersObject().headers,
          ...customHeaders,
          withCredentials: true,
        },
      })
      .then(responseBody)
      .catch(handleError),

  postWithCustomHeaders: (url, body, customHeaders = {}) =>
    axios
      .post(getURL(url), body, {
        ...getHeadersObject(),
        headers: {
          ...getHeadersObject().headers,
          ...customHeaders,
          withCredentials: true,
        },
      })
      .then(responseBody)
      .catch(handleError),

  put: (url, body, headers) =>
    axios
      .put(getURL(url), body, {
        ...getHeadersObject(),
        ...headers,
        withCredentials: true,
      })
      .then(responseBody)
      .catch(handleError),

  patch: (url, body, customHeaders = {}) =>
    axios
      .patch(getURL(url), body, {
        ...getHeadersObject(),
        headers: {
          ...getHeadersObject().headers,
          ...customHeaders,
          withCredentials: true,
        },
      })
      .then(responseBody)
      .catch(handleError),

  delete: (url, body, headers) =>
    axios
      .delete(getURL(url), {
        ...getHeadersObject(),
        ...headers,
        withCredentials: true,

        ...(body && { ...body }),
      })
      .then(responseBody)
      .catch(handleError),
};

export default requests;
