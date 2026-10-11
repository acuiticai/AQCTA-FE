/**
 * Configuration-based UI profiles for custom fields.
 *
 * Each profile describes layout tokens that match native screens using the same
 * Form + InputFieldWithLabel patterns (see Items / Customer Basic Information).
 *
 * Extensibility:
 * - Add or override keys here, or call `registerCustomFieldUIProfile` from app bootstrap.
 * - Per-definition overrides: set `ui_profile_key` on the definition (API) to any
 *   registered key; otherwise resolution uses `${module}:${screen}` then `default`.
 *
 * Example (bootstrap):
 *   import { registerCustomFieldUIProfile } from "@/components/custom-fields/customFieldUIRegistry";
 *   registerCustomFieldUIProfile("inventory:item", {
 *     layout: { labelDirection: "column", customLabelWidth: "w-full" },
 *   });
 */

const DEFAULT_PROFILE = {
  id: "default",
  /**
   * "default" = gray Form/InputField look (Items, Customer, Vendor, Categories, Stock).
   * "document" = white inputs + compact label rhythm like Phone/Fax on invoice & order screens.
   */
  controlSurface: "default",
  layout: {
    labelDirection: "column",
    customLabelWidth: "w-full",
  },
  /** Tailwind gap class for the fields grid — align with `Form` fieldsRowGapClassName when unset */
  gridGapClass: "gap-4",
  /** Vertical spacing between rows — align with `Form` fieldsStackSpacingClassName when unset */
  stackSpacingClass: "space-y-4",
  /** data_type values that occupy a full row in multi-column grids (native textareas / wide controls) */
  fullWidthDataTypes: new Set([
    "multi_line_text",
    "formula",
    "multi_select",
    "external_lookup",
  ]),
};

/** @type {Record<string, typeof DEFAULT_PROFILE>} */
const REGISTRY = {
  default: { ...DEFAULT_PROFILE, id: "default" },
  "inventory:item": { ...DEFAULT_PROFILE, id: "inventory:item" },
  "inventory:category": { ...DEFAULT_PROFILE, id: "inventory:category" },
  "inventory:stock_group": { ...DEFAULT_PROFILE, id: "inventory:stock_group" },
  "inventory:customer": { ...DEFAULT_PROFILE, id: "inventory:customer" },
  "sales:customer": { ...DEFAULT_PROFILE, id: "sales:customer" },
  "sales:invoice": {
    ...DEFAULT_PROFILE,
    id: "sales:invoice",
    controlSurface: "document",
  },
  "sales:sales_order": {
    ...DEFAULT_PROFILE,
    id: "sales:sales_order",
    controlSurface: "document",
  },
  "purchase:purchase_order": {
    ...DEFAULT_PROFILE,
    id: "purchase:purchase_order",
    controlSurface: "document",
  },
  "purchase:vendor_invoice": {
    ...DEFAULT_PROFILE,
    id: "purchase:vendor_invoice",
    controlSurface: "document",
  },
  "purchase:customer": {
    ...DEFAULT_PROFILE,
    id: "purchase:customer",
    layout: {
      ...DEFAULT_PROFILE.layout,
      tightLabelInputSpacing: true,
    },
  },
};

/**
 * Merge profile with defaults so partial profiles are valid.
 * @param {string} id
 * @param {Partial<typeof DEFAULT_PROFILE>} partial
 */
function buildProfile(id, partial) {
  const fullWidth =
    partial.fullWidthDataTypes instanceof Set
      ? partial.fullWidthDataTypes
      : DEFAULT_PROFILE.fullWidthDataTypes;
  return {
    ...DEFAULT_PROFILE,
    ...partial,
    id,
    layout: { ...DEFAULT_PROFILE.layout, ...partial.layout },
    fullWidthDataTypes: fullWidth,
  };
}

Object.keys(REGISTRY).forEach((k) => {
  REGISTRY[k] = buildProfile(k, REGISTRY[k]);
});

/**
 * Register or replace a UI profile at runtime (e.g. new module).
 * @param {string} key
 * @param {Partial<typeof DEFAULT_PROFILE>} profile
 */
export function registerCustomFieldUIProfile(key, profile) {
  REGISTRY[key] = buildProfile(key, profile || {});
}

/**
 * @param {string} module
 * @param {string} screen
 * @param {string} [definitionUiProfileKey] optional per-definition key from API
 * @returns {typeof DEFAULT_PROFILE}
 */
export function resolveCustomFieldUIProfile(module, screen, definitionUiProfileKey) {
  const keys = [
    definitionUiProfileKey && String(definitionUiProfileKey).trim(),
    module && screen ? `${module}:${screen}` : null,
    "default",
  ].filter(Boolean);

  for (const k of keys) {
    if (REGISTRY[k]) return REGISTRY[k];
  }
  return REGISTRY.default;
}

export { DEFAULT_PROFILE, REGISTRY };
