import requests from "./httpService";

const DocTypesServices = {
  URLS: {
    createDocType: "doc-types/",
    getAllDocTypes: "doc-types/",
    getDocTypesByStatus: "doc-types/status/",
    getDocTypesByType: "doc-types/type",
    bulkUpdateStatus: "doc-types/bulk-update-status",
    getDocTypeById: "doc-types/",
    updateDocType: "doc-types/",
    deleteDocType: "doc-types/",
  },

  // Create new doc type
  createDocType: async (body) => {
    return requests.post("doc-types/", body);
  },

  // Get all doc types with optional params
  getAllDocTypes: async (params) => {
    return requests.get("doc-types/", {
      params,
    });
  },

  // Get doc types by status
  getDocTypesByStatus: async (status) => {
    return requests.get("doc-types/status/" + status);
  },

  // Get doc types by type
  getDocTypesByType: async (type) => {
    return requests.get("doc-types/type/" + type);
  },

  // Bulk update status
  bulkUpdateStatus: async (body) => {
    return requests.post("doc-types/bulk-update-status", body);
  },

  // Get single doc type by ID
  getDocTypeById: async (id) => {
    return requests.get("doc-types/" + id);
  },

  // Update doc type
  updateDocType: async (id, body) => {
    return requests.put("doc-types/" + id, body);
  },

  // Delete doc type
  deleteDocType: async (id) => {
    return requests.delete("doc-types/" + id);
  },
};

export default DocTypesServices;
