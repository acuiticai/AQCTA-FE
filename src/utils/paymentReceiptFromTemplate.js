import axios from "axios";
import ejs from "ejs";
import { formatDate } from "@/components/formatAmount";
import {
  downloadCustomerPaymentReceiptPdf,
  downloadVendorPaymentReceiptPdf,
} from "@/utils/downloadCustomerPaymentReceiptPdf";
import {
  normalizeAssetUrlForPdf,
  fetchImageAsDataUriForPdf,
  injectInvoicePdfSafetyStyles,
  downloadPdfBlob,
} from "@/utils/htmlToPdfHelpers";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL || "";

/**
 * Turn stored logo paths into absolute URLs so PDF renderers can load them.
 */
function absoluteApiUrl(src) {
  const base = (Base_URL || "").replace(/\/$/, "");
  const s = String(src || "").trim();
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith("/") ? s : `/${s}`;
  if (!base) return path;
  return `${base}${path}`;
}

/**
 * Inline non-data images for POST /html-to-pdf (Puppeteer has no session cookies for API files).
 */
async function inlineRemainingHttpImagesForPdf(html, adminInfo) {
  if (typeof DOMParser === "undefined") return html;
  try {
    const hadDoctype = /<!doctype/i.test(String(html));
    const stripped = String(html).replace(/^\s*<!DOCTYPE[^>]*>/i, "");
    const doc = new DOMParser().parseFromString(stripped, "text/html");
    const imgs = doc.querySelectorAll("img[src]");
    await Promise.all(
      Array.from(imgs).map(async (img) => {
        const raw = (img.getAttribute("src") || "").trim();
        if (!raw || raw.startsWith("data:")) return;
        const embedded = await fetchImageAsDataUriForPdf(raw, adminInfo);
        if (embedded) img.setAttribute("src", embedded);
      }),
    );
    const htmlEl = doc.documentElement;
    if (!htmlEl) return html;
    return hadDoctype ? `<!DOCTYPE html>\n${htmlEl.outerHTML}` : htmlEl.outerHTML;
  } catch {
    return html;
  }
}

/**
 * Same path as sale order / DocumentGenerator: server renders HTML → PDF so template matches on-screen.
 */
async function downloadPaymentHtmlAsServerPdf(html, filename, token) {
  const t = typeof token === "string" ? token.trim() : "";
  const headers = {
    "Content-Type": "application/json",
    ...(t ? { Authorization: t.startsWith("Bearer ") ? t : `Bearer ${t}` } : {}),
  };
  const res = await axios.post(
    `${Base_URL}/html-to-pdf`,
    {
      html,
      filename,
      format: "A4",
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      documentType: "INV",
    },
    { responseType: "blob", headers },
  );
  downloadPdfBlob(new Blob([res.data], { type: "application/pdf" }), filename);
}

/** Preferred names checked in order after default assignment resolution. */
const DEFAULT_PAYMENT_TEMPLATE_NAMES = ["symic", "Symic", "Standard Payment"];

function authHeaders(token) {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return { "Content-Type": "application/json" };
  return {
    Authorization: t.startsWith("Bearer ") ? t : `Bearer ${t}`,
    "Content-Type": "application/json",
  };
}

export function normalizeBusinessTemplateAssignments(response) {
  const raw = response?.data?.data ?? response?.data;
  return Array.isArray(raw) ? raw : [];
}

function safeJsonClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj ?? {}));
  } catch {
    return {};
  }
}

function unwrapBusiness(b) {
  if (!b || typeof b !== "object") return {};
  const logoVal = b.logo ?? b.companyLogo;
  const logoStr =
    typeof logoVal === "string"
      ? logoVal
      : logoVal && typeof logoVal === "object"
        ? logoVal.url ||
          logoVal.src ||
          logoVal.path ||
          logoVal.file ||
          ""
        : "";
  const img =
    logoStr ||
    b.image ||
    b.companyLogo ||
    b.businessLogo ||
    b.brandLogo ||
    b.logoUrl ||
    b.logo_url ||
    b.company_logo ||
    b.businessImage ||
    b.profileImage ||
    "";
  return {
    name:
      b.name ||
      b.businessName ||
      b.companyName ||
      "",
    address:
      b.address ??
      b.companyAddress ??
      b.fullAddress ??
      b.registeredAddress ??
      "",
    image: typeof img === "string" ? img : "",
  };
}

async function fetchBusinessLean(businessId, token) {
  if (!businessId) return {};
  try {
    const res = await axios.get(`${Base_URL}/business/${businessId}`, {
      headers: authHeaders(token),
    });
    const payload = res?.data?.data ?? res?.data ?? res;
    return unwrapBusiness(payload);
  } catch {
    return {};
  }
}

async function fetchDocumentTemplateById(templateId, token) {
  if (!templateId) return null;
  try {
    const res = await axios.get(`${Base_URL}/document-templates/${templateId}`, {
      headers: authHeaders(token),
    });
    return res?.data?.data ?? res?.data ?? null;
  } catch {
    return null;
  }
}

function nameMatchesPreferred(templateName, preferredNames) {
  const tn = String(templateName || "").trim().toLowerCase();
  if (!tn) return false;
  return preferredNames.some((n) => {
    const p = String(n).trim().toLowerCase();
    if (!p) return false;
    return tn === p || tn.includes(p);
  });
}

/**
 * Resolve HTML DocumentTemplate row for payment slips.
 * Uses business assignments (type payment), then named fallbacks (e.g. symic).
 */
export async function resolvePaymentDocumentTemplate(
  token,
  businessId,
  preferredNames = DEFAULT_PAYMENT_TEMPLATE_NAMES,
) {
  const names =
    preferredNames?.length > 0 ? preferredNames : DEFAULT_PAYMENT_TEMPLATE_NAMES;
  let assignments = [];

  if (businessId) {
    try {
      const res = await axios.get(
        `${Base_URL}/business-templates/${businessId}`,
        {
          headers: authHeaders(token),
        },
      );
      assignments = normalizeBusinessTemplateAssignments(res);
    } catch {
      assignments = [];
    }
  }

  const paymentAssignments = assignments.filter((a) => {
    const t = (a?.type || a?.templateId?.type || "").toLowerCase();
    if (t !== "payment") return false;
    if (a.isActive === false) return false;
    return true;
  });

  let chosen = paymentAssignments.find((a) => a.isDefault);
  if (!chosen) {
    chosen = paymentAssignments.find((a) =>
      nameMatchesPreferred(a?.templateId?.name, names),
    );
  }
  if (!chosen && paymentAssignments.length === 1) {
    chosen = paymentAssignments[0];
  }

  let doc = chosen?.templateId;
  if (doc && doc._id && !doc.htmlContent) {
    doc = await fetchDocumentTemplateById(doc._id, token);
  }

  if (doc?.htmlContent) return doc;

  for (const name of names) {
    try {
      const res = await axios.get(
        `${Base_URL}/document-templates/name/${encodeURIComponent(String(name).trim())}`,
        { headers: authHeaders(token) },
      );
      const d = res?.data?.data ?? null;
      if (d?.htmlContent) return d;
    } catch {
      /* try next */
    }
  }

  return null;
}

function resolveBusinessId(invoice, payment) {
  const fromInv =
    invoice?.business_id?._id ?? invoice?.business_id ?? invoice?.business?._id ?? invoice?.business;
  const fromPay =
    payment?.business_id?._id ??
    payment?.business_id ??
    payment?.business?._id ??
    payment?.business;
  return fromInv || fromPay || null;
}

function partyAddressLinesFromBasicInformation(basic) {
  if (!basic || typeof basic !== "object") return "";
  const parts = [
    basic.addressLineOne,
    basic.addressLineTwo,
    basic.cityName || basic.city,
    basic.countrySubentityCode,
    basic.postalZone,
    basic.countryIdentificationCode || basic.identificationCodeCountry,
  ].filter(Boolean);
  return parts.join("\n");
}

/** Prefer invoice billing, then customer master billing, then payment snapshot fields. */
function pickCustomerBillingAddress(invoice, payment, cust) {
  const invBill = invoice?.billingAddress ?? invoice?.buyerAddress ?? "";
  if (typeof invBill === "string" && invBill.trim()) return invBill.trim();

  const fromCompany =
    cust?.companyInfo?.billingAddress ??
    cust?.basicInformation?.billingAddress ??
    "";
  if (typeof fromCompany === "string" && fromCompany.trim())
    return fromCompany.trim();

  const snap =
    payment?.billingAddress ?? payment?.invoiceBillingAddress ?? "";
  if (typeof snap === "string" && snap.trim()) return snap.trim();

  return "";
}

function firstNonEmptyString(...candidates) {
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return "";
}

/** Invoice / proforma: shipping line on document; customer master: basicInformation.shippingAddress */
function pickCustomerShippingAddress(invoice, payment, cust) {
  const invShip =
    invoice?.shippingAddress ??
    invoice?.shipping_address ??
    invoice?.shipToAddress ??
    "";
  if (typeof invShip === "string" && invShip.trim()) return invShip.trim();

  const snap =
    payment?.shippingAddress ??
    payment?.shipToAddress ??
    "";
  if (typeof snap === "string" && snap.trim()) return snap.trim();

  const bi = cust?.basicInformation || {};
  const fromMaster =
    bi.shippingAddress ??
    cust?.companyInfo?.shippingAddress ??
    "";
  if (typeof fromMaster === "string" && fromMaster.trim())
    return fromMaster.trim();

  return "";
}

function vendorAddressEntryLines(entry) {
  if (!entry || typeof entry !== "object") return "";
  const cityState = [entry.city, entry.state].filter(Boolean).join(", ");
  const parts = [
    entry.addressLine1,
    entry.addressLine2,
    cityState,
    entry.zipCode,
    entry.country,
  ].filter((p) => typeof p === "string" && p.trim());
  return parts.length ? parts.join("\n") : "";
}

function vendorAddressLooksLikeShippingType(addressType) {
  const t = String(addressType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!t) return false;
  if (t === "shipping") return true;
  if (t === "ship to" || t === "shipto") return true;
  if (t === "delivery" || t === "dispatch") return true;
  if (t.includes("ship to") || t.includes("shipping")) return true;
  return false;
}

function pickVendorShippingAddress(invoice, payment, ven) {
  const invShip =
    invoice?.shippingAddress ??
    invoice?.shipping_address ??
    invoice?.shipToAddress ??
    "";
  if (typeof invShip === "string" && invShip.trim()) return invShip.trim();

  const snap =
    payment?.shippingAddress ??
    payment?.shipToAddress ??
    payment?.vendorShippingAddress ??
    "";
  if (typeof snap === "string" && snap.trim()) return snap.trim();

  const bi = ven?.basicInformation || {};
  const fromMaster =
    bi.shippingAddress ?? ven?.companyInfo?.shippingAddress ?? "";
  if (typeof fromMaster === "string" && fromMaster.trim())
    return fromMaster.trim();

  const addrs = ven?.addresses || [];
  const ship = addrs.find((a) => vendorAddressLooksLikeShippingType(a?.addressType));
  if (ship) {
    const lines = vendorAddressEntryLines(ship);
    if (lines) return lines;
  }
  return "";
}

/**
 * Compress long business addresses to two readable lines (comma-separated chunks).
 */
function formatBusinessAddressReceipt(raw) {
  const text = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  const parts = text
    .split(/\n/)
    .flatMap((line) => line.split(","))
    .map((p) => p.trim())
    .filter(Boolean);
  const joinedShort = parts.join(", ");
  if (parts.length <= 3) {
    if (joinedShort.length <= 52) return joinedShort;
    const mid = Math.floor(joinedShort.length / 2);
    let sp = joinedShort.lastIndexOf(" ", mid + 30);
    if (sp < 18) sp = joinedShort.indexOf(" ", mid);
    if (sp > 12 && sp < joinedShort.length - 12)
      return `${joinedShort.slice(0, sp).trim()}\n${joinedShort.slice(sp).trim()}`;
    return joinedShort;
  }
  const half = Math.ceil(parts.length / 2);
  return `${parts.slice(0, half).join(", ")}\n${parts.slice(half).join(", ")}`;
}

function buildCounterpartyCustomer(invoice, payment) {
  const cust =
    invoice?.customer_id ||
    payment?.customer_id ||
    invoice?.customer ||
    payment?.customer ||
    null;
  const bi = cust?.basicInformation || {};
  const name =
    bi.customerDisplayName ||
    bi.companyName ||
    invoice?.customer_name ||
    payment?.customerDisplayName ||
    "";

  const billing = pickCustomerBillingAddress(invoice, payment, cust);
  let addr = "";
  if (billing) {
    addr = billing.replace(/\r\n/g, "\n");
  } else {
    addr =
      bi.formattedAddress ||
      bi.companyAddress?.fullAddress ||
      partyAddressLinesFromBasicInformation(bi.companyAddress || bi);
    if (!addr && typeof bi.companyAddress === "string") addr = bi.companyAddress;
  }

  return { name: name || "—", address: addr || "" };
}

function buildCounterpartyVendor(invoice, payment) {
  const ven = invoice?.vendor || payment?.vendor_id || null;
  const bi = ven?.basicInformation || {};
  const name =
    bi.vendorDisplayName ||
    bi.companyName ||
    payment?.vendorName ||
    "";
  let addr =
    bi.formattedAddress ||
    bi.companyAddress?.fullAddress ||
    partyAddressLinesFromBasicInformation(bi.companyAddress || bi);
  if (!addr && typeof bi.companyAddress === "string") addr = bi.companyAddress;
  return { name: name || "—", address: addr || "" };
}

/**
 * Builds the `payment` object expected by PCI Payment Receipt EJS templates
 * (`payment.companyName`, `payment.customerName`, `payment.invoices`, …).
 *
 * @param {'customer'|'vendor'} kind
 */
export function buildPaymentReceiptTemplatePayload(kind, invoice, payment) {
  const invNum = firstNonEmptyString(
    invoice?.invoice_number,
    invoice?.invoiceNumber,
    payment?.invoice_number,
    payment?.invoiceNumber,
  );

  let invDateRaw =
    invoice?.invoice_date ??
    invoice?.invoiceDate ??
    invoice?.date ??
    payment?.invoice_date ??
    payment?.invoiceDate ??
    null;
  if (invDateRaw == null) {
    invDateRaw =
      invoice?.createdAt ??
      payment?.createdAt ??
      null;
  }

  let payDateRaw = payment?.paymentDate ?? payment?.date ?? payment?.createdAt ?? null;

  const currencyRaw =
    payment?.currency ??
    payment?.paymentCurrency ??
    invoice?.currency ??
    "USD";

  let amtNum = Number(
    payment?.allocatedAmount ??
      payment?.amount ??
      payment?.amountInInvoiceCurrency ??
      0,
  );
  if (!Number.isFinite(amtNum)) amtNum = 0;

  let invTotal = Number(
    invoice?.grandTotal ??
      invoice?.total ??
      payment?.invoice_grand_total ??
      0,
  );
  if (!Number.isFinite(invTotal) || invTotal <= 0) {
    invTotal = amtNum || 0;
  }

  const paymentReceiptNumber =
    String(
      payment?.paymentNumber ||
        payment?.vendorPaymentNumber ||
        invoice?.vendorPaymentNumber ||
        "",
    ).trim() || "";

  const referenceNumber = String(payment?.reference || "").trim();

  let bankNote = "";
  const dep =
    typeof payment?.depositTo === "object" && payment.depositTo != null
      ? payment.depositTo
      : payment?.bankAccount;
  if (dep && typeof dep === "object") {
    const bits = [
      dep.accountName,
      dep.bankName,
      dep.accountNumber,
    ].filter(Boolean);
    bankNote = bits.join(" · ");
  }

  let counterparty =
    kind === "vendor"
      ? buildCounterpartyVendor(invoice, payment)
      : buildCounterpartyCustomer(invoice, payment);

  /** Vendor slips: populate `customerName` so default “Received From” templates still render. */
  const customerName = counterparty?.name || "—";
  const customerAddress = counterparty?.address || "";

  const custRef =
    invoice?.customer_id ||
    payment?.customer_id ||
    invoice?.customer ||
    payment?.customer ||
    null;
  const venRef =
    invoice?.vendor ??
    payment?.vendor_id ??
    invoice?.vendor_id ??
    payment?.vendor ??
    null;

  const customerShippingAddress =
    kind === "vendor"
      ? pickVendorShippingAddress(invoice, payment, venRef)
      : pickCustomerShippingAddress(invoice, payment, custRef);

  return {
    paymentDate:
      kind === "vendor" || payDateRaw
        ? formatDate(payDateRaw || new Date())
        : formatDate(new Date()),
    paymentReceiptNumber,
    referenceNumber,
    paymentMode: String(payment?.paymentMode || payment?.paymentType || "").trim()
      ? String(payment?.paymentMode || payment?.paymentType)
      : kind === "vendor"
        ? "Bank Transfer"
        : "—",
    amountReceived: amtNum,
    currencyCode: String(currencyRaw).trim(),
    customerName,
    customerAddress,
    customerShippingAddress,
    /** Same values in summary area for templates that show invoice # / date above the table */
    invoiceNumber: invNum || "—",
    invoiceDate:
      invDateRaw != null ? formatDate(invDateRaw) : "—",
    beneficiaryNotes: bankNote,
    invoices: [
      {
        invoiceNumber: invNum || "—",
        invoiceDate:
          invDateRaw != null ? formatDate(invDateRaw) : "—",
        invoiceAmount: invTotal,
        paymentAmount: Number.isFinite(amtNum) ? amtNum : invTotal,
      },
    ],
  };
}

function mergeTemplateDummyWithLive(template, livePayment) {
  const root = safeJsonClone(template?.dummyData);
  root.payment = { ...(root.payment || {}), ...livePayment };
  return root;
}

function overlayBusinessOnPayload(root, biz) {
  const b = unwrapBusiness(biz);
  const p = root.payment || {};
  if (b.image) p.companyLogo = absoluteApiUrl(b.image);
  if (b.name) p.companyName = b.name;
  if (b.address) p.companyAddress = formatBusinessAddressReceipt(String(b.address));
  root.payment = p;
  return root;
}

function fallbackPdf(kind, invoice, payment, paymentIndex) {
  if (kind === "vendor") {
    downloadVendorPaymentReceiptPdf({
      invoice,
      payment,
      paymentIndex,
    });
  } else {
    downloadCustomerPaymentReceiptPdf({
      invoice,
      payment,
      paymentIndex,
    });
  }
}

/**
 * Download a Payment Receipt PDF using the assigned Payment template when available.
 * Uses the same server pipeline as sale order / invoice PDFs: embed logo as data URI,
 * inject PDF safety styles, then POST HTML to `/html-to-pdf` (not client html2pdf).
 * Falls back to the simple jsPDF receipt if the template is missing or server PDF fails.
 *
 * @param {object} options
 * @param {string} options.token Bearer token (without prefix ok)
 * @param {string} [options.businessId]
 * @param {object|null} options.invoice
 * @param {object} options.payment
 * @param {'customer'|'vendor'} options.kind
 * @param {number} [options.paymentIndex]
 * @param {string[]} [options.preferredTemplateNames]
 */
export async function downloadPaymentReceiptSlip({
  token,
  businessId: businessIdOpt,
  invoice,
  payment,
  kind = "customer",
  paymentIndex = 0,
  preferredTemplateNames,
}) {
  const businessId =
    businessIdOpt || resolveBusinessId(invoice || {}, payment || {}) || "";

  let template = null;
  try {
    template = await resolvePaymentDocumentTemplate(
      token,
      businessId || "",
      preferredTemplateNames ?? DEFAULT_PAYMENT_TEMPLATE_NAMES,
    );
  } catch (_) {
    template = null;
  }

  if (!template?.htmlContent) {
    fallbackPdf(kind, invoice, payment, paymentIndex);
    return { usedTemplate: false };
  }

  const livePayment = buildPaymentReceiptTemplatePayload(
    kind,
    invoice || {},
    payment || {},
  );

  const merged = mergeTemplateDummyWithLive(template, livePayment);
  let bizMerged = unwrapBusiness({});
  const invBiz = unwrapBusiness(invoice?.business ?? invoice?.business_id);
  const payBiz = unwrapBusiness(payment?.business ?? payment?.business_id);
  bizMerged = {
    ...bizMerged,
    ...payBiz,
    ...invBiz,
  };

  /** Fill missing branding (especially logo) when invoice payload omits fields. */
  if (
    businessId &&
    (!bizMerged.image || !bizMerged.name || !bizMerged.address)
  ) {
    const fetched = await fetchBusinessLean(businessId, token);
    bizMerged = { ...bizMerged, ...fetched };
  }
  overlayBusinessOnPayload(merged, bizMerged);

  const adminInfo = { token };
  const logoRaw = merged.payment?.companyLogo;
  if (logoRaw && !String(logoRaw).startsWith("data:")) {
    const embedded = await fetchImageAsDataUriForPdf(logoRaw, adminInfo);
    if (embedded) {
      merged.payment.companyLogo = embedded;
    } else {
      const abs = normalizeAssetUrlForPdf(logoRaw);
      if (abs) merged.payment.companyLogo = abs;
    }
  }

  let rendered;
  try {
    rendered = ejs.render(template.htmlContent, merged, {
      strict: false,
      async: false,
    });
    rendered = injectInvoicePdfSafetyStyles(rendered);
    rendered = await inlineRemainingHttpImagesForPdf(rendered, adminInfo);
  } catch (e) {
    console.error("Payment receipt template render failed:", e);
    fallbackPdf(kind, invoice, payment, paymentIndex);
    return { usedTemplate: false, error: e };
  }

  const safe =
    (livePayment.paymentReceiptNumber ||
      kind + "-" + (payment?._id || paymentIndex))
      .toString()
      .replace(/[^a-zA-Z0-9-_]/g, "_") || "receipt";
  const outName = `Payment-Receipt-${safe}.pdf`;
  try {
    await downloadPaymentHtmlAsServerPdf(rendered, outName, token);
  } catch (serverErr) {
    console.error("Payment receipt server PDF failed:", serverErr);
    fallbackPdf(kind, invoice, payment, paymentIndex);
    return { usedTemplate: false, error: serverErr };
  }

  return { usedTemplate: true };
}
