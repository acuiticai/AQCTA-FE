import { DEFAULT_MODULE_LABELS } from "@/utils/moduleLabels";

/** Normalize legacy ActivityLog / mongoose collection names to stable module keys */
export const AUDIT_MODULE_KEY_ALIASES = {
  New_Customer: "customer",
  Customer: "customer",
  NVendor: "vendor",
  Vendor: "vendor",
  Proforma_Invoice: "invoice",
  VendorInvoiceNew: "vendorInvoice",
  VendorInvoice: "vendorInvoice",
  SalesOrder: "saleOrder",
  Quotation: "quotation",
  PurchaseOrder: "purchaseOrder",
  Vendor: "vendor",
  CreditNote: "creditNote",
  DebitNote: "debitNote",
  FleetJob: "job",
};

const SALE_ORDER_LABEL_VARIANTS = [
  "Sale Order",
  "Sale Orders",
  "Sales Order",
  "Sales Orders",
];

/**
 * Resolve stable module key for label substitution and routing.
 * @param {object} row - AuditTrail lean document
 */
export function resolveAuditModuleKey(row) {
  const raw = String(row?.moduleKey || "").trim();
  if (raw && DEFAULT_MODULE_LABELS[raw]) return raw;
  if (raw && AUDIT_MODULE_KEY_ALIASES[raw]) return AUDIT_MODULE_KEY_ALIASES[raw];
  const et = String(row?.entityType || "").trim();
  if (et && AUDIT_MODULE_KEY_ALIASES[et]) return AUDIT_MODULE_KEY_ALIASES[et];
  return raw || "";
}

/**
 * Human-readable summary using dynamic labels (never trust stored English module names).
 * @param {object} row
 * @param {(key: string, fallback?: string) => string} getModuleLabel
 */
export function formatAuditTimelineSummary(row, getModuleLabel) {
  if (!row) return "";
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const v1 = meta.auditV1 && typeof meta.auditV1 === "object" ? meta.auditV1 : null;

  if (v1?.template === "module_ref_action" && v1.ref && v1.actionKey) {
    const mk = resolveAuditModuleKey(row) || row.moduleKey;
    const fallback = DEFAULT_MODULE_LABELS[mk] || mk || "Record";
    const label = getModuleLabel(mk, fallback);
    const verb =
      {
        created: "created",
        updated: "updated",
        deleted: "deleted",
        status_changed: "status updated",
      }[v1.actionKey] || String(v1.actionKey || "").replace(/_/g, " ");
    return `${label} ${v1.ref} ${verb}`.trim();
  }

  if (v1?.template === "party_ref_action" && v1.ref && v1.actionKey) {
    const mk = resolveAuditModuleKey(row) || row.moduleKey;
    const fallback = DEFAULT_MODULE_LABELS[mk] || mk || "Record";
    const label = getModuleLabel(mk, fallback);
    const verb =
      {
        created: "created",
        updated: "updated",
        deleted: "deleted",
        status_changed: "status changed",
        documents_uploaded: "documents uploaded",
      }[v1.actionKey] || String(v1.actionKey || "").replace(/_/g, " ");
    return `${label} ${v1.ref} ${verb}`.trim();
  }

  let text = String(row.summary || row.action || "").trim();
  const mk = resolveAuditModuleKey(row);

  if (mk === "saleOrder") {
    const label = getModuleLabel("saleOrder", DEFAULT_MODULE_LABELS.saleOrder);
    for (const old of SALE_ORDER_LABEL_VARIANTS) {
      if (text.includes(old)) {
        text = text.split(old).join(label);
      }
    }
  } else if (mk && DEFAULT_MODULE_LABELS[mk]) {
    const def = DEFAULT_MODULE_LABELS[mk];
    const cur = getModuleLabel(mk, def);
    if (def && text.includes(def)) {
      text = text.split(def).join(cur);
    }
    const pluralDef = pluralizeEn(def);
    if (pluralDef && pluralDef !== def && text.includes(pluralDef)) {
      const pluralCur = pluralizeEn(cur);
      text = text.split(pluralDef).join(pluralCur);
    }
  }

  return text || row.action || "";
}

function pluralizeEn(label) {
  const clean = String(label || "").trim();
  if (!clean) return "";
  if (/(s|x|z|ch|sh)$/i.test(clean)) return `${clean}es`;
  if (/[^aeiou]y$/i.test(clean)) return `${clean.slice(0, -1)}ies`;
  return `${clean}s`;
}
