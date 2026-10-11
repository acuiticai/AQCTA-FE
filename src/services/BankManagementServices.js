import requests from "./httpService";

const BankManagementServices = {
  getAllAccounts: async () => {
    return requests.get("/bank-management/accounts");
  },

  // Accounts for a specific business (used where a page selects the business
  // explicitly, e.g. provider settlement).
  getAccountsByBusiness: async (business) => {
    return requests.get(
      `/bank-management/accounts?business=${business}&limit=500`
    );
  },

//   getAllCategories: async () => {
//     return requests.get("/category/all");
//   },

//   getCategoryById: async (id) => {
//     return requests.get(`/category/${id}`);
//   },

  addAccount: async (body) => {
    return requests.post("/bank-management/accounts", body);
  },

//   addAllCategory: async (body) => {
//     return requests.post("/category/add/all", body);
//   },

//   updateCategory: async (id, body) => {
//     return requests.put(`/category/${id}`, body);
//   },

//   updateStatus: async (id, body) => {
//     return requests.put(`/category/status/${id}`, body);
//   },

//   deleteCategory: async (id, body) => {
//     return requests.delete(`/category/${id}`, body);
//   },

//   updateManyCategory: async (body) => {
//     return requests.patch("/category/update/many", body);
//   },

//   deleteManyCategory: async (body) => {
//     return requests.patch("/category/delete/many", body);
//   },
};

export default BankManagementServices;
