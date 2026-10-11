import requests from "./httpService";

const AdminServices = {
  registerAdmin: async (body) => {
    return requests.post("/admin/register", body);
  },

  loginAdmin: async (body) => {
    return requests.post(`/admin/login`, body);
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

  addBusiness: async (body) => {
    return requests.post("/admin/add", body);
  },
  getAllBusiness: async (body) => {
    return requests.get("/admin", body);
  },
  getBusinessById: async (id, body) => {
    return requests.post(`/admin/${id}`, body);
  },

  updateBusiness: async (id, body) => {
    return requests.put(`/admin/${id}`, body);
  },

  updateBusinessStatus: async (id, body) => {
    return requests.put(`/admin/update-status/${id}`, body);
  },

  deleteBusiness: async (id) => {
    return requests.delete(`/admin/${id}`);
  },
};

export default AdminServices;
