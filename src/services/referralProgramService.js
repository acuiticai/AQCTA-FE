import requests from "./httpService";

const referralProgramService = {
  getOverview: () => requests.get("referral-program/overview"),

  listReferrers: (params) =>
    requests.get("referral-program/referrers", { params }),

  createReferrer: (body) => requests.post("referral-program/referrers", body),

  getReferrer: (id) => requests.get(`referral-program/referrers/${id}`),

  updateReferrer: (id, body) =>
    requests.patch(`referral-program/referrers/${id}`, body),

  recordReferral: (id, body) =>
    requests.post(`referral-program/referrers/${id}/record`, body),

  deleteReferrer: (id) => requests.delete(`referral-program/referrers/${id}`),
};

export default referralProgramService;
