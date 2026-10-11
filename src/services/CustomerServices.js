import requests from "./httpService";

const CustomerServices = {
  /** NCustomer list — supports `search` on name / email / code (see backend). */
  searchCustomers: async (params = {}) => {
    return requests.get(`/customers`, {
      params: { page: 1, limit: 40, ...params },
    });
  },
  getAllCustomers: async ({ searchText = "" }) => {
    return requests.get(`/customer?searchText=${searchText}`);
  },

  addAllCustomers: async (body) => {
    return requests.post("/customer/add/all", body);
  },
  // user create
  createCustomer: async (body) => {
    return requests.post(`/customer/create`, body);
  },

  filterCustomer: async (email) => {
    return requests.post(`/customer/filter/${email}`);
  },

  getCustomerById: async (id) => {
    return requests.get(`/customer/${id}`);
  },

  updateCustomer: async (id, body) => {
    return requests.put(`/customer/${id}`, body);
  },

  deleteCustomer: async (id) => {
    return requests.delete(`/customer/${id}`);
  },

  // --- NEW: Customers by Country ---
  getCustomersByCountry: async () => {
    return requests.get(`/customers/by-country`);
  },

  // --- NEW: Most Recent 10 Customers ---
  getRecentCustomers: async () => {
    return requests.get(`/customers/recent`);
  },
};

export default CustomerServices;
