/**
 * Scheduling / dispatch UI and work-order PDF labels use {@link FleetJob.orderType}
 * (`invoice` | `work_order` | `estimate`) only — not sales-order invoice status.
 *
 * Separately, {@link shouldRouteRecordPaymentViaInvoice} keeps record-payment routing
 * when the SO has been invoiced.
 */

/** @returns {"invoice"|"estimate"|"work_order"} */
export function normalizedJobOrderType(job) {
  const t = String(job?.orderType || "work_order").toLowerCase();
  if (t === "invoice" || t === "estimate" || t === "work_order") return t;
  return "work_order";
}

export function jobBillingDocumentTitle(job) {
  switch (normalizedJobOrderType(job)) {
    case "invoice":
      return "Invoice";
    case "estimate":
      return "Estimate";
    default:
      return "Work Order";
  }
}

export function jobBillingDocumentTitleLower(job) {
  switch (normalizedJobOrderType(job)) {
    case "invoice":
      return "invoice";
    case "estimate":
      return "estimate";
    default:
      return "work order";
  }
}

/** Sidebar / board chip prefix: INV, EST, WO */
export function billingDocIdPrefix(job) {
  switch (normalizedJobOrderType(job)) {
    case "invoice":
      return "INV";
    case "estimate":
      return "EST";
    default:
      return "WO";
  }
}

/** PDF download filename segment (hyphenated where needed). */
export function billingDocFileSlug(job) {
  switch (normalizedJobOrderType(job)) {
    case "invoice":
      return "Invoice";
    case "estimate":
      return "Estimate";
    default:
      return "Work-Order";
  }
}

/**
 * Prefer opening the linked customer invoice for “record payment” when the fleet job is
 * stored as billing type invoice, or the linked sales order payload reports invoiced.
 */
export function shouldRouteRecordPaymentViaInvoice(job) {
  const orderType = String(job?.orderType || "").toLowerCase();
  const invoiceStatus = String(job?.salesOrderInvoiceStatus || "").toLowerCase();
  return orderType === "invoice" || invoiceStatus.includes("invoiced");
}
