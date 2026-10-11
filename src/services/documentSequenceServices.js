import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const getDocumentSequences = (params = {}) => {
  return axios.get(`${API_URL}/document-sequences`, { params });
};

export const previewDocumentSequence = (prefix, padding = 6, startingNumber = 1) => {
  return axios.get(`${API_URL}/document-sequences/preview`, {
    params: { prefix, padding, startingNumber },
  });
};

export const saveDocumentSequence = (data) => {
  return axios.post(`${API_URL}/document-sequences`, data);
};

export const updateDocumentSequence = (id, data) => {
  return axios.put(`${API_URL}/document-sequences/${id}`, data);
};

export const deleteDocumentSequence = (id) => {
  return axios.delete(`${API_URL}/document-sequences/${id}`);
};

// Preview next number WITHOUT incrementing the counter (safe to call on business select).
// Pass options.sourceDocumentType + options.sourceDocumentNumber for linked conversion preview.
export const getNextDocumentNumber = (
  documentType,
  businessId,
  businessGroupId,
  options = {},
) => {
  const { sourceDocumentType, sourceDocumentNumber } = options;
  return axios.get(`${API_URL}/document-sequences/next`, {
    params: {
      documentType,
      businessId,
      businessGroupId,
      ...(sourceDocumentType ? { sourceDocumentType } : {}),
      ...(sourceDocumentNumber ? { sourceDocumentNumber } : {}),
    },
  });
};

// Atomically increment and get the number — call ONLY on actual document save
// Options: { sourceDocumentType, sourceDocumentNumber } for linked document inheritance
export const generateDocumentNumber = (documentType, businessId, businessGroupId, options = {}) => {
  return axios.post(`${API_URL}/document-sequences/generate`, {
    documentType,
    businessId,
    businessGroupId,
    ...options,
  });
};

// Get the actual highest document number already saved in DB for a business group + prefix.
// Use in the Document Numbering settings UI to show current state before user configures.
// Returns: { actualMax, currentFormatted, suggestedStarting, suggestedFormatted }
export const getCurrentMaxDocumentNumber = (documentType, businessGroupId, prefix) => {
  return axios.get(`${API_URL}/document-sequences/current-max`, {
    params: { documentType, businessGroupId, prefix },
  });
};
