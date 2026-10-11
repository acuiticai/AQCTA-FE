import requests from "./httpService";

const BASE = "/onboarding/invitations";

const OnboardingInvitationServices = {
  // Feature flag — public, no auth required.
  getRegistrationMode: async () => {
    return requests.get(`${BASE}/mode`);
  },

  // Admin
  list: async ({ search = "", status = "", planId = "", page = 1, limit = 25 } = {}) => {
    return requests.get(BASE, {
      params: {
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(planId ? { planId } : {}),
        page,
        limit,
      },
    });
  },

  getById: async (id) => {
    return requests.get(`${BASE}/id/${id}`);
  },

  create: async (body) => {
    return requests.post(BASE, body);
  },

  assignPlan: async (id, body) => {
    return requests.post(`${BASE}/${id}/assign-plan`, body);
  },

  generateLink: async (id, { rotate = false } = {}) => {
    return requests.post(`${BASE}/${id}/generate-link`, { rotate });
  },

  sendEmail: async (id) => {
    return requests.post(`${BASE}/${id}/send-email`, {});
  },

  resend: async (id) => {
    return requests.post(`${BASE}/${id}/resend`, {});
  },

  expire: async (id) => {
    return requests.post(`${BASE}/${id}/expire`, {});
  },

  deactivate: async (id) => {
    return requests.post(`${BASE}/${id}/deactivate`, {});
  },

  reactivate: async (id) => {
    return requests.post(`${BASE}/${id}/reactivate`, {});
  },

  cancel: async (id) => {
    return requests.post(`${BASE}/${id}/cancel`, {});
  },

  remove: async (id) => {
    return requests.delete(`${BASE}/${id}`);
  },

  // Customer — public token lookup, no auth required.
  getByToken: async (token) => {
    return requests.get(`${BASE}/${token}`);
  },

  // Customer — requires an authenticated session.
  createCheckout: async (token, couponCode) => {
    return requests.post(`${BASE}/${token}/create-checkout`, {
      couponCode: couponCode || undefined,
    });
  },

  verifyPayment: async (token, sessionId) => {
    return requests.post(`${BASE}/${token}/verify-payment`, { sessionId });
  },
};

export default OnboardingInvitationServices;
