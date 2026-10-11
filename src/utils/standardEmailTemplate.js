import ejs from "ejs";
import { formatDate } from "@/components/formatAmount";
import {
  FLEXA_HEADER_LOGO_BASE64,
  SYSLAB_FOOTER_LOGO_BASE64,
} from "@/utils/emailTemplateLogoBase64";
import { readCachedBrandingLogo } from "@/utils/brandingLogo";

export const STANDARD_EMAIL_TEMPLATE_NAME = "Standard Email Template";
export const STANDARD_EMAIL_MARKER = "SMART BUSINESS. SIMPLIFIED.";
export const STANDARD_EMAIL_WIDTH = "640px";
const GENERIC_EMAIL_CONTENT_SLOT = `
                            <%- typeof emailContent !== 'undefined' ? emailContent : '' %>
`;

function stripWebsiteDisplay(url) {
  return String(url || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function ensureWebsiteHref(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function readCachedConfigurationBranding() {
  try {
    const raw = localStorage.getItem("configurations");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getEmailTemplateLogoData(branding = null) {
  if (branding) {
    const logo =
      branding.logoSrc || branding.logoBase64 || FLEXA_HEADER_LOGO_BASE64;
    return {
      logoBase64: logo,
      syslabLogoBase64: SYSLAB_FOOTER_LOGO_BASE64,
      logoSrc: logo,
      syslabLogoSrc: SYSLAB_FOOTER_LOGO_BASE64,
      systemName: branding.systemName || "AQCTA",
      supportEmail: branding.supportEmail || "",
      websiteHref: branding.websiteHref || "",
      websiteDisplay: branding.websiteDisplay || "",
      brandColor: branding.brandColor || "#1a365d",
      tagline: branding.tagline || "SMART BUSINESS. SIMPLIFIED.",
    };
  }

  const cached = readCachedConfigurationBranding();
  const logo =
    readCachedBrandingLogo() ||
    (typeof cached.system_logo === "string" ? cached.system_logo : null) ||
    FLEXA_HEADER_LOGO_BASE64;
  const website = String(cached.website || "").trim();
  const brandColor =
    String(cached.buttons_color || cached.system_color || "").trim() ||
    "#1a365d";

  return {
    logoBase64: logo,
    syslabLogoBase64: SYSLAB_FOOTER_LOGO_BASE64,
    logoSrc: logo,
    syslabLogoSrc: SYSLAB_FOOTER_LOGO_BASE64,
    systemName: String(cached.name || "").trim() || "AQCTA",
    supportEmail: String(cached.email || "").trim(),
    websiteHref: ensureWebsiteHref(website),
    websiteDisplay: stripWebsiteDisplay(website),
    brandColor,
    tagline: "SMART BUSINESS. SIMPLIFIED.",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildStandardDocumentEmailContent({
  recipientName = "Customer",
  emailTitle = "",
  emailIntro = "",
  documentNo = "",
  dateIssued = "",
  dueDate = "",
  dateIssuedLabel = "Date Issued",
  dueDateLabel = "Due Date",
  amountLabel = "Amount Due",
  currency = "",
  amountDue = "",
  actionUrl = "",
  actionLabel = "View Document",
  approveUrl = "",
  approveLabel = "Review & Approve Quotation",
  showDocumentSummary = true,
} = {}) {
  const parts = [];

  if (emailTitle || recipientName) {
    parts.push(
      `<p style="color: #C8102E; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin: 0;">HELLO, ${escapeHtml(recipientName)}</p>`,
      `<h1 style="color: #1a365d; font-size: 24px; margin-top: 8px; margin-bottom: 8px;">${escapeHtml(emailTitle)}</h1>`,
    );
  }

  if (emailIntro) {
    parts.push(
      `<p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 0; margin-bottom: 30px;">${escapeHtml(emailIntro)}</p>`,
    );
  }

  if (showDocumentSummary && documentNo) {
    parts.push(`<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f7fafc; border-left: 4px solid #C8102E; border-radius: 4px; margin-bottom: 30px;">
      <tr>
        <td style="padding: 24px;">
          <p style="color: #C8102E; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-top: 0; margin-bottom: 16px;">DOCUMENT SUMMARY</p>
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
            <tr>
              <td style="color: #718096; padding: 6px 0; width: 40%;">Document No.</td>
              <td style="color: #1a365d; font-weight: bold; padding: 6px 0;">#${escapeHtml(documentNo)}</td>
            </tr>
            <tr>
              <td style="color: #718096; padding: 6px 0;">${escapeHtml(dateIssuedLabel)}</td>
              <td style="color: #1a365d; font-weight: bold; padding: 6px 0;">${escapeHtml(dateIssued)}</td>
            </tr>
            <tr>
              <td style="color: #718096; padding: 6px 0;">${escapeHtml(dueDateLabel)}</td>
              <td style="color: #1a365d; font-weight: bold; padding: 6px 0;">${escapeHtml(dueDate)}</td>
            </tr>
            <tr>
              <td style="color: #718096; padding: 6px 0;">${escapeHtml(amountLabel)}</td>
              <td style="color: #1a365d; font-weight: bold; padding: 6px 0;">${escapeHtml(currency)}${escapeHtml(amountDue)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`);
  }

  if (approveUrl && approveUrl !== "#") {
    parts.push(
      `<p style="text-align: center; margin: 24px 0 0;"><a href="${escapeHtml(approveUrl)}" style="display: inline-block; background-color: #8f2a2a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">${escapeHtml(approveLabel)}</a></p>`,
    );
  }

  if (actionUrl && actionUrl !== "#") {
    parts.push(
      `<p style="text-align: center; margin: ${approveUrl && approveUrl !== "#" ? "12px" : "24px"} 0 0;"><a href="${escapeHtml(actionUrl)}" style="display: inline-block; background-color: #C8102E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">${escapeHtml(actionLabel)}</a></p>`,
    );
  }

  return parts.join("\n");
}

function formatEmailDate(dateVal) {
  if (!dateVal) return "";
  const formatted = formatDate(dateVal);
  if (formatted) return formatted;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function resolveInvoiceAmountDue(payload = {}) {
  const invType = String(payload.invoiceType || "Commercial");
  const grandTotal = Number(payload.grandTotal);
  const gt = Number.isFinite(grandTotal)
    ? grandTotal
    : Number(payload.grandTotal) || 0;
  const adv = Number(payload.advanceDepositAmount) || 0;
  const depAmt = Number(payload.depositAmount) || 0;
  const isProformaDeposit =
    invType === "Proforma" && (adv > 0 || depAmt > 0);
  const amountValue = isProformaDeposit ? adv || depAmt : gt;
  return Number(amountValue).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function withStandardEmailWidth(html) {
  return String(html || "")
    .replace(/max-width:\s*(?:100%|720px|700px|640px)\s*;?/gi, `max-width: ${STANDARD_EMAIL_WIDTH};`)
    .replace(/<table([^>]*class=["'][^"']*email-container[^"']*["'][^>]*)width=["'](?:100%|720|700|640)["']/gi, `<table$1width="640"`)
    .replace(/<table([^>]*?)width=["'](?:100%|720|700|640)["']([^>]*class=["'][^"']*email-container[^"']*["'][^>]*)/gi, `<table$1width="640"$2`);
}

function withGenericEmailContentSlot(html) {
  const source = String(html || "");
  if (!source || /emailContent/.test(source)) return source;

  const contentCellPattern =
    /(<td\b[^>]*class=["'][^"']*email-content-cell[^"']*["'][^>]*>)([\s\S]*?)(<\/td>\s*<\/tr>)/i;
  if (contentCellPattern.test(source)) {
    return source.replace(contentCellPattern, `$1${GENERIC_EMAIL_CONTENT_SLOT}$3`);
  }

  const mainBlockPattern =
    /(<!--\s*Main Content Block\s*-->)([\s\S]*?)(<!--\s*Bottom Banner\s*-->)/i;
  if (mainBlockPattern.test(source)) {
    return source.replace(
      mainBlockPattern,
      `$1
                    <tr>
                        <td class="email-content-cell" style="padding: 32px 32px 16px; color: #4a5568; font-size: 14px; line-height: 1.6;">
${GENERIC_EMAIL_CONTENT_SLOT}
                        </td>
                    </tr>
                    
                    $3`,
    );
  }

  return `${source}${GENERIC_EMAIL_CONTENT_SLOT}`;
}

export function buildCustomerInvoiceEmailTemplateData(payload = {}) {
  const custName = String(payload.customer_name || "Customer");
  const data = {
    recipientName: custName,
    documentNo: String(payload.invoice_number || ""),
    dateIssued: formatEmailDate(payload.invoice_date),
    dueDate: formatEmailDate(payload.due_date),
    dateIssuedLabel: "Date Issued",
    dueDateLabel: "Due Date",
    amountLabel: "Amount Due",
    currency: String(payload.currency || "USD"),
    amountDue: resolveInvoiceAmountDue(payload),
    emailTitle: "Your Invoice Is Ready for Review",
    emailIntro:
      payload.emailIntro ||
      payload.introText ||
      "Thank you for your business. Your invoice can be viewed, printed and downloaded as PDF from the link below.",
    actionUrl: "{{VIEW_INVOICE_URL}}",
    actionLabel: "View Invoice",
  };
  return {
    ...data,
    emailContent: buildStandardDocumentEmailContent(data),
  };
}

export function buildOrderEmailTemplateData(payload = {}) {
  const orderLabel = String(payload.orderLabel || "Sale Order");
  const lower = orderLabel.toLowerCase();
  const isQuotation = lower.includes("quotation");
  const isPurchaseOrder = lower.includes("purchase");
  const recipientName = String(
    payload.customerName ||
      payload.customer_name ||
      payload.recipientName ||
      (isPurchaseOrder ? "Vendor" : "Customer"),
  );
  const amount = payload.amountDue ?? payload.amount ?? payload.total ?? payload.grandTotal;
  const formattedAmount =
    typeof amount === "string"
      ? amount
      : Number.isFinite(Number(amount))
        ? Number(amount).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";

  const actionLabel = isQuotation
    ? "View Quotation"
    : isPurchaseOrder
      ? "View Purchase Order"
      : `View ${orderLabel}`;

  const data = {
    recipientName,
    documentNo: String(
      payload.orderNumber || payload.documentNo || payload.quote_number || "",
    ),
    dateIssued: formatEmailDate(
      payload.orderDate || payload.quoteDate || payload.date,
    ),
    dueDate: formatEmailDate(
      payload.expectedShipmentDate || payload.expiryDate || payload.due_date,
    ),
    dateIssuedLabel: isQuotation ? "Quote Date" : "Date Issued",
    dueDateLabel: isQuotation ? "Expiry Date" : "Expected Shipment",
    amountLabel: isQuotation
      ? "Quotation Amount"
      : isPurchaseOrder
        ? "Purchase Order Amount"
        : `${orderLabel} Amount`,
    currency: String(payload.currency || "USD"),
    amountDue: formattedAmount,
    emailTitle: `Your ${orderLabel} Is Ready for Review`,
    emailIntro:
      payload.introText ||
      payload.emailIntro ||
      (isPurchaseOrder
        ? "Please find your purchase order below. It can be viewed, printed and downloaded as PDF from the link below."
        : isQuotation
          ? "Please find your quotation attached. Review it and approve using the button below."
          : `Thank you for your order. Your ${orderLabel.toLowerCase()} can be viewed, printed and downloaded as PDF from the link below.`),
    actionUrl: isQuotation
      ? "{{VIEW_QUOTATION_URL}}"
      : isPurchaseOrder
        ? "{{VIEW_PURCHASE_ORDER_URL}}"
        : "{{VIEW_SALES_ORDER_URL}}",
    actionLabel,
    approveUrl: isQuotation ? "{{APPROVE_QUOTATION_URL}}" : "",
    approveLabel: "Review & Approve Quotation",
  };

  return {
    ...data,
    emailContent: buildStandardDocumentEmailContent(data),
  };
}

export function renderStandardEmailTemplate(
  htmlContent,
  templateDummyData,
  invoicePayload,
) {
  return renderStandardEmailBodyTemplate(
    htmlContent,
    templateDummyData,
    buildCustomerInvoiceEmailTemplateData(invoicePayload),
  );
}

export function buildGenericEmailTemplateData(payload = {}) {
  const amount = payload.amountDue ?? payload.amount ?? payload.grandTotal;
  const formattedAmount =
    typeof amount === "string"
      ? amount
      : Number.isFinite(Number(amount))
        ? Number(amount).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";

  const recipientName = String(
    payload.recipientName ||
      payload.customer_name ||
      payload.customerName ||
      payload.vendorName ||
      "Customer",
  );

  return {
    recipientName,
    documentNo: String(
      payload.documentNo ||
        payload.invoice_number ||
        payload.orderNumber ||
        payload.quote_number ||
        "",
    ),
    dateIssued: payload.dateIssued || formatEmailDate(payload.date || payload.invoice_date),
    dueDate: payload.dueDate || formatEmailDate(payload.due_date || payload.expectedShipmentDate),
    currency: String(payload.currency || ""),
    amountDue: formattedAmount,
    actionUrl: payload.actionUrl || "#",
    dateIssuedLabel: payload.dateIssuedLabel || "Date Issued",
    dueDateLabel: payload.dueDateLabel || "Due Date",
    amountLabel: payload.amountLabel || "Amount Due",
    emailTitle: payload.emailTitle || payload.title || "Notification",
    emailIntro: payload.emailIntro || "",
    emailContent:
      payload.emailContent ||
      (payload.showDocumentSummary === false
        ? payload.emailIntro || ""
        : buildStandardDocumentEmailContent({
            recipientName,
            emailTitle: payload.emailTitle || payload.title || "Notification",
            emailIntro: payload.emailIntro || "",
            documentNo: String(
              payload.documentNo ||
                payload.invoice_number ||
                payload.orderNumber ||
                payload.quote_number ||
                "",
            ),
            dateIssued:
              payload.dateIssued || formatEmailDate(payload.date || payload.invoice_date),
            dueDate:
              payload.dueDate || formatEmailDate(payload.due_date || payload.expectedShipmentDate),
            dateIssuedLabel: payload.dateIssuedLabel || "Date Issued",
            dueDateLabel: payload.dueDateLabel || "Due Date",
            amountLabel: payload.amountLabel || "Amount Due",
            currency: String(payload.currency || ""),
            amountDue: formattedAmount,
            actionUrl: payload.actionUrl || "#",
            actionLabel: payload.actionLabel || "View Document",
            showDocumentSummary: payload.showDocumentSummary !== false,
          })),
  };
}

export function buildOrderStandardEmailHtml(
  htmlContent,
  templateDummyData,
  orderPayload = {},
) {
  return renderStandardEmailBodyTemplate(
    htmlContent,
    templateDummyData,
    buildOrderEmailTemplateData(orderPayload),
  );
}

export function renderStandardEmailBodyTemplate(
  htmlContent,
  templateDummyData,
  payload = {},
  branding = null,
) {
  if (!htmlContent) return "";
  const logoData = getEmailTemplateLogoData(branding);
  const renderData = {
    ...logoData,
    ...(templateDummyData && typeof templateDummyData === "object"
      ? templateDummyData
      : {}),
    ...buildGenericEmailTemplateData(payload),
    ...logoData,
  };
  let html = withStandardEmailWidth(
    ejs.render(withGenericEmailContentSlot(htmlContent), renderData, {
      strict: false,
    }),
  );

  // Rewrite any leftover hardcoded Flexa footer/header in stored templates.
  const systemName = logoData.systemName || "AQCTA";
  const supportEmail = logoData.supportEmail || "";
  const websiteHref = logoData.websiteHref || "";
  const websiteDisplay = logoData.websiteDisplay || "";
  const logoSrc = logoData.logoSrc || "";
  const brandColor = logoData.brandColor || "#1a365d";

  if (logoSrc) {
    html = html.replace(
      /(<img\b[^>]*alt=["'](?:Flexa ERP|PCI|AQCTA|Company Logo)["'][^>]*src=["'])([^"']*)(["'])/gi,
      `$1${logoSrc}$3`,
    );
    html = html.replace(
      /(<img\b[^>]*src=["'])([^"']*)(["'][^>]*alt=["'](?:Flexa ERP|PCI|AQCTA|Company Logo)["'])/gi,
      `$1${logoSrc}$3`,
    );
  }
  if (brandColor && brandColor.toLowerCase() !== "#1a365d") {
    html = html.replace(/#1a365d/gi, brandColor);
  }
  html = html.replace(
    /flexa\s*<span\s+style="color:\s*#[0-9a-fA-F]{3,8};">\s*ERP\s*<\/span>/gi,
    systemName,
  );
  html = html.replace(/\bflexa\s+ERP\b/gi, systemName);
  html = html.replace(/\bFlexa\s+ERP\b/gi, systemName);
  html = html.replace(/\bFlexa\b/gi, systemName);
  html = html.replace(/\bPCI Group\b/gi, systemName);
  if (supportEmail) {
    html = html.replace(
      /href=["']mailto:info@flexaerp\.com["']/gi,
      `href="mailto:${supportEmail}"`,
    );
    html = html.replace(/>\s*info@flexaerp\.com\s*</gi, `>${supportEmail}<`);
    html = html.replace(/\binfo@flexaerp\.com\b/gi, supportEmail);
  }
  if (websiteHref && websiteDisplay) {
    html = html.replace(
      /href=["']https?:\/\/(?:www\.)?flexaerp\.com\/?["']/gi,
      `href="${websiteHref}"`,
    );
    html = html.replace(/>\s*www\.flexaerp\.com\s*</gi, `>${websiteDisplay}<`);
    html = html.replace(/\bwww\.flexaerp\.com\b/gi, websiteDisplay);
  }

  return html;
}

export function buildCustomerInvoiceStandardEmailHtml(
  htmlContent,
  templateDummyData,
  invoicePayload,
) {
  return renderStandardEmailTemplate(
    htmlContent,
    templateDummyData,
    invoicePayload,
  );
}

export function resolveEmailTemplateHtmlContent(templateDoc) {
  return (
    templateDoc?.htmlContent ||
    templateDoc?.html_content ||
    ""
  );
}
