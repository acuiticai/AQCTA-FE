import requests from "./httpService";

/**
 * Zoho Books integration — aligns with PCI-BE `/api/Zoho/` routes.
 */
const ZohoBooksServices = {
  saveDetails(payload) {
    return requests.post("/Zoho/save-details", payload);
  },

  getByBusinessId(businessId) {
    return requests.get(`/Zoho/get_by_business_id/${businessId}`);
  },

  authorizationUrl(businessId) {
    return requests.get(`/Zoho/authorization-url/${businessId}`);
  },

  disconnect(businessId) {
    return requests.post(`/Zoho/disconnect/${businessId}`, {});
  },

  refreshToken(businessId) {
    return requests.get(`/Zoho/refresh-token/${businessId}`);
  },

  listOrganizations(businessId) {
    return requests.get(`/Zoho/organizations/${businessId}`);
  },

  selectOrganization(businessId, organizationId, organizationName) {
    return requests.post(`/Zoho/select-organization/${businessId}`, {
      organizationId,
      organizationName,
    });
  },

  testConnection(businessId) {
    return requests.get(`/Zoho/test-connection/${businessId}`);
  },

  syncCustomers(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/customers/${businessId}${qs}`);
  },

  syncItems(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/items/${businessId}${qs}`);
  },

  syncInvoices(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/invoices/${businessId}${qs}`);
  },

  syncSalesOrders(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/sales-orders/${businessId}${qs}`);
  },

  syncRecurringInvoices(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/recurring-invoices/${businessId}${qs}`);
  },

  syncEstimates(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/estimates/${businessId}${qs}`);
  },

  syncPayments(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/payments/${businessId}${qs}`);
  },

  syncVendors(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/vendors/${businessId}${qs}`);
  },

  syncChartAccounts(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/chart-accounts/${businessId}${qs}`);
  },

  syncBankAccounts(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/Zoho/bank-accounts/${businessId}${qs}`);
  },
};

export default ZohoBooksServices;
