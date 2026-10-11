import requests from "./httpService";

const BankDepositServices = {
  // Receipts sitting in a holding account, available to bank.
  getUndeposited: async (accountId) => {
    return requests.get(`/bank-deposits/undeposited?account=${accountId}`);
  },

  // Deposit history into a bank account.
  list: async (accountId, params = {}) => {
    const query = new URLSearchParams({ account: accountId, ...params }).toString();
    return requests.get(`/bank-deposits?${query}`);
  },

  create: async (body) => {
    return requests.post("/bank-deposits", body);
  },

  reverse: async (id) => {
    return requests.delete(`/bank-deposits/${id}`);
  },
};

export default BankDepositServices;
