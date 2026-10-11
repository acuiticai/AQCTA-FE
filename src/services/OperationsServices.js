import requests from "./httpService";

const OperationsServices = {
  // Campaigns
  createCampaign: async (body) => {
    return requests.post("operations/campaigns", body);
  },
  getCampaigns: async (params) => {
    return requests.get("operations/campaigns", { params });
  },
  getCampaignById: async (id) => {
    return requests.get(`operations/campaigns/${id}`);
  },
  updateCampaign: async (id, body) => {
    return requests.put(`operations/campaigns/${id}`, body);
  },
  bulkUpdateCampaignStatus: async (body) => {
    return requests.patch("operations/campaigns/bulk/status", body);
  },
  duplicateCampaign: async (id) => {
    return requests.post(`operations/campaigns/${id}/duplicate`);
  },
  deleteCampaign: async (id) => {
    return requests.delete(`operations/campaigns/${id}`);
  },
  getCampaignApplications: async (campaignId, params) => {
    return requests.get(`operations/campaigns/${campaignId}/applications`, {
      params,
    });
  },
  updateCampaignApplicationStatus: async (campaignId, applicationId, status, reason = "") => {
    return requests.put(
      `operations/campaigns/${campaignId}/applications/${applicationId}/status`,
      { status, reason }
    );
  },
  updateCampaignApplicationDispatch: async (campaignId, applicationId, body) => {
    return requests.post(
      `operations/campaigns/${campaignId}/applications/${applicationId}/dispatch`,
      body
    );
  },
  getCampaignApplicationDispatch: async (campaignId, applicationId) => {
    return requests.get(
      `operations/campaigns/${campaignId}/applications/${applicationId}/dispatch`
    );
  },
  confirmCampaignApplicationDispatch: async (campaignId, applicationId) => {
    return requests.patch(
      `operations/campaigns/${campaignId}/applications/${applicationId}/dispatch/confirm`
    );
  },
  uploadCampaignApplicationProof: async (campaignId, applicationId, body) => {
    return requests.post(
      `operations/campaigns/${campaignId}/applications/${applicationId}/proof`,
      body
    );
  },
  getCampaignApplicationProof: async (campaignId, applicationId) => {
    return requests.get(
      `operations/campaigns/${campaignId}/applications/${applicationId}/proof`
    );
  },
  approveCampaignApplicationProof: async (campaignId, applicationId) => {
    return requests.patch(
      `operations/campaigns/${campaignId}/applications/${applicationId}/proof/approve`
    );
  },
  rejectCampaignApplicationProof: async (campaignId, applicationId, body) => {
    return requests.patch(
      `operations/campaigns/${campaignId}/applications/${applicationId}/proof/reject`,
      body
    );
  },
  getCampaignApplicationActivityLogs: async (campaignId, applicationId, params) => {
    return requests.get(
      `operations/campaigns/${campaignId}/applications/${applicationId}/activity-logs`,
      { params }
    );
  },

  getBusinessById: async (businessId) => {
    return requests.get(`business/${businessId}`);
  },
};

export default OperationsServices;
