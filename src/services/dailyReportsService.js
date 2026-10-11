import requests from "./httpService";

/** Hub dashboard (/daily-reports) vs collection list (/daily-reports-collection). */
export const DAILY_REPORTS_SCOPE = {
  hub: "/daily-reports",
  collection: "/daily-reports-collection",
};

let activeDailyReportsScope = DAILY_REPORTS_SCOPE.hub;

export function setDailyReportsApiScope(scopePath) {
  activeDailyReportsScope = scopePath || DAILY_REPORTS_SCOPE.hub;
}

export function getDailyReportsApiScope() {
  return activeDailyReportsScope;
}

export function resolveDailyReportsScopeFromPath(pathname) {
  const path = (pathname || "").replace(/\/+$/, "") || "/";
  if (
    path === DAILY_REPORTS_SCOPE.collection ||
    path.endsWith(DAILY_REPORTS_SCOPE.collection)
  ) {
    return DAILY_REPORTS_SCOPE.collection;
  }
  return DAILY_REPORTS_SCOPE.hub;
}

const withListScope = (params = {}) => ({
  ...params,
  dailyReportsScope: activeDailyReportsScope,
});

const DailyReportsService = {
  // ==================== Shift Reports ====================
  getAllShiftReports: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(`/daily-reports/shifts?${queryParams}`);
  },

  getShiftReportById: async (id, params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    const suffix = queryParams ? `?${queryParams}` : "";
    return requests.get(`/daily-reports/shifts/${id}${suffix}`);
  },

  createShiftReport: async (data) => {
    return requests.post("/daily-reports/shifts", data);
  },

  updateShiftReport: async (id, data) => {
    return requests.put(`/daily-reports/shifts/${id}`, data);
  },

  submitShiftReport: async (id) => {
    return requests.post(`/daily-reports/shifts/${id}/submit`);
  },

  approveShiftReport: async (id) => {
    return requests.post(`/daily-reports/shifts/${id}/approve`);
  },

  lockShiftReport: async (id) => {
    return requests.post(`/daily-reports/shifts/${id}/lock`);
  },

  deleteShiftReport: async (id) => {
    return requests.delete(`/daily-reports/shifts/${id}`);
  },

  // ==================== Collections ====================
  getAllCollections: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(`/daily-reports/collections?${queryParams}`);
  },

  getCollectionById: async (id) => {
    return requests.get(`/daily-reports/collections/${id}`);
  },

  createCollection: async (data) => {
    return requests.post("/daily-reports/collections", data);
  },

  updateCollection: async (id, data) => {
    return requests.put(`/daily-reports/collections/${id}`, data);
  },

  deleteCollection: async (id) => {
    return requests.delete(`/daily-reports/collections/${id}`);
  },

  // ==================== Supplier Payments ====================
  getAllSupplierPayments: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(`/daily-reports/supplier-payments?${queryParams}`);
  },

  createSupplierPayment: async (data) => {
    return requests.post("/daily-reports/supplier-payments", data);
  },

  updateSupplierPayment: async (id, data) => {
    return requests.put(`/daily-reports/supplier-payments/${id}`, data);
  },

  deleteSupplierPayment: async (id) => {
    return requests.delete(`/daily-reports/supplier-payments/${id}`);
  },

  previewPaymentAllocation: async (data) => {
    return requests.post("/daily-reports/supplier-payments/preview-allocation", data);
  },

  getSupplierOutstandingInvoices: async (supplierId, business) => {
    return requests.get(`/daily-reports/suppliers/${supplierId}/invoices?business=${business}`);
  },

  // ==================== Staff Advances ====================
  getAllStaffAdvances: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(`/daily-reports/staff-advances?${queryParams}`);
  },

  getStaffAdvanceById: async (id) => {
    return requests.get(`/daily-reports/staff-advances/${id}`);
  },

  createStaffAdvance: async (data) => {
    return requests.post("/daily-reports/staff-advances", data);
  },

  updateStaffAdvance: async (id, data) => {
    return requests.put(`/daily-reports/staff-advances/${id}`, data);
  },

  deleteStaffAdvance: async (id) => {
    return requests.delete(`/daily-reports/staff-advances/${id}`);
  },

  // ==================== Late Transactions ====================
  getAllLateTransactions: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(`/daily-reports/late-transactions?${queryParams}`);
  },

  createLateTransaction: async (data) => {
    return requests.post("/daily-reports/late-transactions", data);
  },

  updateLateTransaction: async (id, data) => {
    return requests.put(`/daily-reports/late-transactions/${id}`, data);
  },

  deleteLateTransaction: async (id) => {
    return requests.delete(`/daily-reports/late-transactions/${id}`);
  },

  // ==================== Analytics ====================
  getSummary: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(`/daily-reports/analytics/summary?${queryParams}`);
  },

  getCollectionsByChannel: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(
      `/daily-reports/analytics/collections-by-channel?${queryParams}`
    );
  },

  getCashFlow: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(`/daily-reports/analytics/cash-flow?${queryParams}`);
  },

  getSupplierPaymentsAnalytics: async (params = {}) => {
    const queryParams = new URLSearchParams(withListScope(params)).toString();
    return requests.get(
      `/daily-reports/analytics/supplier-payments?${queryParams}`
    );
  },

  // ==================== Channels ====================
  getAllChannels: async (business_id) => {
    return requests.post("/daily-reports/channels/get_all", {
      business_id,
      FilterStatus: "Active",
      FilterName: "",
    });
  },

  createChannel: async (data) => {
    return requests.post("/daily-reports/channels/add", data);
  },

  updateChannel: async (id, data) => {
    return requests.put(`/daily-reports/channels/update/${id}`, data);
  },

  deleteChannel: async (id) => {
    return requests.delete(`/daily-reports/channels/delete/${id}`);
  },

  getChannelPaymentMethods: async (channelId) => {
    return requests.get(`/daily-reports/channels/${channelId}/payment-methods`);
  },

  updateChannelPaymentMethods: async (channelId, paymentMethodIds) => {
    return requests.put(`/daily-reports/channels/${channelId}/payment-methods`, {
      paymentMethods: paymentMethodIds,
    });
  },

  // ==================== Payment Methods ====================
  getAllPaymentMethods: async (business_id) => {
    return requests.post("/daily-reports/payment-methods/get_all", {
      business_id,
      FilterStatus: "Active",
      FilterName: "",
    });
  },

  createPaymentMethod: async (data) => {
    return requests.post("/daily-reports/payment-methods/add", data);
  },

  updatePaymentMethod: async (id, data) => {
    return requests.put(`/daily-reports/payment-methods/update/${id}`, data);
  },

  deletePaymentMethod: async (id) => {
    return requests.delete(`/daily-reports/payment-methods/delete/${id}`);
  },

  getPaymentMethodsByType: async (businessId, type) => {
    return requests.get(`/daily-reports/payment-methods/by-type/${type}`, {
      params: { business_id: businessId },
    });
  },

  // ==================== Transaction Types ====================
  getAllTransactionTypes: async (business_id) => {
    return requests.post("/daily-reports/transaction-types/get_all", {
      business_id,
      FilterStatus: "Active",
      FilterName: "",
    });
  },

  createTransactionType: async (data) => {
    return requests.post("/daily-reports/transaction-types/add", data);
  },

  updateTransactionType: async (id, data) => {
    return requests.put(`/daily-reports/transaction-types/update/${id}`, data);
  },

  deleteTransactionType: async (id) => {
    return requests.delete(`/daily-reports/transaction-types/delete/${id}`);
  },

  // ==================== Advance Types ====================
  getAllAdvanceTypes: async (business_id) => {
    return requests.post("/daily-reports/advance-types/get_all", {
      business_id,
      FilterStatus: "Active",
      FilterName: "",
    });
  },

  createAdvanceType: async (data) => {
    return requests.post("/daily-reports/advance-types/add", data);
  },

  updateAdvanceType: async (id, data) => {
    return requests.put(`/daily-reports/advance-types/update/${id}`, data);
  },

  deleteAdvanceType: async (id) => {
    return requests.delete(`/daily-reports/advance-types/delete/${id}`);
  },
};

export default DailyReportsService;
