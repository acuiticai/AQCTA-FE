import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const BUSINESS_FIELD_NAMES = new Set([
  "business",
  "businesses",
  "business_id",
  "businessid",
  "company",
]);

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function isBusinessFormField(field) {
  if (!field || typeof field !== "object") return false;
  if (field.isBusinessDropdown) return true;
  if (field.hideWhenSingleBusiness === false) return false;

  const name = String(field.name || "").toLowerCase();
  if (BUSINESS_FIELD_NAMES.has(name)) return true;

  const label = normalizeLabel(field.label);
  return (
    label === "business" ||
    label === "businesses" ||
    label === "company" ||
    label === "companies"
  );
}

/** Hide business picker rows on add/edit forms when only one business is assigned. */
export function filterFormFieldsForSingleBusiness(formFields = []) {
  if (!Array.isArray(formFields) || !isSingleAssignedBusiness()) {
    return formFields;
  }
  return formFields.filter((field) => !isBusinessFormField(field));
}
