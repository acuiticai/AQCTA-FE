"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Eye,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Code,
  Upload,
  X,
  FileText,
  Trash2,
} from "lucide-react";
import { useLocation, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import ejs from "ejs";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useEmailDefaults } from "@/hooks/useEmailDefaults";
import SalesOrderServices from "@/services/SalesOrderServices";
import PurchaseOrderServices from "@/services/PurchaseOrderServices";
import QuotationServices from "@/services/QuotationServices";
import { AdminContext } from "@/context/AdminContext";
import { useContext } from "react";
import {
  formatInvoiceLineTaxColumnDisplay,
  mapInvoiceToUnifiedInvoiceContract,
  mapSalesOrderToInvoiceData,
  rewriteInvoiceTemplateForDisplayLabels,
  isSaleOrderDocumentTemplateType,
  mapToSaleOrderTemplateData,
  mapToQuotationTemplateData,
  isQuotationDocumentTemplateType,
  normalizeDocumentTemplateType,
  resolveTemplateLineItemDisplayCells,
  buildOrderDocumentItemsRowsHtml,
} from "@/utils/invoiceContractMapper";
import { fetchPdfPayload } from "@/services/customFieldServices";
import {
  applyFullPdfCustomFieldsToHtml,
  buildInlinePdfCustomFieldsPayload,
  replaceLineItemsTbodyRowsHtml,
} from "@/utils/customFieldsPdf";
import {
  normalizeAssetUrlForPdf,
  fetchImageAsDataUriForPdf,
  injectInvoicePdfSafetyStyles,
} from "@/utils/htmlToPdfHelpers";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { formatDate } from "@/components/formatAmount";
import EmailTemplateIframePreview from "@/components/email/EmailTemplateIframePreview";
import { buildOrderStandardEmailHtml } from "@/utils/standardEmailTemplate";
import { getDefaultEmailTemplateDoc } from "@/utils/defaultEmailTemplateShell";
import useStandardEmailTemplate from "@/hooks/useStandardEmailTemplate";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** When business_id from API is an id string, still use logo/address from businessData (from /business/:id). */
function mergeBusinessEntityForQuotationPdf(businessIdField, businessData) {
  const raw = businessIdField ?? businessData;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(businessData || {}), ...raw };
  }
  return { ...(businessData || {}) };
}

function buildInitialQuotationEmailAttachments(quotation) {
  const raw = Array.isArray(quotation?.supportingDocuments)
    ? quotation.supportingDocuments
    : [];
  const seen = new Set();
  const out = [];
  for (const d of raw) {
    if (!d) continue;
    const fileId = d.fileId || d._id;
    const s3Key = d.s3Key;
    const dedupeKey = String(s3Key || fileId || "");
    if (!dedupeKey || dedupeKey === "undefined") continue;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      fileId: fileId || undefined,
      name: d.name || d.fileName || "attachment",
      s3Key: s3Key || undefined,
      url: d.url || d.fileUrl || "#",
      size: d.size || d.fileSize || 0,
      type: d.type,
      includeInEmail: d.includeInEmail !== false,
      uploadedAt: d.uploadedAt,
    });
  }
  return out.filter((x) => x.s3Key || x.fileId);
}

/** Merge nav + order attachments for purchase order email (dedupe by s3Key / fileId). */
function buildInitialAdditionalDocuments(stateData) {
  const fromNav = stateData?.poEmailAttachments;
  const fromOrder = stateData?.salesOrderData?.attachments;
  const raw = [];
  if (Array.isArray(fromNav)) raw.push(...fromNav);
  if (Array.isArray(fromOrder)) raw.push(...fromOrder);
  const seen = new Set();
  const out = [];
  for (const d of raw) {
    if (!d) continue;
    const fileId = d.fileId || d._id;
    const s3Key = d.s3Key;
    const dedupeKey = String(s3Key || fileId || "");
    if (!dedupeKey || dedupeKey === "undefined") continue;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      fileId: fileId || undefined,
      name: d.name || d.fileName || "attachment",
      s3Key: s3Key || undefined,
      url: d.url || d.fileUrl || "#",
      size: d.size || d.fileSize || 0,
      type: d.type,
      includeInEmail: d.includeInEmail !== false,
      uploadedAt: d.uploadedAt,
    });
  }
  return out.filter((x) => x.s3Key || x.fileId);
}

function codeFromBusinessForEmail(businessData) {
  if (!businessData || typeof businessData !== "object") return null;
  const b =
    businessData.currency ||
    businessData.baseCurrency ||
    businessData.defaultCurrency;
  if (b && typeof b === "object") {
    const c = b.code || b.currencyCode || b.symbol;
    if (
      typeof c === "string" &&
      c.trim() &&
      !/^[0-9a-fA-F]{24}$/.test(c.trim())
    ) {
      const up = c.trim().toUpperCase().slice(0, 3);
      if (/^[A-Z]{3}$/.test(up)) return up;
    }
  }
  if (typeof b === "string" && b.trim() && !/^[0-9a-fA-F]{24}$/.test(b.trim())) {
    const up = b.trim().toUpperCase().slice(0, 3);
    if (/^[A-Z]{3}$/.test(up)) return up;
  }
  return null;
}

/** ISO 4217 code for email amount line (PO/SO/quotation store `currency` on the order). */
function resolveEmailOrderCurrencyCode(data, businessData) {
  if (!data) return codeFromBusinessForEmail(businessData) || "MYR";
  const raw = data.currency || data.customerCurrency;
  if (raw && typeof raw === "object") {
    const c = raw.code || raw.currencyCode || raw.symbol;
    if (typeof c === "string" && c.trim()) {
      const t = c.trim();
      if (!/^[0-9a-fA-F]{24}$/.test(t)) {
        const up = t.toUpperCase().slice(0, 3);
        if (/^[A-Z]{3}$/.test(up)) return up;
      }
    }
  }
  if (
    typeof raw === "string" &&
    raw.trim() &&
    !/^[0-9a-fA-F]{24}$/.test(raw.trim())
  ) {
    return raw.trim().toUpperCase().slice(0, 3);
  }
  const cur = data.customer?.basicInformation?.currency;
  if (cur && typeof cur === "object") {
    const code = cur.code || cur.currencyCode;
    if (code && typeof code === "string") return code.toUpperCase().slice(0, 3);
  }
  return codeFromBusinessForEmail(businessData) || "MYR";
}

function formatEmailOrderAmount(amount, currencyCode) {
  const code = /^[A-Z]{3}$/.test(String(currencyCode || "").toUpperCase())
    ? String(currencyCode).toUpperCase().slice(0, 3)
    : "MYR";
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    })
      .format(n)
      .replace(/^([^\d\s-]+)\s+/, "$1");
  } catch {
    return `${code}${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

const normalizeTermsAndConditions = (value) => {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
};

const hasMeaningfulSummaryContent = (element) => {
  if (!element) return false;
  const text = (element.textContent || "").replace(/\u00a0/g, " ").trim();
  if (text) return true;
  return !!element.querySelector("img, svg, canvas, table, iframe");
};

const applyInvoiceTermsAndConditionsToHtml = (html, termsAndConditions) => {
  const normalizedTerms = normalizeTermsAndConditions(termsAndConditions);
  const termsHtml = normalizedTerms
    .replace(/\$/g, "$$$$")
    .replace(/\n/g, "<br/>");
  const replacement = normalizedTerms
    ? `<div class="payment-info">${termsHtml}</div>\n      <div class="financial-summary">`
    : `<div class="financial-summary">`;
  const replacementSummaryBox = normalizedTerms
    ? `<div class="payment-info">${termsHtml}</div>\n      <div class="summary-box">`
    : `<div class="summary-box">`;

  let nextHtml = html;
  nextHtml = nextHtml.replace(
    /<div class="payment-info">\s*<div>1\. Method Of Payment[\s\S]*?21400015058\s*<\/div>\s*<\/div>\s*<div class="financial-summary">/g,
    replacement
  );
  nextHtml = nextHtml.replace(
    /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){2,}\s*<\/div>\s*<div class="financial-summary">/g,
    replacement
  );
  nextHtml = nextHtml.replace(
    /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){3}\s*<\/div>\s*<div class="financial-summary">/g,
    replacement
  );
  nextHtml = nextHtml.replace(
    /<div class="payment-info">[\s\S]*?ABDUL HAMEED[\s\S]*?21400015058[\s\S]*?<\/div>\s*<div class="financial-summary">/gi,
    replacement
  );
  // JomSmart-style templates: payment-info sits next to summary-box (not financial-summary)
  nextHtml = nextHtml.replace(
    /<div class="payment-info">\s*<div>1\. Method Of Payment[\s\S]*?21400015058\s*<\/div>\s*<\/div>\s*<div class="summary-box">/g,
    replacementSummaryBox
  );
  nextHtml = nextHtml.replace(
    /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){2,}\s*<\/div>\s*<div class="summary-box">/g,
    replacementSummaryBox
  );
  nextHtml = nextHtml.replace(
    /<div class="payment-info">[\s\S]*?ABDUL HAMEED[\s\S]*?21400015058[\s\S]*?<\/div>\s*<div class="summary-box">/gi,
    replacementSummaryBox
  );

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(nextHtml, "text/html");

    doc.querySelectorAll(".payment-info").forEach((el) => {
      const inner = el.innerHTML || "";
      if (/21400015058|ABDUL HAMEED/i.test(inner)) {
        if (normalizedTerms) {
          el.innerHTML = termsHtml;
        } else {
          el.remove();
        }
      }
    });

    if (normalizedTerms) {
      doc
        .querySelectorAll(".terms-section .terms-content, .terms-content")
        .forEach((el) => {
          const raw = (el.innerHTML || "").trim();
          const hasUnresolvedEjs = /<%=|<%-|<%[\s]/.test(raw);
          if (hasUnresolvedEjs || raw === "") {
            el.innerHTML = termsHtml;
          }
        });
      doc.querySelectorAll(".payment-info").forEach((el) => {
        el.innerHTML = termsHtml;
      });
    } else {
      doc
        .querySelectorAll(".terms-section, .payment-info")
        .forEach((el) => el.remove());
    }

    doc.querySelectorAll(".notes-summary-row").forEach((row) => {
      const leftColumn = row.querySelector(".notes-summary-left");
      const summarySection = row.querySelector(".summary-section");
      if (summarySection && !hasMeaningfulSummaryContent(leftColumn)) {
        leftColumn?.remove();
        row.style.display = "flex";
        row.style.justifyContent = "flex-end";
        row.style.gap = "0";
        summarySection.style.marginLeft = "auto";
        summarySection.style.maxWidth = "320px";
        summarySection.style.width = "100%";
      }
    });

    doc.querySelectorAll(".summary-section").forEach((section) => {
      const paymentInfo = section.querySelector(":scope > .payment-info");
      const financialSummary =
        section.querySelector(":scope > .financial-summary") ||
        section.querySelector(":scope > .summary-box");

      if (paymentInfo && !hasMeaningfulSummaryContent(paymentInfo)) {
        paymentInfo.remove();
      }

      if (!section.querySelector(":scope > .payment-info") && financialSummary) {
        section.style.display = "grid";
        section.style.gridTemplateColumns = "minmax(0, 320px)";
        section.style.justifyContent = "end";
        section.style.width = "100%";
        financialSummary.style.marginLeft = "auto";
        financialSummary.style.width = "100%";
      }
    });

    return doc.documentElement.outerHTML;
  } catch (error) {
    return nextHtml;
  }
};

const replaceInvoiceItemsRowsForPdf = (html, items) => {
  if (!html || typeof html !== "string" || !Array.isArray(items) || !items.length) {
    return html;
  }

  const hasSeparateDescCol =
    /<th[^>]*>\s*Description\s*<\/th>/i.test(html) &&
    !/<th[^>]*>.*Item\s*&\s*Description.*<\/th>/i.test(html);

  const rowsHtml = items
    .map((item, idx) => {
      const {
        combinedPrimary,
        combinedSubtitle,
        separateNameCell,
        separateDescriptionCell,
      } = resolveTemplateLineItemDisplayCells(item);
      const quantity = Number(item.quantity || item.qty || 0);
      const price = Number(item.price || item.unitPrice || item.rate || 0);
      const discountPercent = Number(item.discount ?? 0);
      const lineSubtotal = Math.max(
        0,
        quantity * price * (1 - discountPercent / 100),
      );
      const taxRate = Number(item.taxRate ?? 0);
      const taxName = String(
        item.taxName || item.tax_label || item.taxLabel || "",
      ).trim();
      const taxAmountFromApi = Number(item.taxAmount ?? item.tax ?? 0);
      const tax = taxAmountFromApi || (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
      const computedLineTotal = Math.max(0, lineSubtotal + tax);
      const providedTotal = Number(item.total ?? item.totalValue ?? item.amount ?? 0);
      const tolerance = 0.01;
      const total =
        providedTotal > 0
          ? Math.abs(providedTotal - computedLineTotal) < tolerance
            ? providedTotal
            : Math.abs(providedTotal - lineSubtotal) < tolerance && tax > 0
              ? providedTotal + tax
              : computedLineTotal
          : computedLineTotal;
      const taxDisplay = formatInvoiceLineTaxColumnDisplay({
        tax,
        taxRate,
        taxName,
        taxAmount: tax,
      });

      if (hasSeparateDescCol) {
        const nameHtml = separateNameCell || "&nbsp;";
        const itemCell = `<div class="item-desc-main">${nameHtml}</div>`;
        const descCell = separateDescriptionCell
          ? `<div class="item-desc-sub">${separateDescriptionCell}</div>`
          : "";
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${itemCell}</td>
            <td>${descCell}</td>
            <td>${quantity}</td>
            <td>${price.toFixed(2)}</td>
            <td>${discountPercent.toFixed(2)}%</td>
            <td>${taxDisplay}</td>
            <td>${total.toFixed(2)}</td>
          </tr>
        `;
      }

      const itemDescCell = combinedSubtitle
        ? `<div class="item-desc-main">${combinedPrimary}</div><div class="item-desc-sub" style="font-size: 0.9em; color: #666; margin-top: 2px;">${combinedSubtitle}</div>`
        : `<div class="item-desc-main">${combinedPrimary}</div>`;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${itemDescCell}</td>
          <td>${quantity}</td>
          <td>${price.toFixed(2)}</td>
          <td>${discountPercent.toFixed(2)}%</td>
          <td>${taxDisplay}</td>
          <td>${total.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const afterRows = replaceLineItemsTbodyRowsHtml(html, items.length, rowsHtml);
  if (afterRows !== html) return afterRows;

  const headerIndex =
    html.indexOf("Item</th>") !== -1
      ? html.indexOf("Item</th>")
      : html.indexOf("Item & Description</th>");
  const tbodyStart =
    headerIndex !== -1 ? html.indexOf("<tbody", headerIndex) : html.indexOf("<tbody");

  if (tbodyStart === -1) return html;
  const openTagEnd = html.indexOf(">", tbodyStart);
  const tbodyEnd = html.indexOf("</tbody>", openTagEnd);
  if (openTagEnd === -1 || tbodyEnd === -1) return html;
  const before = html.slice(0, openTagEnd + 1);
  const after = html.slice(tbodyEnd);
  return `${before}${rowsHtml}${after}`;
};

/** Match customer invoice / InvoiceRenderer: ensure signature img src is set for PDF (EJS may leave empty src). */
function injectSalesOrderPdfSignature(html, signatureUrl) {
  if (!html || !signatureUrl) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const isInvalidSrc = (src) =>
      !src ||
      src === "#" ||
      src.includes("<%") ||
      src.includes("{{") ||
      src.includes("undefined") ||
      src.includes("null");

    [".signature-box .logo img", ".authorized-signature img", "img[alt*='signature' i]"].forEach((selector) => {
      doc.querySelectorAll(selector).forEach((img) => {
        const currentSrc = (img.getAttribute("src") || "").trim();
        if (isInvalidSrc(currentSrc)) {
          img.setAttribute("src", signatureUrl);
        }
        img.setAttribute("alt", "Authorized Signature");
        img.style.maxHeight = img.style.maxHeight || "80px";
      });
    });

    const signatureSections = Array.from(doc.querySelectorAll(".signature-section"));
    signatureSections.forEach((section) => {
      let allImages = Array.from(section.querySelectorAll("img"));
      let mainImage = allImages[0] || null;
      if (!mainImage) {
        mainImage = doc.createElement("img");
        mainImage.setAttribute("src", signatureUrl);
        section.insertBefore(mainImage, section.firstChild);
        allImages = [mainImage];
      }
      allImages.slice(1).forEach((img) => img.remove());
      mainImage.setAttribute("src", signatureUrl);
      mainImage.setAttribute("alt", "Authorized Signature");
      mainImage.style.maxHeight = "80px";
      mainImage.style.display = "block";
      mainImage.style.marginBottom = "6px";
      const signatureLine = section.querySelector(".signature-line");
      const signatureLabel = section.querySelector(".signature-label");
      if (signatureLine && mainImage.nextSibling !== signatureLine) {
        section.insertBefore(mainImage, signatureLine);
      } else if (
        !signatureLine &&
        signatureLabel &&
        mainImage.nextSibling !== signatureLabel
      ) {
        section.insertBefore(mainImage, signatureLabel);
      }
    });

    return doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}

export default function SalesOrderEmailPreview() {
  const { t } = useTranslation();
  const { getModuleLabel, getModuleRoutePath } = useModuleLabels();
  const location = useLocation();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const stateData = location.state || {};
  const {
    salesOrderData: soFromState,
    isUpdate,
    salesOrderId: soIdFromState,
    quotationId,
    quotationData,
    selectedCustomer: selectedCustomerFromNav,
    templateData,
    businessData,
    invoiceCustomFieldDefinitions,
    invoiceCustomFieldValues,
    lineItemCustomFieldDefinitions,
    itemsForPdfCustomFields,
    poEmailAttachments,
    emailTemplateDoc: emailTemplateFromNav,
  } = stateData;
  const isQuotationEmail = (location.pathname || "").includes(
    "quotation-email-preview",
  );
  const isPurchaseOrderEmail = (location.pathname || "").includes(
    "purchase-order-email-preview",
  );
  const salesOrderData = isQuotationEmail ? quotationData : soFromState;
  const salesOrderId = isQuotationEmail ? quotationId : soIdFromState;
  const docNumber = isQuotationEmail
    ? salesOrderData?.quote_number || ""
    : salesOrderData?.purchaseOrderNumber ||
      salesOrderData?.salesOrderNumber ||
      "";
  const orderLabel = isQuotationEmail
    ? "Quotation"
    : isPurchaseOrderEmail
      ? "Purchase Order"
      : getModuleLabel("saleOrder", "Sale Order");
  const localizedOrderLabel =
    orderLabel === "Sale Order"
      ? t("salesOrder.label", { defaultValue: "Sale Order" })
      : orderLabel;
  const orderDisplayLabel = isQuotationEmail
    ? t("documents.quotation", { defaultValue: "Quotation" })
    : isPurchaseOrderEmail
      ? t("documents.purchaseOrder", { defaultValue: "Purchase Order" })
      : localizedOrderLabel;
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  const [quotationTemplateData, setQuotationTemplateData] = useState(templateData);

  const previewBusinessId =
    (typeof businessData?._id === "string" && businessData._id) ||
    (typeof salesOrderData?.business_id === "object"
      ? salesOrderData.business_id?._id
      : salesOrderData?.business_id) ||
    "";

  const { emailTemplateDoc, htmlContent: emailTemplateHtmlContent } =
    useStandardEmailTemplate(previewBusinessId, headers, emailTemplateFromNav);

  const emailDefaults = useEmailDefaults();

  const [emailData, setEmailData] = useState({
    from: "",
    to: salesOrderData?.customer_email || "",
    cc: "",
    bcc: "",
    subject: t("documents.email.defaultSubject", {
      defaultValue: "{{document}} {{number}}",
      document: orderDisplayLabel,
      number: docNumber,
    }),
  });

  const [contactOptions, setContactOptions] = useState([]);
  const [toEmails, setToEmails] = useState(
    salesOrderData?.customer_email ? [salesOrderData.customer_email] : []
  );
  const [toInput, setToInput] = useState("");
  const [ccEmails, setCcEmails] = useState([]);
  const [ccInput, setCcInput] = useState("");

  useEffect(() => {
    if (emailDefaults.loading) return;
    setEmailData((prev) => ({
      ...prev,
      from: emailDefaults.from,
      cc: emailDefaults.cc,
    }));
    if (emailDefaults.cc) {
      setCcEmails((prev) => (prev.length ? prev : [emailDefaults.cc]));
    }
  }, [emailDefaults.loading, emailDefaults.from, emailDefaults.cc]);

  const [bccEmails, setBccEmails] = useState([]);
  const [bccInput, setBccInput] = useState("");
  const [showCcField, setShowCcField] = useState(false);
  const [showBccField, setShowBccField] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [showCcDropdown, setShowCcDropdown] = useState(false);
  const [showBccDropdown, setShowBccDropdown] = useState(false);
  const [recipientError, setRecipientError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachSalesOrder, setAttachSalesOrder] = useState(true);
  const [isEditingHtml, setIsEditingHtml] = useState(false);
  const [rawHtmlMode, setRawHtmlMode] = useState(false);
  const [additionalDocuments, setAdditionalDocuments] = useState(() => {
    if (isPurchaseOrderEmail) return buildInitialAdditionalDocuments(stateData);
    if (isQuotationEmail) return buildInitialQuotationEmailAttachments(salesOrderData);
    return [];
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const normalizeEmail = (value) => (value || "").trim().toLowerCase();

  const normalizeSignatureUrl = (value) => {
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^data:image\//i.test(trimmed)) return trimmed;
    return trimmed.startsWith("/") ? `${Base_URL.replace(/\/$/, "")}${trimmed}` : `${Base_URL}/${trimmed.replace(/^\//, "")}`;
  };

  useEffect(() => {
    const options = [];
    const seen = new Set();
    const addOption = (email, label, type = "contact") => {
      const normalized = normalizeEmail(email);
      if (!normalized || !EMAIL_REGEX.test(normalized) || seen.has(normalized)) return;
      seen.add(normalized);
      options.push({ email: normalized, label, type });
    };

    const customerObj =
      salesOrderData?.customer && typeof salesOrderData.customer === "object"
        ? salesOrderData.customer
        : isQuotationEmail &&
            selectedCustomerFromNav &&
            typeof selectedCustomerFromNav === "object"
          ? selectedCustomerFromNav
          : null;

    const primaryEmail =
      salesOrderData?.customer_email ||
      customerObj?.basicInformation?.vendorEmail ||
      customerObj?.basicInformation?.customerEmail ||
      customerObj?.basicInformation?.email ||
      "";
    const primaryName =
      salesOrderData?.customer_name ||
      customerObj?.basicInformation?.vendorDisplayName ||
      customerObj?.basicInformation?.customerDisplayName ||
      customerObj?.basicInformation?.companyName ||
      t("common.primaryContact", { defaultValue: "Primary Contact" });
    addOption(
      primaryEmail,
      t("common.primaryNamed", {
        defaultValue: "{{name}} (Primary)",
        name: primaryName,
      }),
      "primary",
    );

    const keyContacts = customerObj?.keyContacts || customerObj?.key_contacts || [];
    if (Array.isArray(keyContacts)) {
      keyContacts.forEach((contact, idx) => {
        addOption(
          contact?.email,
          t("common.contactLabel", {
            defaultValue: "{{name}} - {{designation}}",
            name:
              contact?.name ||
              t("common.contactNumber", {
                defaultValue: "Contact {{number}}",
                number: idx + 1,
              }),
            designation:
              contact?.designation ||
              t("common.customerContact", { defaultValue: "Customer Contact" }),
          }),
        );
      });
    }

    setContactOptions(options);
    const primary = options.find((o) => o.type === "primary")?.email || options[0]?.email || "";
    setToEmails((prev) => (prev.length ? prev : primary ? [primary] : []));
  }, [salesOrderData, isQuotationEmail, selectedCustomerFromNav]);

  useEffect(() => {
    if (!isQuotationEmail || !salesOrderId || quotationTemplateData?.htmlContent) return;
    const businessId =
      salesOrderData?.business_id?._id ||
      (typeof salesOrderData?.business_id === "string"
        ? salesOrderData.business_id
        : "") ||
      "";
    let cancelled = false;
    (async () => {
      try {
        let chosen = null;
        const savedTemplateId =
          salesOrderData?.templateId?._id ||
          salesOrderData?.templateId ||
          templateData?._id ||
          templateData?.id;
        if (savedTemplateId) {
          try {
            const config = headers?.authorization ? { headers } : undefined;
            const res = await axios.get(
              `${Base_URL}/document-templates/${savedTemplateId}`,
              config,
            );
            const t = res?.data?.data || res?.data;
            if (t && (t.htmlContent || t._id)) {
              chosen = t;
            }
          } catch (err) {
            console.warn("Quotation saved template fetch (email preview):", err);
          }
        }
        if (businessId) {
          const config = headers?.authorization ? { headers } : undefined;
          try {
            const res = await axios.get(
              `${Base_URL}/business-templates/${businessId}`,
              config,
            );
            const assignments = res?.data?.data || [];
            const match =
              assignments.find(
                (a) =>
                  a?.isActive &&
                  a?.isDefault &&
                  isQuotationDocumentTemplateType(a.type, a.templateId?.type),
              ) ||
              assignments.find(
                (a) =>
                  a?.isActive &&
                  isQuotationDocumentTemplateType(a.type, a.templateId?.type),
              );
            if (match?.templateId) chosen = match.templateId;
          } catch (err) {
            console.warn("Quotation template assignments fetch:", err);
          }
        }
        if (!chosen) {
          try {
            const config = headers?.authorization ? { headers } : undefined;
            const res = await axios.get(`${Base_URL}/document-templates`, config);
            const all = res?.data?.data || res?.data || [];
            chosen = all.find(
              (t) => normalizeDocumentTemplateType(t?.type) === "quotation",
            );
          } catch (err) {
            console.warn("Quotation template global fetch:", err);
          }
        }
        if (chosen && !chosen.htmlContent && (chosen._id || chosen.id)) {
          try {
            const config = headers?.authorization ? { headers } : undefined;
            const res = await axios.get(
              `${Base_URL}/document-templates/${chosen._id || chosen.id}`,
              config,
            );
            chosen = res?.data?.data || res?.data || chosen;
          } catch (err) {
            console.warn("Quotation template detail fetch:", err);
          }
        }
        if (!cancelled) setQuotationTemplateData(chosen || null);
      } catch {
        if (!cancelled) setQuotationTemplateData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isQuotationEmail,
    salesOrderId,
    salesOrderData?.business_id,
    salesOrderData?.templateId,
    templateData?._id,
    quotationTemplateData?.htmlContent,
  ]);

  const addRecipient = (target, rawEmail) => {
    const email = normalizeEmail(rawEmail);
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setRecipientError(
        t("documents.email.validation.invalidFormat", {
          defaultValue: "Invalid email format: {{email}}",
          email: rawEmail,
        }),
      );
      return;
    }
    setRecipientError("");
    if (target === "to") {
      if (!toEmails.map(normalizeEmail).includes(email)) {
        setToEmails((prev) => [...prev, email]);
      }
      setToInput("");
      setShowToDropdown(false);
      return;
    }
    if (target === "cc") {
      if (!ccEmails.map(normalizeEmail).includes(email)) setCcEmails((prev) => [...prev, email]);
      setCcInput("");
      setShowCcDropdown(false);
      return;
    }
    if (target === "bcc") {
      if (!bccEmails.map(normalizeEmail).includes(email)) setBccEmails((prev) => [...prev, email]);
      setBccInput("");
      setShowBccDropdown(false);
    }
  };

  const removeRecipient = (target, email) => {
    if (target === "to") setToEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
    if (target === "cc") setCcEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
    if (target === "bcc") setBccEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
  };

  const isSelectedInTarget = (email, target) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    if (target === "to") return toEmails.map(normalizeEmail).includes(normalized);
    if (target === "cc") return ccEmails.map(normalizeEmail).includes(normalized);
    if (target === "bcc") return bccEmails.map(normalizeEmail).includes(normalized);
    return false;
  };

  const getSuggestedContacts = (target, inputValue) => {
    const q = (inputValue || "").trim().toLowerCase();
    return contactOptions
      .filter((opt) => !isSelectedInTarget(opt.email, target))
      .filter((opt) =>
        !q
          ? true
          : opt.email.includes(q) || opt.label.toLowerCase().includes(q)
      )
      .slice(0, 8);
  };

  const buildOrderEmailPayload = () => ({
    orderLabel: orderDisplayLabel,
    customerName:
      salesOrderData?.customer_name ||
      salesOrderData?.customer?.basicInformation?.companyName ||
      salesOrderData?.customer?.basicInformation?.vendorDisplayName ||
      salesOrderData?.customer?.basicInformation?.customerDisplayName ||
      (isPurchaseOrderEmail
        ? t("common.vendor", { defaultValue: "Vendor" })
        : t("common.customer", { defaultValue: "Customer" })),
    orderNumber: docNumber,
    orderDate:
      salesOrderData?.quote_date ||
      salesOrderData?.purchaseOrderDate ||
      salesOrderData?.salesOrderDate,
    quoteDate: salesOrderData?.quote_date,
    expiryDate: salesOrderData?.expiry_date,
    expectedShipmentDate: salesOrderData?.expectedShipmentDate,
    total: salesOrderData?.grandTotal ?? salesOrderData?.total,
    currency: resolveEmailOrderCurrencyCode(salesOrderData, businessData),
  });

  const getDefaultEmailHtml = () => {
    const shellHtml =
      emailTemplateHtmlContent || getDefaultEmailTemplateDoc().htmlContent;
    if (shellHtml) {
      return buildOrderStandardEmailHtml(
        shellHtml,
        emailTemplateDoc?.dummyData,
        buildOrderEmailPayload(),
      );
    }
    return "";
  };

  const [emailHtml, setEmailHtml] = useState(() => getDefaultEmailHtml());
  const resolvedPreviewHtml = useMemo(
    () =>
      (emailHtml || "")
        .replace(/{{VIEW_SALES_ORDER_URL}}/g, "#")
        .replace(/{{VIEW_QUOTATION_URL}}/g, "#")
        .replace(/{{APPROVE_QUOTATION_URL}}/g, "#"),
    [emailHtml],
  );

  useEffect(() => {
    setEmailHtml(getDefaultEmailHtml());
  }, [
    emailTemplateHtmlContent,
    emailTemplateDoc,
    docNumber,
    orderDisplayLabel,
    salesOrderData?.customer_name,
    salesOrderData?.salesOrderDate,
    salesOrderData?.purchaseOrderDate,
    salesOrderData?.quote_date,
    salesOrderData?.expiry_date,
    salesOrderData?.expectedShipmentDate,
    salesOrderData?.total,
    salesOrderData?.grandTotal,
    businessData,
  ]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmailData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle file upload for additional documents
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowedTypes.includes(file.type)) {
      notifyError(
        t("documents.validation.allowedFileTypes", {
          defaultValue:
            "Please upload only JPEG, PNG, PDF, DOC, DOCX, XLS, or XLSX files",
        }),
      );
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError(
        t("documents.validation.maxFileSize", {
          defaultValue: "File size must be less than 10MB",
        }),
      );
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {
      // Use the document upload API
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `EmailAttachments/${salesOrderData?.salesOrderNumber || Date.now()}`
      );

      // Extract business_id
      let businessId = salesOrderData?.business;
      if (businessId && typeof businessId === "object" && businessId._id) {
        businessId = businessId._id;
      } else if (
        businessId &&
        typeof businessId === "object" &&
        businessId.id
      ) {
        businessId = businessId.id;
      }
      formDataForUpload.append("business_id", businessId);

      // Extract customer_id
      let customerId = salesOrderData?.customer;
      if (customerId && typeof customerId === "object" && customerId._id) {
        customerId = customerId._id;
      } else if (
        customerId &&
        typeof customerId === "object" &&
        customerId.id
      ) {
        customerId = customerId.id;
      }
      formDataForUpload.append("customer_id", customerId);

      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formDataForUpload,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      if (response.data.message === "File uploaded successfully") {
        const uploadedFile = response.data.file;

        const newDocument = {
          fileId: uploadedFile._id,
          name: uploadedFile.name,
          s3Key: uploadedFile.s3Key,
          url: uploadedFile.url || "#",
          downloadUrl: uploadedFile.downloadUrl || "#",
          uploadedAt: new Date().toISOString(),
          size: file.size,
          type: file.type,
          includeInEmail: true,
        };

        setAdditionalDocuments((prev) => [...prev, newDocument]);

        setSuccessMessage(
          response.data.message ||
            t("documents.messages.uploaded", {
              defaultValue: "File uploaded successfully!",
            }),
        );
        setUploadSuccess(true);

        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("File upload error:", error);
      notifyError(
        t("documents.messages.uploadFailedRetry", {
          defaultValue: "File upload failed. Please try again.",
        }),
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveDocument = (documentIdOrKey) => {
    if (!documentIdOrKey) return;
    setAdditionalDocuments((prev) =>
      prev.filter(
        (doc) =>
          String(doc.fileId || "") !== String(documentIdOrKey) &&
          String(doc.s3Key || "") !== String(documentIdOrKey)
      )
    );
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError(
        t("documents.messages.openError", { defaultValue: "Error opening file" }),
      );
      console.error("Error: ", error);
    }
  };

  // Handle final submission
  const handleSendEmail = async () => {
    // Validate required fields
    if (!toEmails.length) {
      notifyError(
        t("documents.email.validation.toRequired", {
          defaultValue: "At least one To email is required",
        }),
      );
      return;
    }
    const invalidTo = toEmails.find((email) => !EMAIL_REGEX.test(normalizeEmail(email)));
    if (invalidTo) {
      notifyError(
        t("documents.email.validation.invalidTo", {
          defaultValue: "Invalid To email: {{email}}",
          email: invalidTo,
        }),
      );
      return;
    }
    const invalidInLists = [...ccEmails, ...bccEmails].find((email) => !EMAIL_REGEX.test(normalizeEmail(email)));
    if (invalidInLists) {
      notifyError(
        t("documents.email.validation.invalidRecipient", {
          defaultValue: "Invalid recipient email: {{email}}",
          email: invalidInLists,
        }),
      );
      return;
    }

    if (!emailData.subject) {
      notifyError(
        t("documents.email.validation.subjectRequired", {
          defaultValue: "Email subject is required",
        }),
      );
      return;
    }

    if (!emailHtml.trim()) {
      notifyError(
        t("documents.email.validation.contentRequired", {
          defaultValue: "Email content is required",
        }),
      );
      return;
    }

    setLoading(true);
    try {
      // Always regenerate the attachment from current order state when a template exists.
      // This prevents stale documentUrl PDFs from being re-sent after terms/items changes.
      let documentUrlToUse =
        salesOrderData?.documentUrl || salesOrderData?.document_url || "";
      const effectiveTemplateForPdf = isQuotationEmail
        ? quotationTemplateData || templateData
        : templateData;
      const hasTemplateForPdf =
        !!(effectiveTemplateForPdf?.htmlContent || salesOrderData?.templateId);
      const shouldGenerateOrderPdf =
        attachSalesOrder &&
        hasTemplateForPdf &&
        (isQuotationEmail
          ? !!(businessData || salesOrderData?.business_id)
          : !!businessData);

      if (shouldGenerateOrderPdf) {
        try {
          if (isQuotationEmail) {
            let templateToUse = quotationTemplateData || templateData;
            const rawTid =
              salesOrderData?.templateId ||
              templateToUse?._id ||
              templateToUse?.id;
            const templateId =
              rawTid && typeof rawTid === "object"
                ? rawTid._id || rawTid.id
                : rawTid;
            if (!templateToUse?.htmlContent && templateId) {
              const templateRes = await axios.get(
                `${Base_URL}/document-templates/${templateId}`,
                { headers },
              );
              templateToUse = templateRes.data?.data;
            }
            if (!templateToUse?.htmlContent) {
              notifyError(
                t("documents.email.errors.templateContentMissing", {
                  defaultValue:
                    "Template content not found. Cannot generate quotation PDF.",
                }),
              );
              setLoading(false);
              return;
            }
            let sourceOrderData = salesOrderData;
            if (salesOrderId) {
              try {
                const freshRes = await QuotationServices.getQuotationById(salesOrderId);
                const freshQ = freshRes?.data?.data;
                if (freshQ && typeof freshQ === "object") {
                  sourceOrderData = { ...freshQ, ...salesOrderData };
                }
              } catch (refreshErr) {
                console.warn("Could not reload quotation for PDF;", refreshErr);
              }
            }
            let profileSignature = "";
            let rawSignature = "";
            try {
              const profileRes = await axios.get(
                `${Base_URL}/admin/profile/${adminInfo?.id}`,
                {
                  headers: adminInfo?.token
                    ? { authorization: `Bearer ${adminInfo.token}` }
                    : undefined,
                },
              );
              rawSignature =
                profileRes?.data?.signature || profileRes?.data?.data?.signature || "";
              profileSignature = normalizeSignatureUrl(rawSignature);
            } catch (e) {
              console.warn("Could not load profile signature for quotation PDF:", e);
            }
            const businessMerged = mergeBusinessEntityForQuotationPdf(
              sourceOrderData?.business_id,
              businessData,
            );
            const data = mapToQuotationTemplateData(sourceOrderData, businessMerged);
            let companyLogoForPdf =
              data.companyLogo ||
              businessMerged?.image ||
              businessMerged?.logo ||
              businessMerged?.companyLogo ||
              businessMerged?.businessLogo ||
              "";
            if (companyLogoForPdf && !String(companyLogoForPdf).startsWith("data:")) {
              const embedded = await fetchImageAsDataUriForPdf(
                companyLogoForPdf,
                adminInfo,
              );
              if (embedded) {
                companyLogoForPdf = embedded;
              } else {
                const abs = normalizeAssetUrlForPdf(companyLogoForPdf);
                if (abs) companyLogoForPdf = abs;
              }
            }
            const dataForPdf = { ...data, companyLogo: companyLogoForPdf };
            const contract = {
              ...dataForPdf,
              invoice_number: dataForPdf.quoteNumber,
              invoiceNumber: dataForPdf.quoteNumber,
            };
            let htmlToSend = ejs.render(
              templateToUse.htmlContent,
              { quotation: dataForPdf, contract },
              { strict: false },
            );
            htmlToSend = replaceLineItemsTbodyRowsHtml(
              htmlToSend,
              dataForPdf.items?.length || 0,
              buildOrderDocumentItemsRowsHtml(dataForPdf.items),
            );
            htmlToSend = applyInvoiceTermsAndConditionsToHtml(
              htmlToSend,
              sourceOrderData?.termsAndConditions || "",
            );
            htmlToSend = injectInvoicePdfSafetyStyles(htmlToSend);
            htmlToSend = injectSalesOrderPdfSignature(htmlToSend, profileSignature || "");
            const replaceUrlInHtml = (url, imageBase64) => {
              if (!url || !imageBase64) return;
              const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const escapedForHtml = url.replace(/&/g, "&amp;");
              const escapedForHtmlQuotes = escapedForHtml.replace(/'/g, "&#39;");
              htmlToSend = htmlToSend.replace(
                new RegExp(`(<img[^>]+src=["'])(${escapedUrl})(["'])`, "gi"),
                `$1${imageBase64}$3`,
              );
              htmlToSend = htmlToSend.replace(
                new RegExp(`(<img[^>]+src=["'])(${escapedForHtml})(["'])`, "gi"),
                `$1${imageBase64}$3`,
              );
              htmlToSend = htmlToSend.replace(
                new RegExp(`(<img[^>]+src=['])(${escapedUrl})(['])`, "gi"),
                `$1${imageBase64}$3`,
              );
              htmlToSend = htmlToSend.replace(
                new RegExp(`(<img[^>]+src=['])(${escapedForHtmlQuotes})(['])`, "gi"),
                `$1${imageBase64}$3`,
              );
            };
            if (profileSignature) {
              const signatureBase64 = await fetchImageAsDataUriForPdf(
                profileSignature,
                adminInfo,
              );
              if (signatureBase64) {
                replaceUrlInHtml(profileSignature, signatureBase64);
                if (rawSignature && rawSignature !== profileSignature) {
                  replaceUrlInHtml(rawSignature, signatureBase64);
                }
              }
            }
            const fileName = `quotation-${docNumber || salesOrderId || Date.now()}.pdf`;
            const pdfRes = await axios.post(
              `${Base_URL}/html-to-pdf`,
              {
                html: htmlToSend,
                filename: fileName,
                format: "A4",
                margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
                documentType: "INV",
              },
              {
                responseType: "blob",
                headers: adminInfo?.token
                  ? { authorization: `Bearer ${adminInfo.token}` }
                  : {},
              },
            );
            const pdfBlob = pdfRes.data;
            const pdfFile = new File([pdfBlob], fileName, {
              type: "application/pdf",
              lastModified: Date.now(),
            });
            const formData = new FormData();
            formData.append("file", pdfFile);
            formData.append("uploadedBy", adminInfo?.id || "");
            formData.append("file_name", pdfFile.name);
            const basePath = businessData?.name || "Quotations";
            const currentYear = new Date().getFullYear();
            const customerName = sourceOrderData?.customer_name || "Customer";
            const qn = docNumber || salesOrderId || "Draft";
            formData.append(
              "file_path",
              `${basePath}/${currentYear}/Customers/${customerName}/${qn}/Quotation`,
            );
            const rawBiz =
              sourceOrderData?.business_id ?? salesOrderData?.business_id;
            const businessIdForUpload =
              (typeof rawBiz === "object" && rawBiz !== null
                ? rawBiz._id || rawBiz.id
                : rawBiz) ||
              businessData?._id ||
              businessData?.id ||
              "";
            if (!businessIdForUpload) {
              notifyError(
                t("documents.email.errors.businessRequiredForPdf", {
                  defaultValue:
                    "Business is required to upload the quotation PDF. Open the quotation from a saved draft with a business selected.",
                }),
              );
              setLoading(false);
              return;
            }
            formData.append("business_id", String(businessIdForUpload));
            formData.append("file_type", "application/pdf");
            formData.append("file_size", pdfFile.size.toString());
            const uploadRes = await axios.post(
              `${Base_URL}/documents/uploadDocument`,
              formData,
              { headers: { "Content-Type": "multipart/form-data" } },
            );
            const file = uploadRes.data?.file || uploadRes.data?.data;
            documentUrlToUse =
              file?._id || file?.s3Key || file?.key || uploadRes.data?.s3Key;
            if (documentUrlToUse) {
              await QuotationServices.updateQuotation(salesOrderId, {
                documentUrl: documentUrlToUse,
              });
            }
          } else {
          let templateToUse = effectiveTemplateForPdf;
          const rawTid = salesOrderData?.templateId || templateToUse?._id || templateToUse?.id;
          const templateId =
            rawTid && typeof rawTid === "object"
              ? rawTid._id || rawTid.id
              : rawTid;
          if (!templateToUse?.htmlContent && templateId) {
            const templateRes = await axios.get(
              `${Base_URL}/document-templates/${templateId}`,
              { headers }
            );
            templateToUse = templateRes.data?.data;
          }
          if (!templateToUse?.htmlContent) {
            notifyError(
              t("documents.email.errors.templateContentMissing", {
                defaultValue: "Template content not found. Cannot generate PDF.",
              })
            );
            setLoading(false);
            return;
          }
          let sourceOrderData = salesOrderData;
          if (isPurchaseOrderEmail && salesOrderId) {
            try {
              const freshRes = await PurchaseOrderServices.getPurchaseOrderById(
                salesOrderId,
                headers
              );
              const freshPo = freshRes?.data?.data;
              if (freshPo && typeof freshPo === "object") {
                sourceOrderData = {
                  ...freshPo,
                  ...salesOrderData,
                  customer_name: salesOrderData?.customer_name || freshPo.customer_name,
                  customer_email: salesOrderData?.customer_email || freshPo.customer_email,
                  templateId: salesOrderData?.templateId || freshPo.templateId,
                };
              }
            } catch (refreshErr) {
              console.warn("Could not reload purchase order for PDF; using navigation state.", refreshErr);
            }
          }
          // Fetch admin profile signature (same as Create Customer Invoice PDF generation)
          let profileSignature = "";
          let rawSignature = "";
          try {
            const profileRes = await axios.get(
              `${Base_URL}/admin/profile/${adminInfo?.id}`,
              { headers: adminInfo?.token ? { authorization: `Bearer ${adminInfo.token}` } : undefined }
            );
            rawSignature = profileRes?.data?.signature || profileRes?.data?.data?.signature || "";
            profileSignature = normalizeSignatureUrl(rawSignature);
          } catch (e) {
            console.warn("Could not load profile signature for order PDF:", e);
          }
          const invoiceDataFromSO = mapSalesOrderToInvoiceData(sourceOrderData);
          if (invoiceDataFromSO) {
            invoiceDataFromSO.location = isPurchaseOrderEmail
              ? "purchase-orders"
              : "sales-orders";
          }
          const rawTemplateType =
            templateToUse?.type || templateToUse?.data?.type || "";
          const isSaleOrderTemplate =
            !isPurchaseOrderEmail &&
            isSaleOrderDocumentTemplateType(rawTemplateType, rawTemplateType);
          let htmlToSend;
          let contract;
          if (isSaleOrderTemplate) {
            const saleorder = mapToSaleOrderTemplateData(
              {
                ...invoiceDataFromSO,
                salesOrderNumber:
                  sourceOrderData?.salesOrderNumber ||
                  invoiceDataFromSO?.invoiceNumber ||
                  invoiceDataFromSO?.invoice_number,
                salesOrderDate:
                  sourceOrderData?.salesOrderDate ||
                  invoiceDataFromSO?.invoiceDate,
                expectedShipmentDate:
                  sourceOrderData?.expectedShipmentDate ||
                  invoiceDataFromSO?.dueDate,
              },
              businessData,
            );
            try {
              htmlToSend = ejs.render(
                templateToUse.htmlContent,
                {
                  saleorder,
                  contract: {
                    ...saleorder,
                    invoice_number: saleorder.orderNumber,
                    invoiceNumber: saleorder.orderNumber,
                  },
                },
                { strict: false },
              );
              htmlToSend = replaceLineItemsTbodyRowsHtml(
                htmlToSend,
                saleorder.items?.length || 0,
                buildOrderDocumentItemsRowsHtml(saleorder.items),
              );
            } catch (ejsErr) {
              console.error(
                "EJS render failed for sale order template:",
                ejsErr,
              );
              throw ejsErr;
            }
            contract = {
              termsAndConditions: saleorder.termsAndConditions,
              items: saleorder.items,
            };
          } else {
            contract = mapInvoiceToUnifiedInvoiceContract(
              invoiceDataFromSO,
              businessData,
              {
                purchaseOrderEmailTaxColumn: isPurchaseOrderEmail,
                explicitSalesOrPurchaseOrderLineLabels: true,
              },
            );
            contract.signature = profileSignature || "";
            contract.authorizedSignature = contract.signature;
            contract.approver_signature = contract.signature;
            const templateHtmlForRender = rewriteInvoiceTemplateForDisplayLabels(
              templateToUse.htmlContent,
            );
            htmlToSend = ejs.render(
              templateHtmlForRender,
              { contract },
              { strict: false },
            );
            htmlToSend = replaceInvoiceItemsRowsForPdf(
              htmlToSend,
              contract.items || [],
            );
          }
          try {
            const businessId =
              typeof sourceOrderData?.business === "object"
                ? sourceOrderData.business?._id
                : sourceOrderData?.business;
            const rid = salesOrderId || sourceOrderData?._id;
            const mod = isPurchaseOrderEmail ? "purchase" : "sales";
            const scr = isPurchaseOrderEmail
              ? "purchase_order"
              : "sales_order";

            let headerRows = [];
            let line_items = null;

            if (businessId && rid) {
              try {
                const payload = await fetchPdfPayload(
                  {
                    businessId,
                    module: mod,
                    screen: scr,
                    recordId: String(rid),
                  },
                  headers,
                );
                headerRows = payload.rows || [];
                line_items = payload.line_items || null;
              } catch (fetchErr) {
                console.warn("Custom fields PDF fetch (order email):", fetchErr);
              }
            }

            const itemsForInline =
              itemsForPdfCustomFields ||
              sourceOrderData?.items ||
              [];
            const inline = buildInlinePdfCustomFieldsPayload({
              documentFieldDefinitions:
                invoiceCustomFieldDefinitions || [],
              documentFieldValues: invoiceCustomFieldValues || {},
              lineItemDefinitions: lineItemCustomFieldDefinitions || [],
              items: itemsForInline,
            });
            if (inline) {
              if (inline.headerRows?.length) headerRows = inline.headerRows;
              if (inline.line_items?.rows?.length) line_items = inline.line_items;
            }

            if (
              headerRows.length ||
              (line_items?.columns?.length && line_items?.rows?.length)
            ) {
              htmlToSend = applyFullPdfCustomFieldsToHtml(htmlToSend, {
                headerRows,
                line_items,
              });
            }
          } catch (cfPdfErr) {
            console.warn("Custom fields PDF section skipped:", cfPdfErr);
          }
          htmlToSend = applyInvoiceTermsAndConditionsToHtml(
            htmlToSend,
            invoiceDataFromSO?.termsAndConditions ??
              sourceOrderData?.termsAndConditions ??
              contract?.termsAndConditions ??
              ""
          );
          htmlToSend = injectInvoicePdfSafetyStyles(htmlToSend);
          htmlToSend = injectSalesOrderPdfSignature(htmlToSend, profileSignature || "");
          // Embed logo and signature as base64 so they render in PDF (same as Create Customer Invoice)
          const replaceUrlInHtml = (url, imageBase64) => {
            if (!url || !imageBase64) return;
            const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const escapedForHtml = url.replace(/&/g, "&amp;");
            const escapedForHtmlQuotes = escapedForHtml.replace(/'/g, "&#39;");
            htmlToSend = htmlToSend.replace(new RegExp(`(<img[^>]+src=["'])(${escapedUrl})(["'])`, "gi"), `$1${imageBase64}$3`);
            htmlToSend = htmlToSend.replace(new RegExp(`(<img[^>]+src=["'])(${escapedForHtml})(["'])`, "gi"), `$1${imageBase64}$3`);
            htmlToSend = htmlToSend.replace(new RegExp(`(<img[^>]+src=['])(${escapedUrl})(['])`, "gi"), `$1${imageBase64}$3`);
            htmlToSend = htmlToSend.replace(new RegExp(`(<img[^>]+src=['])(${escapedForHtmlQuotes})(['])`, "gi"), `$1${imageBase64}$3`);
          };
          const convertImageToBase64 = async (imageUrl, imageName) => {
            if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("//") && !imageUrl.startsWith("data:"))) return null;
            if (imageUrl.startsWith("data:")) return imageUrl;
            try {
              const normalizedUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : imageUrl;
              let imageBase64 = null;
              const baseUrlClean = (Base_URL || "").replace(/\/$/, "");
              const isSameOrigin = baseUrlClean && normalizedUrl.startsWith(baseUrlClean);
              if (isSameOrigin && adminInfo?.token) {
                const imgRes = await axios.get(normalizedUrl, {
                  responseType: "arraybuffer",
                  headers: { authorization: `Bearer ${adminInfo.token}` },
                });
                const bytes = new Uint8Array(imgRes.data);
                let binary = "";
                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                const b64 = typeof btoa !== "undefined" ? btoa(binary) : "";
                const contentType = imgRes.headers?.["content-type"] || "image/png";
                imageBase64 = b64 ? `data:${contentType};base64,${b64}` : null;
              }
              if (!imageBase64) {
                const imageResponse = await fetch(normalizedUrl, { mode: "cors", credentials: "omit" });
                if (!imageResponse.ok) return null;
                const imageBlob = await imageResponse.blob();
                imageBase64 = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(imageBlob);
                });
              }
              if (imageBase64) {
                replaceUrlInHtml(normalizedUrl, imageBase64);
                return imageBase64;
              }
            } catch (err) {
              console.warn(`Could not embed ${imageName} as base64:`, err);
            }
            return null;
          };
          const businessLogoUrl = businessData?.image || businessData?.logo || businessData?.companyLogo || businessData?.businessLogo || "";
          if (businessLogoUrl) await convertImageToBase64(businessLogoUrl, "logo");
          if (profileSignature) {
            const signatureBase64 = await convertImageToBase64(profileSignature, "signature");
            if (signatureBase64 && rawSignature && rawSignature !== profileSignature) replaceUrlInHtml(rawSignature, signatureBase64);
          }
          const fileName = `${isPurchaseOrderEmail ? "purchase-order" : "sales-order"}-${docNumber || salesOrderId || Date.now()}.pdf`;
          const pdfRes = await axios.post(
            `${Base_URL}/html-to-pdf`,
            {
              html: htmlToSend,
              filename: fileName,
              format: "A4",
              margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
              documentType: "INV",
            },
            { responseType: "blob" }
          );
          const pdfBlob = pdfRes.data;
          const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf", lastModified: Date.now() });
          const formData = new FormData();
          formData.append("file", pdfFile);
          formData.append("uploadedBy", adminInfo?.id || "");
          formData.append("file_name", pdfFile.name);
          const basePath = salesOrderData?.business?.name || (isPurchaseOrderEmail ? "PurchaseOrders" : "SalesOrders");
          const currentYear = new Date().getFullYear();
          const customerName = salesOrderData?.customer_name || (isPurchaseOrderEmail ? "Vendor" : "Customer");
          const soNum = docNumber || salesOrderId || "Draft";
          const folderLabel = isPurchaseOrderEmail ? "Purchase Order" : orderLabel;
          formData.append("file_path", `${basePath}/${currentYear}/Customers/${customerName}/${soNum}/${folderLabel}`);
          const businessId = typeof salesOrderData?.business === "object" ? salesOrderData.business?._id : salesOrderData?.business;
          formData.append("business_id", businessId || "");
          formData.append("file_type", "application/pdf");
          formData.append("file_size", pdfFile.size.toString());
          const uploadRes = await axios.post(
            `${Base_URL}/documents/uploadDocument`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          const file = uploadRes.data?.file || uploadRes.data?.data;
          documentUrlToUse = file?._id || file?.s3Key || file?.key || uploadRes.data?.s3Key;
          if (documentUrlToUse) {
            await (isPurchaseOrderEmail ? PurchaseOrderServices : SalesOrderServices).updateSalesOrder(
              salesOrderId,
              { documentUrl: documentUrlToUse },
              headers
            );
          }
          }
        } catch (genErr) {
          console.error("Order PDF generation failed:", genErr);
          let detail = genErr.message || "";
          try {
            const data = genErr.response?.data;
            if (typeof data === "string" && data.trim()) {
              detail = data;
            } else if (data?.message) {
              detail = data.message;
            } else if (typeof Blob !== "undefined" && data instanceof Blob) {
              const text = await data.text();
              try {
                const parsed = JSON.parse(text);
                detail = parsed.message || text;
              } catch {
                detail = text || detail;
              }
            }
          } catch (_) {
            /* keep detail */
          }
          notifyError(
            t("documents.email.errors.pdfGenerationFailed", {
              defaultValue:
                "Failed to generate {{document}} PDF for attachment. {{message}}",
              document: orderDisplayLabel.toLowerCase(),
              message: detail,
            })
          );
          setLoading(false);
          return;
        }
      } else if (attachSalesOrder && !documentUrlToUse) {
        notifyError(
          t("documents.email.errors.cannotAttachPdf", {
            defaultValue:
              "Cannot attach PDF: template or business data missing. Uncheck 'Attach {{document}} PDF' or go back and select a template.",
            document: orderDisplayLabel.toLowerCase(),
          })
        );
        setLoading(false);
        return;
      }

      const additionalForApi = (additionalDocuments || [])
        .filter(
          (d) =>
            d &&
            d.includeInEmail !== false &&
            (d.s3Key || d.fileId)
        )
        .map((d) => ({
          name: d.name,
          s3Key: d.s3Key,
          fileId: d.fileId,
        }));

      const emailPayload = {
        from: emailData.from,
        to: toEmails.map(normalizeEmail).join(","),
        cc: ccEmails.length ? ccEmails.join(",") : undefined,
        bcc: bccEmails.length ? bccEmails.join(",") : undefined,
        subject: emailData.subject,
        email_html: emailHtml,
        AttachInvoice: attachSalesOrder,
        ...(documentUrlToUse ? { documentUrl: documentUrlToUse } : {}),
        additionalDocuments: additionalForApi,
        salesOrderId: salesOrderId,
      };

      const response = isQuotationEmail
        ? await QuotationServices.sendQuotationEmail(salesOrderId, emailPayload, {
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${adminInfo.token}`,
            },
          })
        : await (isPurchaseOrderEmail ? PurchaseOrderServices : SalesOrderServices).sendSalesOrderEmail(
            salesOrderId,
            emailPayload,
            headers
          );

      if (response.data.success) {
        if (isPurchaseOrderEmail && salesOrderId) {
          const persist = (additionalDocuments || [])
            .filter((d) => d && (d.s3Key || d.fileId))
            .map((d) => ({
              fileName: d.name,
              fileUrl: d.url && d.url !== "#" ? d.url : "",
              s3Key: d.s3Key,
              fileId: d.fileId,
              fileSize: d.size,
              includeInEmail: d.includeInEmail !== false,
            }));
          try {
            await PurchaseOrderServices.updateSalesOrder(
              salesOrderId,
              { attachments: persist },
              headers
            );
          } catch (persistErr) {
            console.warn(
              "Could not persist purchase order attachments after email:",
              persistErr
            );
          }
        }
        notifySuccess(
          t("documents.email.messages.sent", {
            defaultValue: "{{document}} email sent successfully",
            document: orderDisplayLabel,
          }),
        );
        history.push(
          isQuotationEmail
            ? `/quotations/view/${salesOrderId}`
            : isPurchaseOrderEmail
              ? `/purchase-orders/view/${salesOrderId}`
              : getModuleRoutePath("saleOrder", "view", { id: salesOrderId })
        );
      } else {
        notifyError(
          response.data.message ||
            t("documents.email.errors.sendFailed", {
              defaultValue: "Failed to send email",
            }),
        );
      }
    } catch (error) {
      console.error("Error sending email:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        t("documents.email.errors.sendFailed", {
          defaultValue: "Failed to send email",
        });
      notifyError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Editor commands
  const execCommand = (command, value = null) => {
    if (!isEditingHtml) return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEmailHtml(html);
    }
  };

  // Toggle between WYSIWYG and raw HTML mode
  const toggleHtmlMode = () => {
    setRawHtmlMode(!rawHtmlMode);
  };

  // Update HTML content when editing raw HTML
  const handleRawHtmlChange = (e) => {
    setEmailHtml(e.target.value);
  };

  useEffect(() => {
    if (isEditingHtml && editorRef.current && !rawHtmlMode) {
      editorRef.current.innerHTML = emailHtml;
    }
  }, [isEditingHtml, rawHtmlMode]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back button */}
      <div className="mb-8">
        <button
          className="flex items-center text-gray-700 text-sm"
          onClick={() => history.goBack()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back", { defaultValue: "Back" })}
        </button>
      </div>

      {/* Email Title */}
      <h1 className="text-2xl font-medium mb-8">
        {t("documents.email.title", {
          defaultValue: "Email to {{customer}}",
          customer:
            salesOrderData?.customer_name ||
            t("common.customer", { defaultValue: "Customer" }),
        })}
      </h1>

      {/* Email Form */}
      <div className="border border-gray-200 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("documents.email.from", { defaultValue: "From" })}
          </label>
          <input
            type="email"
            name="from"
            value={emailData.from}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>

        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("documents.email.sendTo", { defaultValue: "Send To" })}
          </label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-1 min-h-[40px] bg-white">
              {toEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-sm border border-slate-200"
                >
                  {email}
                  <button
                    type="button"
                    className="ml-1 text-slate-400 hover:text-red-500"
                    onClick={() => removeRecipient("to", email)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={toInput}
                onChange={(e) => {
                  setToInput(e.target.value);
                  setRecipientError("");
                  setShowToDropdown(true);
                }}
                onFocus={() => setShowToDropdown(true)}
                onBlur={() => setTimeout(() => setShowToDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient("to", toInput);
                  }
                }}
                className="border-none outline-none flex-1 min-w-[180px]"
                placeholder={t("documents.email.addRecipient", {
                  defaultValue: "Add recipient email",
                })}
              />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCcField(true);
                  setShowCcDropdown(true);
                }}
                className={`text-sm font-medium ${showCcField ? "text-[var(--p-blue)]" : "text-gray-500 hover:text-[var(--p-blue)]"}`}
              >
                {t("documents.email.cc", { defaultValue: "Cc" })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBccField(true);
                  setShowBccDropdown(true);
                }}
                className={`text-sm font-medium ${showBccField ? "text-[var(--p-blue)]" : "text-gray-500 hover:text-[var(--p-blue)]"}`}
              >
                {t("documents.email.bcc", { defaultValue: "Bcc" })}
              </button>
            </div>
            {showToDropdown && getSuggestedContacts("to", toInput).length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-44 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                {getSuggestedContacts("to", toInput).map((opt) => (
                  <button
                    key={opt.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipient("to", opt.email);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    {opt.label} ({opt.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showCcField && (
        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("documents.email.cc", { defaultValue: "CC" })}
          </label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-1 min-h-[40px] bg-white">
              {ccEmails.map((email) => (
                <span key={email} className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-sm border border-slate-200">
                  {email}
                  <button
                    type="button"
                    className="ml-1 text-slate-400 hover:text-red-500"
                    onClick={() => removeRecipient("cc", email)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={ccInput}
                onChange={(e) => {
                  setCcInput(e.target.value);
                  setRecipientError("");
                  setShowCcDropdown(true);
                }}
                onFocus={() => setShowCcDropdown(true)}
                onBlur={() => setTimeout(() => setShowCcDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient("cc", ccInput);
                  }
                }}
                className="border-none outline-none flex-1 min-w-[180px]"
                placeholder={t("documents.email.addCc", {
                  defaultValue: "Add CC email",
                })}
              />
            </div>
            {showCcDropdown && getSuggestedContacts("cc", ccInput).length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-44 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                {getSuggestedContacts("cc", ccInput).map((opt) => (
                  <button
                    key={opt.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipient("cc", opt.email);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    {opt.label} ({opt.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {showBccField && (
        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("documents.email.bcc", { defaultValue: "BCC" })}
          </label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-1 min-h-[40px] bg-white">
              {bccEmails.map((email) => (
                <span key={email} className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-sm border border-slate-200">
                  {email}
                  <button
                    type="button"
                    className="ml-1 text-slate-400 hover:text-red-500"
                    onClick={() => removeRecipient("bcc", email)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={bccInput}
                onChange={(e) => {
                  setBccInput(e.target.value);
                  setRecipientError("");
                  setShowBccDropdown(true);
                }}
                onFocus={() => setShowBccDropdown(true)}
                onBlur={() => setTimeout(() => setShowBccDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient("bcc", bccInput);
                  }
                }}
                className="border-none outline-none flex-1 min-w-[180px]"
                placeholder={t("documents.email.addBcc", {
                  defaultValue: "Add BCC email",
                })}
              />
            </div>
            {showBccDropdown && getSuggestedContacts("bcc", bccInput).length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-44 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                {getSuggestedContacts("bcc", bccInput).map((opt) => (
                  <button
                    key={opt.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipient("bcc", opt.email);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    {opt.label} ({opt.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
        {recipientError && <div className="text-red-500 text-xs mb-4">{recipientError}</div>}

        <div className="grid grid-cols-[100px_1fr] items-center mb-4">
          <label className="text-gray-600">
            {t("documents.email.subject", { defaultValue: "Subject" })}
          </label>
          <input
            type="text"
            name="subject"
            value={emailData.subject}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>
      </div>

      {/* Email Content Editor */}
      <div className="mb-8">
        <div className="bg-gray-100 p-2 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded ${!isEditingHtml ? "bg-white font-bold" : "bg-gray-200"
                  }`}
                onClick={() => setIsEditingHtml(false)}
              >
                {t("common.preview", { defaultValue: "Preview" })}
              </button>
              <button
                className={`px-3 py-1 rounded ${isEditingHtml ? "bg-white font-bold" : "bg-gray-200"
                  }`}
                onClick={() => setIsEditingHtml(true)}
              >
                {t("documents.email.html", { defaultValue: "HTML" })}
              </button>
            </div>

            {isEditingHtml && (
              <div className="flex items-center gap-1">
                <button
                  className={`p-1 rounded ${rawHtmlMode ? "bg-white" : "bg-gray-200"
                    }`}
                  onClick={toggleHtmlMode}
                  title={
                    rawHtmlMode
                      ? t("documents.email.wysiwygEditor", {
                          defaultValue: "WYSIWYG Editor",
                        })
                      : t("documents.email.rawHtml", {
                          defaultValue: "Raw HTML",
                        })
                  }
                >
                  <Code className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {isEditingHtml && !rawHtmlMode && (
            <div className="flex items-center gap-1 mt-2 flex-wrap border-t border-gray-200 pt-2">
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("bold")}
                title={t("documents.email.editor.bold", { defaultValue: "Bold" })}
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("italic")}
                title={t("documents.email.editor.italic", {
                  defaultValue: "Italic",
                })}
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("underline")}
                title={t("documents.email.editor.underline", {
                  defaultValue: "Underline",
                })}
              >
                <Underline className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("insertUnorderedList")}
                title={t("documents.email.editor.bulletList", {
                  defaultValue: "Bullet List",
                })}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("insertOrderedList")}
                title={t("documents.email.editor.numberedList", {
                  defaultValue: "Numbered List",
                })}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyLeft")}
                title={t("documents.email.editor.alignLeft", {
                  defaultValue: "Align Left",
                })}
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyCenter")}
                title={t("documents.email.editor.alignCenter", {
                  defaultValue: "Align Center",
                })}
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyRight")}
                title={t("documents.email.editor.alignRight", {
                  defaultValue: "Align Right",
                })}
              >
                <AlignRight className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyFull")}
                title={t("documents.email.editor.justify", {
                  defaultValue: "Justify",
                })}
              >
                <AlignJustify className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => {
                  const url = prompt(
                    t("documents.email.editor.enterLinkUrl", {
                      defaultValue: "Enter link URL:",
                    }),
                  );
                  if (url) execCommand("createLink", url);
                }}
                title={t("documents.email.editor.insertLink", {
                  defaultValue: "Insert Link",
                })}
              >
                <Link className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => {
                  const url = prompt(
                    t("documents.email.editor.enterImageUrl", {
                      defaultValue: "Enter image URL:",
                    }),
                  );
                  if (url) execCommand("insertImage", url);
                }}
                title={t("documents.email.editor.insertImage", {
                  defaultValue: "Insert Image",
                })}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("formatBlock", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  {t("documents.email.editor.format", {
                    defaultValue: "Format",
                  })}
                </option>
                <option value="h1">
                  {t("documents.email.editor.heading1", {
                    defaultValue: "Heading 1",
                  })}
                </option>
                <option value="h2">
                  {t("documents.email.editor.heading2", {
                    defaultValue: "Heading 2",
                  })}
                </option>
                <option value="h3">
                  {t("documents.email.editor.heading3", {
                    defaultValue: "Heading 3",
                  })}
                </option>
                <option value="p">
                  {t("documents.email.editor.paragraph", {
                    defaultValue: "Paragraph",
                  })}
                </option>
                <option value="pre">
                  {t("documents.email.editor.preformatted", {
                    defaultValue: "Preformatted",
                  })}
                </option>
              </select>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("fontName", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  {t("documents.email.editor.font", { defaultValue: "Font" })}
                </option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
              </select>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("fontSize", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  {t("documents.email.editor.size", { defaultValue: "Size" })}
                </option>
                <option value="1">
                  {t("documents.email.editor.small", { defaultValue: "Small" })}
                </option>
                <option value="3">
                  {t("documents.email.editor.normal", { defaultValue: "Normal" })}
                </option>
                <option value="5">
                  {t("documents.email.editor.large", { defaultValue: "Large" })}
                </option>
                <option value="7">
                  {t("documents.email.editor.extraLarge", {
                    defaultValue: "X-Large",
                  })}
                </option>
              </select>
              <input
                type="color"
                className="w-6 h-6 p-0 border-0 rounded"
                onChange={(e) => execCommand("foreColor", e.target.value)}
                title={t("documents.email.editor.textColor", {
                  defaultValue: "Text Color",
                })}
              />
              <input
                type="color"
                className="w-6 h-6 p-0 border-0 rounded"
                onChange={(e) => execCommand("hiliteColor", e.target.value)}
                title={t("documents.email.editor.backgroundColor", {
                  defaultValue: "Background Color",
                })}
              />
            </div>
          )}
        </div>

        {isEditingHtml ? (
          rawHtmlMode ? (
            <textarea
              className="w-full h-96 p-4 border border-gray-200 rounded-lg font-mono text-sm"
              value={emailHtml}
              onChange={handleRawHtmlChange}
            ></textarea>
          ) : (
            <div
              ref={editorRef}
              className="customer-invoice-email-preview w-full min-h-96 p-4 border border-gray-200 rounded-lg overflow-auto"
              contentEditable={true}
              onInput={(e) => setEmailHtml(e.currentTarget.innerHTML)}
              suppressContentEditableWarning={true}
            ></div>
          )
        ) : (
          <EmailTemplateIframePreview
            html={resolvedPreviewHtml}
            minHeight={400}
            fullWidth
          />
        )}
      </div>

      {/* Attachments */}
      <div className="mb-8">
        <div className="bg-[#f9f9f9] p-4 rounded-lg mb-4 flex items-center">
          <input
            type="checkbox"
            id="salesOrder"
            className="mr-3"
            checked={attachSalesOrder}
            onChange={(e) => setAttachSalesOrder(e.target.checked)}
          />
          <div className="flex-1">
            <label htmlFor="salesOrder" className="font-medium block">
              {t("documents.email.attachPdf", {
                defaultValue: "Attach {{document}} PDF",
                document: orderDisplayLabel.toLowerCase(),
              })}
            </label>
            <p className="text-sm text-gray-500">
              {t("documents.email.attachPdfHelp", {
                defaultValue:
                  "Include the {{document}} document and attach it to this email.",
                document: orderDisplayLabel.toLowerCase(),
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {isQuotationEmail
                ? t("documents.email.fileNames.quotation", {
                    defaultValue: "quotation.pdf",
                  })
                : isPurchaseOrderEmail
                  ? t("documents.email.fileNames.purchaseOrder", {
                      defaultValue: "purchase-order.pdf",
                    })
                  : t("documents.email.fileNames.salesOrder", {
                      defaultValue: "sales-order.pdf",
                    })}
            </span>
            <Eye className="h-5 w-5 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Additional Documents Upload */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          {t("documents.additionalDocuments", { defaultValue: "Additional Documents" })}
        </h3>
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="space-y-2">
              <p className="text-gray-600">
                {t("documents.email.additionalDocumentsHelp", {
                  defaultValue:
                    "Upload additional documents to send with this email (e.g., terms & conditions, specifications)",
                })}
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50"
              >
                <Upload size={16} className="mr-2" />
                {uploading
                  ? t("documents.uploading", { defaultValue: "Uploading..." })
                  : t("documents.chooseFile", { defaultValue: "Choose File" })}
              </button>
            </div>
            {uploading && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {t("documents.uploadProgress", {
                    defaultValue: "{{progress}}% uploaded",
                    progress: uploadProgress,
                  })}
                </p>
              </div>
            )}
            {uploadSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm">{successMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Display uploaded documents */}
        {additionalDocuments.length > 0 && (
          <div className="mt-4">
            <h4 className="text-md font-medium mb-3 text-gray-700">
              {t("documents.uploadedDocumentsCount", {
                defaultValue: "Uploaded Documents ({{count}})",
                count: additionalDocuments.length,
              })}
            </h4>
            <div className="space-y-2">
              {additionalDocuments.map((doc) => (
                <div
                  key={doc.fileId || doc.s3Key}
                  className="bg-gray-50 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={doc.includeInEmail !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAdditionalDocuments((prev) =>
                          prev.map((d) =>
                            (d.fileId || d.s3Key) === (doc.fileId || doc.s3Key)
                              ? { ...d, includeInEmail: checked }
                              : d
                          )
                        );
                      }}
                      id={`attach-email-${String(doc.fileId || doc.s3Key)}`}
                    />
                    <label
                      htmlFor={`attach-email-${String(doc.fileId || doc.s3Key)}`}
                      className="flex items-center min-w-0 flex-1 cursor-pointer"
                    >
                      <FileText className="h-6 w-6 text-[var(--p-blue)] mr-3 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800">{doc.name}</p>
                        <p className="text-sm text-gray-500">
                          {Number(doc.size)
                            ? `${(doc.size / 1024 / 1024).toFixed(2)} MB`
                            : "—"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t("documents.email.sendFileWhenChecked", {
                            defaultValue:
                              "Send this file to the {{recipient}} when checked",
                            recipient: isPurchaseOrderEmail
                              ? t("common.vendor", { defaultValue: "vendor" })
                              : t("common.customerLower", { defaultValue: "customer" }),
                          })}
                        </p>
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleOpenFile(doc.fileId)}
                      className="p-2 text-[var(--p-blue)] hover:text-[#9CBA33] rounded-lg transition-colors"
                      title={t("documents.viewDocument", {
                        defaultValue: "View Document",
                      })}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveDocument(doc.fileId || doc.s3Key)
                      }
                      className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                      title={t("documents.removeDocument", {
                        defaultValue: "Remove Document",
                      })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          className="px-8 py-3 bg-[#f5f5f5] rounded-md text-sm"
          onClick={() => history.goBack()}
        >
          {t("common.cancel", { defaultValue: "Cancel" })}
        </button>
        <button
          className="px-8 py-3 bg-[#bcd351] text-white rounded-md text-sm"
          onClick={handleSendEmail}
          disabled={loading}
        >
          {loading
            ? t("documents.email.sending", { defaultValue: "Sending..." })
            : t("common.send", { defaultValue: "Send" })}
        </button>
      </div>
    </div>
  );
}
