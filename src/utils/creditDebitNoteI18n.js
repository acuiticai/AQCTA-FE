/**
 * Credit / Debit Note i18n helpers (Accounts modules).
 */

export const CREDIT_NOTE_STATUS_KEY = {
  Draft: "draft",
  Created: "created",
  "Approved by Management": "approvedByManagement",
  "Make Transaction": "makeTransaction",
  "Approve Transaction": "approveTransaction",
  "Applied to Invoice": "appliedToInvoice",
  Cancelled: "cancelled",
};

export const DEBIT_NOTE_STATUS_KEY = {
  Draft: "draft",
  Created: "created",
  "Approved by Management": "approvedByManagement",
  Settled: "settled",
  Cancelled: "cancelled",
};

export const LHDN_STATUS_KEY = {
  Pending: "pending",
  Submitted: "submitted",
  Valid: "valid",
  Invalid: "invalid",
  Rejected: "rejected",
  Cancelled: "cancelled",
};

export function makeCreditNoteT(t) {
  return (key, defaultValue, options = {}) =>
    t(`accounts.creditNotes.${key}`, { defaultValue, ...options });
}

export function makeDebitNoteT(t) {
  return (key, defaultValue, options = {}) =>
    t(`accounts.debitNotes.${key}`, { defaultValue, ...options });
}

export function translateCreditNoteStatus(t, status, options = {}) {
  if (!status) return options.empty ?? "—";
  const key = CREDIT_NOTE_STATUS_KEY[status];
  if (!key) return status;
  return t(`accounts.creditNotes.statuses.${key}`, {
    defaultValue: status,
    ...options,
  });
}

export function translateDebitNoteStatus(t, status, options = {}) {
  if (!status) return options.empty ?? "—";
  const key = DEBIT_NOTE_STATUS_KEY[status];
  if (!key) return status;
  return t(`accounts.debitNotes.statuses.${key}`, {
    defaultValue: status,
    ...options,
  });
}

export function translateLhdnStatus(t, status, namespace = "creditNotes", options = {}) {
  if (!status) return options.empty ?? "—";
  const key = LHDN_STATUS_KEY[status];
  if (!key) return status;
  return t(`accounts.${namespace}.lhdnStatuses.${key}`, {
    defaultValue: status,
    ...options,
  });
}
