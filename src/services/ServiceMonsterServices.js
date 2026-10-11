import requests from "./httpService";

/**
 * ServiceMonster integration API client.
 *
 * Mirrors the backend `/api/ServiceMonster/*` routes mounted by
 * `PCI-BE/Business/BusinessServiceMonster/routes.js`. Used by the
 * Settings → Integrations → ServiceMonster Integration page.
 */
const ServiceMonsterServices = {
  /** Save (or update) ServiceMonster Basic auth credentials for a business. */
  saveDetails(payload) {
    // payload: { business_id, username, password }
    return requests.post("/ServiceMonster/save-details", payload);
  },

  /** Read the saved record (without the raw password). */
  getByBusinessId(businessId) {
    return requests.get(`/ServiceMonster/get_by_business_id/${businessId}`);
  },

  /** Reveal the saved password — requires the current user's password. */
  revealPassword(businessId, userPassword) {
    return requests.post(`/ServiceMonster/get-password/${businessId}`, {
      userPassword,
    });
  },

  /** Probe ServiceMonster `/account` to validate credentials. */
  testConnection(businessId) {
    return requests.get(`/ServiceMonster/test-connection/${businessId}`);
  },

  /** Soft-disconnect: keeps the record but disables sync + webhooks. */
  disconnect(businessId) {
    return requests.post(`/ServiceMonster/disconnect/${businessId}`);
  },

  /** Pull customers from ServiceMonster. First call needs ?startDate=YYYY-MM-DD. */
  syncCustomers(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/ServiceMonster/customers/${businessId}${qs}`);
  },

  /** Pull invoices (Orders of type "Invoice") from ServiceMonster. */
  syncOrders(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/ServiceMonster/orders/${businessId}${qs}`);
  },

  /** Pull payments and attach them to the matching invoices. */
  syncPayments(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/ServiceMonster/payments/${businessId}${qs}`);
  },

  /** Pull catalog items from ServiceMonster. */
  syncItems(businessId, startDate) {
    const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    return requests.get(`/ServiceMonster/items/${businessId}${qs}`);
  },

  /** Subscribe to all supported ServiceMonster webhook events. */
  subscribeAllWebhooks(businessId) {
    return requests.post(`/ServiceMonster/webhook/subscribe-all/${businessId}`);
  },

  /** Unsubscribe from every active ServiceMonster webhook subscription. */
  unsubscribeAllWebhooks(businessId) {
    return requests.post(
      `/ServiceMonster/webhook/unsubscribe-all/${businessId}`
    );
  },

  /** Get the active webhook subscriptions and the public webhook URL. */
  getWebhookStatus(businessId) {
    return requests.get(`/ServiceMonster/webhook/status/${businessId}`);
  },

  /** Get the in-memory webhook event log for a business. */
  getWebhookLogs(businessId, limit = 100) {
    return requests.get(
      `/ServiceMonster/webhook/logs/${businessId}?limit=${limit}`
    );
  },

  /** Clear the in-memory webhook event log for a business. */
  clearWebhookLogs(businessId) {
    return requests.delete(`/ServiceMonster/webhook/logs/${businessId}`);
  },
};

export default ServiceMonsterServices;
