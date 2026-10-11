/** Shared reviewHistory → timeline helpers for admin + customer portals. */

export const REVIEW_ACTION_TITLES = {
  assigned: "Assigned",
  approved: "Approved",
  request_info: "Additional information requested",
  rejected: "Rejected",
  submitted: "Application submitted",
  resubmitted: "Application resubmitted",
  status_change: "Status changed",
};

/** Customer-facing actions only (matches backend CUSTOMER_VISIBLE_LOG_ACTIONS). */
export const CUSTOMER_VISIBLE_LOG_ACTIONS = new Set([
  "submitted",
  "resubmitted",
  "approved",
  "request_info",
  "rejected",
]);

export const formatTimelineDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fallbackTimeline = (row, { customerFacing = false } = {}) => {
  const status = row?.status || "Draft";
  const isDraft = status === "Draft";
  return [
    {
      date: formatTimelineDate(
        row?.submittedAt || row?.createdAt || row?.updatedAt,
      ),
      title: isDraft ? "Draft saved" : "Application submitted",
      note: isDraft
        ? customerFacing
          ? "You can continue editing this draft"
          : "Customer can continue editing this draft"
        : customerFacing
          ? "Submission locked for review"
          : "Submission locked for review",
      tone: "done",
    },
    {
      date: formatTimelineDate(row?.updatedAt),
      title: row?.commercialStage || row?.stage || "In progress",
      note: `Current status: ${status}`,
      tone: "current",
    },
  ];
};

/**
 * @param {object} row - application list/detail item
 * @param {{ customerFacing?: boolean }} options
 *   customerFacing: filter to required/customer-visible logs; hide actor names
 */
export const buildApplicationTimeline = (
  row,
  { customerFacing = false } = {},
) => {
  let history = Array.isArray(row?.reviewHistory)
    ? [...row.reviewHistory]
    : [];

  if (customerFacing) {
    history = history.filter((entry) => {
      if (!entry) return false;
      const action = String(entry.action || "").toLowerCase();
      if (action === "assigned") return false;
      if (entry.customerVisible === true) return true;
      if (entry.customerVisible === false) return false;
      return CUSTOMER_VISIBLE_LOG_ACTIONS.has(action);
    });
  }

  if (!history.length) {
    return fallbackTimeline(row, { customerFacing });
  }

  history.sort(
    (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
  );

  return history.map((entry, idx) => {
    const action = String(entry.action || "").toLowerCase();
    let title = REVIEW_ACTION_TITLES[action] || entry.action || "Update";
    if (
      !customerFacing &&
      action === "status_change" &&
      (entry.fromStatus || entry.toStatus)
    ) {
      title = `Status: ${entry.fromStatus || "—"} → ${entry.toStatus || "—"}`;
    }

    let note;
    if (customerFacing) {
      note = entry.remarks || entry.toStatus || undefined;
    } else {
      const noteParts = [entry.remarks, entry.byName].filter(Boolean);
      note = noteParts.length ? noteParts.join(" · ") : undefined;
    }

    return {
      date: formatTimelineDate(entry.at),
      title,
      note: note || undefined,
      tone: idx === 0 ? "current" : "done",
    };
  });
};
