import requests from "./httpService";

/**
 * Per-business 360Messenger / WhatsApp integration (Settings → Integrations).
 * Backend: `/api/WhatsApp/*`
 */
const WhatsAppIntegrationServices = {
  saveDetails(payload) {
    return requests.post("/WhatsApp/save-details", payload);
  },

  getByBusinessId(businessId) {
    return requests.get(`/WhatsApp/get_by_business_id/${businessId}`);
  },

  testConnection(businessId) {
    return requests.get(`/WhatsApp/test-connection/${businessId}`);
  },

  /** Reveal the saved API key — requires the current user's login password. */
  revealApiKey(businessId, userPassword) {
    return requests.post(`/WhatsApp/reveal-api-key/${businessId}`, {
      userPassword,
    });
  },

  disconnect(businessId) {
    return requests.post(`/WhatsApp/disconnect/${businessId}`);
  },
};

export default WhatsAppIntegrationServices;
