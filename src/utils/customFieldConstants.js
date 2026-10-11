/**
 * Central custom-field metadata (aligned with PCI-FE/src/utils/Datatype.md).
 */
export const CUSTOM_FIELD_MODULES = ["sales", "purchase", "inventory"];

export const CUSTOM_FIELD_MODULE_LABELS = {
  sales: "Sales",
  purchase: "Purchase",
  inventory: "Items",
};

/** Submodule (screen) options per module — values must exist in API SCREENS list. */
export const CUSTOM_FIELD_SCREENS_BY_MODULE = {
  sales: [
    { value: "sales_order", label: "Sales order" },
    { value: "invoice", label: "Customer invoice" },
    { value: "customer", label: "Customer" },
  ],
  purchase: [
    { value: "purchase_order", label: "Purchase order" },
    { value: "vendor_invoice", label: "Vendor invoice" },
    { value: "customer", label: "Vendor" },
  ],
  inventory: [
    { value: "item", label: "Item" },
    { value: "category", label: "Category" },
    { value: "stock_group", label: "Stock group" },
    { value: "customer", label: "Contact" },
  ],
};

export const MODULE_SCREEN_DEFAULTS = {
  sales: "sales_order",
  purchase: "purchase_order",
  inventory: "item",
};

/** Union of all screen slugs the API accepts */
export const CUSTOM_FIELD_ALL_SCREENS = [
  "sales_order",
  "invoice",
  "customer",
  "purchase_order",
  "vendor_invoice",
  "item",
  "category",
  "stock_group",
];

export function getCustomFieldScreenLabel(module, screenValue) {
  const row = (CUSTOM_FIELD_SCREENS_BY_MODULE[module] || []).find(
    (x) => x.value === screenValue,
  );
  return row?.label || screenValue;
}

/**
 * For Items › Items custom fields only: transaction contexts (stored on each definition’s
 * `transaction_targets`). Line-item tables resolve these when loading columns.
 *
 * - Recurring schedules: use `sales:recurring_invoice`. For backward compatibility, any
 *   definition that still lists only `sales:invoice` also appears on recurring screens.
 * - Vendor bills: `purchase:vendor_invoice`.
 */
export const CUSTOMER_FIELD_TRANSACTION_OPTIONS_BY_MODULE = {
  sales: [
    { value: "sales:invoice", label: "Customer invoice" },
    { value: "sales:recurring_invoice", label: "Recurring invoice" },
    { value: "sales:sales_order", label: "Sales order" },
  ],
  purchase: [
    { value: "purchase:purchase_order", label: "Purchase order" },
    { value: "purchase:vendor_invoice", label: "Vendor invoice" },
  ],
  inventory: [
    { value: "sales:invoice", label: "Customer invoice" },
    { value: "sales:recurring_invoice", label: "Recurring invoice" },
    { value: "sales:sales_order", label: "Sales order" },
    { value: "purchase:purchase_order", label: "Purchase order" },
    { value: "purchase:vendor_invoice", label: "Vendor invoice" },
  ],
};

export const CUSTOM_FIELD_DATA_TYPES = [
  "single_line_text",
  "multi_line_text",
  "email",
  "url",
  "phone",
  "number",
  "decimal",
  "currency",
  "percentage",
  "date",
  "datetime",
  "checkbox",
  "auto_number",
  "dropdown",
  "multi_select",
  "lookup",
  "external_lookup",
  "file",
  "image",
  "formula",
];

export const CUSTOM_FIELD_DATA_PRIVACY = ["none", "pii", "ephi"];

export const CUSTOM_FIELD_LOOKUP_TARGETS = [
  { module: "sales", screen: "customer", label: "Customer" },
  { module: "purchase", screen: "customer", label: "Vendor" },
  { module: "inventory", screen: "customer", label: "Customer" },
];

/**
 * UI placement config for custom fields.
 * - invoice-like screens: inject above line-items section
 * - other screens: inject above Image; fallback to Items, then Categories, then footer
 */
export const CUSTOM_FIELD_PLACEMENT = {
  default: {
    slots: [
      "before_image",
      "before_items",
      "before_categories",
      "before_footer",
    ],
    fieldAnchors: {
      before_image: ["images", "image"],
      before_items: ["items", "item"],
      before_categories: ["categories", "category"],
    },
  },
  sales: {
    invoice: { slots: ["after_due_date", "before_footer"] },
    sales_order: { slots: ["after_due_date", "before_footer"] },
  },
  purchase: {
    purchase_order: { slots: ["after_due_date", "before_footer"] },
    vendor_invoice: { slots: ["after_due_date", "before_footer"] },
  },
};

/**
 * Item form: custom definitions to show in the same row as native "UOM"
 * (field_key contains "uom", or label is exactly "UOM", case-insensitive).
 */
export function isItemUomCompanionCustomField(def) {
  if (!def) return false;
  const k = String(def.field_key || "").toLowerCase();
  const l = String(def.label || "")
    .trim()
    .toLowerCase();
  return k.includes("uom") || l === "uom";
}
