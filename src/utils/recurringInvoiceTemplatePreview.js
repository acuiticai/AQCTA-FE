/**
 * Client-side recurring-invoice preview: renders the saved document template HTML
 * (EJS) with the profile's template data and next scheduled dates — same pipeline
 * as CreateRecurringInvoice's template iframe + BE generateRecurringInvoicePdf
 * preprocessing (discount/tax snippets, payment/terms block swap).
 */

import axios from "axios";
import ejs from "ejs";
import numberToWords from "number-to-words";
import {
  buildInvoicePlaceholderOptions,
  resolveInvoicePlaceholderText,
} from "@/utils/invoicePlaceholderResolver";
import {
  injectInvoiceLineItemsIntoTemplateHtml,
  rewriteInvoiceTemplateForDisplayLabels,
} from "@/utils/invoiceContractMapper";
import { formatDate } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL || "";

export function normalizeRecurringPreviewSignatureUrl(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  const base = (Base_URL || "").replace(/\/$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return base ? `${base}${path}` : trimmed;
}

/** Mirrors customer-invoice InvoiceRenderer signature DOM injection. */
export function injectAuthorizedSignatureIntoRenderedHtml(html, signatureUrl) {
  const url = normalizeRecurringPreviewSignatureUrl(signatureUrl);
  if (!html || !url) return html;

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

    const signatureImgSelectors = [
      ".signature-box .logo img",
      ".authorized-signature img",
      "img[alt*='signature' i]",
    ];

    signatureImgSelectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((img) => {
        const currentSrc = (img.getAttribute("src") || "").trim();
        if (isInvalidSrc(currentSrc)) {
          img.setAttribute("src", url);
        }
        img.setAttribute("alt", "Authorized Signature");
        img.style.maxHeight = img.style.maxHeight || "80px";
      });
    });

    const signatureSections = Array.from(
      doc.querySelectorAll(".signature-section"),
    );

    signatureSections.forEach((section) => {
      let allImages = Array.from(section.querySelectorAll("img"));
      let mainImage = allImages[0] || null;

      if (!mainImage) {
        mainImage = doc.createElement("img");
        mainImage.setAttribute("src", url);
        section.insertBefore(mainImage, section.firstChild);
        allImages = [mainImage];
      }

      allImages.slice(1).forEach((img) => img.remove());

      mainImage.setAttribute("src", url);
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

    if (signatureSections.length === 0) {
      const signatureContainers = [
        ".signature-placeholder",
        ".signature-box .logo",
        ".authorized-signature",
      ];

      signatureContainers.forEach((selector) => {
        doc.querySelectorAll(selector).forEach((container) => {
          const existingImages = Array.from(container.querySelectorAll("img"));
          const mainImage = existingImages[0] || doc.createElement("img");

          if (!existingImages.length) {
            container.insertBefore(mainImage, container.firstChild);
          }
          existingImages.slice(1).forEach((img) => img.remove());

          mainImage.setAttribute("src", url);
          mainImage.setAttribute("alt", "Authorized Signature");
          mainImage.style.maxHeight = "80px";
          mainImage.style.display = "block";
          mainImage.style.marginBottom = "6px";
        });
      });
    }

    doc.querySelectorAll(".signature-label").forEach((label) => {
      if (!/authorized\s*signature/i.test((label.textContent || "").trim())) {
        return;
      }
      const host =
        label.closest(".signature-section") ||
        label.parentElement ||
        label;
      if (!host || host.querySelector("img")) return;
      const img = doc.createElement("img");
      img.setAttribute("src", url);
      img.setAttribute("alt", "Authorized Signature");
      img.style.maxHeight = "80px";
      img.style.display = "block";
      img.style.marginBottom = "6px";
      host.insertBefore(img, label);
    });

    return doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}

function previewNextDueDate(tpl, nextRunRaw) {
  if (!nextRunRaw) return null;
  const inv = tpl.invoice_date ? new Date(tpl.invoice_date) : null;
  const due = tpl.due_date ? new Date(tpl.due_date) : null;
  if (
    !inv ||
    !due ||
    Number.isNaN(inv.getTime()) ||
    Number.isNaN(due.getTime())
  ) {
    return null;
  }
  const delta = due.getTime() - inv.getTime();
  const run = new Date(nextRunRaw);
  if (Number.isNaN(run.getTime())) return null;
  return new Date(run.getTime() + delta);
}

export function stringifyInvoiceAddress(addr) {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  if (typeof addr !== "object") return String(addr);
  return [
    addr.attention,
    addr.address,
    addr.street2,
    [addr.city, addr.state, addr.zip].filter(Boolean).join(", "),
    addr.country,
  ]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join("\n");
}

function formatRecurringDiscountDisplay(item) {
  const discount = Number(
    item?.discountPercent ?? item?.discount ?? item?.discountAmount ?? 0,
  );
  return `${discount.toFixed(2)}%`;
}

function formatRecurringTaxDisplay(item) {
  const name = String(
    item?.taxName ?? item?.tax_label ?? item?.taxLabel ?? "",
  ).trim();
  const rate = Number(item?.taxRate ?? 0);
  const hasRate = Number.isFinite(rate) && rate > 0;

  if (name && hasRate) return `${name} (${rate.toFixed(2)}%)`;
  if (name) return name;
  if (hasRate) return `${rate.toFixed(2)}%`;

  const taxAmount = Number(item?.tax ?? item?.taxAmount ?? 0);
  return taxAmount.toFixed(2);
}

/** Mirrors PCI-BE/RecurringInvoice/generateRecurringInvoicePdf.js before EJS render. */
export function rewriteRecurringInvoiceTemplateLineDisplays(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return htmlContent;

  const replacements = [
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>",
      replacement: "<%= item.recurringDiscountDisplay %>",
    },
    {
      target:
        '<%= contract.currency || "RM" %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>',
      replacement: "<%= item.recurringDiscountDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>",
      replacement: "<%= item.recurringDiscountDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>",
      replacement: "<%= item.recurringDiscountDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>",
      replacement: "<%= item.recurringTaxDisplay %>",
    },
    {
      target:
        '<%= contract.currency || "RM" %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>',
      replacement: "<%= item.recurringTaxDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>",
      replacement: "<%= item.recurringTaxDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>",
      replacement: "<%= item.recurringTaxDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(item.taxAmount || item.tax || 0).toFixed(2) %>",
      replacement: "<%= item.recurringTaxDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(item.taxAmount || item.tax || 0).toFixed(2) %>",
      replacement: "<%= item.recurringTaxDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(item.taxAmount || item.tax || 0).toFixed(2) %>",
      replacement: "<%= item.recurringTaxDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>",
      replacement: "<%= contract.summaryDiscountDisplay %>",
    },
    {
      target:
        '<%= contract.currency || "RM" %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>',
      replacement: "<%= contract.summaryDiscountDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>",
      replacement: "<%= contract.summaryDiscountDisplay %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>",
      replacement: "<%= contract.summaryDiscountDisplay %>",
    },
  ];

  let output = htmlContent;
  for (const { target, replacement } of replacements) {
    if (output.includes(target)) {
      output = output.split(target).join(replacement);
    }
  }
  return output;
}

/** After EJS — same regex intent as PCI-BE recurring PDF (payment block swap). */
function replaceHardcodedPaymentInfoWithRenderedHtml(html, termsAndConditions) {
  if (!html || typeof html !== "string") return html;
  const raw =
    termsAndConditions && String(termsAndConditions).trim()
      ? String(termsAndConditions)
      : "";
  const termsHtml = raw
    .replace(/\$/g, "$$$$")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br/>");
  let out = html;
  out = out.replace(
    /<div class="payment-info">\s*<div>1\. Method Of Payment[\s\S]*?21400015058\s*<\/div>\s*<\/div>\s*<div class="financial-summary">/g,
    `<div class="payment-info">${termsHtml}</div>\n      <div class="financial-summary">`,
  );
  out = out.replace(
    /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){2,}\s*<\/div>\s*<div class="financial-summary">/g,
    `<div class="payment-info">${termsHtml}</div>\n      <div class="financial-summary">`,
  );
  out = out.replace(
    /<div class="payment-info">[\s\S]*?ABDUL HAMEED[\s\S]*?21400015058[\s\S]*?<\/div>\s*<div class="financial-summary">/gi,
    `<div class="payment-info">${termsHtml}</div>\n      <div class="financial-summary">`,
  );
  return out;
}

export function resolveTemplateIdFromInvoiceTemplate(invTpl) {
  if (!invTpl) return "";
  const t = invTpl.templateId;
  if (!t) return "";
  if (typeof t === "string") return t;
  if (typeof t === "object" && t._id) return String(t._id);
  return "";
}

function totalAmountInWords(totalAmount) {
  const amount = Number(totalAmount) || 0;
  if (amount <= 0) return "ZERO ONLY";
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);
  let totalInWords = numberToWords
    .toWords(integerPart, { and: true })
    .toUpperCase();
  if (decimalPart > 0) {
    totalInWords +=
      " AND " +
      numberToWords.toWords(decimalPart, { and: true }).toUpperCase() +
      " CENTS";
  }
  return `${totalInWords} ONLY`;
}

/**
 * Builds the `contract` object passed to invoice EJS templates (subset aligned with
 * CreateRecurringInvoice `renderTemplatePreview` + recurring line-display fields).
 *
 * @param {object} profile — GET recurring-invoice/:id `data`
 * @param {{ signatureUrl?: string }} [options]
 */
export function buildRecurringInvoicePreviewContract(profile, options = {}) {
  const signatureUrl = normalizeRecurringPreviewSignatureUrl(
    options.signatureUrl || "",
  );
  const tpl = profile?.invoice_template || {};
  const cust = profile?.customer_id;
  const biz = profile?.business_id;

  const refDate = profile?.next_invoice_date
    ? new Date(profile.next_invoice_date)
    : new Date();

  const nextDueDate = previewNextDueDate(tpl, profile?.next_invoice_date);

  /**
   * Re-use the shared invoice placeholder pipeline so the recurring preview
   * resolves tokens with the same rules as the customer-invoice viewer /
   * PDF / email. `invoice_number = "PREVIEW"` is the only override since the
   * spawned child invoice does not exist yet at preview time.
   */
  const placeholderOpts = buildInvoicePlaceholderOptions({
    invoice: tpl,
    business: { name: profile?.business_id?.name || biz?.name },
    referenceDate: refDate,
    contextOverrides: {
      customer_name: tpl.customer_name || profile?.customer_name,
      currency: tpl.currency || profile?.currency,
      grand_total: tpl.grandTotal ?? profile?.grand_total,
      amount: tpl.grandTotal ?? profile?.grand_total,
      invoice_number: "PREVIEW",
    },
  });
  const r = (s) =>
    typeof s === "string"
      ? resolveInvoicePlaceholderText(s, placeholderOpts)
      : s ?? "";

  const summaryItems = Array.isArray(tpl.items) ? tpl.items : [];
  const computedItemsSubtotal = summaryItems.reduce(
    (s, it) =>
      s +
      (Number(it.totalValue) ||
        Number(it.total) ||
        Number(it.amount) ||
        0),
    0,
  );
  const summarySubtotal = Number(tpl.subTotal) || computedItemsSubtotal || 0;
  const summaryDiscountPct = Math.min(
    100,
    Math.max(0, Number(tpl.discount) || 0),
  );
  const summaryShipping = Number(tpl.shippingCharges) || 0;
  const summaryAdjustment = Number(tpl.adjustment) || 0;
  const summaryDiscountAmount =
    summaryDiscountPct > 0
      ? (summarySubtotal * summaryDiscountPct) / 100
      : Number(tpl.discountAmount) || 0;
  const summaryTaxTotal =
    Number(tpl.taxTotal) ||
    summaryItems.reduce((s, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const disc = Number(it.discount) || 0;
      const taxRate = Number(it.taxRate) || 0;
      const lineSub = qty * price * (1 - disc / 100);
      return s + (lineSub * taxRate) / 100;
    }, 0);
  const summaryTotalDerived = Math.max(
    0,
    summarySubtotal -
      summaryDiscountAmount +
      summaryShipping +
      summaryAdjustment,
  );
  const grand =
    summarySubtotal > 0
      ? summaryTotalDerived
      : tpl.grandTotal ?? profile?.grand_total ?? 0;

  const curr = tpl.currency || profile?.currency || "USD";

  const customerName =
    cust?.basicInformation?.customerDisplayName ??
    cust?.basicInformation?.companyName ??
    profile?.customer_name ??
    tpl.customer_name ??
    "Customer";

  const billingResolved = r(stringifyInvoiceAddress(tpl.billingAddress));
  const shippingResolved = r(stringifyInvoiceAddress(tpl.shippingAddress));

  const invoiceDateStr =
    refDate instanceof Date && !Number.isNaN(refDate.getTime())
      ? formatDate(refDate)
      : formatDate(new Date());
  const dueDateStr =
    nextDueDate instanceof Date && !Number.isNaN(nextDueDate.getTime())
      ? formatDate(nextDueDate)
      : "";

  const items =
    summaryItems.length > 0
      ? summaryItems.map((item, idx) => {
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.unitPrice || item.rate || 0);
          const discountPercent = Number(item.discount ?? 0);
          const lineSubtotal =
            quantity * unitPrice * (1 - discountPercent / 100);
          const taxRate = Number(item.taxRate || 0);
          const taxAmount =
            Number(item.taxAmount ?? item.tax ?? 0) ||
            (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
          const total =
            Number(item.total ?? item.totalValue ?? 0) ||
            Math.max(0, lineSubtotal + taxAmount);
          const tplItemName = String(
            item.itemName ||
              item.title ||
              item.name ||
              (typeof item.item === "string" ? item.item : ""),
          ).trim();
          const tplDesc = String(item.description ?? "").trim();
          /** Mirrors PCI-BE/utils/invoicePayloadToContract.js `items` mapping. */
          const mainPlain = tplItemName || tplDesc || "Item";
          const subPlain =
            tplItemName &&
            tplDesc &&
            tplDesc.trim() !== tplItemName.trim()
              ? tplDesc
              : "";
          const mainResolved = r(mainPlain);
          const subResolved = subPlain ? r(subPlain) : "";
          const base = {
            /** Product / line title (same semantics as backend `contract.items[].item`) */
            item: mainResolved,
            name: mainResolved,
            description: subResolved,
            /** Optional helpers if a template prefers these over loop index */
            lineNo: idx + 1,
            rowNumber: idx + 1,
            quantity,
            unit: item.unit ?? "",
            unitPrice,
            rate: unitPrice,
            discount: discountPercent,
            taxRate,
            tax: taxAmount,
            taxAmount,
            total,
            recurringDiscountDisplay: formatRecurringDiscountDisplay(item),
            recurringTaxDisplay: formatRecurringTaxDisplay(item),
          };
          return base;
        })
      : [
          {
            item: "Sample Item",
            name: "Sample Item",
            description: "",
            lineNo: 1,
            rowNumber: 1,
            quantity: 1,
            unitPrice: 100,
            rate: 100,
            discount: 0,
            taxRate: 0,
            tax: 0,
            taxAmount: 0,
            total: 100,
            recurringDiscountDisplay: "0.00%",
            recurringTaxDisplay: "0.00",
          },
        ];

  const summaryDiscountDisplay =
    summaryDiscountPct > 0
      ? `${summaryDiscountPct.toFixed(2)}%`
      : `${summaryDiscountAmount.toFixed(2)}`;

  const contract = {
    businessLogo:
      biz?.image ?? biz?.logo ?? biz?.companyLogo ?? biz?.businessLogo ?? "",
    businessName: biz?.name || "Company",
    businessCountry: biz?.country ?? "",
    businessEmail: biz?.email ?? "",
    contract_no: "PREVIEW",
    invoice_number: "PREVIEW",
    subject: r(
      (profile?.subject != null && String(profile.subject).trim() !== "")
        ? String(profile.subject).trim()
        : tpl.subject || "",
    ),
    currency: curr,
    totalValue: grand,
    grandTotal: grand,
    customerName,
    buyerInfo: customerName,
    customerAddress: billingResolved,
    buyerAddress: billingResolved,
    shippingAddress: shippingResolved,
    shipping_address: shippingResolved,
    invoice_date: invoiceDateStr,
    date_of_issue: invoiceDateStr,
    terms: tpl.terms || "Due on Receipt",
    payment: tpl.terms || "Due on Receipt",
    dueDate: dueDateStr,
    orderNumber: r(tpl.orderNumber || ""),
    signature: signatureUrl,
    authorizedSignature: signatureUrl,
    approver_signature: signatureUrl,
    items,
    customerNotes: r(tpl.customerNotes || ""),
    termsAndConditions: r(tpl.termsAndConditions || ""),
    subtotal: summarySubtotal,
    discountAmount: summaryDiscountAmount,
    discount: summaryDiscountPct,
    summaryDiscountDisplay,
    tax: summaryTaxTotal,
    taxTotal: summaryTaxTotal,
    shippingCharges: summaryShipping,
    adjustment: summaryAdjustment,
    total: grand,
    invoiceType: tpl.invoiceType || "Commercial",
    total_in_words: totalAmountInWords(grand),
  };

  return { contract };
}

/**
 * Loads admin signature URLs (same endpoint as view-customer-invoice / InvoiceRenderer).
 * Tries each id in order; salesperson ids are staff ids and usually skip — logged-in admin first.
 */
export async function fetchAdminProfileSignatureUrl(adminIds, headers) {
  const seen = new Set();
  for (const rawId of adminIds) {
    const adminId = rawId != null ? String(rawId).trim() : "";
    if (!adminId || seen.has(adminId)) continue;
    seen.add(adminId);
    try {
      const res = await axios.get(`${Base_URL}/admin/profile/${adminId}`, {
        headers,
      });
      const url = normalizeRecurringPreviewSignatureUrl(
        res?.data?.signature || "",
      );
      if (url) return url;
    } catch {
      // Optional — try next id.
    }
  }
  return "";
}

function applySignatureToTemplateSource(html, signatureUrl) {
  if (!html || !signatureUrl) return html;
  return html.replace(
    /<%= ?contract\.(signature|authorizedSignature|approver_signature) ?%>/g,
    signatureUrl,
  );
}

/**
 * Renders stored template HTML → full HTML preview (inline embed, not sandboxed iframe).
 */
export function renderRecurringInvoiceTemplateHtml(
  htmlContent,
  profile,
  options = {},
) {
  if (!htmlContent || typeof htmlContent !== "string") {
    throw new Error("No template HTML to render.");
  }

  const signatureUrl = normalizeRecurringPreviewSignatureUrl(
    options.signatureUrl || "",
  );

  let templateProcessed = rewriteRecurringInvoiceTemplateLineDisplays(htmlContent);
  templateProcessed = rewriteInvoiceTemplateForDisplayLabels(templateProcessed);
  templateProcessed = applySignatureToTemplateSource(
    templateProcessed,
    signatureUrl,
  );

  const { contract } = buildRecurringInvoicePreviewContract(profile, {
    ...options,
    signatureUrl,
  });

  let html = ejs.render(templateProcessed, { contract }, { strict: false });

  html = replaceHardcodedPaymentInfoWithRenderedHtml(
    html,
    contract.termsAndConditions,
  );

  if (contract.signature) {
    html = injectAuthorizedSignatureIntoRenderedHtml(html, contract.signature);
  }

  if (Array.isArray(contract.items) && contract.items.length > 0) {
    html = injectInvoiceLineItemsIntoTemplateHtml(html, contract.items);
  }

  return html;
}
