/**
 * Maps invoice form data + business to the contract shape expected by
 * invoice templates (EJS). Used by DocumentGenerator and EmailPreview for PDF generation.
 * Also supports sales order data via mapSalesOrderToInvoiceData.
 */
import { replaceLineItemsTbodyRowsHtml } from "@/utils/customFieldsPdf";
import { numberToWords } from "@/utils/invoiceTemplateProcessor";
import { getModuleLabel } from "@/utils/moduleLabels";
import { formatDate } from "@/components/formatAmount";
import { resolveDocumentCompanyBranding } from "@/config/aqctaIdentity";

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function calculateOrderDiscountPercentage(subtotal, discountAmount) {
  const baseSubtotal = toFiniteNumber(subtotal);
  const discount = toFiniteNumber(discountAmount);
  if (baseSubtotal <= 0 || discount <= 0) return 0;
  return Math.min(100, Math.max(0, (discount / baseSubtotal) * 100));
}

/** Normalize template type labels from assignments / DB (`saleorder`, "Sales Order", etc.). */
export function normalizeDocumentTemplateType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * Sales Order PDFs should use templates with document type `saleorder` (assignments store `template.type`).
 */
export function isSaleOrderDocumentTemplateType(assignmentType, templateType) {
  const canon = (n) =>
    n === "saleorder" || n === "salesorder" ? "saleorder" : n;
  const a = canon(normalizeDocumentTemplateType(assignmentType));
  const t = canon(normalizeDocumentTemplateType(templateType));
  return a === "saleorder" || t === "saleorder";
}

const MONGO_OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

/**
 * Resolve quotation/order currency for EJS templates (never an ObjectId string).
 * Uses business currency fields when the stored value is an id or missing.
 */
export function resolveQuotationCurrencyCode(currency, business = {}) {
  const fromBusiness = () => {
    const b =
      business?.currency || business?.baseCurrency || business?.defaultCurrency;
    if (b && typeof b === "object") {
      const c = b.code || b.currencyCode || b.symbol;
      if (
        typeof c === "string" &&
        c.trim() &&
        !MONGO_OBJECT_ID_HEX.test(c.trim())
      ) {
        const up = c.trim().toUpperCase().slice(0, 3);
        if (/^[A-Z]{3}$/.test(up)) return up;
      }
    }
    if (
      typeof b === "string" &&
      b.trim() &&
      !MONGO_OBJECT_ID_HEX.test(b.trim())
    ) {
      const up = b.trim().toUpperCase().slice(0, 3);
      if (/^[A-Z]{3}$/.test(up)) return up;
    }
    return "MYR";
  };

  if (currency == null || currency === "") return fromBusiness();

  if (typeof currency === "object") {
    const c = currency.code || currency.currencyCode || currency.symbol;
    if (typeof c === "string" && c.trim()) {
      const t = c.trim();
      if (MONGO_OBJECT_ID_HEX.test(t)) return fromBusiness();
      const up = t.toUpperCase().slice(0, 3);
      if (/^[A-Z]{3}$/.test(up)) return up;
    }
    return fromBusiness();
  }

  const s = String(currency).trim();
  if (!s) return fromBusiness();
  if (MONGO_OBJECT_ID_HEX.test(s)) return fromBusiness();
  const up = s.toUpperCase().slice(0, 3);
  if (/^[A-Z]{3}$/.test(up)) return up;
  return fromBusiness();
}

/** Quotation PDFs use templates with document type `quotation`. */
export function isQuotationDocumentTemplateType(assignmentType, templateType) {
  const a = normalizeDocumentTemplateType(assignmentType);
  const t = normalizeDocumentTemplateType(templateType);
  return a === "quotation" || t === "quotation";
}

/** Work Order PDFs use templates with document type `workorder`. */
export function isWorkOrderDocumentTemplateType(assignmentType, templateType) {
  const canon = (n) =>
    n === "workorder" || n === "work-order" ? "workorder" : n;
  const a = canon(normalizeDocumentTemplateType(assignmentType));
  const t = canon(normalizeDocumentTemplateType(templateType));
  return a === "workorder" || t === "workorder";
}

/**
 * SO/PO payloads sometimes save the literal "N/A" when no label was entered; treat as empty for display.
 */
export function normalizeOrderLineText(value) {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "n/a" || lower === "na" || lower === "-" || lower === "—")
    return "";
  return s;
}

function firstNormalizedLineCandidate(...vals) {
  for (const v of vals) {
    const n = normalizeOrderLineText(v);
    if (n) return n;
  }
  return "";
}

/**
 * Resolve primary line label + optional second line for invoices/PDF/email (SO, PO, customer invoice).
 * DB lines usually only have `description`; catalog name may live on populated `itemId`.
 */
export function resolveOrderLineItemAndDescription(item, index = 0) {
  const populated =
    item?.itemId &&
    typeof item.itemId === "object" &&
    !Array.isArray(item.itemId)
      ? item.itemId
      : null;
  // Catalog "name" only — do not use populated.description as the item title (line description is separate).
  const fromCatalog = firstNormalizedLineCandidate(
    populated?.title,
    populated?.name,
    populated?.itemName,
  );
  const fromName = firstNormalizedLineCandidate(
    item?.itemName,
    item?.name,
    item?.item,
    item?.title,
    item?.productName,
  );
  const fromDesc = firstNormalizedLineCandidate(
    item?.description,
    item?.goods_description,
  );
  const primary =
    fromName || fromCatalog || fromDesc || `Item ${Number(index) + 1}`;
  const secondary =
    fromDesc && fromDesc !== primary ? fromDesc : "";
  return { itemName: primary, description: secondary };
}

/**
 * Table cell content for document templates: combined "Item & Description" vs separate Description column.
 */
export function resolveTemplateLineItemDisplayCells(item) {
  const itemName = String(
    item?.item ?? item?.name ?? item?.title ?? item?.itemName ?? "",
  ).trim();
  const itemDescription = String(
    item?.description ?? item?.subDescription ?? item?.goods_description ?? "",
  ).trim();

  const combinedPrimary = itemName || itemDescription || "—";
  const combinedSubtitle =
    itemName && itemDescription && itemDescription !== itemName
      ? itemDescription
      : "";

  const separateNameCell = itemName || (itemDescription ? "" : "—");

  return {
    combinedPrimary,
    combinedSubtitle,
    separateNameCell,
    separateDescriptionCell: itemDescription,
  };
}

function escapeTemplateCellHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTemplateNumber(value, decimals = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : (0).toFixed(decimals);
}

function formatTemplatePercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${parseFloat(n.toFixed(2)).toString()}%`;
}

export function buildOrderDocumentItemsRowsHtml(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, idx) => {
      const { combinedPrimary, combinedSubtitle } =
        resolveTemplateLineItemDisplayCells(item);
      const itemCell = combinedSubtitle
        ? `<div class="item-desc-main">${escapeTemplateCellHtml(combinedPrimary)}</div><div class="item-desc-sub" style="font-size: 0.9em; color: #666; margin-top: 2px;">${escapeTemplateCellHtml(combinedSubtitle)}</div>`
        : `<div class="item-desc-main">${escapeTemplateCellHtml(combinedPrimary)}</div>`;
      const quantity = item?.quantity ?? item?.qty ?? item?.ordered_quantity ?? 0;
      const rate = item?.rate ?? item?.unitPrice ?? item?.price ?? 0;
      const discount =
        item?.discount ?? item?.discountRate ?? item?.discountPercentage ?? 0;
      const taxRate = item?.taxRate ?? 0;
      const amount = item?.amount ?? item?.total ?? item?.totalValue ?? 0;

      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${itemCell}</td>
        <td class="right">${formatTemplateNumber(quantity)}</td>
        <td class="right">${formatTemplateNumber(rate)}</td>
        <td class="right">${formatTemplatePercent(discount)}</td>
        <td class="right">${formatTemplatePercent(taxRate)}</td>
        <td class="right">${formatTemplateNumber(amount)}</td>
      </tr>
    `;
    })
    .join("");
}

export function formatInvoiceLineDiscountColumnDisplay(item) {
  const discount = toFiniteNumber(
    item?.discountPercent ?? item?.discount ?? item?.discountAmount ?? 0,
  );
  return `${discount.toFixed(2)}%`;
}

export function formatInvoiceLineTaxColumnDisplay(item) {
  const name = String(
    item?.taxName ?? item?.tax_label ?? item?.taxLabel ?? "",
  ).trim();
  const rate = toFiniteNumber(item?.taxRate);
  if (name && rate > 0) return `${name} (${rate.toFixed(2)}%)`;
  if (name) return name;
  if (rate > 0) return `${rate.toFixed(2)}%`;
  return toFiniteNumber(item?.tax ?? item?.taxAmount ?? 0).toFixed(2);
}

export function formatSummaryDiscountDisplay(summaryDiscountPercentage) {
  return `${toFiniteNumber(summaryDiscountPercentage).toFixed(2)}%`;
}

/**
 * Rebuilds line-item tbody rows after EJS — same behavior as InvoiceRenderer so embedded
 * previews match view-customer-invoice (borders, columns, tax/discount labels).
 */
export function injectInvoiceLineItemsIntoTemplateHtml(html, items) {
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
      const tax =
        taxAmountFromApi ||
        (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
      const computedLineTotal = Math.max(0, lineSubtotal + tax);
      const providedTotal = Number(
        item.total ?? item.totalValue ?? item.amount ?? 0,
      );
      const tolerance = 0.01;
      const total =
        providedTotal > 0
          ? Math.abs(providedTotal - computedLineTotal) < tolerance
            ? providedTotal
            : Math.abs(providedTotal - lineSubtotal) < tolerance && tax > 0
              ? providedTotal + tax
              : computedLineTotal
          : computedLineTotal;

      const discountCell =
        item.recurringDiscountDisplay ??
        item.invoiceDiscountColumnDisplay ??
        formatInvoiceLineDiscountColumnDisplay(item);
      const taxDisplay =
        item.recurringTaxDisplay ??
        item.invoiceTaxColumnDisplay ??
        formatInvoiceLineTaxColumnDisplay({
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
                <td>${discountCell}</td>
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
                <td>${discountCell}</td>
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
}

/**
 * Normalize invoice/due dates from API (Date, ISO string, timestamp, YYYY-MM-DD) to YYYY-MM-DD.
 * Avoids `String(date)` which becomes "Fri Mar 27 2026 05:00:00 GMT+0500 (...)" in PDFs.
 */
export function normalizeInvoiceDateToYmd(v) {
  if (v === undefined || v === null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const dt = new Date(v);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return "";
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return "";
  }
  if (typeof v === "object" && v !== null && v.$date != null) {
    return normalizeInvoiceDateToYmd(v.$date);
  }
  return "";
}

/** Line tax column for PO email PDF: "SST 10%" when name/rate exist; otherwise currency + amount. */
export function formatPurchaseOrderLineTaxColumnDisplay(
  item,
  currencyCode = "USD",
) {
  const name = String(item?.taxName ?? "").trim();
  const rate = Number(item?.taxRate);
  const hasRate = Number.isFinite(rate) && rate > 0;
  if (name || hasRate) {
    const rateStr = hasRate
      ? `${Number.isInteger(rate) ? String(Math.round(rate)) : parseFloat(rate.toFixed(4)).toString()}%`
      : "";
    if (name && hasRate) return `${name} ${rateStr}`;
    if (name) return name;
    return rateStr;
  }
  const amt = Number(item?.tax ?? item?.taxAmount ?? 0);
  const cur = String(currencyCode || "USD").trim() || "USD";
  return `${cur} ${amt.toFixed(2)}`;
}

/**
 * Document templates often print line tax as currency + amount. For purchase order PDF, rewrite those
 * EJS snippets so they render {@link formatPurchaseOrderLineTaxColumnDisplay} via item.poTaxColumnDisplay.
 */
export function rewritePurchaseOrderInvoiceTemplateForLineTaxLabels(
  htmlContent,
) {
  return rewriteInvoiceTemplateForDisplayLabels(htmlContent);
}

export function rewriteInvoiceTemplateForDisplayLabels(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return htmlContent;

  const replacements = [
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceDiscountColumnDisplay || ((parseFloat(item.discount || item.discountPercent || item.discountAmount || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        '<%= contract.currency || "RM" %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>',
      replacement:
        "<%= item.invoiceDiscountColumnDisplay || ((parseFloat(item.discount || item.discountPercent || item.discountAmount || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceDiscountColumnDisplay || ((parseFloat(item.discount || item.discountPercent || item.discountAmount || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceDiscountColumnDisplay || ((parseFloat(item.discount || item.discountPercent || item.discountAmount || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceTaxColumnDisplay || (item.taxName ? item.taxName + ((parseFloat(item.taxRate || 0) > 0) ? (' (' + parseFloat(item.taxRate || 0).toFixed(2) + '%)') : '') : parseFloat(item.tax || item.taxAmount || 0).toFixed(2)) %>",
    },
    {
      target:
        '<%= contract.currency || "RM" %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>',
      replacement:
        "<%= item.invoiceTaxColumnDisplay || (item.taxName ? item.taxName + ((parseFloat(item.taxRate || 0) > 0) ? (' (' + parseFloat(item.taxRate || 0).toFixed(2) + '%)') : '') : parseFloat(item.tax || item.taxAmount || 0).toFixed(2)) %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceTaxColumnDisplay || (item.taxName ? item.taxName + ((parseFloat(item.taxRate || 0) > 0) ? (' (' + parseFloat(item.taxRate || 0).toFixed(2) + '%)') : '') : parseFloat(item.tax || item.taxAmount || 0).toFixed(2)) %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceTaxColumnDisplay || (item.taxName ? item.taxName + ((parseFloat(item.taxRate || 0) > 0) ? (' (' + parseFloat(item.taxRate || 0).toFixed(2) + '%)') : '') : parseFloat(item.tax || item.taxAmount || 0).toFixed(2)) %>",
    },
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(item.taxAmount || item.tax || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceTaxColumnDisplay || (item.taxName ? item.taxName + ((parseFloat(item.taxRate || 0) > 0) ? (' (' + parseFloat(item.taxRate || 0).toFixed(2) + '%)') : '') : parseFloat(item.taxAmount || item.tax || 0).toFixed(2)) %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(item.taxAmount || item.tax || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceTaxColumnDisplay || (item.taxName ? item.taxName + ((parseFloat(item.taxRate || 0) > 0) ? (' (' + parseFloat(item.taxRate || 0).toFixed(2) + '%)') : '') : parseFloat(item.taxAmount || item.tax || 0).toFixed(2)) %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(item.taxAmount || item.tax || 0).toFixed(2) %>",
      replacement:
        "<%= item.invoiceTaxColumnDisplay || (item.taxName ? item.taxName + ((parseFloat(item.taxRate || 0) > 0) ? (' (' + parseFloat(item.taxRate || 0).toFixed(2) + '%)') : '') : parseFloat(item.taxAmount || item.tax || 0).toFixed(2)) %>",
    },
    {
      target:
        "<%= contract.currency || 'RM' %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>",
      replacement:
        "<%= contract.summaryDiscountDisplay || ((parseFloat(contract.discountPercentage || contract.summaryDiscountPercentage || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        '<%= contract.currency || "RM" %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>',
      replacement:
        "<%= contract.summaryDiscountDisplay || ((parseFloat(contract.discountPercentage || contract.summaryDiscountPercentage || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        "<%= contract.currency || 'MYR' %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>",
      replacement:
        "<%= contract.summaryDiscountDisplay || ((parseFloat(contract.discountPercentage || contract.summaryDiscountPercentage || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        "<%= contract.currency || 'USD' %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>",
      replacement:
        "<%= contract.summaryDiscountDisplay || ((parseFloat(contract.discountPercentage || contract.summaryDiscountPercentage || 0).toFixed(2)) + '%') %>",
    },
    // Summary discount without currency prefix (some templates)
    {
      target:
        "<%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %>",
      replacement:
        "<%= contract.summaryDiscountDisplay || ((parseFloat(contract.discountPercentage || contract.summaryDiscountPercentage || 0).toFixed(2)) + '%') %>",
    },
    {
      target:
        "<%= parseFloat(contract.discountAmount || contract.discount || 0).toFixed(2) %>",
      replacement:
        "<%= contract.summaryDiscountDisplay || ((parseFloat(contract.discountPercentage || contract.summaryDiscountPercentage || 0).toFixed(2)) + '%') %>",
    },
  ];

  let out = htmlContent;
  for (const { target, replacement } of replacements) {
    if (out.includes(target)) out = out.split(target).join(replacement);
  }
  return out;
}

/** Normalize sales order to invoice-like shape so mapInvoiceToUnifiedInvoiceContract can be used for PDF. */
export function mapSalesOrderToInvoiceData(salesOrder) {
  if (!salesOrder) return null;
  const customer = salesOrder.customer || {};
  const basic = customer.basicInformation || {};
  const companyInfo = customer.companyInfo || {};
  const addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
  const billingAddressObj = addresses.find(
    (a) => (a?.addressType || "").toLowerCase() === "billing",
  );
  const shippingAddressObj =
    addresses.find(
      (a) => (a?.addressType || "").toLowerCase() === "shipping",
    ) ||
    billingAddressObj ||
    addresses[0];
  const formatAddress = (addressObj) => {
    if (!addressObj) return "";
    if (typeof addressObj.address === "string" && addressObj.address.trim()) {
      return addressObj.address.trim();
    }
    return [
      addressObj.addressLine1,
      addressObj.addressLine2,
      addressObj.city,
      addressObj.state,
      addressObj.zipCode,
      addressObj.country,
    ]
      .filter(Boolean)
      .join(", ");
  };
  const resolvedBillingAddress =
    salesOrder.billingAddress ||
    salesOrder.billing_address ||
    formatAddress(billingAddressObj) ||
    companyInfo.billingAddress ||
    "";
  const resolvedShippingAddress =
    salesOrder.shippingAddress ||
    salesOrder.shipping_address ||
    formatAddress(shippingAddressObj) ||
    companyInfo.shippingAddress ||
    "";
  const resolvedPhone =
    salesOrder.phoneNumber ||
    salesOrder.customerPhone ||
    salesOrder.customer_phone ||
    salesOrder.phone ||
    basic.customerPhone?.mobile ||
    basic.customerPhone?.workPhone ||
    basic.vendorPhone?.mobile ||
    basic.vendorPhone?.workPhone ||
    companyInfo.phone ||
    billingAddressObj?.phone ||
    shippingAddressObj?.phone ||
    customer?.keyContacts?.[0]?.contactNumber ||
    "";
  const resolvedEmail =
    salesOrder.customerEmail ||
    salesOrder.customer_email ||
    basic.customerEmail ||
    basic.vendorEmail ||
    basic.email ||
    customer?.keyContacts?.[0]?.email ||
    companyInfo.email ||
    "";
  const items = (salesOrder.items || []).map((it, idx) => {
    const { itemName: lineName, description: lineDesc } =
      resolveOrderLineItemAndDescription(it, idx);
    return {
      itemName: lineName,
      description: lineDesc,
      quantity: it.quantity ?? it.ordered_quantity ?? 0,
      unitPrice: it.rate ?? it.unitPrice ?? 0,
      total:
        it.amount ??
        it.total ??
        parseFloat(it.quantity || 0) * parseFloat(it.rate || 0),
      discount: it.discount || 0,
      tax: it.tax || 0,
      taxRate: it.taxRate || 0,
      taxName: it.taxName || "",
    };
  });
  const lineItemsSubtotal = items.reduce(
    (s, i) => s + (Number(i.total) || 0),
    0,
  );
  const discountAmount = toFiniteNumber(salesOrder.discount);
  const explicitDiscountPct = toFiniteNumber(salesOrder.discountPercentage);
  const grossSubtotal =
    lineItemsSubtotal || toFiniteNumber(salesOrder.subtotal) || 0;
  const discountPercentage =
    explicitDiscountPct > 0 && explicitDiscountPct <= 100
      ? explicitDiscountPct
      : calculateOrderDiscountPercentage(grossSubtotal, discountAmount);
  return {
    invoice_number:
      salesOrder.purchaseOrderNumber || salesOrder.salesOrderNumber || "",
    invoiceDate:
      salesOrder.salesOrderDate || new Date().toISOString().slice(0, 10),
    dueDate: salesOrder.dueDate || salesOrder.salesOrderDate || "",
    currency: salesOrder.currency || salesOrder.customerCurrency || "USD",
    customer_name:
      salesOrder.customer_name ||
      basic.vendorDisplayName ||
      basic.customerDisplayName ||
      basic.companyName ||
      "Customer",
    customer_id: customer,
    customer: customer,
    billingAddress: resolvedBillingAddress,
    shippingAddress: resolvedShippingAddress,
    items,
    subtotal: grossSubtotal,
    total: salesOrder.total ?? salesOrder.grandTotal ?? 0,
    discountAmount,
    discountPercentage,
    shippingCharges: salesOrder.shippingCharges || 0,
    adjustment: salesOrder.adjustment || 0,
    termsAndConditions: salesOrder.termsAndConditions || "",
    terms: salesOrder.terms || "Due on Receipt",
    customerNotes: salesOrder.customerNotes || "",
    phoneNumber: resolvedPhone,
    customerPhone: resolvedPhone,
    customer_phone: resolvedPhone,
    customerEmail: resolvedEmail,
    customer_email: resolvedEmail,
  };
}

export function mapInvoiceToUnifiedInvoiceContract(
  invoiceData,
  business,
  options = {},
) {
  const safeStr = (v) => (v === undefined || v === null ? "" : String(v));
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const currency = safeStr(
    invoiceData?.currency || invoiceData?.baseCurrency || "RM",
  );

  const branding = resolveDocumentCompanyBranding(business);
  const businessLogo = safeStr(branding.businessLogo);
  const businessName = safeStr(branding.businessName);
  const businessAddress = safeStr(branding.businessAddress);
  const businessPhone = safeStr(branding.businessPhone);
  const businessEmail = safeStr(branding.businessEmail);

  const invoice_number = safeStr(
    invoiceData?.invoiceNumber || invoiceData?.invoice_number || "",
  );
  const date = formatDate(
    normalizeInvoiceDateToYmd(
      invoiceData?.invoiceDate ?? invoiceData?.invoice_date,
    ) || invoiceData?.invoiceDate || invoiceData?.invoice_date,
  );
  const dueDate = formatDate(
    normalizeInvoiceDateToYmd(
      invoiceData?.dueDate ?? invoiceData?.due_date,
    ) || invoiceData?.dueDate || invoiceData?.due_date,
  );
  const salesType = safeStr(invoiceData?.salesType || "CREDIT");
  const salesPerson = safeStr(invoiceData?.salesPerson || "");

  let buyerName = "";
  if (invoiceData?.customer_name) {
    buyerName = safeStr(invoiceData.customer_name);
  } else if (invoiceData?.customer) {
    if (typeof invoiceData.customer === "object") {
      buyerName = safeStr(
        invoiceData.customer.basicInformation?.customerDisplayName ||
          invoiceData.customer.basicInformation?.customerName ||
          invoiceData.customer.basicInformation?.companyName ||
          invoiceData.customer.name ||
          "",
      );
    } else {
      buyerName = safeStr(invoiceData.customer);
    }
  }
  buyerName = buyerName || "Customer";

  const customerObj =
    invoiceData?.customer_id && typeof invoiceData.customer_id === "object"
      ? invoiceData.customer_id
      : invoiceData?.customer && typeof invoiceData.customer === "object"
        ? invoiceData.customer
        : null;
  const customerBasic = customerObj?.basicInformation || {};
  const customerCompanyInfo = customerObj?.companyInfo || {};
  const customerPhoneObj = customerBasic?.customerPhone || {};
  const customerAddresses = Array.isArray(customerObj?.addresses)
    ? customerObj.addresses
    : [];
  const billingAddr = customerAddresses.find(
    (a) => (a.addressType || "").toLowerCase() === "billing",
  );
  const shippingAddr =
    customerAddresses.find(
      (a) => (a.addressType || "").toLowerCase() === "shipping",
    ) || customerAddresses[0];

  const buyerCompany = safeStr(
    invoiceData?.customerCompany ||
      invoiceData?.companyName ||
      customerBasic?.companyName ||
      customerCompanyInfo?.companyName ||
      customerBasic?.customerDisplayName ||
      buyerName,
  );
  const buyerAddress = safeStr(invoiceData?.billingAddress || "");
  const buyerPhone = safeStr(
    invoiceData?.phoneNumber ||
      invoiceData?.customerPhone ||
      invoiceData?.customer_phone ||
      invoiceData?.phone ||
      customerPhoneObj?.mobile ||
      customerPhoneObj?.workPhone ||
      customerBasic?.phone ||
      customerCompanyInfo?.phone ||
      billingAddr?.phone ||
      shippingAddr?.phone ||
      customerAddresses[0]?.phone ||
      customerObj?.keyContacts?.[0]?.contactNumber ||
      "",
  );
  const buyerEmail = safeStr(
    invoiceData?.customerEmail ||
      invoiceData?.customer_email ||
      invoiceData?.email?.to ||
      customerBasic?.customerEmail ||
      customerBasic?.email ||
      customerObj?.keyContacts?.[0]?.email ||
      customerCompanyInfo?.email ||
      "",
  );

  const shipToName = safeStr(invoiceData?.shipToName || buyerName);
  const shipToCompany = safeStr(invoiceData?.shipToCompany || buyerCompany);
  const shipToAddress = safeStr(invoiceData?.shippingAddress || buyerAddress);
  const shipToPhone = safeStr(
    invoiceData?.shipToPhone ||
      invoiceData?.ship_to_phone ||
      shippingAddr?.phone ||
      buyerPhone,
  );
  const shipToEmail = safeStr(
    invoiceData?.shipToEmail || invoiceData?.ship_to_email || buyerEmail,
  );

  const items = Array.isArray(invoiceData?.items)
    ? invoiceData.items.map((it, idx) => {
        const quantity = toNum(it.quantity || it.qty);
        const price = toNum(it.rate || it.unitPrice || it.price);
        const discountPercent = toNum(it.discount ?? it.discountPercent ?? 0);
        const lineSubtotal = Math.max(
          0,
          quantity *
            price *
            (1 - Math.min(100, Math.max(0, discountPercent)) / 100),
        );
        const taxRate = toNum(it.taxRate ?? 0);
        const taxAmountFromApi = toNum(it.taxAmount ?? it.tax ?? 0);
        const tax =
          taxAmountFromApi || (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
        const computedLineTotal = Math.max(0, lineSubtotal + tax);
        const providedTotal = toNum(
          it.amount ?? it.total ?? it.totalValue ?? 0,
        );
        const tol = 0.01;
        const total =
          providedTotal > 0
            ? Math.abs(providedTotal - computedLineTotal) < tol
              ? providedTotal
              : Math.abs(providedTotal - lineSubtotal) < tol && tax > 0
                ? providedTotal + tax
                : computedLineTotal
            : computedLineTotal;
        const { itemName: linePrimary, description: lineSecondary } =
          resolveOrderLineItemAndDescription(it, idx);
        const mainName = safeStr(linePrimary);
        const subDesc = safeStr(lineSecondary);
        return {
          item: mainName,
          name: mainName,
          description: subDesc,
          subDescription: safeStr(
            subDesc || it.subDescription || it.sub_description || "",
          ),
          servicePeriod: safeStr(it.servicePeriod || it.service_period || ""),
          quantity,
          price,
          unitPrice: price,
          rate: price,
          discount: discountPercent,
          discountPercent,
          tax,
          taxRate,
          taxName: safeStr(it.taxName || it.tax_label || it.taxLabel || ""),
          invoiceDiscountColumnDisplay: formatInvoiceLineDiscountColumnDisplay({
            discount: discountPercent,
          }),
          invoiceTaxColumnDisplay: formatInvoiceLineTaxColumnDisplay({
            tax,
            taxRate,
            taxName: safeStr(it.taxName || it.tax_label || it.taxLabel || ""),
          }),
          total,
        };
      })
    : [];

  const itemsWithPoTaxDisplay =
    options.purchaseOrderEmailTaxColumn && items.length
      ? items.map((it) => ({
          ...it,
          poTaxColumnDisplay: formatPurchaseOrderLineTaxColumnDisplay(
            it,
            currency,
          ),
        }))
      : items;

  const providedSubtotal =
    toNum(invoiceData?.subTotal) || toNum(invoiceData?.subtotal);
  const subtotal =
    providedSubtotal ||
    itemsWithPoTaxDisplay.reduce((s, it) => s + toNum(it.total), 0);
  const discountTotal = toNum(
    invoiceData?.discountAmount ?? invoiceData?.discount ?? 0,
  );
  const summaryDiscountPercentage =
    toNum(
      invoiceData?.discountPercentage ?? invoiceData?.summaryDiscountPercentage,
    ) ||
    (() => {
      const d = toNum(invoiceData?.discount);
      return d > 0 && d <= 100 ? d : 0;
    })() ||
    calculateOrderDiscountPercentage(subtotal, discountTotal);
  const shippingCharges = toNum(invoiceData?.shippingCharges ?? 0);
  const calculatedItemTax = itemsWithPoTaxDisplay.reduce(
    (s, it) => s + toNum(it.tax),
    0,
  );
  const taxTotal =
    toNum(invoiceData?.taxTotal ?? invoiceData?.tax ?? 0) || calculatedItemTax;
  const adjustment = toNum(invoiceData?.adjustment ?? 0);
  const total =
    toNum(invoiceData?.total) ||
    toNum(invoiceData?.grandTotal) ||
    subtotal + shippingCharges + adjustment - discountTotal;
  const deposit = toNum(
    invoiceData?.deposit ?? invoiceData?.depositAmount ?? 0,
  );

  const totalInWords = numberToWords(total, currency || "USD");

  // Try to carry over any signature already present on the invoice
  const baseSignature = safeStr(
    invoiceData?.signature ||
      invoiceData?.customer_signature ||
      invoiceData?.accounts_signature ||
      invoiceData?.approver_signature ||
      "",
  );

  return {
    businessLogo,
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    invoice_number,
    date,
    dueDate,
    salesType,
    salesPerson,
    buyerName,
    buyerCompany,
    buyerAddress,
    buyerPhone,
    buyerEmail,
    customerPhone: buyerPhone,
    phoneNumber: buyerPhone,
    customerEmail: buyerEmail,
    shipToName,
    shipToCompany,
    shipToAddress,
    shipToPhone,
    shipToEmail,
    currency,
    items: itemsWithPoTaxDisplay,
    subtotal,
    discount: discountTotal,
    discountAmount: discountTotal,
    discountPercentage: summaryDiscountPercentage,
    summaryDiscountPercentage,
    summaryDiscountDisplay: formatSummaryDiscountDisplay(
      summaryDiscountPercentage,
    ),
    shippingCharges,
    tax: taxTotal,
    taxTotal,
    adjustment,
    total,
    deposit,
    totalInWords,
    ref: invoice_number,
    notes: invoiceData?.customerNotes || invoiceData?.notes || "",
    termsAndConditions: invoiceData?.termsAndConditions || "",
    terms: invoiceData?.terms || invoiceData?.paymentTerms || "Due on Receipt",
    paymentTerms:
      invoiceData?.terms || invoiceData?.paymentTerms || "Due on Receipt",
    paymentInfo: invoiceData?.paymentInfo || invoiceData?.bankDetails || "",
    billingAddress: buyerAddress,
    signature: baseSignature,
    authorizedSignature: baseSignature,
    approver_signature: baseSignature,
  };
}

/** Format a date for sale order / quotation PDF templates using global Configuration. */
function formatSaleOrderDate(value) {
  if (!value) return "";
  const formatted = formatDate(value);
  return formatted === value && value ? String(value) : formatted || "";
}

/**
 * Map sales order data to the shape expected by `saleorder` document templates.
 * The sale order EJS template reads `saleorder.*` (not `contract.*`).
 */
export function mapToSaleOrderTemplateData(invoiceData = {}, business = {}) {
  const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const safe = (v) => (v === undefined || v === null ? "" : String(v));

  const rawItems = Array.isArray(invoiceData.items) ? invoiceData.items : [];
  const items = rawItems.map((item, idx) => {
    const quantity = toNum(item.quantity ?? item.qty ?? item.ordered_quantity);
    const rate = toNum(item.rate ?? item.unitPrice ?? item.price);
    const discountPct = toNum(item.discount ?? 0);
    const taxAmount = toNum(item.tax ?? item.taxAmount);
    const baseLine = quantity * rate;
    const afterDiscount = Math.max(
      0,
      baseLine - (baseLine * discountPct) / 100,
    );
    const computedAmount = afterDiscount + taxAmount;
    const amount =
      toNum(item.amount) ||
      toNum(item.total) ||
      toNum(item.totalValue) ||
      computedAmount;
    const { itemName, description } = resolveOrderLineItemAndDescription(
      item,
      idx,
    );
    const primary =
      itemName || safe(item.itemName) || safe(item.name) || safe(item.title);
    const secondary = description || safe(item.description);
    return {
      item: primary || `Item ${idx + 1}`,
      itemName: primary || `Item ${idx + 1}`,
      description: secondary,
      name: primary || `Item ${idx + 1}`,
      quantity,
      rate,
      amount,
      tax: taxAmount,
      taxRate: toNum(item.taxRate),
      taxName: safe(item.taxName),
      discount: discountPct,
    };
  });

  /** Sum of line Amount column (tax-inclusive); subtotal and header discount base. */
  const lineAmountSum = items.reduce((s, it) => s + toNum(it.amount), 0);
  const apiSubTotal =
    toNum(invoiceData.subTotal) || toNum(invoiceData.subtotal);
  const subTotal = lineAmountSum > 0.00001 ? lineAmountSum : apiSubTotal;
  const discountAmount = toNum(
    invoiceData.discountAmount ?? invoiceData.discount,
  );
  let discountPercentage = toNum(invoiceData.discountPercentage);
  if (
    discountAmount > 0 &&
    subTotal > 0.00001 &&
    discountPercentage <= 0
  ) {
    discountPercentage = (discountAmount / subTotal) * 100;
  }
  /** Legacy template key: document-level discount as a currency amount (not %). */
  const discount = discountAmount;
  const shippingCharges = toNum(invoiceData.shippingCharges);
  const adjustment = toNum(invoiceData.adjustment);
  const taxTotal =
    toNum(invoiceData.taxTotal ?? invoiceData.tax) ||
    items.reduce((s, it) => s + toNum(it.tax), 0);
  const total =
    toNum(invoiceData.total) ||
    toNum(invoiceData.grandTotal) ||
    Math.max(
      0,
      subTotal - discountAmount + shippingCharges + adjustment,
    );

  const taxes = [];
  if (taxTotal > 0) {
    taxes.push({ name: "Tax", amount: taxTotal });
  }

  const customer = invoiceData.customer || invoiceData.customer_id || {};
  const basic = customer?.basicInformation || {};
  const company = customer?.companyInfo || {};

  const customerName =
    safe(invoiceData.customer_name) ||
    safe(invoiceData.customerName) ||
    safe(basic.companyName) ||
    safe(basic.customerDisplayName) ||
    safe(basic.customerName) ||
    safe(customer?.name) ||
    "";

  const customerAddress =
    safe(invoiceData.billingAddress) ||
    safe(invoiceData.customer_address) ||
    safe(company.billingAddress) ||
    "";

  const orderDocNumber =
    safe(invoiceData.salesOrderNumber) ||
    safe(invoiceData.sales_order_number) ||
    safe(invoiceData.orderNumber) ||
    safe(invoiceData.order_number) ||
    safe(invoiceData.soNumber) ||
    safe(invoiceData.invoiceNumber) ||
    safe(invoiceData.invoice_number) ||
    "";

  const moduleDisplayName =
    safe(invoiceData.moduleDisplayName) ||
    getModuleLabel("saleOrder", "Sale Order");

  const branding = resolveDocumentCompanyBranding(business);

  return {
    moduleDisplayName,
    companyLogo:
      safe(branding.companyLogo) || safe(invoiceData.businessLogo) || "",
    companyName:
      safe(branding.companyName) || safe(invoiceData.businessName) || "",
    companyAddress:
      safe(branding.companyAddress) ||
      safe(invoiceData.businessAddress) ||
      "",
    companyPhone: safe(branding.companyPhone),
    companyEmail: safe(branding.companyEmail),
    orderNumber: orderDocNumber,
    salesOrderNumber: orderDocNumber,
    /** Invoice-style keys for SO templates copied from invoice layouts */
    invoice_number: orderDocNumber,
    invoiceNumber: orderDocNumber,
    orderDate: formatSaleOrderDate(
      invoiceData.salesOrderDate ||
        invoiceData.invoiceDate ||
        invoiceData.invoice_date ||
        invoiceData.date,
    ),
    expectedShipDate: formatSaleOrderDate(
      invoiceData.expectedShipmentDate ||
        invoiceData.dueDate ||
        invoiceData.due_date,
    ),
    referenceNumber:
      safe(invoiceData.referenceNumber) ||
      safe(invoiceData.reference_number) ||
      "",
    paymentTerms:
      safe(invoiceData.terms) || safe(invoiceData.paymentTerms) || "",
    salesPerson:
      safe(invoiceData.salesPerson) ||
      safe(invoiceData.salesperson) ||
      safe(invoiceData.salesPersonName) ||
      "",
    customerName,
    customerCompany: safe(company.companyName) || safe(basic.companyName) || "",
    customerAddress,
    shippingAddress:
      safe(invoiceData.shippingAddress) ||
      safe(company.shippingAddress) ||
      customerAddress,
    customerPhone:
      safe(invoiceData.customerPhone) ||
      safe(invoiceData.customer_phone) ||
      safe(invoiceData.phoneNumber) ||
      safe(invoiceData.phone) ||
      safe(basic.customerPhone?.mobile) ||
      "",
    customerEmail:
      safe(invoiceData.customerEmail) ||
      safe(invoiceData.customer_email) ||
      safe(basic.customerEmail) ||
      "",
    items,
    subTotal,
    taxes,
    taxTotal,
    discount,
    discountAmount,
    discountPercentage,
    shippingCharges,
    adjustment,
    total,
    currencyCode: safe(invoiceData.currency) || "USD",
    notes: safe(invoiceData.customerNotes) || safe(invoiceData.notes) || "",
    termsAndConditions: safe(invoiceData.termsAndConditions) || "",
  };
}

/**
 * Map quotation data to the EJS shape expected by `quotation` document templates
 * (template reads `quotation.*` — companyName, customerName, items, totals, etc.).
 */
export function mapToQuotationTemplateData(quotation = {}, business = {}) {
  const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const safe = (v) => (v === undefined || v === null ? "" : String(v));

  const rawItems = Array.isArray(quotation.items) ? quotation.items : [];
  const items = rawItems.map((item, idx) => {
    const quantity = toNum(item.quantity ?? item.qty);
    const rate = toNum(item.rate ?? item.unitPrice ?? item.price);
    const discountPct = toNum(item.discount ?? 0);
    const taxAmount = toNum(item.tax ?? item.taxAmount);
    const baseLine = quantity * rate;
    const afterDiscount = Math.max(
      0,
      baseLine - (baseLine * discountPct) / 100,
    );
    const computedAmount = afterDiscount + taxAmount;
    const amount =
      toNum(item.amount) ||
      toNum(item.totalValue) ||
      toNum(item.total) ||
      computedAmount;
    const { itemName, description } = resolveOrderLineItemAndDescription(
      item,
      idx,
    );
    const primary =
      itemName || safe(item.title) || safe(item.itemName) || safe(item.name);
    const secondary = description || safe(item.description);
    return {
      item: primary || `Item ${idx + 1}`,
      itemName: primary || `Item ${idx + 1}`,
      description: secondary,
      name: primary || `Item ${idx + 1}`,
      quantity,
      rate,
      amount,
      tax: taxAmount,
      taxRate: toNum(item.taxRate),
      taxName: safe(item.taxName),
      discount: discountPct,
    };
  });

  const computedLineNetSubtotal = items.reduce(
    (s, it) =>
      s +
      Math.max(
        0,
        toNum(it.quantity) * toNum(it.rate) -
          (toNum(it.quantity) * toNum(it.rate) * toNum(it.discount)) / 100,
      ),
    0,
  );
  /** Sum of line Amount column (typically tax-inclusive); shown as Sub Total in templates. */
  const lineAmountSum = items.reduce((s, it) => s + toNum(it.amount), 0);
  const apiSubTotal = toNum(quotation.subTotal ?? quotation.subtotal);
  const subTotal = lineAmountSum > 0.00001 ? lineAmountSum : apiSubTotal;

  /** Model: `discount` = order-level %, `discountAmount` = currency (if set). */
  const orderDiscountPctRaw = toNum(quotation.discount);
  let orderDiscountAmt = toNum(quotation.discountAmount);
  if (
    orderDiscountAmt <= 0 &&
    orderDiscountPctRaw > 0 &&
    computedLineNetSubtotal > 0
  ) {
    orderDiscountAmt = (computedLineNetSubtotal * orderDiscountPctRaw) / 100;
  }
  let discountPercentage = orderDiscountPctRaw > 0 ? orderDiscountPctRaw : 0;
  if (
    orderDiscountAmt > 0 &&
    computedLineNetSubtotal > 0.00001 &&
    discountPercentage <= 0
  ) {
    discountPercentage = (orderDiscountAmt / computedLineNetSubtotal) * 100;
  }
  const discountAmount = orderDiscountAmt;
  /** Legacy: templates that still read `quotation.discount` as an amount. */
  const discount = discountAmount;
  const shippingCharges = toNum(quotation.shippingCharges);
  const adjustment = toNum(quotation.adjustment);
  const taxTotal =
    toNum(quotation.taxTotal ?? quotation.tax) ||
    items.reduce((s, it) => s + toNum(it.tax), 0);
  const total =
    toNum(quotation.grandTotal) ||
    toNum(quotation.total) ||
    Math.max(
      0,
      lineAmountSum > 0.00001
        ? lineAmountSum - discountAmount + shippingCharges + adjustment
        : computedLineNetSubtotal -
            discountAmount +
            shippingCharges +
            adjustment +
            taxTotal,
    );

  const taxes = [];
  if (taxTotal > 0) {
    taxes.push({ name: "Tax", amount: taxTotal });
  }

  const customer = quotation.customer_id || quotation.customer || {};
  const basic = customer?.basicInformation || {};
  const company = customer?.companyInfo || {};

  const customerName =
    safe(quotation.customer_name) ||
    safe(quotation.customerName) ||
    safe(basic.companyName) ||
    safe(basic.customerDisplayName) ||
    safe(basic.customerName) ||
    safe(customer?.name) ||
    "";

  const customerAddress =
    safe(quotation.billingAddress) ||
    safe(quotation.customer_address) ||
    safe(company.billingAddress) ||
    "";

  const quoteNum =
    safe(quotation.quote_number) ||
    safe(quotation.quoteNumber) ||
    safe(quotation.invoice_number) ||
    "";

  const branding = resolveDocumentCompanyBranding(business);

  return {
    companyLogo: safe(branding.companyLogo),
    companyName: safe(branding.companyName),
    companyAddress: safe(branding.companyAddress),
    companyPhone: safe(branding.companyPhone),
    companyEmail: safe(branding.companyEmail),
    quoteNumber: quoteNum,
    /** Aliases for invoice-style EJS snippets copied into quotation templates */
    invoice_number: quoteNum,
    invoiceNumber: quoteNum,
    number: quoteNum,
    ref: quoteNum,
    quoteDate: formatSaleOrderDate(
      quotation.quote_date || quotation.quoteDate || quotation.date,
    ),
    expiryDate: formatSaleOrderDate(
      quotation.expiry_date || quotation.expiryDate || quotation.dueDate,
    ),
    duration: safe(quotation.duration) || safe(quotation.validity) || "",
    customerName,
    customerCompany: safe(company.companyName) || safe(basic.companyName) || "",
    customerAddress,
    shippingAddress:
      safe(quotation.shippingAddress) ||
      safe(company.shippingAddress) ||
      customerAddress,
    customerEmail:
      safe(quotation.customer_email) ||
      safe(quotation.customerEmail) ||
      safe(basic.customerEmail) ||
      "",
    customerPhone:
      safe(quotation.customerPhone) ||
      safe(basic.customerPhone?.mobile) ||
      safe(basic.customerPhone?.workPhone) ||
      "",
    subject: safe(quotation.subject) || "",
    salesPerson:
      safe(quotation.salesPerson) ||
      safe(quotation.salesperson) ||
      safe(quotation.salesPersonName) ||
      "",
    items,
    subTotal,
    taxes,
    taxTotal,
    discount,
    discountAmount,
    discountPercentage,
    shippingCharges,
    adjustment,
    total,
    currencyCode: resolveQuotationCurrencyCode(quotation.currency, business),
    notes: safe(quotation.customerNotes) || safe(quotation.notes) || "",
    termsAndConditions: safe(quotation.termsAndConditions) || "",
  };
}

/**
 * Convert a full HTML document string from a saved EJS template into something
 * embeddable inside React via dangerouslySetInnerHTML, while preserving the
 * template's intended visual layout (A4-page styling, body padding, fonts).
 *
 * - Extracts `<style>` blocks and rewrites `body` selectors to target the wrapper class
 *   so template body styles apply within an isolated container (not the host app body).
 * - Returns just the inner content of `<body>` (so we can wrap it ourselves).
 *
 * If the input is not a full document, returns the input as-is.
 */
export function scopeTemplateHtmlForEmbed(fullHtml, wrapperClass) {
  if (!fullHtml || typeof fullHtml !== "string")
    return { styles: "", body: "" };
  const cls = String(wrapperClass || "tpl-doc-body").trim();
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styles = [];
  let match;
  while ((match = styleRegex.exec(fullHtml)) !== null) {
    let css = match[1] || "";
    css = css.replace(/(^|[\s,{}])body(\s*[\s,{>])/g, (m, pre, post) => {
      return `${pre}.${cls}${post}`;
    });
    css = css.replace(/(^|[\s,{}])body\s*{/g, (m, pre) => `${pre}.${cls} {`);
    styles.push(css);
  }
  let body = fullHtml;
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(fullHtml);
  if (bodyMatch) body = bodyMatch[1];
  else body = fullHtml.replace(styleRegex, "");
  return { styles: styles.join("\n"), body };
}
