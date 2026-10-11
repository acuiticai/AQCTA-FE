import {
  getLineSubtotal,
  getLineTaxAmount,
} from "@/utils/itemDiscountUtils";

/** @typedef {{ lineNetExTax: number; taxAmount: number; lineTotal: number; quantity: number|null; unitRate: number|null; discountPct: number; taxRatePct: number; taxName: string }} CnDnLineFigures */

/**
 * Canonical view figures for stored credit/debit note line rows.
 * `amount` is stored net of line discount, before tax; `tax` is line tax currency when persisted.
 *
 * @param {Record<string, unknown>} item
 * @returns {CnDnLineFigures}
 */
export function resolveCnDnLineFigures(item) {
  const qtyRaw = item.quantity;
  const rateSrc = item.rate != null ? item.rate : item.unitPrice;
  const qty = qtyRaw !== undefined && qtyRaw !== null ? Number(qtyRaw) : NaN;
  const unitRate =
    rateSrc !== undefined && rateSrc !== null ? Number(rateSrc) : NaN;
  const discountPct =
    item.discount !== undefined &&
    item.discount !== null &&
    String(item.discount).trim() !== ""
      ? Number(item.discount) || 0
      : 0;
  const taxRatePct =
    item.taxRate !== undefined &&
    item.taxRate !== null &&
    String(item.taxRate).trim() !== ""
      ? Number(item.taxRate) || 0
      : 0;

  let lineNetExTax = 0;
  if (
    item.amount !== undefined &&
    item.amount !== null &&
    Number.isFinite(Number(item.amount))
  ) {
    lineNetExTax = Math.max(0, Number(item.amount));
  } else if (Number.isFinite(qty) && Number.isFinite(unitRate)) {
    lineNetExTax = getLineSubtotal(qty, unitRate, discountPct);
  }

  let taxAmount = 0;
  if (
    item.tax !== undefined &&
    item.tax !== null &&
    String(item.tax).trim() !== "" &&
    Number.isFinite(Number(item.tax))
  ) {
    taxAmount = Math.max(0, Number(item.tax));
  } else {
    taxAmount = getLineTaxAmount(lineNetExTax, taxRatePct);
  }

  const lineTotal = Math.max(0, lineNetExTax + taxAmount);

  const taxName =
    typeof item.taxName === "string" && item.taxName.trim() !== ""
      ? item.taxName.trim()
      : "";

  return {
    lineNetExTax,
    taxAmount,
    lineTotal,
    quantity: Number.isFinite(qty) ? qty : null,
    unitRate: Number.isFinite(unitRate) ? unitRate : null,
    discountPct,
    taxRatePct,
    taxName,
  };
}

/**
 * @param {unknown} items
 * @returns {{ totalNetExTax: number; totalTax: number; totalInclusive: number }}
 */
export function summarizeCnDnLines(items) {
  const list = Array.isArray(items) ? items : [];
  return list.reduce(
    (acc, row) => {
      const f = resolveCnDnLineFigures(row);
      acc.totalNetExTax += f.lineNetExTax;
      acc.totalTax += f.taxAmount;
      acc.totalInclusive += f.lineTotal;
      return acc;
    },
    { totalNetExTax: 0, totalTax: 0, totalInclusive: 0 }
  );
}

/**
 * Percent for table cells — missing values show em dash.
 * @param {unknown} pct
 */
export function formatLinePercentCell(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0) return "0%";
  return `${rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2)}%`;
}
