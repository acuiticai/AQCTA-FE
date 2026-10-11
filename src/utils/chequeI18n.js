/**
 * Shared cheque i18n helpers — status labels stay API-English; display via statuses.*.
 */
export const CHEQUE_STATUS_KEY = {
  Draft: "draft",
  Issued: "issued",
  "Due Soon": "dueSoon",
  Cleared: "cleared",
  Bounced: "bounced",
  Cancelled: "cancelled",
  Replaced: "replaced",
  Pending: "draft",
};

/** Translate a cheque status API value for display. */
export function translateChequeStatus(t, status, options = {}) {
  if (!status) return options.empty ?? "—";
  const key = CHEQUE_STATUS_KEY[status];
  if (!key) return status;
  const fallback =
    status === "Pending" ? "Draft" : status;
  return t(`accounts.cheques.statuses.${key}`, {
    defaultValue: fallback,
    ...options,
  });
}

/** Short helper factory matching vendorPayments pattern. */
export function makeChequeT(t) {
  return (key, defaultValue, options = {}) =>
    t(`accounts.cheques.${key}`, { defaultValue, ...options });
}

export function makeChequeReportsT(t) {
  return (key, defaultValue, options = {}) =>
    t(`accounts.chequeReports.${key}`, { defaultValue, ...options });
}
