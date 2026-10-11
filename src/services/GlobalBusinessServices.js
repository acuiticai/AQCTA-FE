import requests from "./httpService";

const GlobalBusinessServices = {
  // Add Business
  addBusiness: async (body) => {
    return requests.post("Business/add", body);
  },

  // Get All Businesses
  getAllBusiness: async (body) => {
    return requests.post("Business/getALL", body);
  },

  // Get Business by ID
  getBusinessById: async (id) => {
    return requests.get(`Business/${id}`);
  },

  // Get Single Business
  getSingle: async (body) => {
    return requests.post("Business/get_single", body);
  },

  // Update Business
  updateBusiness: async (id, body) => {
    return requests.put(`Business/update/${id}`, body);
  },

  // Update Business Status
  updateStatus: async (id, body) => {
    return requests.put(`Business/status/${id}`, body);
  },

  // Delete Business
  deleteBusiness: async (id) => {
    return requests.delete(`Business/delete/${id}`);
  },
};

export default GlobalBusinessServices;
