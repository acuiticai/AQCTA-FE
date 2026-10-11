/**
 * Client-side module registry: labels/slugs come from System Settings (API → moduleLabels util).
 * RBAC keys and backend identifiers stay stable (e.g. saleOrder).
 */

import {
  DEFAULT_MODULE_LABELS,
  getModuleLabel,
  getModulePath,
  getModuleSlug,
} from "@/utils/moduleLabels";

/** Metadata that does not depend on admin-renamed labels */
export const MODULE_REGISTRY_META = {
  saleOrder: {
    rbacModuleKey: "saleOrder",
    defaultLabel: DEFAULT_MODULE_LABELS.saleOrder,
    /** Default plural URL slug when label is default — used for legacy / redirects */
    baseSlugPlural: "sale-orders",
    baseSlugSingular: "sale-order",
  },
};

/**
 * Snapshot for UI/routing — no React components here (avoids circular imports with routes).
 */
export function getModuleRegistryEntry(moduleKey) {
  const meta = MODULE_REGISTRY_META[moduleKey];
  if (!meta) return null;
  const fallbackLabel =
    meta.defaultLabel || DEFAULT_MODULE_LABELS[moduleKey] || moduleKey;
  return {
    key: moduleKey,
    label: getModuleLabel(moduleKey, fallbackLabel),
    slugPlural: getModuleSlug(moduleKey, {
      plural: true,
      fallback: meta.baseSlugPlural,
    }),
    slugSingular: getModuleSlug(moduleKey, {
      plural: false,
      fallback: meta.baseSlugSingular,
    }),
    listPath: getModulePath(moduleKey),
    baseSlugPlural: meta.baseSlugPlural,
    baseSlugSingular: meta.baseSlugSingular,
  };
}

export function getModuleRegistry() {
  return Object.keys(MODULE_REGISTRY_META).reduce((acc, key) => {
    acc[key] = getModuleRegistryEntry(key);
    return acc;
  }, {});
}
