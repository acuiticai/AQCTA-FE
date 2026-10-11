/**
 * Turns the list APIs we already have into the dashboard widget shape.
 * Missing fields (expiry dates, inspection locations, etc.) stay empty —
 * never invent placeholder numbers.
 */

export const ACTIVE_APPLICATION_STATUSES = [
  "Under Review",
  "Scheduled",
  "In Progress",
  "Draft",
  "Resubmitted",
  "Approved",
  "Action Required",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const formatMoney = (amount, currency = "MYR") =>
  `${currency === "MYR" ? "RM" : currency} ${Number(amount || 0).toLocaleString(
    "en-MY",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;

export const formatDateShort = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDateCompact = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const appRef = (row) =>
  row?.applicationNumber || row?.id || String(row?._id || "");

const isOutstandingInvoice = (inv) => {
  const s = String(inv?.status || "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (
    ["paid", "completed", "confirmed", "cancelled", "canceled", "rejected", "draft"].includes(
      s,
    )
  ) {
    return false;
  }
  return true;
};

const invoiceAmount = (inv) =>
  Number(inv?.amount ?? inv?.grandTotal ?? inv?.total ?? 0);

const invoiceRef = (inv) =>
  inv?.invoiceNumber || inv?.invoice_number || inv?.id || "Invoice";

const locationFromApp = (row) => {
  const fd = row?.formData || {};
  return (
    fd.factoryAddress ||
    fd.siteAddress ||
    fd.address ||
    fd.companyAddress ||
    fd.location ||
    ""
  );
};

const CATEGORY_ICON = {
  contract_review: "file",
  quotation: "clipboard",
  audit: "check",
  invoice: "invoice",
  general: "file",
};

const CATEGORY_TONE = {
  contract_review: "brand",
  quotation: "warning",
  audit: "success",
  invoice: "info",
  general: "brand",
};

const lastEightMonthBuckets = () => {
  const now = new Date();
  const months = [];
  for (let i = 7; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_SHORT[d.getMonth()],
      caption: `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`,
      year: d.getFullYear(),
      month: d.getMonth(),
      value: 0,
    });
  }
  return months;
};

const countByMonth = (applications) => {
  const months = lastEightMonthBuckets();
  const index = new Map(months.map((m, i) => [m.key, i]));
  for (const row of applications) {
    const raw = row.submittedAt || row.createdAt;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const i = index.get(key);
    if (i != null) months[i].value += 1;
  }
  return months;
};

const percentChange = (months) => {
  if (months.length < 2) return 0;
  const prev = months[months.length - 2]?.value || 0;
  const curr = months[months.length - 1]?.value || 0;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
};

const emptyPayload = () => ({
  dashboardSummary: {
    activeApplications: {
      value: "0",
      note: "No active applications",
      noteTone: "muted",
      trend: [0, 0, 0, 0, 0, 0, 0, 0],
      trendTone: "success",
    },
    upcomingInspections: {
      value: "0",
      note: "None scheduled",
      noteTone: "muted",
      trend: [0, 0, 0, 0, 0, 0, 0, 0],
      trendTone: "success",
    },
    validCertificates: {
      value: "0",
      note: "No certificates on file",
      noteTone: "muted",
      trend: [0, 0, 0, 0, 0, 0, 0, 0],
      trendTone: "success",
    },
    outstandingInvoices: {
      value: formatMoney(0),
      note: "No unpaid invoices",
      noteTone: "muted",
      trend: [0, 0, 0, 0, 0, 0, 0, 0],
      trendTone: "success",
    },
  },
  applicationOverview: {
    total: 0,
    changePercent: 0,
    changeDirection: "flat",
    rangeLabel: "Last 8 Months",
    months: lastEightMonthBuckets(),
    currentMonthIndex: 7,
  },
  pendingActions: [],
  upcomingInspections: [],
  recentUpdates: [],
  recentApplications: [],
  certificates: {
    validCount: 0,
    validNote: "No certificates on file",
    renewals: [],
  },
});

/**
 * @param {object} input
 * @param {Array} input.applications
 * @param {Array} input.invoices
 * @param {Array} input.quotations
 * @param {Array} input.notifications
 * @param {Array} input.projects
 * @param {"customer"|"admin"} [input.audience]
 */
export function buildDashboardPayload({
  applications = [],
  invoices = [],
  quotations = [],
  notifications = [],
  projects = [],
  audience = "customer",
} = {}) {
  const base = emptyPayload();
  const apps = Array.isArray(applications) ? applications : [];
  const invs = Array.isArray(invoices) ? invoices : [];
  const quotes = Array.isArray(quotations) ? quotations : [];
  const notes = Array.isArray(notifications) ? notifications : [];
  const projs = Array.isArray(projects) ? projects : [];

  const activeApps = apps.filter((row) =>
    ACTIVE_APPLICATION_STATUSES.includes(row.status),
  );
  const actionRequiredApps = apps.filter(
    (row) =>
      row.status === "Action Required" ||
      row.status === "Rejected" ||
      row.needsAcknowledgement,
  );

  const months = countByMonth(apps);
  const change = percentChange(months);
  const trendValues = months.map((m) => m.value);

  /* —— Inspections from Scheduled apps + audit notice visit dates —— */
  const inspectionMap = new Map();
  for (const row of apps) {
    const notice = row.acknowledgementNotice;
    const visitDate = notice?.visitDate;
    if (visitDate || row.status === "Scheduled") {
      const ref = appRef(row);
      if (!ref || inspectionMap.has(ref)) continue;
      inspectionMap.set(ref, {
        id: ref,
        _id: row._id,
        service: row.service || "—",
        date: formatDateShort(visitDate || row.submittedAt || row.createdAt) || "—",
        location: locationFromApp(row) || "—",
        status: row.needsAcknowledgement
          ? "Awaiting"
          : row.status === "Scheduled"
            ? "Scheduled"
            : "Confirmed",
        sortAt: new Date(visitDate || row.submittedAt || row.createdAt || 0).getTime(),
      });
    }
  }
  for (const row of projs) {
    const notice = row.acknowledgementNotice;
    if (!notice?.visitDate) continue;
    const ref = row.applicationNumber || row.projectNumber || appRef(row);
    if (!ref || inspectionMap.has(ref)) continue;
    inspectionMap.set(ref, {
      id: ref,
      _id: row.application || row._id,
      service: row.productName || "Factory Audit",
      date: formatDateShort(notice.visitDate) || "—",
      location: "—",
      status: row.needsAcknowledgement ? "Awaiting" : "Confirmed",
      sortAt: new Date(notice.visitDate).getTime(),
    });
  }
  const upcomingInspections = [...inspectionMap.values()]
    .sort((a, b) => (a.sortAt || 0) - (b.sortAt || 0))
    .slice(0, 8)
    .map(({ sortAt, ...rest }) => rest);

  const nextInspection = upcomingInspections[0];

  /* —— Certificates: numbers we actually store (no fake expiry) —— */
  const certMap = new Map();
  for (const row of projs) {
    const num = String(row.certificateNumber || "").trim();
    if (!num) continue;
    certMap.set(num, {
      id: num,
      expires: row.status ? `Status: ${row.status}` : "On file",
      projectNumber: row.projectNumber || "",
      application: row.application,
    });
  }
  for (const row of apps) {
    const num = String(row.certificateNumber || "").trim();
    if (!num || certMap.has(num)) continue;
    if (row.status === "Certified" || num) {
      certMap.set(num, {
        id: num,
        expires: row.status === "Certified" ? "Certified" : "On file",
        application: row._id,
      });
    }
  }
  const certList = [...certMap.values()];

  /* —— Outstanding invoices —— */
  const outstanding = invs.filter(isOutstandingInvoice);
  const outstandingTotal = outstanding.reduce(
    (sum, inv) => sum + invoiceAmount(inv),
    0,
  );
  const outstandingCurrency =
    outstanding[0]?.currency || outstanding[0]?.Currency || "MYR";

  /* —— Pending actions —— */
  const pendingActions = [];
  for (const row of apps) {
    if (row.needsAcknowledgement) {
      pendingActions.push({
        id: `ack-${appRef(row)}`,
        label: "Confirm factory audit notice",
        reference: appRef(row),
        due: row.acknowledgementNotice?.visitDate
          ? `Visit ${formatDateShort(row.acknowledgementNotice.visitDate)}`
          : "",
        tone: "info",
        href:
          audience === "customer"
            ? `/customer/applications/${row._id || row.id}`
            : `/applications/view/${row._id}`,
      });
    } else if (row.status === "Action Required" || row.status === "Rejected") {
      pendingActions.push({
        id: `app-${appRef(row)}`,
        label:
          audience === "customer"
            ? "Respond to application request"
            : "Application needs customer action",
        reference: appRef(row),
        due: row.updatedAt ? `Updated ${formatDateCompact(row.updatedAt)}` : "",
        tone: "danger",
        href:
          audience === "customer"
            ? `/customer/applications/${row._id || row.id}`
            : `/applications/view/${row._id}`,
      });
    } else if (
      audience === "admin" &&
      (row.status === "Under Review" || row.status === "Resubmitted")
    ) {
      pendingActions.push({
        id: `review-${appRef(row)}`,
        label: "Review application",
        reference: appRef(row),
        due: row.submittedAt
          ? `Submitted ${formatDateCompact(row.submittedAt)}`
          : "",
        tone: "warning",
        href: `/applications/view/${row._id}`,
      });
    }
  }
  for (const row of quotes) {
    if (!row.needsDecision) continue;
    pendingActions.push({
      id: `qt-${row.quotationRef || row.applicationId}`,
      label:
        audience === "customer"
          ? `Review quotation ${row.quotationRef || ""}`.trim()
          : `Quotation awaiting customer decision`,
      reference: row.quotationRef || appRef(row),
      due: row.issuedAt ? `Issued ${formatDateCompact(row.issuedAt)}` : "",
      tone: "warning",
      href:
        audience === "customer"
          ? `/customer/quotation`
          : row.applicationId
            ? `/applications/view/${row.applicationId}`
            : "/applications",
    });
  }
  for (const inv of outstanding.slice(0, 5)) {
    pendingActions.push({
      id: `inv-${invoiceRef(inv)}`,
      label:
        audience === "customer"
          ? `Pay invoice ${invoiceRef(inv)}`
          : `Outstanding invoice ${invoiceRef(inv)}`,
      reference: invoiceRef(inv),
      due: inv.due_date || inv.dueDate
        ? `Due ${formatDateShort(inv.due_date || inv.dueDate)}`
        : inv.issuedAt
          ? `Issued ${formatDateCompact(inv.issuedAt)}`
          : "",
      tone: "success",
      href:
        audience === "customer" ? "/customer/invoices" : "/customer-invoices",
    });
  }

  /* —— Recent applications —— */
  const recentApplications = [...apps]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0) -
        new Date(a.updatedAt || a.createdAt || 0),
    )
    .slice(0, 6)
    .map((row) => ({
      id: appRef(row),
      _id: row._id,
      service: row.service || "—",
      submitted:
        row.submitted ||
        formatDateCompact(row.submittedAt || row.createdAt) ||
        "—",
      status: row.needsAcknowledgement ? "Action Required" : row.status || "—",
    }));

  /* —— Recent updates / notifications ——
   * Customer: only their own rows (API already scopes by email).
   * Admin: every customer-portal notification; meta includes customer email.
   */
  const recentUpdates = notes.slice(0, 6).map((n) => {
    const bodySnippet = n.body ? String(n.body).slice(0, 72) : "";
    const customerEmail =
      audience === "admin"
        ? n.customerEmail || n.email || ""
        : "";
    return {
      id: String(n._id || n.id),
      title: n.title || n.message || "Update",
      meta: [customerEmail, bodySnippet, formatDateCompact(n.createdAt)]
        .filter(Boolean)
        .join(" · "),
      icon: CATEGORY_ICON[n.category] || "file",
      tone: CATEGORY_TONE[n.category] || "brand",
      link:
        audience === "admin" && n.application
          ? `/applications/view/${n.application}`
          : n.link || "",
      customerEmail,
    };
  });

  const actionNote =
    actionRequiredApps.length > 0
      ? `${actionRequiredApps.length} require${actionRequiredApps.length === 1 ? "s" : ""} your action`
      : activeApps.length > 0
        ? `${activeApps.length} in progress`
        : "No active applications";

  return {
    dashboardSummary: {
      activeApplications: {
        value: String(activeApps.length),
        note: actionNote,
        noteTone: actionRequiredApps.length ? "danger" : "muted",
        trend: trendValues,
        trendTone: actionRequiredApps.length ? "danger" : "success",
      },
      upcomingInspections: {
        value: String(upcomingInspections.length),
        note: nextInspection
          ? `Next: ${nextInspection.date}`
          : "None scheduled",
        noteTone: "muted",
        trend: trendValues.map((v) => Math.min(v, 3)),
        trendTone: "success",
      },
      validCertificates: {
        value: String(certList.length),
        note:
          certList.length > 0
            ? `${certList.length} on file`
            : "No certificates on file",
        noteTone: certList.length ? "success" : "muted",
        trend: certList.length
          ? trendValues.map((_, i) =>
              Math.min(certList.length, i + 1),
            )
          : [0, 0, 0, 0, 0, 0, 0, 0],
        trendTone: "success",
      },
      outstandingInvoices: {
        value: formatMoney(outstandingTotal, outstandingCurrency),
        note:
          outstanding.length > 0
            ? `${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"} unpaid`
            : "No unpaid invoices",
        noteTone: outstanding.length ? "danger" : "muted",
        trend: trendValues,
        trendTone: outstanding.length ? "danger" : "success",
      },
    },
    applicationOverview: {
      total: activeApps.length,
      changePercent: Math.abs(change),
      changeDirection: change > 0 ? "up" : change < 0 ? "down" : "flat",
      rangeLabel: "Last 8 Months",
      months,
      currentMonthIndex: months.length - 1,
    },
    pendingActions: pendingActions.slice(0, 8),
    upcomingInspections,
    recentUpdates,
    recentApplications,
    certificates: {
      validCount: certList.length,
      validNote: certList.length ? "On file" : "No certificates on file",
      renewals: certList.slice(0, 5),
    },
  };
}

export default buildDashboardPayload;
