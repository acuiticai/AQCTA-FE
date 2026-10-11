/**
 * Central dynamic-placeholder resolution for invoice render surfaces.
 *
 * Single source of truth used by every screen that turns a stored invoice /
 * recurring-profile template into rendered output — viewer (InvoiceRenderer),
 * PDF generation (DocumentGenerator), email preview (EmailPreview) and the
 * recurring next-run preview (recurringInvoiceTemplatePreview, ViewRecurringInvoice).
 *
 * Behaviour:
 *  - DB / Edit screens keep the raw `%(d)%`, `%(d)(m)(y+1)%` tokens.
 *  - Anything that renders the invoice for a human — page view, PDF, email,
 *    recurring preview — runs the contract through `resolveContractPlaceholders`
 *    so the tokens become real dates against the invoice's own reference date
 *    + the global Configuration date format.
 *
 * Callers should NOT inline their own placeholder options; use
 * `buildInvoicePlaceholderOptions` so context tokens (customer_name, currency,
 * invoice_number, business_name, grand_total) are derived consistently.
 */

import { parseDynamicPlaceholders } from "@/utils/dynamicPlaceholders";
import { config as globalConfiguration } from "@/hooks/useConfiguration";

/**
 * Contract fields rendered by EJS templates and our HTML post-processing
 * that may legitimately carry `%(...)%` tokens. Keep this list aligned with
 * the editor fields in CreateCustomerInvoice / CreateRecurringInvoice so any
 * new "user typed" string lights up across every render surface at once.
 */
export const INVOICE_CONTRACT_TEXT_KEYS = Object.freeze([
  "subject",
  "customerNotes",
  "notes",
  "termsAndConditions",
  "terms_and_conditions",
  "terms",
  "paymentTerms",
  "payment",
  "payment_info",
  "orderNumber",
  "buyerAddress",
  "billingAddress",
  "customerAddress",
  "shippingAddress",
  "shipToAddress",
  "shipping_address",
]);

/**
 * Per-line-item text fields rendered in the items table cells. Mirrors the
 * aliases templates / mappers emit (`item`, `name`, `title`, `itemName`, plus
 * description variants) so a placeholder anywhere on a line resolves.
 */
export const INVOICE_ITEM_TEXT_KEYS = Object.freeze([
  "item",
  "name",
  "title",
  "itemName",
  "description",
  "subDescription",
  "goods_description",
]);

/**
 * Pick the reference date for placeholder resolution from explicit option,
 * then the invoice's `invoice_date`, then the contract's date aliases,
 * finally today. Always returns a valid Date.
 */
export function resolvePlaceholderReferenceDate({
  referenceDate,
  invoice,
  contract,
} = {}) {
  const candidates = [
    referenceDate,
    invoice?.invoice_date,
    invoice?.invoiceDate,
    contract?.invoice_date,
    contract?.invoiceDate,
    contract?.date,
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (c instanceof Date) {
      if (!Number.isNaN(c.getTime())) return c;
      continue;
    }
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Build `parseDynamicPlaceholders` options that mirror what every render
 * surface uses: reference date, Configuration date format and context
 * tokens (customer_name, currency, grand_total/amount, invoice_number,
 * business_name).
 *
 * Pass `contextOverrides` for screens that need bespoke values — e.g. the
 * recurring next-run preview uses `invoice_number: "PREVIEW"` because the
 * spawned invoice doesn't exist yet.
 */
export function buildInvoicePlaceholderOptions({
  invoice,
  contract,
  business,
  referenceDate,
  dateFormat,
  contextOverrides,
} = {}) {
  const ref = resolvePlaceholderReferenceDate({
    referenceDate,
    invoice,
    contract,
  });
  const grand =
    contract?.total ??
    contract?.grandTotal ??
    invoice?.grandTotal ??
    invoice?.total;
  const baseContext = {
    customer_name:
      contract?.customerName ||
      contract?.buyerName ||
      invoice?.customer_name,
    currency: contract?.currency || invoice?.currency,
    grand_total: grand,
    amount: grand,
    invoice_number:
      contract?.invoice_number ||
      contract?.invoiceNumber ||
      invoice?.invoice_number,
    business_name:
      business?.name ||
      contract?.businessName ||
      invoice?.businessName,
  };
  return {
    referenceDate: ref,
    dateFormat: dateFormat || globalConfiguration.dateFormat,
    context: { ...baseContext, ...(contextOverrides || {}) },
  };
}

/**
 * Apply placeholder resolution to the user-typed text fields on a contract
 * object — header strings (subject, notes, terms, addresses, …) and every
 * per-line item label / description. Pure: returns a new object and a new
 * items array; never mutates the input.
 *
 * Pass either a pre-built `phOpts` (from `buildInvoicePlaceholderOptions`)
 * or `{ invoice, business, referenceDate, dateFormat, contextOverrides }`
 * and the helper will build options for you.
 */
export function resolveContractPlaceholders(contract, optionsOrContext = {}) {
  if (!contract || typeof contract !== "object") return contract;

  const phOpts =
    optionsOrContext &&
    typeof optionsOrContext === "object" &&
    optionsOrContext.referenceDate &&
    optionsOrContext.context
      ? optionsOrContext
      : buildInvoicePlaceholderOptions({ contract, ...optionsOrContext });

  const r = (v) =>
    typeof v === "string" ? parseDynamicPlaceholders(v, phOpts) : v;

  const next = { ...contract };
  for (const key of INVOICE_CONTRACT_TEXT_KEYS) {
    if (typeof next[key] === "string") next[key] = r(next[key]);
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map((it) => {
      if (!it || typeof it !== "object") return it;
      const out = { ...it };
      for (const key of INVOICE_ITEM_TEXT_KEYS) {
        if (typeof out[key] === "string") out[key] = r(out[key]);
      }
      return out;
    });
  }
  return next;
}

/**
 * In-place variant for the legacy DocumentGenerator path that mutates the
 * `contract` object it hands to EJS. Behaviourally identical to
 * `resolveContractPlaceholders` but writes back onto the passed contract so
 * existing downstream code that reads `contract.customerNotes` etc. keeps
 * working without restructuring the surrounding function.
 */
export function applyContractPlaceholdersInPlace(contract, optionsOrContext = {}) {
  if (!contract || typeof contract !== "object") return contract;
  const resolved = resolveContractPlaceholders(contract, optionsOrContext);
  for (const key of INVOICE_CONTRACT_TEXT_KEYS) {
    if (typeof resolved[key] === "string") contract[key] = resolved[key];
  }
  if (Array.isArray(resolved.items)) {
    contract.items = resolved.items;
  }
  return contract;
}

/**
 * Resolve `%(...)%` tokens against `parseDynamicPlaceholders` for individual
 * strings (subject lines, badges, single fields) using the same opts as the
 * contract resolver. Returns the input unchanged when not a string.
 */
export function resolveInvoicePlaceholderText(text, optionsOrContext = {}) {
  if (typeof text !== "string") return text;
  const phOpts =
    optionsOrContext &&
    typeof optionsOrContext === "object" &&
    optionsOrContext.referenceDate &&
    optionsOrContext.context
      ? optionsOrContext
      : buildInvoicePlaceholderOptions(optionsOrContext);
  return parseDynamicPlaceholders(text, phOpts);
}
