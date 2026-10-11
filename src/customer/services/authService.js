import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Guest /customer auth — public routes (no Bearer token).
 */
const CustomerAuthServices = {
  login: (data, config = {}) =>
    axios.post(`${Base_URL}/public/customer-portal/login`, data, config),

  register: (data, config = {}) =>
    axios.post(`${Base_URL}/public/customer-portal/register`, data, config),

  verifyOtp: (data, config = {}) =>
    axios.post(`${Base_URL}/public/customer-portal/verify-otp`, data, config),

  resendOtp: (data, config = {}) =>
    axios.post(`${Base_URL}/public/customer-portal/resend-otp`, data, config),

  forgotPassword: (data, config = {}) =>
    axios.post(
      `${Base_URL}/public/customer-portal/forgot-password`,
      data,
      config,
    ),

  resetPassword: (data, config = {}) =>
    axios.post(
      `${Base_URL}/public/customer-portal/reset-password`,
      data,
      config,
    ),

  /** Optional document upload via existing public /upload endpoint. */
  uploadFile: (file, config = {}) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("file_name", file?.name || "document");
    return axios.post(`${Base_URL}/upload`, formData, {
      ...config,
      headers: {
        ...(config.headers || {}),
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

export default CustomerAuthServices;
