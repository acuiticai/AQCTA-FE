import requests from "./httpService";

const VendorServices = {
  /** Paginated list with `search` (name, email, phone, etc.). Use `riderOnly: "true"` for rider logins. */
  getPaginatedVendors: async (params = {}) => {
    return requests.get(`/vendors/paginated`, { params });
  },
  getAllVendors: async ({ searchText = "", vendorType = "" }) => {
    return requests.get(`/vendors`, {
      query: {
        ...(searchText && { searchText }),
        ...(vendorType && { vendorType }),
      },
    });
  },
  getAllVendorsByType: async (vendorType = "") => {
    return requests.get(`/vendors`, {
      params: {
        vendorType,
      },
    });
  },

  getSuppliersByBusiness: async (businessId) => {
    return requests.get(`/vendors/Supplier/${businessId}`);
  },

  getBusinessLogisticServiceProviders: async (businessId) => {
    return requests.get(`/vendors/all/${businessId}`, {
      params: {
        vendorType: "Logistic Service Provider",
      },
    });
  },

  getLogisticServiceProvider: async (vendorId) => {
    return requests.get(`/vendors/${vendorId}`);
  },

  //   addAllCustomers: async (body) => {
  //     return requests.post("/customer/add/all", body);
  //   },
  //   // user create
  //   createCustomer: async (body) => {
  //     return requests.post(`/customer/create`, body);
  //   },

  //   filterCustomer: async (email) => {
  //     return requests.post(`/customer/filter/${email}`);
  //   },

  //   getCustomerById: async (id) => {
  //     return requests.get(`/customer/${id}`);
  //   },

  //   updateCustomer: async (id, body) => {
  //     return requests.put(`/customer/${id}`, body);
  //   },

  //   deleteCustomer: async (id) => {
  //     return requests.delete(`/customer/${id}`);
  //   },
};

export default VendorServices;
