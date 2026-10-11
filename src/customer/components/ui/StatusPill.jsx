import React from "react";

/**
 * Status vocabulary for the portal.
 *
 * Status colours are reserved — they never double as chart series colours — and
 * each pill always carries its label, so state is never communicated by colour
 * alone. Unknown values fall back to the neutral tone rather than throwing, so a
 * new backend status degrades gracefully instead of breaking a table.
 */
export const STATUS_TONES = {
  // Scheduling
  confirmed: "success",
  certified: "success",
  completed: "success",
  scheduled: "info",
  proposed: "warning",
  awaiting: "danger-soft",
  // Applications
  "under review": "warning",
  "in review": "warning",
  "in progress": "info",
  "action required": "danger",
  "pending approval": "warning",
  rejected: "danger",
  draft: "neutral",
  submitted: "info",
  // Enquiries
  open: "info",
  responded: "success",
  converted: "danger-soft",
  closed: "neutral",
  spam: "danger",
  // Documents
  attached: "success",
  missing: "danger",
  accepted: "success",
  referenced: "info",
  // Finance
  paid: "success",
  unpaid: "danger",
  overdue: "danger",
  pending: "warning",
};

export function statusTone(status) {
  return STATUS_TONES[String(status || "").toLowerCase()] || "neutral";
}

export default function StatusPill({ status, tone }) {
  const resolved = tone || statusTone(status);
  return <span className={`epc-pill epc-pill--${resolved}`}>{status}</span>;
}
