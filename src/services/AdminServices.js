import requests from "./httpService";

const AdminServices = {
  registerAdmin: async (body) => {
    return requests.post("/admin/register", body);
  },

  loginAdmin: async (data) => {
    return requests.post("/admin/login", data);
  },

  logout: async () => {
    return requests.post("/admin/logout");
  },

  refreshToken: async () => {
    return requests.post("/admin/refresh-token", {});
  },

  getAdminProfile: async (id) => {
    return requests.get(`/admin/profile/${id}`);
  },

  forgetPassword: async (body) => {
    return requests.put("/admin/forget-password", body);
  },

  resetPassword: async (body) => {
    return requests.put("/admin/reset-password", body);
  },

  signUpWithProvider: async (body) => {
    return requests.post("/admin/signup", body);
  },

  updateTwoFactorAuth: async (body) => {
    return requests.post("/admin/two-factor-auth", body);
  },

  getTwoFactorAuth: async (email) => {
    return requests.get(`/admin/two-factor-auth/${email}`);
  },

  addStaff: async (body) => {
    return requests.post("/admin/add", body);
  },
  getAllStaff: async (body) => {
    return requests.get("/admin", body);
  },
  getStaffById: async (id, body) => {
    return requests.post(`/admin/${id}`, body);
  },

  updateStaff: async (id, body) => {
    return requests.put(`/admin/${id}`, body);
  },

  updateStaffStatus: async (id, body) => {
    return requests.put(`/admin/update-status/${id}`, body);
  },

  deleteStaff: async (id) => {
    return requests.delete(`/admin/${id}`);
  },

  // Device trust verification
  checkTrustedDevice: async (data) => {
    return requests.post("/admin/check-trusted-device", data);
  },
};

export default AdminServices;
