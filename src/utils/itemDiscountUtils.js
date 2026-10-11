/**
 * Item-level discount utilities.
 * Discount is stored and input as percentage (0–100%).
 *
 * Formula:
 *   discounted_price = unit_price * quantity * (1 - discount_percent / 100)
 *   tax_amount = discounted_price * tax_percent / 100
 *   item_total = discounted_price + tax_amount
 */

/**
 * Calculate line subtotal (after item-level discount, before tax).
 * @param {number} quantity
 * @param {number} unitPrice
 * @param {number} discountPercent - 0–100
 * @returns {number}
 */
export function getLineSubtotal(quantity, unitPrice, discountPercent) {
  const q = parseFloat(quantity) || 0;
  const p = parseFloat(unitPrice) || 0;
  const d = Math.min(100, Math.max(0, parseFloat(discountPercent) || 0));
  return Math.max(0, q * p * (1 - d / 100));
}

/**
 * Calculate tax amount on discounted line subtotal.
 * @param {number} lineSubtotal
 * @param {number} taxRatePercent
 * @returns {number}
 */
export function getLineTaxAmount(lineSubtotal, taxRatePercent) {
  const sub = parseFloat(lineSubtotal) || 0;
  const rate = parseFloat(taxRatePercent) || 0;
  return (sub * rate) / 100;
}

/**
 * Calculate full item total: discounted subtotal + tax.
 * @param {number} quantity
 * @param {number} unitPrice
 * @param {number} discountPercent - 0–100
 * @param {number} taxRatePercent
 * @returns {number}
 */
export function getItemTotal(quantity, unitPrice, discountPercent, taxRatePercent) {
  const lineSubtotal = getLineSubtotal(quantity, unitPrice, discountPercent);
  const taxAmount = getLineTaxAmount(lineSubtotal, taxRatePercent);
  return Math.max(0, lineSubtotal + taxAmount);
}

const LINE_TOTAL_TOLERANCE = 0.01;

/**
 * Discounted line base (qty × unit price − line discount %) using common API field aliases.
 * Zoho/import payloads may use `qty` / `rate` instead of `quantity` / `unitPrice`.
 */
export function lineDiscountedSubtotalFromItem(item = {}) {
  return getLineSubtotal(
    item?.quantity ?? item?.qty ?? 0,
    item?.unitPrice ?? item?.rate ?? item?.price ?? 0,
    item?.discount,
  );
}

/**
 * Line discount %, taxable base, tax amount, and tax-inclusive total (InvoiceRenderer rules).
 */
export function resolveFlexaLineBillingBreakdown(item = {}) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 0);
  const unitPrice = Number(item?.unitPrice ?? item?.rate ?? item?.price ?? 0);
  const discountPercent = Number(item?.discount ?? 0);
  const lineSubtotal = getLineSubtotal(quantity, unitPrice, discountPercent);
  const taxRate = Number(item?.taxRate ?? 0);
  const taxAmountFromApi = Number(item?.taxAmount ?? item?.tax ?? 0);
  const tax =
    taxAmountFromApi ||
    (taxRate ? (lineSubtotal * taxRate) / 100 : 0);

  const computedLineTotal = Math.max(0, lineSubtotal + tax);
  const providedTotal = Number(
    item?.amount ?? item?.total ?? item?.totalValue ?? 0,
  );

  let total = computedLineTotal;
  if (providedTotal > 0) {
    if (
      Math.abs(providedTotal - computedLineTotal) < LINE_TOTAL_TOLERANCE
    ) {
      total = providedTotal;
    } else if (
      Math.abs(providedTotal - lineSubtotal) < LINE_TOTAL_TOLERANCE &&
      tax > 0
    ) {
      total = providedTotal + tax;
    }
  }

  return {
    quantity,
    unitPrice,
    discountPercent,
    taxRate,
    lineSubtotal,
    tax,
    total,
  };
}

/**
 * One tax-inclusive line total matching {@link InvoiceRenderer} and PCI-BE/invoice-summary.md.
 * Handles Zoho/sync rows where `totalValue` holds **pre-tax** net while `tax` carries line VAT —
 * UI rows then show net + tax, but naïvely summing `totalValue` would drop tax from Subtotal.
 */
export function resolveFlexaLineBillingTotal(item = {}) {
  return resolveFlexaLineBillingBreakdown(item).total;
}

/**
 * Sum of line tax for invoice/credit-note summary (after line discount, before document discount).
 * Matches {@link InvoiceSummaryPanel} breakdown alongside gross line subtotals.
 */
export function sumLineTaxAmountsFromItems(items = []) {
  return items.reduce((sum, item) => {
    const explicitTax = Number(item?.taxAmount ?? item?.tax);
    if (Number.isFinite(explicitTax) && explicitTax >= 0) {
      return sum + explicitTax;
    }
    const lineSubtotal = lineDiscountedSubtotalFromItem(item);
    return sum + getLineTaxAmount(lineSubtotal, item?.taxRate);
  }, 0);
}

/**
 * Sum of line totals (qty × price after line discount + line tax).
 * Matches invoice UI "Subtotal" where tax is embedded per line.
 */
export function sumLineGrossFromItems(items = []) {
  return items.reduce(
    (sum, item) => sum + resolveFlexaLineBillingTotal(item),
    0,
  );
}

/** Grand total from header fields when subtotal already includes line tax. */
export function computeInvoiceTotalFromHeader({
  subtotal = 0,
  discountAmount = 0,
  shippingCharges = 0,
  adjustment = 0,
} = {}) {
  return Math.max(
    0,
    (Number(subtotal) || 0) -
      (Number(discountAmount) || 0) +
      (Number(shippingCharges) || 0) +
      (Number(adjustment) || 0),
  );
}

/**
 * Clamp discount to 0–100 (percentage).
 * @param {number} value
 * @returns {number}
 */
export function clampDiscountPercent(value) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * Currency rounding for invoicing / API payloads (e.g. 2 decimal MYR).
 */
export function roundMoney(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const f = 10 ** decimals;
  return Math.round((num + Number.EPSILON) * f) / f;
}
