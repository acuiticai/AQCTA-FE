import requests from "./httpService";

const RegistrationServices = {
  isEnabled: async () => {
    return requests.get("/registration/enabled");
  },

  register: async (body) => {
    return requests.post("/registration/start", body);
  },

  verifyEmail: async ({ email, otp }) => {
    return requests.post("/registration/verify-email", { email, otp });
  },

  resendVerification: async (email) => {
    return requests.post("/registration/resend-verification", { email });
  },

  setPassword: async (body) => {
    return requests.post("/registration/set-password", body);
  },

  getModules: async () => {
    return requests.get("/registration/modules");
  },

  getSubscriptionStatus: async () => {
    return requests.get("/registration/subscription-status");
  },

  selectModules: async (
    modules,
    { adjustment = false, subModules = [] } = {},
  ) => {
    return requests.post("/registration/select-modules", {
      modules,
      subModules,
      adjustment: adjustment || undefined,
    });
  },

  getPricingQuote: async (
    billingInterval = "monthly",
    { adjustment = false, planId = null, userCount = null } = {},
  ) => {
    return requests.get("/registration/pricing-quote", {
      params: {
        billingInterval,
        ...(adjustment ? { adjustment: "true" } : {}),
        ...(planId ? { planId } : {}),
        ...(userCount != null ? { userCount } : {}),
      },
    });
  },

  getPricingPlans: async ({ activeOnly, channel } = {}) => {
    const params = new URLSearchParams();
    if (activeOnly) params.set("activeOnly", "true");
    if (channel) params.set("channel", channel);
    const qs = params.toString();
    return requests.get(
      `/registration/pricing-plans${qs ? `?${qs}` : ""}`,
    );
  },

  getPricingPlan: async (id) => {
    return requests.get(`/registration/pricing-plans/${id}`);
  },

  createPricingPlan: async (body) => {
    return requests.post("/registration/pricing-plans", body);
  },

  updatePricingPlan: async (id, body) => {
    return requests.put(`/registration/pricing-plans/${id}`, body);
  },

  deletePricingPlan: async (id) => {
    return requests.delete(`/registration/pricing-plans/${id}`);
  },

  selectPlan: async ({
    planId,
    billingInterval,
    adjustment = false,
    userCount = null,
  }) => {
    return requests.post("/registration/select-plan", {
      planId,
      billingInterval,
      adjustment: adjustment || undefined,
      ...(userCount != null ? { userCount } : {}),
    });
  },

  createCheckout: async (couponCode) => {
    return requests.post("/registration/create-checkout", {
      couponCode: couponCode || undefined,
    });
  },

  verifyPayment: async (sessionId, tokenization = {}) => {
    const body = { sessionId };
    if (tokenization?.extraP != null) body.extraP = tokenization.extraP;
    if (tokenization?.token) body.token = tokenization.token;
    if (tokenization?.cclast4) body.cclast4 = tokenization.cclast4;
    if (tokenization?.ccbrand) body.ccbrand = tokenization.ccbrand;
    if (tokenization?.CustID) body.CustID = tokenization.CustID;
    return requests.post("/registration/verify-payment", body);
  },

  activateDummy: async () => {
    return requests.post("/registration/activate-dummy", {});
  },

  getBillingOverview: async () => {
    return requests.get("/registration/billing/overview");
  },

  getBillingInvoices: async () => {
    return requests.get("/registration/billing/invoices");
  },

  getSubscriptionSettings: async () => {
    return requests.get("/registration/subscription-settings");
  },

  updateSubscriptionSettings: async (body) => {
    return requests.put("/registration/subscription-settings", body);
  },

  cancelSubscription: async ({ immediately = false } = {}) => {
    return requests.post("/registration/billing/cancel", { immediately });
  },

  resumeSubscription: async () => {
    return requests.post("/registration/billing/resume", {});
  },

  openBillingPortal: async (returnUrl) => {
    return requests.post("/registration/billing/portal", { returnUrl });
  },

  createRenewalCheckout: async () => {
    return requests.post("/registration/billing/renew", {});
  },

  retryFailedPayment: async () => {
    return requests.post("/registration/billing/retry-payment", {});
  },

  applyAdjustment: async ({ planId, billingInterval, userCount = null } = {}) => {
    return requests.post("/registration/apply-adjustment", {
      planId,
      billingInterval,
      ...(userCount != null ? { userCount } : {}),
    });
  },
};

export default RegistrationServices;
