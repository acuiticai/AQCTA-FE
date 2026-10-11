import requests from "./httpService";

const BankReconciliationServices = {
  // History for one bank account
  getReconciliations: async (accountId, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    return requests.get(
      `/bank-reconciliation/${accountId}${query ? `?${query}` : ""}`
    );
  },

  // Everything the matching workspace needs
  getDetail: async (id) => {
    return requests.get(`/bank-reconciliation/detail/${id}`);
  },

  createReconciliation: async (body) => {
    return requests.post("/bank-reconciliation", body);
  },

  updateSelection: async (id, transactionIds) => {
    return requests.put(`/bank-reconciliation/${id}/selection`, {
      transactionIds,
    });
  },

  updateClosingBalance: async (id, closingBalance) => {
    return requests.put(`/bank-reconciliation/${id}/closing-balance`, {
      closingBalance,
    });
  },

  addTransaction: async (id, body) => {
    return requests.post(`/bank-reconciliation/${id}/transaction`, body);
  },

  // Reverse a book entry that should not have posted (failed/duplicate payment).
  reverseTransaction: async (id, txnId, reason) => {
    return requests.post(
      `/bank-reconciliation/${id}/transaction/${txnId}/reverse`,
      { reason }
    );
  },

  // Statement-line matching (1:1, many-to-one, one-to-many).
  createMatch: async (id, body) => {
    return requests.post(`/bank-reconciliation/${id}/match`, body);
  },
  removeMatch: async (id, matchId) => {
    return requests.delete(`/bank-reconciliation/${id}/match/${matchId}`);
  },

  // Investigative treatment for a bank line: unidentified / ignored / unmatched.
  setLineStatus: async (id, lineId, status, note) => {
    return requests.put(
      `/bank-reconciliation/${id}/statement-line/${lineId}/status`,
      { status, note }
    );
  },

  getActivity: async (id) => {
    return requests.get(`/bank-reconciliation/${id}/activity`);
  },

  updateReconciliation: async (id, body) => {
    return requests.put(`/bank-reconciliation/${id}`, body);
  },

  // The file goes to the shared Documents service first; this records the
  // reference against the reconciliation.
  attachDocument: async (id, document) => {
    return requests.post(`/bank-reconciliation/${id}/attachments`, document);
  },

  removeDocument: async (id, fileId) => {
    return requests.delete(`/bank-reconciliation/${id}/attachments/${fileId}`);
  },

  reconcile: async (id) => {
    return requests.post(`/bank-reconciliation/${id}/reconcile`, {});
  },

  unreconcile: async (id, reason) => {
    return requests.post(`/bank-reconciliation/${id}/unreconcile`, { reason });
  },

  deleteDraft: async (id) => {
    return requests.delete(`/bank-reconciliation/${id}`);
  },

  getStatusReport: async (id) => {
    return requests.get(`/bank-reconciliation/${id}/status-report`);
  },
};

export default BankReconciliationServices;
