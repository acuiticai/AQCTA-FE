export const DEFAULT_MODULE_LABELS = {
  saleOrder: "Sale Order",
  invoice: "Invoice",
  quotation: "Quotation",
  purchaseOrder: "Purchase Order",
  vendorInvoice: "Vendor Invoice",
  recurringInvoice: "Recurring Invoice",
  job: "Job",
  creditNote: "Credit Note",
  debitNote: "Debit Note",
  /** Party entities (timeline + audit); not renamed via module settings today but kept stable keys */
  customer: "Customer",
  vendor: "Vendor",
};

const MODULE_ROUTE_CONFIG = {
  saleOrder: {
    /** Canonical REST-era paths (stable bookmarks); kept in routing + redirects */
    legacy: {
      list: "/sales-orders",
      create: "/create-sale-order",
      edit: "/sales-orders/edit/:id",
      view: "/sales-orders/view/:id",
      emailPreview: "/sales-order-email-preview",
    },
    /** Alternate paths that appear in older links and sidebar data */
    legacyExtras: {
      list: ["/sale-order"],
      create: ["/sales-orders/create", "/sale-order/create"],
      edit: ["/sale-order/edit/:id"],
      view: ["/sale-order/view/:id"],
      emailPreview: [],
    },
  },
};

let runtimeModuleLabels = { ...DEFAULT_MODULE_LABELS };
let runtimeVersion = 0;
const listeners = new Set();

const notifyListeners = () => {
  runtimeVersion += 1;
  listeners.forEach((listener) => {
    try {
      listener(runtimeVersion);
    } catch (_) {}
  });
};

/** Avoid bumping version when nothing changed — Layout keys Switch on moduleLabelsVersion, so notifies remount everything. */
const shallowEqualMergedLabels = (next, prev) => {
  const keys = new Set([...Object.keys(next), ...Object.keys(prev)]);
  for (const k of keys) {
    if (next[k] !== prev[k]) return false;
  }
  return true;
};

const normalizeLabel = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
};

const pluralizeLabel = (label) => {
  const cleanLabel = normalizeLabel(label);
  if (!cleanLabel) return "";
  if (/(s|x|z|ch|sh)$/i.test(cleanLabel)) return `${cleanLabel}es`;
  if (/[^aeiou]y$/i.test(cleanLabel)) return `${cleanLabel.slice(0, -1)}ies`;
  return `${cleanLabel}s`;
};

const slugify = (value) =>
  normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const setModuleLabels = (labels = {}) => {
  if (!labels || typeof labels !== "object") return;
  const next = {
    ...DEFAULT_MODULE_LABELS,
    ...labels,
  };
  if (shallowEqualMergedLabels(next, runtimeModuleLabels)) return;
  runtimeModuleLabels = next;
  notifyListeners();
};

export const subscribeToModuleLabelChanges = (listener) => {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getModuleLabelsVersion = () => runtimeVersion;

export const getModuleLabel = (moduleKey, fallback) => {
  if (!moduleKey) return fallback || "";
  return (
    runtimeModuleLabels[moduleKey] ||
    fallback ||
    DEFAULT_MODULE_LABELS[moduleKey] ||
    moduleKey
  );
};

export const getModuleSlug = (moduleKey, options = {}) => {
  const { plural = false, fallback = "" } = options;
  const baseLabel = getModuleLabel(moduleKey, fallback || moduleKey);
  const source = plural ? pluralizeLabel(baseLabel) : baseLabel;
  return slugify(source);
};

export const getModulePath = (moduleKey, options = {}) => {
  const slug = getModuleSlug(moduleKey, { plural: true, ...options });
  return slug ? `/${slug}` : "/";
};

export const getModuleRoutePath = (moduleKey, routeKey, params = {}) => {
  const config = MODULE_ROUTE_CONFIG[moduleKey];
  const legacyPath = config?.legacy?.[routeKey];
  if (!legacyPath) return "";

  if (moduleKey !== "saleOrder") {
    return legacyPath.replace(/:([A-Za-z0-9_]+)/g, (_, key) => params[key] ?? `:${key}`);
  }

  const moduleSlug = getModuleSlug("saleOrder", { plural: false, fallback: "sale-order" });
  const moduleSlugPlural = getModuleSlug("saleOrder", { plural: true, fallback: "sale-orders" });
  const listPath = `/${moduleSlugPlural}`;
  const map = {
    list: listPath,
    create: `/create-${moduleSlug}`,
    edit: `${listPath}/edit/:id`,
    view: `${listPath}/view/:id`,
    emailPreview: `/${moduleSlug}-email-preview`,
  };
  const template = map[routeKey] || legacyPath;
  return template.replace(/:([A-Za-z0-9_]+)/g, (_, key) => params[key] ?? `:${key}`);
};

const expandSaleOrderAliasTemplates = (routeKey, params = {}) => {
  const config = MODULE_ROUTE_CONFIG.saleOrder;
  if (!config) return [];
  const primaryLegacy = config.legacy?.[routeKey];
  const extras = config.legacyExtras?.[routeKey] || [];
  const dynamicPath = getModuleRoutePath("saleOrder", routeKey, params);
  const expanded = [primaryLegacy, ...extras, dynamicPath].filter(Boolean);
  const substituted = expanded.map((tpl) =>
    tpl.replace(/:([A-Za-z0-9_]+)/g, (_, key) => params[key] ?? `:${key}`),
  );
  return [...new Set(substituted)];
};

export const getModuleRouteAliases = (moduleKey, routeKey, params = {}) => {
  const config = MODULE_ROUTE_CONFIG[moduleKey];
  const legacyPath = config?.legacy?.[routeKey];
  if (moduleKey === "saleOrder") {
    return expandSaleOrderAliasTemplates(routeKey, params);
  }
  const dynamicPath = getModuleRoutePath(moduleKey, routeKey, params);
  const aliases = [legacyPath, dynamicPath].filter(Boolean);
  return [...new Set(aliases)];
};

/**
 * Specs for <Redirect /> routes: legacy/alternate paths → current canonical path (label-derived slug).
 * Evaluated when routes are built (after settings hydrate).
 */
export const getSaleOrderCanonicalRedirectSpecs = () => {
  const specs = [];
  const routeKeys = ["list", "create", "edit", "view", "emailPreview"];
  const seen = new Set();

  for (const routeKey of routeKeys) {
    const canonicalTemplate = getModuleRoutePath("saleOrder", routeKey);
    const fromTemplates = expandSaleOrderAliasTemplates(routeKey).filter(
      (tpl) => tpl && tpl !== canonicalTemplate,
    );

    for (const pathTpl of fromTemplates) {
      if (seen.has(pathTpl)) continue;
      seen.add(pathTpl);
      specs.push({ path: pathTpl, exact: true, routeKey });
    }
  }

  return specs;
};

/**
 * Map sidebar/API paths (may use any legacy or dynamic segment) to canonical navigation target.
 */
export const normalizeSaleOrderSidebarPath = (path = "") => {
  const raw = String(path || "");
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  const lower = normalized.toLowerCase();

  const listAliases = expandSaleOrderAliasTemplates("list").map((p) => p.toLowerCase());
  if (listAliases.includes(lower)) {
    return getModuleRoutePath("saleOrder", "list");
  }

  const createAliases = expandSaleOrderAliasTemplates("create").map((p) => p.toLowerCase());
  if (createAliases.includes(lower)) {
    return getModuleRoutePath("saleOrder", "create");
  }

  const viewPrefixes = expandSaleOrderAliasTemplates("view").map((tpl) =>
    tpl.replace(/:id\b.*$/i, ""),
  );
  for (const prefixRaw of viewPrefixes) {
    const prefix = prefixRaw || "";
    if (!prefix || lower.length < prefix.length) continue;
    if (lower.startsWith(prefix.toLowerCase())) {
      const id = normalized.slice(prefix.length).replace(/^\//, "").split("/")[0];
      if (id) return getModuleRoutePath("saleOrder", "view", { id });
    }
  }

  const editPrefixes = expandSaleOrderAliasTemplates("edit").map((tpl) =>
    tpl.replace(/:id\b.*$/i, ""),
  );
  for (const prefixRaw of editPrefixes) {
    const prefix = prefixRaw || "";
    if (!prefix || lower.length < prefix.length) continue;
    if (lower.startsWith(prefix.toLowerCase())) {
      const id = normalized.slice(prefix.length).replace(/^\//, "").split("/")[0];
      if (id) return getModuleRoutePath("saleOrder", "edit", { id });
    }
  }

  return raw;
};

export const isLegacySaleOrderPath = (pathname = "") => {
  const current = String(pathname || "").toLowerCase();
  return (
    current === "/sales-orders" ||
    current === "/sale-order" ||
    current.startsWith("/sales-orders/") ||
    current.startsWith("/sale-order/") ||
    current === "/create-sale-order" ||
    current.startsWith("/sale-order/create")
  );
};

export const getAllModuleLabels = () => ({ ...runtimeModuleLabels });
