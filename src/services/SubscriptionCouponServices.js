import requests from "./httpService";

const SubscriptionCouponServices = {
  validate: async ({ couponCode, planId, amount, userId }) => {
    return requests.post("/coupons/validate", {
      couponCode,
      planId,
      amount,
      userId,
    });
  },

  list: async () => {
    return requests.get("/coupons");
  },

  get: async (id) => {
    return requests.get(`/coupons/${id}`);
  },

  create: async (body) => {
    return requests.post("/coupons", body);
  },

  update: async (id, body) => {
    return requests.put(`/coupons/${id}`, body);
  },

  remove: async (id) => {
    return requests.delete(`/coupons/${id}`);
  },

  resendEmail: async (id) => {
    return requests.post(`/coupons/${id}/send-email`, {});
  },

  searchUsers: async (q, limit = 20) => {
    return requests.get("/coupons/users/search", {
      params: { q, limit },
    });
  },
};

export default SubscriptionCouponServices;
