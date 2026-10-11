import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) =>
    axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
};

const PosServices = {
  // ── Tables ──────────────────────────────────────────────────
  getTables: async (params = {}, headers = {}) => {
    return requests.get("/pos/tables", { params, headers });
  },
  createTable: async (data, headers = {}) => {
    return requests.post("/pos/tables", data, { headers });
  },
  updateTable: async (id, data, headers = {}) => {
    return requests.put(`/pos/tables/${id}`, data, { headers });
  },
  deleteTable: async (id, headers = {}) => {
    return requests.delete(`/pos/tables/${id}`, { headers });
  },
  updateTableStatus: async (id, status, headers = {}) => {
    return requests.put(`/pos/tables/${id}/status`, { status }, { headers });
  },
  bulkCreateTables: async (data, headers = {}) => {
    return requests.post("/pos/tables/bulk", data, { headers });
  },

  // ── Table QR codes ──────────────────────────────────────────
  generateTableQr: async (id, headers = {}) => {
    return requests.post(`/pos/tables/${id}/qr/generate`, {}, { headers });
  },
  revokeTableQr: async (id, headers = {}) => {
    return requests.post(`/pos/tables/${id}/qr/revoke`, {}, { headers });
  },

  // ── Reports ─────────────────────────────────────────────────
  getSalesSummary: async (params = {}, headers = {}) => {
    return requests.get("/pos/reports/summary", { params, headers });
  },
  getTopItemsReport: async (params = {}, headers = {}) => {
    return requests.get("/pos/reports/top-items", { params, headers });
  },
  getTablesReport: async (params = {}, headers = {}) => {
    return requests.get("/pos/reports/tables", { params, headers });
  },
  getKitchenReport: async (params = {}, headers = {}) => {
    return requests.get("/pos/reports/kitchen", { params, headers });
  },
  getRecentOrdersReport: async (params = {}, headers = {}) => {
    return requests.get("/pos/reports/orders", { params, headers });
  },

  // ── Orders ──────────────────────────────────────────────────
  getChargeSettings: async (businessId, headers = {}) => {
    return requests.get("/pos/settings/charges", {
      params: { business: businessId },
      headers,
    });
  },
  updateChargeSettings: async (data, headers = {}) => {
    return requests.put("/pos/settings/charges", data, { headers });
  },

  // POS → accounting ledger wiring: which bank accounts cash and card takings
  // post to. Returns the current settings and the account list to choose from.
  getLedgerSettings: async (businessId, headers = {}) => {
    return requests.get("/pos/settings/ledger", {
      params: { business: businessId },
      headers,
    });
  },
  updateLedgerSettings: async (data, headers = {}) => {
    return requests.put("/pos/settings/ledger", data, { headers });
  },

  getOrders: async (params = {}, headers = {}) => {
    return requests.get("/pos/orders", { params, headers });
  },
  getOrder: async (id, headers = {}) => {
    return requests.get(`/pos/orders/${id}`, { headers });
  },
  createOrder: async (data, headers = {}) => {
    return requests.post("/pos/orders", data, { headers });
  },
  updateOrder: async (id, data, headers = {}) => {
    return requests.put(`/pos/orders/${id}`, data, { headers });
  },
  updateOrderItems: async (id, items, headers = {}) => {
    return requests.put(`/pos/orders/${id}/items`, { items }, { headers });
  },
  fireOrderToKitchen: async (id, headers = {}) => {
    return requests.post(`/pos/orders/${id}/fire`, {}, { headers });
  },
  checkoutOrder: async (id, data, headers = {}) => {
    return requests.post(`/pos/orders/${id}/checkout`, data, { headers });
  },
  collectOrderPayment: async (id, data, headers = {}) => {
    return requests.post(`/pos/orders/${id}/payments`, data, { headers });
  },
  voidOrder: async (id, data = {}, headers = {}) => {
    return requests.post(`/pos/orders/${id}/void`, data, { headers });
  },
  transferTable: async (id, tableId, headers = {}) => {
    return requests.post(`/pos/orders/${id}/transfer`, { tableId }, { headers });
  },
  holdOrder: async (id, headers = {}) => {
    return requests.post(`/pos/orders/${id}/hold`, {}, { headers });
  },
  resumeOrder: async (id, headers = {}) => {
    return requests.post(`/pos/orders/${id}/resume`, {}, { headers });
  },
  releaseTable: async (id, data = {}, headers = {}) => {
    return requests.post(`/pos/tables/${id}/release`, data, { headers });
  },
  createRealtimeStream: (businessId, token) => {
    const params = new URLSearchParams();
    if (businessId) params.set("business", String(businessId));
    if (token) params.set("token", String(token));
    return new EventSource(`${Base_URL}/pos/stream?${params.toString()}`);
  },
  getReceipt: async (id, headers = {}) => {
    return requests.get(`/pos/orders/${id}/receipt`, { headers });
  },

  // ── Lookups ─────────────────────────────────────────────────
  getItems: async (params = {}, headers = {}) => {
    return requests.get("/pos/items", { params, headers });
  },
  getCategories: async (params = {}, headers = {}) => {
    return requests.get("/pos/categories", { params, headers });
  },
  searchCustomers: async (params = {}, headers = {}) => {
    return requests.get("/pos/customers/search", { params, headers });
  },

  getBusinessPaymentMethods: async (businessId, headers = {}) => {
    return requests.post(
      "/daily-reports/payment-methods/get_all",
      {
        business_id: businessId,
        FilterStatus: "Active",
        FilterName: "",
      },
      { headers },
    );
  },
  getBusinessSalesChannels: async (businessId, headers = {}) => {
    return requests.get("/pos/sales-channels", {
      params: { business: businessId },
      headers,
    });
  },
  seedMalaysianSalesChannels: async (businessId, headers = {}) => {
    return requests.post(
      "/daily-reports/channels/seed-malaysian",
      { business_id: businessId },
      { headers },
    );
  },

  // ── Shift management ───────────────────────────────────────
  getShiftDefinitions: async (params = {}, headers = {}) => {
    return requests.get("/pos/shifts/definitions", { params, headers });
  },
  getActiveShift: async (params = {}, headers = {}) => {
    return requests.get("/pos/shifts/active", { params, headers });
  },
  startShift: async (data, headers = {}) => {
    return requests.post("/pos/shifts/start", data, { headers });
  },
  getShiftPreview: async (id, headers = {}) => {
    return requests.get(`/pos/shifts/${id}/preview`, { headers });
  },
  closeShift: async (id, data, headers = {}) => {
    return requests.post(`/pos/shifts/${id}/close`, data, { headers });
  },
  getShiftHistory: async (params = {}, headers = {}) => {
    return requests.get("/pos/shifts/history", { params, headers });
  },

  // ── Day closing ─────────────────────────────────────────────
  getDayStatus: async (params = {}, headers = {}) => {
    return requests.get("/pos/day/status", { params, headers });
  },
  closeDay: async (data, headers = {}) => {
    return requests.post("/pos/day/close", data, { headers });
  },
  getDayClosing: async (params = {}, headers = {}) => {
    return requests.get("/pos/day/report", { params, headers });
  },
  getDayClosingHistory: async (params = {}, headers = {}) => {
    return requests.get("/pos/day/history", { params, headers });
  },
};

export default PosServices;
