import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "jspdf-autotable";
import ejs from "ejs";
import html2canvas from "html2canvas";
import { WORK_ORDER_TEMPLATE_HTML } from "./workOrderTemplate";
import {
  billingDocFileSlug,
  jobBillingDocumentTitle,
} from "@/utils/fleetJobBillingLabels";
import {
  fleetJobLineUnitRate as lineUnitRate,
  computeFleetJobLineSummary,
} from "@/utils/fleetJobLineDisplay";
/** Never let jsPDF receive undefined (renders as the word "undefined"). */
function T(v) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s === "" || s === "undefined" || s === "null" ? "—" : s;
}

function safeStr(v) {
  if (v == null) return "";
  return String(v).replace(/\r|\n/g, " ").trim();
}

function safeMultiline(v) {
  if (v == null) return "";
  return String(v).replace(/\r/g, "").trim();
}

function normalizeTermsContentForCompare(v) {
  if (v == null) return "";
  return String(v).replace(/\r/g, "").trim();
}

function parseTermsContentToItems(content) {
  const plain = htmlToPlainTextForPdf(content);
  if (!plain) return [];

  const numbered = plain
    .split(/\n(?=\d+[\.\)]\s)/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  const paras = plain
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (paras.length > 1) return paras;

  const lines = plain
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  return plain ? [plain] : [];
}

async function fetchSalesOrderTerms(salesOrderId) {
  const soId = safeStr(salesOrderId);
  if (!soId) return "";
  const base = safeStr(import.meta.env.VITE_APP_API_BASE_URL).replace(/\/$/, "");
  if (!base) return "";
  const headers = { "Content-Type": "application/json" };
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${base}/sales-orders/${soId}`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    if (!res.ok) return "";
    const payload = await res.json();
    const so = payload?.data || payload?.salesOrder || payload;
    return normalizeTermsContentForCompare(so?.termsAndConditions)
      ? String(so.termsAndConditions).replace(/\r/g, "").trim()
      : "";
  } catch {
    return "";
  }
}

/**
 * Same precedence as sales order creation:
 * 1) terms saved on the job (from SO create/update)
 * 2) linked sales order terms
 * 3) business default termsAndConditions
 */
async function resolveWorkOrderTermsContent(job, businessObj) {
  let terms = normalizeTermsContentForCompare(job?.termsAndConditions)
    ? String(job.termsAndConditions).replace(/\r/g, "").trim()
    : "";
  if (terms) return terms;

  const createdFrom = job?.createdFrom;
  if (createdFrom && typeof createdFrom === "object") {
    terms = normalizeTermsContentForCompare(createdFrom.termsAndConditions)
      ? String(createdFrom.termsAndConditions).replace(/\r/g, "").trim()
      : "";
    if (terms) return terms;
  }

  const salesOrderId =
    createdFrom?._id ||
    (typeof createdFrom === "string" ? createdFrom : null);
  if (salesOrderId) {
    terms = await fetchSalesOrderTerms(salesOrderId);
    if (terms) return terms;
  }

  return normalizeTermsContentForCompare(businessObj?.termsAndConditions)
    ? String(businessObj.termsAndConditions).replace(/\r/g, "").trim()
    : "";
}

async function fetchTermsAndConditionsList(businessId) {
  const bid = safeStr(businessId);
  if (!bid) return [];
  const base = safeStr(import.meta.env.VITE_APP_API_BASE_URL).replace(/\/$/, "");
  if (!base) return [];
  const headers = { "Content-Type": "application/json" };
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${base}/items/Terms and Conditions/get_all`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        business_id: bid,
        FilterStatus: "active",
        FilterName: "",
      }),
    });
    if (!res.ok) return [];
    const payload = await res.json();
    return payload?.success && Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}

/** Load business templates + settings terms list so PDF title can match create/fetch UI. */
async function ensureBusinessTermsForPdf(businessArg, job) {
  const biz =
    businessArg && typeof businessArg === "object" ? { ...businessArg } : {};
  const bid = biz._id || job?.businessId?._id || job?.businessId;
  if (!bid) return { business: biz, termsList: [] };

  const base = safeStr(import.meta.env.VITE_APP_API_BASE_URL).replace(/\/$/, "");
  if (!base) return { business: biz, termsList: [] };

  const headers = { "Content-Type": "application/json" };
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const [businessRes, termsList] = await Promise.all([
      fetch(`${base}/business/${bid}`, {
        method: "GET",
        credentials: "include",
        headers,
      }),
      fetchTermsAndConditionsList(bid),
    ]);

    let merged = { ...biz };
    if (businessRes.ok) {
      const payload = await businessRes.json();
      const full = payload?.data;
      if (full && typeof full === "object") {
        merged = { ...merged, ...full };
      }
    }
    return { business: merged, termsList };
  } catch {
    return { business: biz, termsList: [] };
  }
}

/** Strip simple HTML from WYSIWYG / rich-text fields for PDF output. */
function htmlToPlainTextForPdf(html) {
  if (html == null) return "";
  let s = String(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>\s*/gi, "\n");
  s = s.replace(/<p[^>]*>/gi, "");
  s = s.replace(/<div[^>]*>/gi, "\n");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.replace(/\r/g, "").trim();
}

function termsContentMatches(stored, candidate) {
  const a = normalizeTermsContentForCompare(stored);
  const b = normalizeTermsContentForCompare(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  const plainA = htmlToPlainTextForPdf(a);
  const plainB = htmlToPlainTextForPdf(b);
  return plainA === plainB;
}

function resolveTermsSectionTitle(content, businessObj, termsList = []) {
  const trimmed = normalizeTermsContentForCompare(content);
  if (!trimmed) return "";

  const b = businessObj && typeof businessObj === "object" ? businessObj : {};

  const fromMisc = (Array.isArray(termsList) ? termsList : []).find((t) =>
    termsContentMatches(trimmed, t.content),
  );
  if (safeStr(fromMisc?.name)) return safeStr(fromMisc.name);

  const tpl = (Array.isArray(b.termsTemplates) ? b.termsTemplates : []).find((t) =>
    termsContentMatches(trimmed, t.content),
  );
  if (safeStr(tpl?.name)) return safeStr(tpl.name);

  if (termsContentMatches(trimmed, b.termsAndConditions)) {
    return "Default";
  }

  return "";
}

function buildWorkOrderTermsFields(businessObj, termsContent, termsList = []) {
  const content = normalizeTermsContentForCompare(termsContent)
    ? String(termsContent).replace(/\r/g, "").trim()
    : "";
  const items = parseTermsContentToItems(content);
  return {
    waiverTitle: resolveTermsSectionTitle(content, businessObj, termsList),
    waiverItems: items,
    waiverBody: items.length ? "" : htmlToPlainTextForPdf(content),
  };
}

function parseDataUrlForJspdf(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  let format = "PNG";
  if (mime.includes("jpeg") || mime.includes("jpg")) format = "JPEG";
  else if (mime.includes("webp")) format = "WEBP";
  return { format, base64 };
}

function imageDimensionsFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}

/** Turn stored logo path into an absolute URL (many DB values omit the host). */
function normalizeLogoAssetUrl(raw, apiBase) {
  const u = raw.replace(/&amp;/g, "&").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const b = safeStr(apiBase).replace(/\/$/, "");
  if (!b) return u;
  const path = u.startsWith("/") ? u : `/${u.replace(/^\//, "")}`;
  return `${b}${path}`;
}

function blobLooksLikeImage(blob) {
  if (!blob || blob.size === 0) return false;
  const t = (blob.type || "").toLowerCase();
  if (!t) return true;
  if (t.startsWith("image/")) return true;
  if (t.includes("octet-stream")) return true;
  return false;
}

/** Backend proxy-image only allows S3-style hosts; detect before calling it. */
function isProxyAllowedImageHost(urlString) {
  try {
    const { hostname } = new URL(urlString);
    return [
      /\.s3\.([a-z0-9-]+\.)?amazonaws\.com$/i,
      /^s3\.([a-z0-9-]+\.)?amazonaws\.com$/i,
      /\.s3-[a-z0-9-]+\.amazonaws\.com$/i,
      /^s3-[a-z0-9-]+\.amazonaws\.com$/i,
      /^localhost$/i,
      /^127\.0\.0\.1$/i,
    ].some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Load business logo for jsPDF (same strategy as e-invoice PDF: CORS + proxy-image).
 * @param {string} logoUrl
 * @returns {Promise<string|null>}
 */
async function loadLogoDataUrlForWorkOrder(logoUrl) {
  const raw = safeStr(logoUrl);
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;

  const base = safeStr(import.meta.env.VITE_APP_API_BASE_URL).replace(/\/$/, "");
  const abs = normalizeLogoAssetUrl(raw, base) || raw.replace(/&amp;/g, "&").trim();

  const tryFetchUrl = async (url, cred) => {
    try {
      const res = await fetch(url, { mode: "cors", credentials: cred });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blobLooksLikeImage(blob)) return null;
      return blobToDataUrl(blob);
    } catch {
      return null;
    }
  };

  let dataUrl = await tryFetchUrl(abs, "include");
  if (dataUrl) return dataUrl;
  dataUrl = await tryFetchUrl(abs, "omit");
  if (dataUrl) return dataUrl;

  if (base && isProxyAllowedImageHost(abs)) {
    const proxyUrl = `${base}/proxy-image?url=${encodeURIComponent(abs)}`;
    try {
      const res = await fetch(proxyUrl, { credentials: "include" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blobLooksLikeImage(blob)) return null;
      return blobToDataUrl(blob);
    } catch {
      return null;
    }
  }

  return null;
}

function resolveWorkOrderBusinessLogoUrl(businessArg, job) {
  const b = businessArg && typeof businessArg === "object" ? businessArg : {};
  const jb = job?.businessId && typeof job.businessId === "object" ? job.businessId : {};
  return safeStr(
    b.image ||
      b.logo ||
      b.businessLogo ||
      b.companyLogo ||
      jb.image ||
      jb.logo ||
      jb.businessLogo ||
      jb.companyLogo ||
      "",
  );
}

function formatMoneyValue(n, currency) {
  const code = (currency && String(currency).trim().toUpperCase()) || "USD";
  const x = Number(n);
  const loc = code === "MYR" ? "en-MY" : "en-US";
  const opts = { style: "currency", currency: code };
  if (code === "MYR") opts.currencyDisplay = "code";
  if (!Number.isFinite(x)) {
    return new Intl.NumberFormat(loc, opts).format(0);
  }
  return new Intl.NumberFormat(loc, opts).format(x);
}

function workOrderNo(job) {
  if (!job) return "—";
  const n = job.workOrderNumber ?? job.salesOrderNumber ?? job.orderNumber;
  if (n != null && String(n).trim() !== "") return String(n).trim();
  const id = job._id;
  if (!id) return "—";
  return String(id).replace(/[^a-f0-9]/gi, "").slice(-4).toUpperCase();
}

/** Display work order # for UI / email subject (matches PDF). */
export function getWorkOrderNumberLabel(job) {
  return T(workOrderNo(job));
}

function customerLine(job) {
  const c = job?.customerId;
  if (!c) return "Customer";
  return (
    safeStr(c?.basicInformation?.customerDisplayName) ||
    safeStr(c?.basicInformation?.companyName) ||
    "Customer"
  );
}

function customerPhone(job) {
  const c = job?.customerId;
  const p = c?.basicInformation?.customerPhone;
  return safeStr(p?.mobile || p?.workPhone || p?.homePhone) || "—";
}

function serviceAddressText(job) {
  const addrs = job?.customerId?.addresses;
  if (Array.isArray(addrs) && addrs.length > 0) {
    const a = addrs[0];
    const parts = [a.addressLine1, a.city, a.state, a.zipCode].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  const s = job?.serviceAddress;
  if (s && (s.street || s.city || s.area || s.zip)) {
    return [s.street, s.city, s.area, s.zip].filter(Boolean).join(", ");
  }
  return "—";
}

function getCurrency(job, scheduleCurrency) {
  const c = job?.currency;
  if (c != null && /^[A-Za-z]{3}$/.test(String(c).trim())) {
    return String(c).trim().toUpperCase();
  }
  return scheduleCurrency || "USD";
}

function lineItemTotalsWithJob(job, lineItems) {
  let taxSum = 0;
  let grand = 0;
  if (Array.isArray(lineItems) && lineItems.length) {
    lineItems.forEach((r) => {
      taxSum += Number(r?.tax) || 0;
      grand += Number(r?.amount ?? r?.total) || 0;
    });
  }
  const jobTax = Number(
    job?.totalTax ?? job?.taxTotal ?? job?.taxAmount ?? job?.gstAmount,
  );
  if ((!taxSum || taxSum === 0) && Number.isFinite(jobTax) && jobTax > 0) {
    taxSum = jobTax;
  }
  if (!grand) {
    const t = Number(job?.totalAmount ?? job?.grandTotal);
    if (Number.isFinite(t) && t > 0) grand = t;
  }
  const sub = Math.max(0, grand - taxSum);
  return { taxSum, grand, sub };
}

/** Roll-up for PDF summary — shared with scheduling line-item math. */
function computeWorkOrderSummary(job, lineItems, cur) {
  return { ...computeFleetJobLineSummary(job, lineItems), currency: cur };
}

function formatBusinessFooterLines(businessObj) {
  const b = businessObj && typeof businessObj === "object" ? businessObj : {};
  const name = safeStr(b.name) || "";
  let addr = safeStr(b.address);
  if (!addr && Array.isArray(b.addresses) && b.addresses.length) {
    const a = b.addresses[0];
    addr = [a.addressLine1, a.addressLine2, a.city, a.state, a.zipCode, a.country]
      .filter((x) => safeStr(x))
      .join(", ");
  }
  const tel = safeStr(b.tel);
  const email = safeStr(b.email);
  return { name, addr, tel, email };
}

/** First assigned-business bank (from API) or null. */
function resolvePrimaryBank(businessObj) {
  const b = businessObj?.primaryBankAccount;
  if (!b || typeof b !== "object") return null;
  if (safeStr(b.bankName) || safeStr(b.accountNumber) || safeStr(b.accountName)) return b;
  return null;
}

function getBalanceAmount(job) {
  if (!job) return null;
  const bal = Number(job.balanceDue ?? job.balance ?? job.amountDue);
  return Number.isFinite(bal) ? bal : null;
}

function getPaymentsFromJob(job, grand, bal) {
  const p = Number(job?.totalPaid ?? job?.amountPaid ?? job?.paymentsReceived);
  if (Number.isFinite(p) && p >= 0) return p;
  if (bal != null && grand != null) return Math.max(0, Math.min(grand, grand - bal));
  return null;
}

function paymentStatusWord(job) {
  if (!job) return "—";
  const raw =
    job.salesOrderPaymentStatus ??
    job.paymentStatus ??
    job.payment_state ??
    job.paymentStatusLabel ??
    job.invoicePaymentStatus ??
    job.billingStatus ??
    job.payment?.status;
  if (raw != null && String(raw).trim() !== "") {
    const s = String(raw).trim().toLowerCase();
    if (s.includes("partial")) return "PARTIAL";
    if (s === "paid" || s.includes("paid") || s === "complete" || s === "completed") {
      return "PAID";
    }
    if (s.includes("unpaid") || s.includes("due") || s.includes("outstanding") || s === "open") {
      return "UNPAID";
    }
  }
  const orderType = String(job.orderType || "work_order").toLowerCase();
  if (orderType === "estimate") return "ESTIMATE";
  const b = getBalanceAmount(job);
  const li = lineItemTotalsWithJob(job, job?.lineItems);
  const total = li.grand;
  if (b == null) {
    if (total > 0) return "UNPAID";
    return "—";
  }
  if (b <= 0.01) return "PAID";
  if (total > 0.01 && b < total - 0.01) return "PARTIAL";
  return "UNPAID";
}

function isPaidish(job) {
  const w = paymentStatusWord(job);
  if (w === "PAID") return true;
  const bal = getBalanceAmount(job);
  return bal != null && bal <= 0.01 && lineItemTotalsWithJob(job, job?.lineItems).grand > 0;
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function minutesToLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const am = h24 < 12;
  let h = h24 % 12;
  if (h === 0) h = 12;
  const suffix = am ? "AM" : "PM";
  return `${h}:${pad2(m)} ${suffix}`;
}

const TABLE_HEAD_GRAY = [230, 230, 230];
const MIN_LINE_ROWS = 9;

/**
 * @param {object} params
 * @param {object} params.job – Fleet / schedule job
 * @param {object} [params.assignment] – Route assignment (null for on-deck)
 * @param {string} [params.dayYmd] – Appointment date "YYYY-MM-DD" (if missing, uses assignment or job created date)
 * @param {object} [params.business] – Optional; not shown on the PDF (call sites may still pass)
 * @param {string} [params.scheduleCurrency] – Base currency for schedule
 */
async function buildWorkOrderPdfResult({
  job,
  assignment,
  dayYmd,
  business: businessArg,
  scheduleCurrency = "USD",
}) {
  if (!job) return null;
  const cur = getCurrency(job, scheduleCurrency);

  const tech =
    (assignment &&
      (safeStr(assignment.technicianName) ||
        safeStr(assignment.assignedTechnicianName))) ||
    (Array.isArray(job.technicianNames) && job.technicianNames.length
      ? job.technicianNames.join(", ")
      : "") ||
    safeStr(job.technicianName) ||
    "—";
  const salesRep =
    safeStr(job.salesRepName) ||
    safeStr(job.salesPersonName) ||
    safeStr(job?.createdFrom?.salesPerson) ||
    "—";
  let dateYmd = dayYmd;
  if (!dateYmd && assignment?.dayYmd) dateYmd = assignment.dayYmd;
  if (!dateYmd && job.createdAt) {
    const c = new Date(job.createdAt);
    if (!Number.isNaN(c.getTime())) {
      dateYmd = `${c.getFullYear()}-${pad2(c.getMonth() + 1)}-${pad2(c.getDate())}`;
    }
  }
  const startM = timeToMinutes(assignment?.startTime);
  const startLabel = startM != null ? minutesToLabel(startM) : "—";

  const lineRows = Array.isArray(job.lineItems) ? job.lineItems : [];
  const summary = computeWorkOrderSummary(job, lineRows, cur);

  const tableBody = lineRows.length
    ? lineRows.map((r) => {
        const qty = r.quantity != null ? r.quantity : 1;
        const rate = lineUnitRate(r);
        const discPct = Math.min(100, Math.max(0, Number(r.discount) || 0));
        const desc =
          safeStr(r.description || r.itemDescription) ||
          safeStr(r.itemName) ||
          "—";
        const taxAmt = Number(r.tax) || 0;
        const amount = Number(r.amount ?? r.total) || 0;
        const discLabel = discPct > 0 ? `${discPct}%` : "—";
        const taxLabel = taxAmt > 0 ? T(formatMoneyValue(taxAmt, cur)) : "—";
        return [
          T(qty),
          T(desc),
          T(formatMoneyValue(rate, cur)),
          T(discLabel),
          T(taxLabel),
          T(formatMoneyValue(amount, cur)),
        ];
      })
    : [
        [
          T("1"),
          "—",
          T(formatMoneyValue(0, cur)),
          "—",
          "—",
          T(formatMoneyValue(0, cur)),
        ],
      ];

  while (tableBody.length < MIN_LINE_ROWS) {
    tableBody.push(["", "", "", "", "", ""]);
  }

  const { business: businessObj, termsList } = await ensureBusinessTermsForPdf(
    businessArg || job?.businessId || {},
    job,
  );
  const termsContent = await resolveWorkOrderTermsContent(job, businessObj);
  const termsFields = buildWorkOrderTermsFields(businessObj, termsContent, termsList);

  const orderNo = T(workOrderNo(job));
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 14;
  const innerW = pageW - 2 * m;
  const y0 = m;

  const dateGb =
    dateYmd && /^\d{4}-\d{2}-\d{2}/.test(dateYmd)
      ? new Date(`${dateYmd}T12:00:00`).toLocaleDateString("en-GB")
      : "—";
  const timeLabel = startLabel === "—" ? "—" : startLabel;
  const docLabel = jobBillingDocumentTitle(job);
  const docLabelUpper = docLabel.toUpperCase();
  const companyName =
    safeStr(businessObj?.name) || safeStr(job?.businessId?.name) || safeStr(job?.businessName) || docLabel;
  const businessLogoUrl = resolveWorkOrderBusinessLogoUrl(businessObj, job);

  const logoDataUrl = await loadLogoDataUrlForWorkOrder(businessLogoUrl);

  doc.setTextColor(0, 0, 0);
  const LOGO_W = 68;
  const LOGO_H = 20;
  let logoPlaced = false;
  if (logoDataUrl) {
    const parsed = parseDataUrlForJspdf(logoDataUrl);
    const dims = await imageDimensionsFromDataUrl(logoDataUrl);
    if (parsed && dims?.w > 0 && dims?.h > 0) {
      const ar = dims.w / dims.h;
      let drawW = LOGO_W;
      let drawH = LOGO_W / ar;
      if (drawH > LOGO_H) {
        drawH = LOGO_H;
        drawW = LOGO_H * ar;
      }
      const drawX = m + 1;
      const drawY = y0 + 6;
      try {
        doc.addImage(parsed.base64, parsed.format, drawX, drawY, drawW, drawH);
        logoPlaced = true;
      } catch {
        try {
          doc.addImage(logoDataUrl, parsed.format, drawX, drawY, drawW, drawH);
          logoPlaced = true;
        } catch {
          logoPlaced = false;
        }
      }
    }
  }
  if (!logoPlaced) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(92, 100, 112);
    doc.text(companyName, m + 1, y0 + 8);
  }

  const boxW = 74;
  const boxH = 24;
  const boxX = pageW - m - boxW;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 55, 72);
  doc.setFontSize(10.5);
  doc.text(docLabelUpper, boxX, y0 + 3.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(75, 85, 99);
  doc.text(`SST No.: ${T(job?.sstNo || "—")}`, boxX, y0 + 6.5, { align: "left" });

  const boxY = y0 + 8.2;
  const cellW = boxW / 2;
  const cellH = boxH / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(boxX, boxY, boxW, boxH);
  doc.line(boxX + cellW, boxY, boxX + cellW, boxY + boxH);
  doc.line(boxX, boxY + cellH, boxX + boxW, boxY + cellH);
  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.text(`${docLabel} #`, boxX + 1.4, boxY + 2.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  doc.text(orderNo, boxX + 1.2, boxY + 5.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.text("Date", boxX + cellW + 1.2, boxY + 2.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  doc.text(T(dateGb), boxX + cellW + 1.2, boxY + 5.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.text("Sales Rep", boxX + 1.2, boxY + cellH + 2.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  doc.text(T(salesRep), boxX + 1.2, boxY + cellH + 5.6, { maxWidth: cellW - 3 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.text("Time", boxX + cellW + 1.2, boxY + cellH + 2.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  doc.text(T(timeLabel), boxX + cellW + 1.2, boxY + cellH + 5.6);

  let y = boxY + boxH + 4;

  const infoH = 50;
  doc.setLineWidth(0.25);
  doc.rect(m, y, innerW, infoH);
  const leftW = innerW / 2;
  const rightW = innerW - leftW;
  doc.line(m + leftW, y, m + leftW, y + infoH);
  doc.line(m, y + 6.5, m + innerW, y + 6.5);
  doc.line(m + leftW, y + 30, m + innerW, y + 30);
  doc.setFontSize(7.8);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Info", m + 1.8, y + 4.6);
  doc.text("Service Location", m + leftW + 1.8, y + 4.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.text(T(customerLine(job)), m + 2, y + 10.8, { maxWidth: leftW - 4 });
  const addr = serviceAddressText(job);
  doc.text(T(addr), m + leftW + 2, y + 10.8, { maxWidth: rightW - 4 });
  doc.text(T(customerLine(job)), m + 2, y + 28, { maxWidth: leftW - 4 });
  doc.text(T(customerLine(job)), m + leftW + 2, y + 28, { maxWidth: rightW - 4 });
  doc.setFontSize(7);
  doc.text("Tel: " + T(customerPhone(job)), m + 2, y + 33.8, { maxWidth: leftW - 4 });
  doc.text("Tel: " + T(customerPhone(job)), m + leftW + 2, y + 33.8, { maxWidth: rightW - 4 });
  doc.setFontSize(7.2);
  doc.text("P.O. # / Vendor #", m + 2, y + 39.2);
  doc.text("Payment Term: Due Upon Receipt", m + leftW + 2, y + 39.2);
  doc.text("Job Technician", m + 2, y + 45.4);
  doc.text(T(tech), m + 27, y + 45.4, { maxWidth: leftW - 30 });
  y += infoH + 0.8;

  autoTable(doc, {
    startY: y,
    head: [["Qty", "Description", "Unit price", "Discount", "Tax", "Amount"]],
    body: tableBody,
    theme: "grid",
    tableWidth: innerW,
    margin: { left: m, right: m },
    styles: {
      fontSize: 6.8,
      cellPadding: { top: 1.2, right: 1.2, bottom: 1.2, left: 1.2 },
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 5,
      textColor: [30, 30, 30],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: TABLE_HEAD_GRAY,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 6.6,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { halign: "right", cellWidth: 9 },
      1: { halign: "left", cellWidth: 52 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "right", cellWidth: 30 },
      5: { halign: "right", cellWidth: 47 },
    },
  });

  const afterTableY =
    doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y + 70;
  const lat = doc.lastAutoTable;
  const tableRight =
    lat && typeof lat.getWidth === "function" && lat.settings?.margin
      ? lat.settings.margin.left + lat.getWidth(pageW)
      : pageW - m;
  const summaryW = Math.min(82, Math.max(68, innerW * 0.45));
  const summaryEdge = tableRight;
  const summaryX = summaryEdge - summaryW;
  const rowGap = 5.4;
  let sy = afterTableY + 3;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.15);
  doc.line(summaryX, sy - 1.5, summaryEdge, sy - 1.5);
  doc.setDrawColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(0, 0, 0);
  const sumRows = [
    ["Subtotal", formatMoneyValue(summary.subtotalExTax, cur)],
    ["Discount", formatMoneyValue(summary.discountTotal, cur)],
    ["Tax", formatMoneyValue(summary.taxTotal, cur)],
    ["Total", formatMoneyValue(summary.grand, cur)],
  ];
  sumRows.forEach(([label, val], idx) => {
    doc.setFont("helvetica", idx === 3 ? "bold" : "normal");
    doc.text(label, summaryX, sy + 3.2);
    doc.text(String(val), summaryEdge, sy + 3.2, { align: "right" });
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.12);
    doc.line(summaryX, sy + 4.4, summaryEdge, sy + 4.4);
    sy += rowGap;
  });

  const waiverTop = sy + 4;
  const waiverTitle = safeStr(termsFields.waiverTitle);
  const waiverLineInputs =
    termsFields.waiverItems?.length > 0
      ? termsFields.waiverItems
      : termsFields.waiverBody
        ? termsFields.waiverBody
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.9);
  const waiverBodyLines = [];
  waiverLineInputs.forEach((line) => {
    doc.splitTextToSize(line, innerW - 3.5).forEach((w) => waiverBodyLines.push(w));
  });
  const hasWaiverContent = waiverBodyLines.length > 0;
  const waiverHeight = hasWaiverContent
    ? Math.min(28, Math.max(11, 8 + waiverBodyLines.length * 2.65))
    : 0;
  if (hasWaiverContent) {
    doc.rect(m, waiverTop, innerW, waiverHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    let wy = waiverTop + 3.6;
    if (waiverTitle) {
      doc.text(waiverTitle, m + 1.5, wy);
      wy += 3;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.9);
    waiverBodyLines.forEach((line) => {
      doc.text(line, m + 1.5, wy);
      wy += 2.65;
    });
  }

  const footerTop = hasWaiverContent ? waiverTop + waiverHeight + 3 : waiverTop;
  const footBase = footerTop;
  const primaryBank = resolvePrimaryBank(businessObj);

  const gutter = 5;
  const payColW = Math.min(86, Math.floor(innerW * 0.405));
  const c1x = m + 1;
  const tailLeft = m + payColW + gutter;
  const tailWidth = Math.max(0, innerW - payColW - gutter);
  let thanksColW = Math.max(26, Math.floor(tailWidth * 0.58));
  let signColW = tailWidth - thanksColW - gutter;
  if (signColW < 24) {
    thanksColW = Math.max(22, thanksColW - (24 - signColW));
    signColW = tailWidth - thanksColW - gutter;
  }
  const xThanks = tailLeft;
  const xSign = xThanks + thanksColW + gutter;

  let payPy = footBase + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text("Payable to", c1x, payPy);
  payPy += 4;
  const payeeLine =
    primaryBank && safeStr(primaryBank.accountName)
      ? safeStr(primaryBank.accountName)
      : companyName;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.1);
  doc.setTextColor(25, 25, 25);
  doc.splitTextToSize(T(payeeLine), payColW - 2).forEach((ln) => {
    doc.text(ln, c1x, payPy);
    payPy += 3.65;
  });
  payPy += 2.5;

  const bankField = (label, value, opts = {}) => {
    const { primary = false, labelW = 24 } = opts;
    const v = safeStr(value);
    if (!v) return;
    const valueX = c1x + labelW;
    const wrapped = doc.splitTextToSize(v, payColW - labelW - 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(primary ? 6.2 : 6.05);
    doc.text(`${label}:`, c1x, payPy);
    doc.setFont("helvetica", primary ? "bold" : "normal");
    doc.setFontSize(primary ? 6.5 : 6.05);
    if (wrapped.length) doc.text(wrapped[0], valueX, payPy);
    payPy += primary ? 3.35 : 3.05;
    for (let i = 1; i < wrapped.length; i++) {
      doc.text(wrapped[i], valueX, payPy);
      payPy += 3.05;
    }
    payPy += primary ? 0.85 : 0.65;
  };

  const regBrn = safeStr(businessObj?.registrationNumber);
  if (regBrn) {
    bankField("Reg. No", regBrn, { labelW: 22 });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.9);
  doc.setTextColor(0, 0, 0);

  if (primaryBank) {
    bankField("Bank", htmlToPlainTextForPdf(primaryBank.bankName), { primary: true });
    bankField("A/C No", htmlToPlainTextForPdf(primaryBank.accountNumber), { primary: true });
    bankField("Address", htmlToPlainTextForPdf(primaryBank.bankAddress), {
      labelW: 18,
    });
  } else {
    doc.text("Bank account *", c1x, payPy);
    payPy += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.15);
    doc.setTextColor(95, 95, 95);
    doc.text(
      "Add an active bank account for this business in Finance to print details here.",
      c1x,
      payPy,
      { maxWidth: payColW - 1 },
    );
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    payPy += 10;
  }

  const bankBottomY = payPy;
  const tailPadTop = 3;
  const tailPadBottom = 4;
  const thanksLine = `Thank you for choosing ${T(companyName)}.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.1);
  const thanksLines = doc.splitTextToSize(thanksLine, thanksColW - 1.5);
  const thanksBottom = footBase + tailPadTop + 2 + thanksLines.length * 3.15;
  const minBandForSignature = thanksBottom - footBase + tailPadBottom + 8;
  const bandH = Math.max(
    bankBottomY - footBase + tailPadBottom + 2,
    minBandForSignature,
    26,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.1);
  doc.setTextColor(55, 55, 55);
  let thanksY = footBase + tailPadTop + 2;
  thanksLines.forEach((ln) => {
    doc.text(ln, xThanks, thanksY, { maxWidth: thanksColW - 1 });
    thanksY += 3.15;
  });

  const signLineY = footBase + bandH - tailPadBottom - 5.5;
  const signLabelY = signLineY + 3.6;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.35);
  doc.line(xSign + 1, signLineY, xSign + signColW - 3, signLineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(40, 40, 40);
  doc.text("Customer Signature / Date", xSign + signColW / 2, signLabelY, {
    align: "center",
    maxWidth: signColW - 2,
  });

  const sectionEndY = footBase + bandH + 4;

  const { name: bizName, addr: bizAddr, tel: bizTel, email: bizEmail } =
    formatBusinessFooterLines(businessObj);
  const bizTitle = safeStr(bizName) || companyName;
  const telLine = bizTel ? `Tel: ${bizTel}` : "";
  const emailLine = bizEmail ? `Email: ${bizEmail}` : "";
  const bizDetailLines = [bizAddr, telLine, emailLine]
    .map((x) => safeStr(x))
    .filter(Boolean);

  const flatBiz = [];
  doc.splitTextToSize(T(bizTitle), innerW - 14).forEach((wline) => {
    flatBiz.push({ bold: true, text: wline, size: 7 });
  });
  bizDetailLines.forEach((line) => {
    doc.splitTextToSize(line, innerW - 14).forEach((wline) => {
      flatBiz.push({ bold: false, text: wline, size: 6.2 });
    });
  });
  let bizStackH = 0;
  flatBiz.forEach((row) => {
    bizStackH += row.bold ? 4.3 : 3.5;
  });
  const printY = pageH - 5;
  const bizBottomAbovePrint = printY - 2;
  let bizTopY = bizBottomAbovePrint - bizStackH;
  const minGapAbovePay = 4;
  if (bizTopY < sectionEndY + minGapAbovePay) {
    doc.addPage();
    bizTopY = printY - 2 - bizStackH;
  }

  doc.setPage(doc.getNumberOfPages());
  let yBizLine = bizBottomAbovePrint;
  for (let i = flatBiz.length - 1; i >= 0; i--) {
    const row = flatBiz[i];
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(row.size);
    doc.setTextColor(45, 45, 45);
    doc.text(row.text, pageW / 2, yBizLine, { align: "center" });
    yBizLine -= row.bold ? 4.3 : 3.5;
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(5.8);

  const rawName = workOrderNo(job);
  const safeFile = T(rawName).replace(/[^a-z0-9-_]/gi, "_");
  const filePrefix = billingDocFileSlug(job);
  const fname = `${filePrefix}-${safeFile === "—" ? "order" : safeFile}.pdf`.slice(0, 120);
  return { doc, fileName: fname, job };
}

/** Browser download of the work order PDF (using the new HTML template). */
export async function downloadWorkOrderPdf(params) {
  const { job, assignment, dayYmd, business: businessArg, scheduleCurrency = "USD" } = params;
  if (!job) return;

  const cur = getCurrency(job, scheduleCurrency);
  const tech =
    (assignment &&
      (safeStr(assignment.technicianName) ||
        safeStr(assignment.assignedTechnicianName))) ||
    (Array.isArray(job.technicianNames) && job.technicianNames.length
      ? job.technicianNames.join(", ")
      : "") ||
    safeStr(job.technicianName) ||
    "—";
  
  const salesRep =
    safeStr(job.salesRepName) ||
    safeStr(job.salesPersonName) ||
    safeStr(job?.createdFrom?.salesPerson) ||
    "—";

  let dateYmd = dayYmd;
  if (!dateYmd && assignment?.dayYmd) dateYmd = assignment.dayYmd;
  if (!dateYmd && job.createdAt) {
    const c = new Date(job.createdAt);
    if (!Number.isNaN(c.getTime())) {
      dateYmd = `${c.getFullYear()}-${pad2(c.getMonth() + 1)}-${pad2(c.getDate())}`;
    }
  }

  const dateDisplay = dateYmd && /^\d{4}-\d{2}-\d{2}/.test(dateYmd)
    ? new Date(`${dateYmd}T12:00:00`).toLocaleDateString("en-GB")
    : "—";

  const startM = timeToMinutes(assignment?.startTime);
  const timeLabel = startM != null ? minutesToLabel(startM) : "—";

  const { business: businessObj, termsList } = await ensureBusinessTermsForPdf(
    businessArg || job?.businessId || {},
    job,
  );
  const termsContent = await resolveWorkOrderTermsContent(job, businessObj);
  const termsFields = buildWorkOrderTermsFields(businessObj, termsContent, termsList);
  const businessLogoUrl = resolveWorkOrderBusinessLogoUrl(businessObj, job);
  const logoDataUrl = await loadLogoDataUrlForWorkOrder(businessLogoUrl);

  const mappedItems = (Array.isArray(job.lineItems) ? job.lineItems : []).map(r => ({
    quantity: r.quantity != null ? r.quantity : 1,
    name: safeStr(r.itemName) || "—",
    description: safeStr(r.description || r.itemDescription) || ""
  }));

  const contract = {
    businessLogo: logoDataUrl,
    businessSstNo: job?.sstNo || businessObj?.sstNo || "B16-1902-32000206",
    invoice_number: workOrderNo(job),
    date: dateDisplay,
    salesPerson: salesRep,
    orderTime: timeLabel,
    buyerName: customerLine(job),
    buyerAddress: serviceAddressText(job),
    buyerPhone: customerPhone(job),
    po_no: job.poNumber || job.orderNumber || "—",
    shipToName: customerLine(job),
    shipToAddress: serviceAddressText(job),
    shipToPhone: customerPhone(job),
    paymentTerms: "Due Upon Receipt",
    technicianName: tech,
    items: mappedItems,
    notes: safeMultiline(job.orderNote || job.notes),
    qrCodeUrl: "",
    ...termsFields,
  };

  try {
    const html = ejs.render(WORK_ORDER_TEMPLATE_HTML, { contract });
    
    // Create a hidden container to render the HTML
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "800px";
    container.style.background = "#fff";
    container.innerHTML = html;
    document.body.appendChild(container);

    // Give it a moment to render images
    await new Promise(r => setTimeout(r, 500));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const margin = 10; // 10mm margin
    const contentWidth = pdfWidth - (margin * 2);
    const pdfHeight = (imgProps.height * contentWidth) / imgProps.width;
    
    pdf.addImage(imgData, "JPEG", margin, 5, contentWidth, pdfHeight);
    
    const fileName = `WorkOrder-${workOrderNo(job)}.pdf`;
    pdf.save(fileName);
  } catch (err) {
    console.error("Work Order HTML PDF Error:", err);
    // Fallback to old method if something goes wrong
    const r = await buildWorkOrderPdfResult(params);
    if (r) r.doc.save(r.fileName);
  }
}

/**
 * @returns {File | null} PDF file for email / upload; filename like "Work Order 5005 Printout.pdf"
 */
export async function getWorkOrderPdfFile(params) {
  const r = await buildWorkOrderPdfResult(params);
  if (!r) return null;
  const n = T(workOrderNo(r.job));
  const label = n === "—" ? "order" : n;
  const printoutName = `${jobBillingDocumentTitle(r.job)} ${label} Printout.pdf`
    .replace(/[^\w\-.() ]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const blob = r.doc.output("blob");
  return new File([blob], printoutName, { type: "application/pdf", lastModified: Date.now() });
}
