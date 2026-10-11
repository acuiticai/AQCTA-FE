/**
 * Fleet job / schedule line-item display helpers.
 * Mirrors work order PDF logic so scheduling sidebars stay consistent with SO-sourced rows.
 */

/** Per-line unit rate (`rate` / `unitPrice`, or inferred from amount, qty, discount %). */
export function fleetJobLineUnitRate(r) {
  const rate = Number(r?.rate);
  if (Number.isFinite(rate) && rate !== 0) return rate;
  const up = Number(r?.unitPrice);
  if (Number.isFinite(up)) return up;
  const qty = Math.max(0.0001, Number(r?.quantity) || 1);
  const amt = Number(r?.amount ?? r?.total) || 0;
  const discPct = Math.min(100, Math.max(0, Number(r?.discount) || 0));
  const preDisc = amt / (1 - discPct / 100 || 1);
  return preDisc / qty;
}

/** Primary cell label — avoids repeating the same SO description in two columns. */
export function fleetJobLineItemLabel(r) {
  const name = String(r?.itemName || "").trim();
  const desc = String(r?.description || r?.itemDescription || "").trim();
  if (name) return name;
  return desc || "—";
}

/** Details column text only when distinct from primary label (keeps Details empty if duplicate). */
export function fleetJobLineSecondaryDescriptionOnly(r) {
  const name = String(r?.itemName || "").trim();
  const desc = String(r?.description || r?.itemDescription || "").trim();
  if (!desc || desc === name) return "";
  return desc;
}

/**
 * Secondary line under the item (different description text, discount %, tax).
 * @param {(n: number) => string} formatMoney — e.g. Intl-formatted currency
 */
export function fleetJobLineItemDetailSubtitle(r, formatMoney = (n) => String(n)) {
  const name = String(r?.itemName || "").trim();
  const desc = String(r?.description || r?.itemDescription || "").trim();
  const bits = [];
  if (desc && desc !== name) bits.push(desc);

  const d = Number(r?.discount);
  if (d > 0) bits.push(`Disc ${d}%`);

  const taxAmt = Number(r?.tax) || 0;
  const tr = Number(r?.taxRate) || 0;
  const tn = String(r?.taxName || "").trim();
  if (taxAmt > 0) {
    const prefix = tn ? `${tn}: ` : "Tax: ";
    bits.push(prefix + formatMoney(taxAmt));
  } else if (tr > 0) {
    bits.push(tn ? `${tn} ${tr}%` : `Tax ${tr}%`);
  }

  return bits.length ? bits.join(" · ") : "";
}

/**
 * Roll-up for schedule UI / PDF: subtotal (ex tax), discount (money), tax, grand.
 * @param {object|null} job
 * @param {object[]|undefined} lineItems
 */
export function computeFleetJobLineSummary(job, lineItems) {
  const rows = Array.isArray(lineItems) ? lineItems : [];
  if (!rows.length) {
    const grand = Number(job?.totalAmount ?? job?.grandTotal) || 0;
    const taxTotal =
      Number(job?.totalTax ?? job?.taxTotal ?? job?.taxAmount ?? job?.gstAmount) || 0;
    const discountTotal =
      Number(
        job?.totalDiscount ?? job?.discountTotal ?? job?.orderDiscount ?? job?.invoiceDiscount,
      ) || 0;
    const subtotalExTax = Math.max(0, grand - taxTotal);
    return { subtotalExTax, discountTotal, taxTotal, grand };
  }

  let lineSumAmount = 0;
  let lineSumTax = 0;
  let sumDiscountMoney = 0;

  rows.forEach((r) => {
    const qty = Number(r.quantity) || 0;
    const rate = fleetJobLineUnitRate(r);
    const discPct = Math.min(100, Math.max(0, Number(r.discount) || 0));
    const tax = Number(r.tax) || 0;
    const amt = Number(r.amount ?? r.total) || 0;
    sumDiscountMoney += (qty * rate * discPct) / 100;
    lineSumAmount += amt;
    lineSumTax += tax;
  });

  const jobGrand = Number(job?.totalAmount ?? job?.grandTotal);
  const jobTax = Number(
    job?.totalTax ?? job?.taxTotal ?? job?.taxAmount ?? job?.gstAmount,
  );
  const jobDiscount = Number(
    job?.totalDiscount ??
      job?.discountTotal ??
      job?.orderDiscount ??
      job?.invoiceDiscount,
  );

  const grand = Number.isFinite(jobGrand) && jobGrand > 0 ? jobGrand : lineSumAmount;
  const taxTotal = Number.isFinite(jobTax) && jobTax > 0 ? jobTax : lineSumTax;
  const discountTotal =
    Number.isFinite(jobDiscount) && jobDiscount > 0 ? jobDiscount : sumDiscountMoney;
  const subtotalExTax = Math.max(0, grand - taxTotal);

  return {
    subtotalExTax,
    discountTotal,
    taxTotal,
    grand,
  };
}
