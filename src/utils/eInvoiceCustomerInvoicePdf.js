import jsPDF from "jspdf";
import QRCode from "qrcode";

function safeStr(v) {
  if (v == null) return "";
  return String(v).replace(/\r|\n/g, " ").trim();
}

function displayOrNA(v) {
  const s = safeStr(v);
  return s === "" ? "N/A" : s;
}

/** YYYY-MM-DD HH:mm:ss style (matches LHDN-style previews). */
function formatPdfDateTime(value) {
  if (value == null || value === "") return "N/A";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return String(value);
  }
}

function joinAddressParts(parts) {
  return parts
    .map((p) => safeStr(p))
    .filter(Boolean)
    .join(", ");
}

function buildShareUrlFromUuidLongId(uuid, longID, usePreprod) {
  if (!uuid || !longID) return "";
  const base = usePreprod
    ? "https://preprod.myinvois.hasil.gov.my"
    : "https://myinvois.hasil.gov.my";
  return `${base}/${encodeURIComponent(String(uuid))}/share/${encodeURIComponent(String(longID))}`;
}

function resolveQrUrl(inv, businessLhdn) {
  const link = safeStr(inv.invoiceLink);
  if (link) return link;
  const uuid = inv.uuid;
  const longID = inv.longID;
  const usePreprod = businessLhdn?.useTestingEnvironment !== false;
  return buildShareUrlFromUuidLongId(uuid, longID, usePreprod);
}

function resolveDisplayEInvoiceType(inv) {
  if (!inv || typeof inv !== "object") return "Invoice";
  const rawType = String(inv.invoiceType || "").trim();
  const normalizedType = rawType.toLowerCase();
  const creditType = String(inv.creditNoteType || "").trim().toLowerCase();

  if (inv.isConsolidated === true) return "Consolidated Invoice";
  if (creditType.startsWith("refund")) return "Refund Note";
  if (inv.creditNoteNumber || normalizedType.includes("credit")) {
    return "Credit Note";
  }
  if (inv.debitNoteNumber || normalizedType.includes("debit")) {
    return "Debit Note";
  }
  if (normalizedType.includes("refund")) return "Refund Note";
  if (normalizedType.includes("consolidat")) return "Consolidated Invoice";
  if (rawType) return rawType;
  return "Invoice";
}

function sumInclusiveTaxFromLines(items) {
  let taxSum = 0;
  for (const it of items || []) {
    const rate = Number(it.taxRate) || 0;
    const lineTotal = Number(it.totalValue) || 0;
    if (rate > 0 && lineTotal > 0) {
      const net = lineTotal / (1 + rate / 100);
      taxSum += lineTotal - net;
    }
  }
  return taxSum;
}

/** Same resolution order as `InvoiceRenderer` / create invoice PDF helpers. */
function resolveBusinessLogoUrl(inv) {
  const business = inv.business_id || inv.business || {};
  return safeStr(
    business.image ||
      business.logo ||
      business.businessLogo ||
      business.companyLogo ||
      inv.businessLogo ||
      inv.business_id?.image ||
      inv.business_id?.logo ||
      inv.business?.image ||
      inv.business?.logo ||
      "",
  );
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

function blobLooksLikeImage(blob) {
  if (!blob || blob.size === 0) return false;
  const t = (blob.type || "").toLowerCase();
  if (!t) return true;
  if (t.startsWith("image/")) return true;
  if (t.includes("octet-stream")) return true;
  return false;
}

/**
 * Load logo for jsPDF: direct fetch first (API/static URLs); S3 via proxy when allowed.
 * @param {string} logoUrl
 * @returns {Promise<string|null>} data URL
 */
async function loadLogoDataUrlForPdf(logoUrl) {
  const raw = safeStr(logoUrl);
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;

  const base = safeStr(import.meta.env.VITE_APP_API_BASE_URL).replace(
    /\/$/,
    "",
  );
  const abs =
    normalizeLogoAssetUrl(raw, base) || raw.replace(/&amp;/g, "&").trim();

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

/**
 * Merge GET /business/:id so `image` is present (populate alone sometimes omits or stale).
 * @param {object} inv
 * @param {(id: string) => Promise<{ data?: unknown }>} getBusinessById axios-like
 */
async function mergeBusinessDocForPdf(inv, getBusinessById) {
  if (!getBusinessById || !inv || typeof inv !== "object") return inv;
  const bid = inv.business_id?._id || inv.business_id;
  const idStr = bid != null ? String(bid) : "";
  if (!idStr) return inv;

  try {
    const res = await getBusinessById(idStr);
    const bdoc = res?.data?.data ?? res?.data;
    if (!bdoc || typeof bdoc !== "object") return inv;

    const prev = inv.business_id;
    const prevIsPopulated =
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev) &&
      (prev.name != null ||
        prev.email != null ||
        prev.image != null ||
        prev.logo != null);
    const prevPlain = prevIsPopulated ? prev : {};

    const mergedBiz = {
      ...bdoc,
      ...prevPlain,
      image: safeStr(prevPlain.image) || safeStr(bdoc.image) || "",
      logo: safeStr(prevPlain.logo) || safeStr(bdoc.logo) || "",
    };

    return {
      ...inv,
      business_id: mergedBiz,
      business: mergedBiz,
    };
  } catch {
    return inv;
  }
}

function parseDataUrlForJspdf(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  let format = "PNG";
  if (mime.includes("jpeg") || mime.includes("jpg")) format = "JPEG";
  else if (mime.includes("png")) format = "PNG";
  else if (mime.includes("webp")) format = "WEBP";
  return { base64, format };
}

function imageDimensionsFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        w: img.naturalWidth,
        h: img.naturalHeight,
      });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Map PCI proforma-invoice API shape into fields for the LHDN-style PDF.
 * @param {object} inv
 * @param {object|null} businessLhdn row from BusinessDetails/get_by_business_id
 */
export function buildLhdnEInvoicePdfFieldModel(inv, businessLhdn) {
  const customer = inv.customer_id || inv.customer;
  const custBio = customer?.basicInformation || {};
  const ei = customer?.eInvoiceInfo || {};
  const isConsolidated = inv.isConsolidated === true;

  const business = inv.business_id || inv.business;

  const itemsRaw = inv.items || [];
  const items = itemsRaw.map((it, idx) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.unitPrice ?? it.rate) || 0;
    const amt =
      it.totalValue != null
        ? Number(it.totalValue)
        : it.total != null
          ? Number(it.total)
          : qty * rate;
    const taxRate = Number(it.taxRate) || 0;
    const title = safeStr(it.title || it.itemName || it.name);
    const descPart = safeStr(it.description);
    const desc =
      title && descPart && title !== descPart
        ? `${title} — ${descPart}`
        : title || descPart || "Item";
    const clsRaw =
      it.classificationCode ||
      it.lhdnClassification ||
      it.itemType ||
      String(idx + 1).padStart(3, "0");
    const cls = String(clsRaw).slice(0, 12);
    return { cls, desc, qty, taxRate, amt };
  });

  const grand = Number(inv.grandTotal ?? inv.total) || 0;
  let taxAmt = sumInclusiveTaxFromLines(itemsRaw);
  const sub = Number(inv.subTotal ?? inv.subtotal) || 0;
  if (taxAmt < 0.0001 && grand > 0 && sub > 0 && grand > sub) {
    taxAmt = Math.max(0, grand - sub);
  }

  const firstTaxLine = itemsRaw.find((x) => Number(x.taxRate) > 0);
  const t_taxLabel = safeStr(firstTaxLine?.taxName) || "Tax";
  const t_taxRate = firstTaxLine ? Number(firstTaxLine.taxRate) : 0;

  const status = safeStr(inv.lhdn_status) || "N/A";
  const paidWord =
    safeStr(inv.status).toLowerCase() === "paid" || status === "Valid"
      ? "Paid Invoice"
      : "Invoice";

  const s_name = business?.name || "N/A";
  const s_tin = displayOrNA(businessLhdn?.tin);
  const s_idType = displayOrNA(businessLhdn?.idType || "BRN");
  const s_idVal = displayOrNA(
    businessLhdn?.idValue || businessLhdn?.registrationNumber,
  );
  const s_sst = displayOrNA(businessLhdn?.sstRegistrationNumber);
  const s_msic = displayOrNA(businessLhdn?.msicCode);
  const s_contact = displayOrNA(businessLhdn?.contactNumber);
  const s_email = displayOrNA(business?.email);
  const s_addr =
    joinAddressParts([
      businessLhdn?.addressLine1,
      businessLhdn?.addressLine2,
      businessLhdn?.cityName,
      businessLhdn?.postalZone,
    ]) || displayOrNA(inv.billingAddress);

  const b_name = isConsolidated
    ? "General Public"
    : displayOrNA(
        custBio.customerDisplayName || custBio.companyName || inv.customer_name,
      );
  const b_tin = isConsolidated ? "NA" : displayOrNA(ei.tin);
  const b_idType = isConsolidated ? "NA" : displayOrNA(ei.idType || "BRN");
  const b_idVal = isConsolidated
    ? "NA"
    : displayOrNA(ei.idValue || ei.registrationNumber);
  const b_sst = isConsolidated ? "NA" : displayOrNA(ei.sstRegistrationNumber);
  const b_contact = isConsolidated
    ? "NA"
    : displayOrNA(
        ei.contactNumber ||
          custBio.customerPhone?.mobile ||
          custBio.customerPhone?.workPhone,
      );
  const b_email = isConsolidated ? "NA" : displayOrNA(custBio.customerEmail);
  const b_addr = isConsolidated
    ? "NA"
    : joinAddressParts([
        ei.addressLine1,
        ei.addressLine2,
        ei.cityName,
        ei.postalZone,
      ]) || displayOrNA(inv.billingAddress);

  const qrUrl = resolveQrUrl(inv, businessLhdn);
  const supplierLogoUrl = resolveBusinessLogoUrl(inv);

  return {
    supplierLogoUrl,
    f_type: resolveDisplayEInvoiceType(inv) || paidWord,
    f_code: safeStr(inv.invoiceCodeNumber) || "01",
    f_uuid: displayOrNA(inv.uuid),
    f_internalId: displayOrNA(inv.invoice_number || inv.code),
    f_issueDate: formatPdfDateTime(inv.invoice_date ?? inv.invoiceDate),
    f_subDate: formatPdfDateTime(inv.submitted_time),
    f_valDate: formatPdfDateTime(inv.processed_time),
    f_currency: safeStr(inv.currency).toUpperCase() || "MYR",
    f_status: status,
    f_qrUrl: qrUrl,
    s_name,
    s_tin,
    s_idType,
    s_idVal,
    s_sst,
    s_msic,
    s_contact,
    s_email,
    s_addr,
    b_name,
    b_tin,
    b_idType,
    b_idVal,
    b_sst,
    b_contact,
    b_email,
    b_addr,
    items,
    t_taxLabel,
    t_taxRate,
    t_taxAmt: taxAmt,
    t_grand: grand,
  };
}

/**
 * LHDN e-invoice layout (Malaysia MyInvois template-style). Styling matches the
 * standalone preview: branded header bars, grid table, footer notice.
 * @param {ReturnType<typeof buildLhdnEInvoicePdfFieldModel>} m
 */
export async function generateLhdnEInvoiceTemplatePdf(m) {
  const g = (k) => (m[k] == null ? "" : String(m[k]));

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const M = 14;
  const cw = pageW - 2 * M;
  /** Section header / table header fill #023366 */
  const HEADER_FILL_RGB = [0x02, 0x33, 0x66];

  let y = M;

  let qrDataUrl = null;
  const qrUrl = g("f_qrUrl");
  if (qrUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 400,
        margin: 3,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
    } catch {
      qrDataUrl = null;
    }
  }

  const LOGO_W = 55;
  const LOGO_H = 18;
  /** Right column only: drop QR + label slightly from page top; left block unchanged */
  const QR_TOP_OFFSET_MM = 4;
  const QR_W = 34;
  const QR_H = 34;
  const QR_X = pageW - M - QR_W;
  const qrY = M + QR_TOP_OFFSET_MM;

  const logoDataUrl = await loadLogoDataUrlForPdf(m.supplierLogoUrl);
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
      const offX = M + (LOGO_W - drawW) / 2;
      const offY = M + (LOGO_H - drawH) / 2;
      const tryAdd = (data, fmt) => {
        doc.addImage(data, fmt, offX, offY, drawW, drawH);
      };
      try {
        tryAdd(parsed.base64, parsed.format);
        logoPlaced = true;
      } catch {
        try {
          tryAdd(logoDataUrl, parsed.format);
          logoPlaced = true;
        } catch {
          if (parsed.format !== "JPEG") {
            try {
              tryAdd(parsed.base64, "JPEG");
              logoPlaced = true;
            } catch {
              /* use placeholder */
            }
          }
        }
      }
    }
  }
  if (!logoPlaced) {
    doc.setFillColor(245, 245, 245);
    doc.rect(M, M, LOGO_W, LOGO_H, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text("Business Logo", M + LOGO_W / 2, M + LOGO_H / 2 + 1, {
      align: "center",
    });
  }
  doc.setTextColor(0, 0, 0);

  if (qrDataUrl) {
    let imageData = qrDataUrl;
    if (qrDataUrl.startsWith("data:")) {
      const base64Match = qrDataUrl.match(/base64,(.+)/);
      if (base64Match) imageData = base64Match[1];
    }
    try {
      doc.addImage(imageData, "PNG", QR_X, qrY, QR_W, QR_H);
    } catch {
      try {
        doc.addImage(qrDataUrl, "PNG", QR_X, qrY, QR_W, QR_H);
      } catch {
        doc.setFillColor(245, 245, 245);
        doc.rect(QR_X, qrY, QR_W, QR_H, "F");
      }
    }
  } else {
    doc.setFillColor(245, 245, 245);
    doc.rect(QR_X, qrY, QR_W, QR_H, "F");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("e-INVOICE", QR_X + QR_W / 2, qrY + QR_H + 6, { align: "center" });

  const INFO_Y_START = M + LOGO_H + 3;
  const INFO_LX = M;
  const INFO_VX = M + 52;
  const INFO_LH = 4.5;
  y = INFO_Y_START;

  const infoRows = [
    ["e-Invoice Type", g("f_type")],
    ["e-Invoice Code", g("f_code")],
    ["UUID", g("f_uuid")],
    ["Internal ID", g("f_internalId")],
    ["Issuance Date", g("f_issueDate")],
    ["Submission Date", g("f_subDate")],
    ["Validation Date", g("f_valDate")],
    ["Currency Code", g("f_currency")],
    ["Status", g("f_status")],
  ];

  doc.setFontSize(8);
  for (const [lbl, val] of infoRows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`${lbl} :`, INFO_LX, y);
    doc.text(String(val || "N/A"), INFO_VX, y);
    y += INFO_LH;
  }

  y += 6;

  const colW = cw / 2;
  const midX = M + colW;
  const HDR_H = 7;
  const boxStartY = y;

  doc.setFillColor(...HEADER_FILL_RGB);
  doc.rect(M, y, cw, HDR_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Supplier (From)", M + 4, y + HDR_H - 2);
  doc.text("Buyer (To)", midX + 4, y + HDR_H - 2);

  const CONTENT_TOP = y + HDR_H + 2;
  /** Space above the first "Name" row in supplier & buyer columns */
  const PARTY_NAME_TOP_MM = 5;
  let sY = CONTENT_TOP + PARTY_NAME_TOP_MM;
  let bY = CONTENT_TOP + PARTY_NAME_TOP_MM;
  const PAD = 3;
  const halfW = colW - PAD * 2;
  const quarterW = halfW / 2 - 2;

  const FLD_FS = 7.5;
  /** Vertical gap: label baseline → value block */
  const FLD_LH = 4.3;
  /** Line height for wrapped value text */
  const FLD_VLH = 4.1;
  /** Space after each field / field-pair before the next block */
  const FLD_BLOCK_GAP = 3.2;

  const drawFld = (x, cy, label, value, maxW) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FLD_FS);
    doc.setTextColor(0, 0, 0);
    doc.text(label, x, cy);
    cy += FLD_LH;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(value || "N/A"), maxW);
    doc.text(lines, x, cy);
    return cy + lines.length * FLD_VLH + FLD_BLOCK_GAP;
  };

  const drawFldPair = (x, cy, lbl1, val1, lbl2, val2) => {
    const x2 = x + quarterW + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FLD_FS);
    doc.setTextColor(0, 0, 0);
    doc.text(lbl1, x, cy);
    if (lbl2) doc.text(lbl2, x2, cy);
    cy += FLD_LH;
    doc.setFont("helvetica", "normal");
    const v1 = doc.splitTextToSize(String(val1 || "N/A"), quarterW);
    doc.text(v1, x, cy);
    if (lbl2) {
      const v2 = doc.splitTextToSize(String(val2 || "N/A"), quarterW);
      doc.text(v2, x2, cy);
    }
    return cy + Math.max(v1.length, 1) * FLD_VLH + FLD_BLOCK_GAP;
  };

  const sX = M + PAD;
  const bX = midX + PAD;

  sY = drawFld(sX, sY, "Name", g("s_name"), halfW);
  sY = drawFldPair(
    sX,
    sY,
    "ID Type/Number",
    `${g("s_idType")} ${g("s_idVal")}`.trim(),
    "TIN",
    g("s_tin"),
  );
  sY = drawFldPair(
    sX,
    sY,
    "SST Registration Number",
    g("s_sst"),
    "MSIC Code",
    g("s_msic"),
  );
  sY = drawFldPair(
    sX,
    sY,
    "Contact Number",
    g("s_contact"),
    "Email",
    g("s_email"),
  );
  sY = drawFld(sX, sY, "Address", g("s_addr"), halfW);

  bY = drawFld(bX, bY, "Name", g("b_name"), halfW);
  bY = drawFldPair(
    bX,
    bY,
    "ID Type/Number",
    `${g("b_idType")} ${g("b_idVal")}`.trim(),
    "TIN",
    g("b_tin"),
  );
  bY = drawFldPair(
    bX,
    bY,
    "SST Registration Number",
    g("b_sst"),
    "Contact Number",
    g("b_contact"),
  );
  bY = drawFld(bX, bY, "Email", g("b_email"), halfW);
  bY = drawFld(bX, bY, "Address", g("b_addr"), halfW);

  const boxBottom = Math.max(sY, bY) + 4;
  const boxH = boxBottom - boxStartY;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(M, boxStartY, cw, boxH, "S");
  doc.line(midX, boxStartY, midX, boxStartY + boxH);

  y = boxStartY + boxH + 5;

  const C = { cls: 22, qty: 18, taxed: 14, amt: 20 };
  C.desc = cw - C.cls - C.qty - C.taxed - C.amt;
  const cx = {
    cls: M,
    desc: M + C.cls,
    qty: M + C.cls + C.desc,
    taxed: M + C.cls + C.desc + C.qty,
    amt: M + C.cls + C.desc + C.qty + C.taxed,
  };
  const TBL_HDR_H = 7;
  /** Keep table + at least one row together; avoid empty header on previous page */
  const TABLE_PAGE_SAFE_BOTTOM = 60;

  const drawTblHdr = (ty) => {
    doc.setFillColor(...HEADER_FILL_RGB);
    doc.rect(M, ty, cw, TBL_HDR_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Classification", cx.cls + 2, ty + 5);
    doc.text("Description of Product or Service", cx.desc + 2, ty + 5);
    doc.text("Quantity", cx.qty + C.qty / 2, ty + 5, { align: "center" });
    doc.text("Taxed", cx.taxed + C.taxed / 2, ty + 5, { align: "center" });
    doc.text("Amount", cx.amt + C.amt, ty + 5, { align: "right" });
    doc.setTextColor(0, 0, 0);
    return ty + TBL_HDR_H;
  };

  const MIN_ITEM_ROW_H = 7;
  let tableY = y;
  if (tableY + TBL_HDR_H + MIN_ITEM_ROW_H > pageH - TABLE_PAGE_SAFE_BOTTOM) {
    doc.addPage();
    tableY = M;
  }
  let curY = drawTblHdr(tableY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  const items = m.items || [];
  for (const item of items) {
    const descLines = doc.splitTextToSize(String(item.desc), C.desc - 3);
    const ROW_H = Math.max(descLines.length * 3.8 + 3.5, MIN_ITEM_ROW_H);

    if (curY + ROW_H > pageH - TABLE_PAGE_SAFE_BOTTOM) {
      doc.addPage();
      curY = M;
      curY = drawTblHdr(curY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }

    const mY = curY + ROW_H / 2 + 1.3;
    doc.text(String(item.cls), cx.cls + 2, mY);
    doc.text(descLines, cx.desc + 2, curY + 4);
    doc.text(parseFloat(item.qty).toFixed(1), cx.qty + C.qty / 2, mY, {
      align: "center",
    });
    doc.text(item.taxRate > 0 ? "Yes" : "No", cx.taxed + C.taxed / 2, mY, {
      align: "center",
    });
    doc.text(parseFloat(item.amt).toFixed(2), cx.amt + C.amt, mY, {
      align: "right",
    });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(M, curY + ROW_H, M + cw, curY + ROW_H);
    curY += ROW_H;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(M, curY, M + cw, curY);

  /** Air between line-items table and totals / tax block */
  const TABLE_TO_TOTALS_GAP_MM = 7;
  y = curY + TABLE_TO_TOTALS_GAP_MM;

  const taxAmt = Number(m.t_taxAmt) || 0;
  const grand = Number(m.t_grand) || 0;
  const net = grand - taxAmt;
  const TOTALS_ROW_H = 5.25;
  const TOTALS_RIGHT_START = 8;
  const TOTALS_H = 40;

  if (y + TOTALS_H > pageH - 35) {
    doc.addPage();
    y = M;
  }

  const totTop = y;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(M, totTop, cw, TOTALS_H, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Tax Type", M + 4, totTop + 8);
  doc.text("Tax Rate", M + 42, totTop + 8);
  doc.setFont("helvetica", "normal");
  doc.text(g("t_taxLabel"), M + 4, totTop + 14);
  doc.text(`${parseFloat(m.t_taxRate || 0).toFixed(1)}%`, M + 42, totTop + 14);

  const totR = pageW - M - 3;
  const totLX = M + cw * 0.5 + 4;
  const totRows = [
    ["Total Tax Amount:", taxAmt.toFixed(1)],
    ["Total Net Amount:", net.toFixed(1)],
    ["Total Excluding Tax:", net.toFixed(1)],
    ["Total Including Tax:", grand.toFixed(2)],
    ["Prepayment Amount:", "0"],
    ["Total Payable Amount:", grand.toFixed(2)],
  ];
  let tY = totTop + TOTALS_RIGHT_START;
  doc.setFontSize(8);
  for (const [lbl, val] of totRows) {
    doc.setFont("helvetica", "normal");
    doc.text(lbl, totLX, tY);
    doc.text(val, totR, tY, { align: "right" });
    tY += TOTALS_ROW_H;
  }

  y = totTop + TOTALS_H + 8;

  const NOTICE =
    "This document is computer-generated. No signature is required for the purpose of the Income Tax Act 1967 and the relevant subsidiary legislation. The supplier and buyer are responsible for the accuracy of the information in this e-Invoice.";
  const FOOTER_URL = "https://www.hasil.gov.my/en/e-invoice/about-e-invoice/";

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const FY = pageH - 26;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(
      "For more information on Malaysia e-Invoice, please refer to:",
      M,
      FY,
    );
    doc.setTextColor(0, 0, 200);
    doc.text(FOOTER_URL, M, FY + 4);
    const lw = doc.getTextWidth(FOOTER_URL);
    doc.link(M, FY + 2, lw, 4, { url: FOOTER_URL });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("Notice:", M, FY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    const nl = doc.splitTextToSize(NOTICE, cw);
    doc.text(nl, M, FY + 14);
    doc.setTextColor(0, 0, 0);
  }

  const safeType =
    safeStr(g("f_type"))
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "E-Invoice";
  const safeNumber =
    safeStr(g("f_internalId"))
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "Document";
  doc.save(`${safeType}_${safeNumber}.pdf`);
}

/**
 * Map a PCI invoice record for PDF (line items / top-level aliases).
 * @param {object} inv
 */
export function mapFlexaCustomerInvoiceForEInvoicePdf(inv) {
  if (!inv || typeof inv !== "object") return inv;
  const items = (inv.items || []).map((it) => {
    const qty = parseFloat(it.quantity) || 0;
    const rate = parseFloat(it.unitPrice ?? it.rate) || 0;
    const amountNum =
      it.totalValue != null
        ? parseFloat(it.totalValue)
        : it.total != null
          ? parseFloat(it.total)
          : qty * rate;
    const itemName = it.title || it.itemName || it.item || it.name || "Item";
    return {
      ...it,
      title: itemName,
      quantity: qty,
      unitPrice: rate,
      totalValue: amountNum,
    };
  });

  const bus = inv.business_id;
  const businessObj =
    bus && typeof bus === "object" && !Array.isArray(bus) ? bus : null;

  return {
    ...inv,
    invoice_number: inv.invoice_number ?? inv.invoiceNumber,
    invoice_date: inv.invoice_date ?? inv.invoiceDate,
    grandTotal: inv.grandTotal ?? inv.total,
    subTotal: inv.subTotal ?? inv.subtotal,
    items,
    business_id: bus,
    business: businessObj || inv.business,
    customer_id: inv.customer_id ?? inv.customer,
    customer: inv.customer_id ?? inv.customer,
  };
}

/**
 * Download e-invoice as PDF (call when `lhdn_status === "Valid"`).
 * @param {object} rowInvoice list row
 * @param {object} services
 * @param {(id: string) => Promise<any>} [services.getInvoiceById]
 * @param {(code: string) => Promise<any>} [services.getEInvoiceDetails]
 * @param {(businessId: string) => Promise<object|null>} [services.getBusinessLhdnByBusinessId]
 * @param {(businessId: string) => Promise<any>} [services.getBusinessById] loads `image` for PDF logo
 */
export function mapFlexaCreditNoteForEInvoicePdf(note) {
  if (!note || typeof note !== "object") return note;
  const cust = note.customer;
  const bus = note.business;
  return {
    ...note,
    invoice_number: note.creditNoteNumber,
    invoice_date: note.creditNoteDate,
    due_date: note.dueDate,
    grandTotal: note.total,
    subTotal: note.subtotal,
    invoiceType: "Credit Note",
    items: (note.items || []).map((it, i) => {
      const qty = Number(it.quantity) || 1;
      const amt = Number(it.amount) || 0;
      const rate =
        it.rate != null && it.rate !== ""
          ? Number(it.rate)
          : qty
            ? amt / qty
            : amt;
      return {
        title: it.item_name || `Line ${i + 1}`,
        description: it.description,
        quantity: qty,
        unitPrice: rate,
        totalValue: amt,
        taxRate: Number(it.taxRate) || 0,
        taxName: it.taxName,
      };
    }),
    customer_id: cust,
    customer: cust,
    business_id: bus?._id ?? note.business_id ?? bus,
    business: typeof bus === "object" && bus ? bus : note.business,
    isConsolidated: false,
  };
}

export function mapFlexaDebitNoteForEInvoicePdf(note) {
  if (!note || typeof note !== "object") return note;
  const cust = note.customer;
  const bus = note.business;
  return {
    ...note,
    invoice_number: note.debitNoteNumber,
    invoice_date: note.debitNoteDate,
    grandTotal: note.total,
    subTotal: note.subtotal,
    invoiceType: "Debit Note",
    items: (note.items || []).map((it, i) => {
      const qty = Number(it.quantity) || 1;
      const amt = Number(it.amount) || 0;
      const rate =
        it.rate != null && it.rate !== ""
          ? Number(it.rate)
          : qty
            ? amt / qty
            : amt;
      return {
        title: it.item_name || `Line ${i + 1}`,
        description: it.description,
        quantity: qty,
        unitPrice: rate,
        totalValue: amt,
        taxRate: Number(it.taxRate) || 0,
        taxName: it.taxName,
      };
    }),
    customer_id: cust,
    customer: cust,
    business_id: bus?._id ?? note.business_id ?? bus,
    business: typeof bus === "object" && bus ? bus : note.business,
    isConsolidated: false,
  };
}

/**
 * Download validated LHDN PDF for a customer credit or debit note (`cn-` / `dn-` details codes).
 */
export async function downloadFlexaCreditDebitEInvoicePdf(
  row,
  kind,
  {
    getCreditNoteById,
    getDebitNoteById,
    getEInvoiceDetails,
    getBusinessLhdnByBusinessId,
    getBusinessById,
  },
) {
  const getInvoiceById =
    kind === "debit" ? getDebitNoteById : getCreditNoteById;
  const mapped =
    kind === "debit"
      ? mapFlexaDebitNoteForEInvoicePdf({ ...row })
      : mapFlexaCreditNoteForEInvoicePdf({ ...row });
  const code = kind === "debit" ? `dn-${row._id}` : `cn-${row._id}`;
  await downloadFlexaCustomerInvoiceEInvoicePdf(
    {
      ...mapped,
      _id: row._id,
      lhdn_status: row.lhdn_status,
      code,
    },
    {
      getInvoiceById,
      getEInvoiceDetails,
      getBusinessLhdnByBusinessId,
      getBusinessById,
    },
  );
}

export async function downloadFlexaCustomerInvoiceEInvoicePdf(
  rowInvoice,
  {
    getInvoiceById,
    getEInvoiceDetails,
    getBusinessLhdnByBusinessId,
    getBusinessById,
  } = {},
) {
  let data = { ...rowInvoice };
  if (getInvoiceById) {
    try {
      const res = await getInvoiceById(rowInvoice._id);
      const body = res?.data?.data ?? res?.data;
      if (body && typeof body === "object") data = { ...data, ...body };
    } catch {
      /* use row data */
    }
  }

  data = mapFlexaCustomerInvoiceForEInvoicePdf(data);
  data = await mergeBusinessDocForPdf(data, getBusinessById);

  const code = data.code || rowInvoice._id || data._id;
  if (getEInvoiceDetails && code) {
    if (!data.invoiceLink || !data.uuid || !data.longID) {
      try {
        const envelope = await getEInvoiceDetails(String(code));
        if (envelope?.link) data.invoiceLink = envelope.link;
        if (envelope?.data) {
          const d = envelope.data;
          if (d.uuid) data.uuid = d.uuid;
          if (d.longID) data.longID = d.longID;
          if (d.invoiceLink) data.invoiceLink = d.invoiceLink;
          if (d.lhdn_status) data.lhdn_status = d.lhdn_status;
          if (d.submitted_time) data.submitted_time = d.submitted_time;
          if (d.processed_time) data.processed_time = d.processed_time;
        }
      } catch {
        /* continue */
      }
    }
  }

  let businessLhdn = null;
  const bizId = data.business_id?._id || data.business_id;
  if (getBusinessLhdnByBusinessId && bizId) {
    try {
      businessLhdn = await getBusinessLhdnByBusinessId(String(bizId));
    } catch {
      businessLhdn = null;
    }
  }

  const model = buildLhdnEInvoicePdfFieldModel(data, businessLhdn);
  await generateLhdnEInvoiceTemplatePdf(model);
}
