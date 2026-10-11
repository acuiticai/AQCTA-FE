import { calculateDueDate } from "@/utils/calculateDueDate";

function formatDateInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Build CreateCustomerInvoice prefill payload (same shape as sales order convert).
 * Uses today as invoice date and recalculates due date from terms (Zoho-style).
 *
 * @param {object} profile — GET /recurring-invoice/:id response `data`
 * @returns {object}
 */
export function buildRecurringInvoicePrefillPayload(profile) {
  const tpl = profile?.invoice_template || {};
  const bid =
    tpl.business_id?._id ||
    tpl.business_id ||
    profile?.business_id?._id ||
    profile?.business_id;
  const cid =
    tpl.customer_id?._id ||
    tpl.customer_id ||
    profile?.customer_id?._id ||
    profile?.customer_id;

  const invoiceDate = formatDateInput(new Date());
  const terms = tpl.terms || "Due on Receipt";
  const dueDate = calculateDueDate(terms, invoiceDate) || invoiceDate;

  /**
   * Keep raw %(...)% placeholders intact so the user can see / tweak the
   * expression in the Create Customer Invoice form. They are resolved later
   * at save time (handleSubmit) and PDF render so the saved invoice + PDFs
   * show the actual dates.
   */
  const items = (tpl.items || []).map((it) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const disc = Number(it.discount) || 0;
    const lineSub = qty * unit * (1 - disc / 100);
    const taxRate = Number(it.taxRate) || 0;
    const taxAmt = (lineSub * taxRate) / 100;
    const total = Number(it.totalValue) || Math.max(0, lineSub + taxAmt);
    return {
      itemName: it.itemName || it.title || it.description || "",
      description: it.description || "",
      quantity: qty,
      unitPrice: unit,
      discount: disc,
      total,
      amount: total,
      tax: taxAmt,
      taxRate,
      itemId: it.itemId || undefined,
      taxId: it.taxId || undefined,
      taxName: it.taxName || undefined,
      expenseAccount: it.expenseAccount || undefined,
      unit: it.unit || undefined,
      itemType: it.itemType || undefined,
      isAdvancePayment: it.isAdvancePayment || false,
    };
  });

  const subTotalNum = Number(tpl.subTotal) || 0;
  const discPct = Number(tpl.discount) || 0;
  const discountAmount =
    tpl.discountAmount != null
      ? Number(tpl.discountAmount)
      : subTotalNum > 0 && discPct
        ? (subTotalNum * discPct) / 100
        : 0;

  const profileId = profile?._id;
  return {
    recurringInvoiceProfileId:
      profileId != null ? String(profileId) : "",
    business: bid ? String(bid) : "",
    customer: cid ? String(cid) : "",
    orderNumber: tpl.orderNumber || "",
    invoiceDate,
    dueDate,
    terms,
    subject: tpl.subject || profile?.subject || "",
    billingAddress: tpl.billingAddress || "",
    shippingAddress: tpl.shippingAddress || "",
    phone: "",
    fax: "",
    currency: tpl.currency || profile?.currency || "",
    items,
    subtotal: subTotalNum,
    discount: discountAmount,
    discountAmount,
    shippingCharges:
      tpl.shippingCharges != null ? Number(tpl.shippingCharges) : 0,
    adjustment: tpl.adjustment != null ? Number(tpl.adjustment) : 0,
    customerNotes: tpl.customerNotes || "",
    termsAndConditions: tpl.termsAndConditions || "",
    invoiceType: tpl.invoiceType || "Proforma",
    bankAccount: tpl.bankAccount?._id || tpl.bankAccount || "",
  };
}
