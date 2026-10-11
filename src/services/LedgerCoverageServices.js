import requests from "./httpService";

const LedgerCoverageServices = {
  getReport: async (business) => {
    const q = business ? `?business=${business}` : "";
    return requests.get(`/ledger-coverage${q}`);
  },
};

export default LedgerCoverageServices;
