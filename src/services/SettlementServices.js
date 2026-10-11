import requests from "./httpService";

/**
 * Provider settlement: banking the net card/QR batch out of a clearing account
 * and booking the merchant fee. Backend routes live under /pos/settlements.
 */
const SettlementServices = {
  // Clearing accounts for a business, each with its outstanding gross.
  getClearingAccounts: async (business) => {
    return requests.get(`/pos/settlements/clearing-accounts?business=${business}`);
  },

  // The unsettled clearing entries for one account, plus gross and predicted fee.
  getOutstanding: async (account) => {
    return requests.get(`/pos/settlements/outstanding?account=${account}`);
  },

  // Settlement history for a clearing account.
  list: async (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    return requests.get(`/pos/settlements${query ? `?${query}` : ""}`);
  },

  create: async (body) => {
    return requests.post("/pos/settlements", body);
  },

  reverse: async (id) => {
    return requests.post(`/pos/settlements/${id}/reverse`, {});
  },
};

export default SettlementServices;
