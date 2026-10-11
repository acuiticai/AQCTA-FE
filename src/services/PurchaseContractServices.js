import axios from "axios";

const API_BASE = import.meta.env.VITE_APP_API_BASE_URL;

const PurchaseContractServices = {
  // Get purchase analytics data
  getPurchaseAnalytics: async ({ params }) => {
    const response = await axios.get(`${API_BASE}/purchase-contracts/analytics`, { params });
    return response.data;
  },
  // Get recent purchase contracts
  getRecentPurchaseContracts: async ({ params }) => {
    const response = await axios.get(`${API_BASE}/purchase-contracts/recent`, { params });
    console.log("recent Contracts response service: ", response)
    return response.data;
  },
  // Get vendors by country
  getVendorsByCountry: async () => {
    const response = await axios.get(`${API_BASE}/purchase-contracts/vendors/by-country`);
    return response.data;
  },
  // Get recent vendors
  getRecentVendors: async () => {
    const response = await axios.get(`${API_BASE}/purchase-contracts/vendors/recent`);
    return response.data;
  },
  // Get purchase contracts by country of origin
  getPurchaseContractsByOriginCountry: async ({ params } = {}) => {
    const response = await axios.get(`${API_BASE}/purchase-contracts/by-origin-country`, { params });
    return response.data;
  },
  // Get purchase contracts by country
  getContractsByCountry: async () => {
    const response = await axios.get(`${API_BASE}/purchase-contracts/by-country`);
    return response.data;
  },
  getAllPurchaseContracts: async ({ params }) => {
    const response = await axios.get(`${API_BASE}/purchase-contracts`, { params });
    return response.data;
  },
  // ... (other purchase contract service methods can be added here)
};

export default PurchaseContractServices; 