import { getModuleRoutePath } from "@/utils/moduleLabels";
import { resolveAuditModuleKey } from "@/utils/auditTimelineFormat";

const idStr = (v) => {
  if (v == null) return "";
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
};

/**
 * Returns an in-app path for navigation, or null when unknown / not navigable.
 * @param {object} row - AuditTrail lean document
 */
export function resolveAuditEntryPath(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (meta.deletedEntity === true) return null;

  const entityId = idStr(row.entityId);
  const mk = resolveAuditModuleKey(row);
  const et = String(row.entityType || "");

  if ((mk === "saleOrder" || et === "SalesOrder") && entityId) {
    return getModuleRoutePath("saleOrder", "view", { id: entityId });
  }

  if ((mk === "quotation" || et === "Quotation") && entityId) {
    return `/quotations/view/${entityId}`;
  }

  if ((mk === "purchaseOrder" || et === "PurchaseOrder") && entityId) {
    return `/purchase-orders/view/${entityId}`;
  }

  if ((mk === "invoice" || et === "Proforma_Invoice") && entityId) {
    return `/view-customer-invoice/${entityId}`;
  }

  if ((mk === "recurringInvoice" || et === "RecurringInvoice") && entityId) {
    return `/view-recurring-invoice/${entityId}`;
  }

  if (
    (mk === "vendorInvoice" || et === "VendorInvoiceNew" || et === "VendorInvoice") &&
    entityId
  ) {
    return `/view-vendor-invoice/${entityId}`;
  }

  if ((mk === "customer" || et === "New_Customer" || et === "Customer") && entityId) {
    return `/Edit Customer/${entityId}`;
  }

  if ((mk === "vendor" || et === "NVendor" || et === "Vendor") && entityId) {
    return `/Edit Vendor/${entityId}`;
  }

  if ((mk === "creditNote" || et === "CreditNote") && entityId) {
    return `/view-credit-note/${entityId}`;
  }

  if ((mk === "debitNote" || et === "DebitNote") && entityId) {
    return `/view-debit-note/${entityId}`;
  }

  if ((mk === "job" || et === "FleetJob") && entityId) {
    return `/jobs/${entityId}`;
  }

  return null;
}
