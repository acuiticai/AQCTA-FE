/**
 * Product Details multi-entry fields (FOR-01 Type(s)/Model(s)/Rating(s)/Size(s)/Brand(s)).
 * Stored as string arrays; legacy single strings are normalized on load.
 */

export const PRODUCT_MULTI_FIELDS = [
  {
    name: "types",
    label: "Type(s)",
    legacy: "type",
    placeholder: "e.g. Men — press Enter to add",
  },
  {
    name: "models",
    label: "Model(s)",
    legacy: "model",
    placeholder: "e.g. Classic Tee — press Enter to add",
  },
  {
    name: "ratings",
    label: "Rating(s)",
    legacy: "rating",
    placeholder: "e.g. 100% Cotton — press Enter to add",
  },
  {
    name: "sizes",
    label: "Size(s)",
    legacy: "size",
    placeholder: "e.g. Large — press Enter to add",
  },
  {
    name: "brands",
    label: "Trademark(s) / Brand name(s)",
    legacy: "brand",
    placeholder: "e.g. Acme — press Enter to add",
  },
];

/** Coerce a stored value into a clean string list. */
export function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (value == null) return [];
  const text = String(value).trim();
  return text ? [text] : [];
}

/**
 * Normalize formData so multi fields are always arrays, migrating legacy
 * single-string `brand` / `model` / etc. when present.
 */
export function normalizeProductFormValues(form = {}) {
  if (!form || typeof form !== "object") return form;

  const next = { ...form };
  PRODUCT_MULTI_FIELDS.forEach(({ name, legacy }) => {
    const fromArray = toStringList(form[name]);
    const fromLegacy = toStringList(form[legacy]);
    next[name] = fromArray.length ? fromArray : fromLegacy;
  });

  // Keep legacy scalars for older list/detail consumers.
  next.brand = next.brands.join(", ");
  next.model = next.models.join(", ");
  next.type = next.types.join(", ");
  next.rating = next.ratings.join(", ");
  next.size = next.sizes.join(", ");

  // Dynamic category fields marked allowMultiple may already be arrays.
  if (next.categoryFieldValues && typeof next.categoryFieldValues === "object") {
    next.categoryFieldValues = { ...next.categoryFieldValues };
  }

  return next;
}

/** Format a multi-value field for display (detail / review). */
export function formatMultiValue(value) {
  const list = toStringList(value);
  return list.length ? list.join(", ") : "";
}
