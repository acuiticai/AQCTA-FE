import requests from "./httpService";

const SalesContractServices = {
  // Get sales analytics data
  getSalesAnalytics: async ({ params }) => {
    return requests.get("sales-contracts/analytics", {
      params,
    });
  },

  // Get all sales contracts with pagination and filters
  getAllSalesContracts: async ({ params }) => {
    return requests.get("sales-contracts", {
      params,
    });
  },

  // Get recent sales contracts for dashboard
  getRecentSalesContracts: async ({ params }) => {
    return requests.get("sales-contracts", {
      params: {
        ...params,
        page: 1,
        limit: 10,
        // Sort by most recent
      }
    });
  },
};

export default SalesContractServices; 