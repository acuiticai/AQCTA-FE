/** Friendly labels for audit field paths (no "Id" suffix for entity references). */
export const FIELD_LABEL_OVERRIDES = {
  businessid: "Business",
  business_id: "Business",
  customerid: "Customer",
  customer_id: "Customer",
  vendorid: "Vendor",
  vendor_id: "Vendor",
  userid: "User",
  user_id: "User",
};

/** Last path segment, compact: businessId → businessid, business_id → businessid */
export function fieldKeyCompact(fieldPath) {
  const leaf = String(fieldPath || "").split(".").pop() || "";
  return leaf
    .replace(/[_\s-]+/g, "")
    .replace(/([a-z])([A-Z])/g, (_, a, b) => `${a}${b}`)
    .toLowerCase();
}

export function formatActivityFieldLabel(fieldPath) {
  const compact = fieldKeyCompact(fieldPath);
  if (FIELD_LABEL_OVERRIDES[compact]) {
    return FIELD_LABEL_OVERRIDES[compact];
  }

  const leaf = String(fieldPath || "").split(".").pop() || fieldPath;
  const label = String(leaf)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return label.replace(/\s+Id$/i, "").trim();
}
