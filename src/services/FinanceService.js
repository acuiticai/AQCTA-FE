import requests from "./httpService";

const FinanceService = {
  // Get currencies by business ID
  getCurrenciesByBusiness: async (businessId) => {
    try {
      const response = await requests.get(
        `finance/currencies?business_id=${businessId}`
      );
      return response;
    } catch (error) {
      console.error("Error fetching currencies by business:", error);
      throw error;
    }
  },
};

export default FinanceService;
