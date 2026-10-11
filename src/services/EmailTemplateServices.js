import requests from "./httpService";

const EmailTemplateServices = {
  // Get email template by ID
  getTemplateById: async (id) => {
    return requests.get(`/email-template/template/${id}`);
  },

  // Get email template by name
  getTemplateByName: async (name) => {
    return requests.get(`/email-template/template/name/${name}`);
  },

  // Get all email templates
  getAllTemplates: async (params = {}) => {
    return requests.get("/email-template/templates", { params });
  },

  // Create new email template
  createTemplate: async (body) => {
    return requests.post("/email-template/template", body);
  },

  // Update email template
  updateTemplate: async (id, body) => {
    return requests.put(`/email-template/template/${id}`, body);
  },

  // Delete email template
  deleteTemplate: async (id) => {
    return requests.delete(`/email-template/template/${id}`);
  },

  // Get template by category
  getTemplatesByCategory: async (category) => {
    return requests.get(`/email-template/templates/category/${category}`);
  },
};

export default EmailTemplateServices;
