import { useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { ROUTE_PERMISSION_FALLBACKS } from "./routePermissionFallbacks";
import {
  MY_HR_MODULE_NAME,
  matchMyHrRouteMapping,
} from "./myHrRoutePermissions";
import {
  getModuleRouteAliases,
  getModuleRoutePath,
} from "@/utils/moduleLabels";

/** API permission strings (role.modules[].subModules[].permissions) */
export const PERMISSION_ACTION = {
  ADD: "Add",
  UPDATE: "Update",
  DELETE: "Delete",
  BULK_DELETE: "BulkDelete",
  VIEW: "View",
  VIEW_OWN: "ViewOwn",
  VIEW_DETAILS: "ViewDetails",
};

/** Standard list/form UI flags from role.modules (used when merging parent + submodule). */
const STANDARD_UI_PERMISSIONS = [
  PERMISSION_ACTION.ADD,
  PERMISSION_ACTION.UPDATE,
  PERMISSION_ACTION.DELETE,
  PERMISSION_ACTION.VIEW,
  PERMISSION_ACTION.VIEW_DETAILS,
  PERMISSION_ACTION.BULK_DELETE,
];

/**
 * Pure check: whether `permissions` includes `action`.
 * Deny by default — missing/empty array means no access (no implicit Allow).
 *
 * @param {string[]|null|undefined} permissions
 * @param {string} action - e.g. PERMISSION_ACTION.ADD
 * @returns {boolean}
 */
export function hasPermission(permissions, action) {
  if (action == null || String(action).trim() === "") return false;
  if (!Array.isArray(permissions)) return false;
  return permissions.includes(action);
}

/**
 * Normalize module/submodule labels: trim + case-insensitive compare.
 * Handles API quirks like "Items  " vs "Items".
 */
export function normalizePermissionLabel(value) {
  if (value == null) return "";
  /* Strip zero-width characters: module names typed/pasted into the Modules
     admin can carry them, and they would break every name-based match here. */
  return String(value)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizePath(path) {
  if (path == null || path === "") return "";
  const p = String(path).trim();
  if (!p) return "";
  const withLeadingSlash = p.startsWith("/") ? p : `/${p}`;
  // Treat trailing slashes as equivalent (e.g. "/SystemUsers" == "/SystemUsers/").
  if (withLeadingSlash.length > 1) {
    return withLeadingSlash.replace(/\/+$/, "");
  }
  return "/";
}

/**
 * Settings routes use parent `/settings` permissions so one role assignment
 * controls all settings screens and actions (View/Add/Update/Delete/etc).
 */
const SETTINGS_PERMISSION_PATHS = new Set([
  "/settings",
  "/reminders",
  "/cheque-reminders",
  "/taxes",
  "/vendor-invoice-approval",
  "/credit-notes-approval",
  "/special-transfers-types",
  "/paymentmethods",
  "/transactiontypes",
  "/advancetypes",
  "/channels",
  "/documents_misc_data_types",
  "/finance_misc_data_types",
  "/currency",
  "/departments_positions",
  "/foreign_worker_management",
  "/leaves",
  "/claims",
  "/branch_locations",
  "/shifts",
  "/publicholidays",
  "/wfhsettings",
  "/wfhgroups",
  "/item_misc_data_types",
  "/miscellanious_misc_data_types",
  "/notification-events",
  "/emailtemplatesui",
  "/operations_misc_data_types",
  "/fleet-job-scheduling-settings",
  "/purchase_misc_data_types",
  "/sales_misc_data_types",
  "/account-types",
  "/bank-account-types",
  "/bank-account-mapping",
  "/document-types",
  "/document_templates",
  "/payroll-pay-elements",
  "/payroll-company-settings",
  "/payroll-statutory-settings",
  "/payroll-pay-groups",
  "/tax-classes",
  "/malaysianbanks",
  "/settings/custom-fields",
  "/settings/module-labels",
  "/settings/application-documents",
  "/settings/application-fields",
  "/settings/dynamic-forms",
  "/settings/class-categories",
  "/pos/settings",
  "/accounts/e-invoice-settings",
  "/accounts/service-monster",
  "/accounts/zoho-books",
  "/accounts/whatsapp-integration",
  "/settings/integrations/cliniko",
]);

function isSettingsManagedPath(pathname) {
  const normalized = normalizePath(pathname).toLowerCase();
  if (!normalized) return false;
  if (SETTINGS_PERMISSION_PATHS.has(normalized)) return true;
  for (const basePath of SETTINGS_PERMISSION_PATHS) {
    if (basePath !== "/" && normalized.startsWith(`${basePath}/`)) return true;
  }
  return false;
}

/** True if `current` equals `registered` path or is a nested route under it. */
function pathMatchesRoute(currentRaw, registeredRaw) {
  const current = normalizePath(currentRaw).toLowerCase();
  const registered = normalizePath(registeredRaw).toLowerCase();
  if (!registered || !current) return false;
  if (current === registered) return true;
  if (registered === "/") return false;
  return current.startsWith(`${registered}/`);
}

/**
 * My HR self-service URLs → permissions on "My HR" submodule (same as MyHR.jsx cards).
 * Runs before registered module paths so HR admin modules are not used by mistake.
 * @returns {string[] | null} null when URL is not a My HR staff route
 */
function resolveMyHrPathPermissions(modules, pathname) {
  const mapping = matchMyHrRouteMapping(pathname);
  if (!mapping) return null;

  const myHrParent = findModuleByName(modules, MY_HR_MODULE_NAME);
  if (myHrParent && mapping.subModuleName) {
    return getPermissionsForModule(
      modules,
      MY_HR_MODULE_NAME,
      mapping.subModuleName,
    );
  }

  for (const { moduleName, subModuleName } of mapping.legacyCandidates || []) {
    const list = getEffectivePermissionsForModule(
      modules,
      moduleName,
      subModuleName,
    );
    if (list.length > 0) return list;
  }
  const first = mapping.legacyCandidates?.[0];
  if (first) {
    return getEffectivePermissionsForModule(
      modules,
      first.moduleName,
      first.subModuleName,
    );
  }
  return [];
}

/**
 * @returns {{ permissions: string[], matchedRule: boolean }}
 */
function resolveFallbackPermissions(modules, pathname) {
  if (!pathname) return { permissions: [], matchedRule: false };
  for (const rule of ROUTE_PERMISSION_FALLBACKS) {
    if (!rule.test(pathname)) continue;
    let fallbackFirst = null;
    for (const { moduleName, subModuleName } of rule.candidates) {
      const list = getEffectivePermissionsForModule(
        modules,
        moduleName,
        subModuleName
      );
      if (fallbackFirst === null) fallbackFirst = list;
      if (list.length > 0) {
        return { permissions: list, matchedRule: true };
      }
    }
    if (fallbackFirst !== null) {
      return { permissions: fallbackFirst, matchedRule: true };
    }
  }
  return { permissions: [], matchedRule: false };
}

/**
 * Longest matching module/submodule path wins (same logic as getPermissionsForCurrentPath path branch).
 * @returns {{ bestLen: number, bestPerms: string[] }}
 */
function computePathPermissionsFromRegisteredRoutes(modules, current) {
  let bestLen = -1;
  let bestPerms = [];
  let bestPathKey = "";
  let bestFromSubModule = false;
  /** Parent top-level module when the winning match is a submodule (for inheriting UI perms). */
  let parentOfBestSub = null;

  const consider = (rawPath, perms, isSubModule, parentModule) => {
    const pNorm = normalizePath(rawPath);
    if (!pNorm || !pathMatchesRoute(current, pNorm)) return;
    const pathKey = pNorm.toLowerCase();
    const len = pNorm.length;
    const arr = Array.isArray(perms) ? perms : [];
    if (len > bestLen) {
      bestLen = len;
      bestPerms = [...arr];
      bestPathKey = pathKey;
      bestFromSubModule = isSubModule;
      parentOfBestSub = isSubModule ? parentModule : null;
    } else if (len === bestLen && len >= 0) {
      if (pathKey === bestPathKey) {
        if (isSubModule && !bestFromSubModule) {
          bestPerms = [...arr];
          bestFromSubModule = true;
          parentOfBestSub = parentModule;
        } else if (!isSubModule && bestFromSubModule) {
          return;
        } else {
          bestPerms = [...new Set([...bestPerms, ...arr])];
        }
      } else {
        bestPerms = [...new Set([...bestPerms, ...arr])];
      }
    }
  };

  for (const module of modules) {
    consider(module?.path, module?.permissions, false, null);
    for (const sub of module.subModules || []) {
      consider(sub?.path, sub?.permissions, true, module);
    }
  }

  // Important RBAC rule: when a submodule is matched, we should use ONLY the
  // submodule's explicit permissions. An empty array means "no access" — no
  // implicit inheritance from the parent module.

  return { bestLen, bestPerms };
}

/**
 * How the current URL was mapped to permission strings.
 * - `path`: matched a module/submodule `path` in role.modules
 * - `myhr`: My HR staff self-service route (see myHrRoutePermissions.js)
 * - `fallback`: matched a rule in ROUTE_PERMISSION_FALLBACKS (e.g. edit routes)
 * - `none`: no RBAC mapping for this URL (e.g. home) — empty list does not mean "blocked submodule"
 */
export function getPathPermissionResolution(modules, pathname) {
  if (!modules || !Array.isArray(modules) || !pathname) {
    return { permissions: [], resolution: "none" };
  }
  const current = normalizePath(pathname);
  if (!current) return { permissions: [], resolution: "none" };

  // Parent-level RBAC for Settings: every known settings route inherits `/settings`.
  if (isSettingsManagedPath(current)) {
    const { bestLen, bestPerms } = computePathPermissionsFromRegisteredRoutes(
      modules,
      "/settings"
    );
    if (bestLen >= 0) {
      return {
        permissions: [...new Set(bestPerms)],
        resolution: "path",
      };
    }
    return { permissions: [], resolution: "path" };
  }

  const myHrPerms = resolveMyHrPathPermissions(modules, current);
  if (myHrPerms !== null) {
    return {
      permissions: [...new Set(myHrPerms)],
      resolution: "myhr",
    };
  }

  const { bestLen, bestPerms } = computePathPermissionsFromRegisteredRoutes(
    modules,
    current
  );
  if (bestLen >= 0 && Array.isArray(bestPerms) && bestPerms.length > 0) {
    return {
      permissions: [...new Set(bestPerms)],
      resolution: "path",
    };
  }

  // Path matched a module/submodule but permissions were empty (e.g. stale
  // login payload / ObjectId mismatch). Fall through to name-based fallbacks
  // so routes like /enquiries still resolve Sales → Enquiry permissions.
  const { permissions, matchedRule } = resolveFallbackPermissions(
    modules,
    current
  );
  if (matchedRule && Array.isArray(permissions) && permissions.length > 0) {
    return {
      permissions,
      resolution: "fallback",
    };
  }

  if (bestLen >= 0) {
    return {
      permissions: [...new Set(bestPerms)],
      resolution: "path",
    };
  }

  return {
    permissions: matchedRule ? permissions : [],
    resolution: matchedRule ? "fallback" : "none",
  };
}

/**
 * Find a top-level module by name.
 * @param {Array} modules - role.modules
 * @param {string} moduleName
 */
export function findModuleByName(modules, moduleName) {
  if (!modules || !Array.isArray(modules) || moduleName == null) return null;
  const want = normalizePermissionLabel(moduleName);
  return modules.find((m) => normalizePermissionLabel(m?.name) === want) || null;
}

/** True when role includes Purchase/Purchases module with any usable permission. */
export function roleHasPurchaseModuleAccess(modules) {
  if (!Array.isArray(modules)) return false;
  for (const mod of modules) {
    const name = normalizePermissionLabel(mod?.name);
    if (name !== "purchase" && name !== "purchases") continue;
    const perms = [
      ...(Array.isArray(mod.permissions) ? mod.permissions : []),
      ...(mod.subModules || []).flatMap((s) =>
        Array.isArray(s?.permissions) ? s.permissions : [],
      ),
    ];
    if (
      perms.includes(PERMISSION_ACTION.VIEW) ||
      perms.includes(PERMISSION_ACTION.VIEW_DETAILS) ||
      perms.includes(PERMISSION_ACTION.ADD) ||
      perms.includes(PERMISSION_ACTION.UPDATE)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Find a submodule by name within a module.
 */
export function findSubModuleByName(module, subModuleName) {
  if (!module?.subModules || !Array.isArray(module.subModules)) return null;
  if (subModuleName == null) return null;
  const want = normalizePermissionLabel(subModuleName);
  return (
    module.subModules.find(
      (s) => normalizePermissionLabel(s?.name) === want
    ) || null
  );
}

/**
 * Find a submodule whose name matches `name` anywhere under role.modules.
 * Use when a screen maps to a submodule that is not a top-level module row.
 */
export function findSubModuleByNameGlobally(modules, name) {
  if (!modules || !Array.isArray(modules) || name == null) return null;
  const want = normalizePermissionLabel(name);
  for (const m of modules) {
    for (const s of m.subModules || []) {
      if (normalizePermissionLabel(s?.name) === want) return s;
    }
  }
  return null;
}

/**
 * Effective permission strings for a module key + optional submodule.
 * - With subModuleName: same as getPermissionsForModule (strict parent + child names).
 * - Without subModuleName: parent module by name, else first matching submodule name globally.
 */
export function getEffectivePermissionsForModule(
  modules,
  moduleName,
  subModuleName
) {
  const subTrim = subModuleName != null && String(subModuleName).trim() !== "";
  if (subTrim) {
    return getPermissionsForModule(modules, moduleName, subModuleName);
  }
  const mod = findModuleByName(modules, moduleName);
  if (mod) {
    return Array.isArray(mod.permissions) ? mod.permissions : [];
  }
  const sub = findSubModuleByNameGlobally(modules, moduleName);
  if (sub) {
    return Array.isArray(sub.permissions) ? sub.permissions : [];
  }
  return [];
}

/**
 * Boolean flags from role.modules for UI (Add, Update, Delete, View, ViewDetails, BulkDelete).
 * @param {Array} modules - adminInfo.role.modules
 * @param {string} moduleName - Top-level module name, or a submodule name if no parent match
 * @param {string} [subModuleName] - Optional submodule name under the parent
 */
export function getPermissionFlagsFromList(list) {
  const permissions = Array.isArray(list) ? list : [];
  return {
    permissions,
    canAdd: hasPermission(permissions, PERMISSION_ACTION.ADD),
    canUpdate: hasPermission(permissions, PERMISSION_ACTION.UPDATE),
    canDelete: hasPermission(permissions, PERMISSION_ACTION.DELETE),
    canView: hasPermission(permissions, PERMISSION_ACTION.VIEW),
    canViewOwn: hasPermission(permissions, PERMISSION_ACTION.VIEW_OWN),
    canViewDetails: hasPermission(permissions, PERMISSION_ACTION.VIEW_DETAILS),
    canBulkDelete: hasPermission(permissions, PERMISSION_ACTION.BULK_DELETE),
  };
}

export function getModulePermissionFlags(modules, moduleName, subModuleName) {
  const list = getEffectivePermissionsForModule(
    modules,
    moduleName,
    subModuleName
  );
  return getPermissionFlagsFromList(list);
}

/**
 * Effective permission list for a module + optional submodule.
 * - If subModuleName is omitted / empty: uses module.permissions only.
 * - If subModuleName is set: uses that submodule's permissions (must exist).
 */
export function getPermissionsForModule(
  modules,
  moduleName,
  subModuleName
) {
  const mod = findModuleByName(modules, moduleName);
  if (!mod) return [];

  const subTrim = subModuleName != null && String(subModuleName).trim() !== "";
  if (!subTrim) {
    return Array.isArray(mod.permissions) ? mod.permissions : [];
  }

  const sub = findSubModuleByName(mod, subModuleName);
  if (!sub) return [];
  return Array.isArray(sub.permissions) ? sub.permissions : [];
}

/**
 * Pure helper: check if role.modules grants `action` for module + submodule.
 *
 * @param {Array} modules - adminInfo.role.modules
 * @param {string} moduleName - e.g. "Items"
 * @param {string} [subModuleName] - e.g. "Items"; omit for module-level only
 * @param {string} action - e.g. "Add", "View", "Change Status"
 */
export function hasModulePermission(
  modules,
  moduleName,
  subModuleName,
  action
) {
  const list = getPermissionsForModule(modules, moduleName, subModuleName);
  return hasPermission(list, action);
}

/**
 * Path-based: permissions for the current URL — longest matching module/subModule path
 * (prefix match), then route fallbacks for URLs that do not share API paths (see routePermissionFallbacks.js).
 */
export function getPermissionsForCurrentPath(modules, pathname) {
  const { permissions } = getPathPermissionResolution(modules, pathname);
  return permissions;
}

/**
 * Pure helper: check whether `pathname` grants `action`.
 * Uses the same route-to-module mapping as useRouteModulePermissions.
 */
export function hasPathPermission(
  modules,
  pathname,
  action = PERMISSION_ACTION.VIEW
) {
  if (!action) return false;
  const normalized = normalizePath(pathname);
  if (!normalized) return false;
  const { permissions } = getPathPermissionResolution(modules, normalized);
  return hasPermission(permissions, action);
}

/**
 * List-screen View check: same path → submodule permission resolution as RouteActionGate
 * (no parent-module fallback when the submodule exists with permissions: []).
 */
export function hasListViewAccessForPath(modules, pathname, isSuperAdmin = false) {
  if (isSuperAdmin) return true;
  if (!pathname) return false;
  return hasPathPermission(modules, pathname, PERMISSION_ACTION.VIEW);
}

/**
 * View on a submodule by name (role.modules / subModules[].permissions only).
 * Does not inherit parent module View.
 */
export function hasReportSubmoduleView(modules, isSuperAdmin, subModuleName) {
  if (isSuperAdmin) return true;
  const sub = findSubModuleByNameGlobally(modules, subModuleName);
  if (sub) {
    const perms = Array.isArray(sub.permissions) ? sub.permissions : [];
    return hasPermission(perms, PERMISSION_ACTION.VIEW);
  }
  const mod = findModuleByName(modules, subModuleName);
  if (mod) {
    const perms = Array.isArray(mod.permissions) ? mod.permissions : [];
    return hasPermission(perms, PERMISSION_ACTION.VIEW);
  }
  return false;
}

/** View when the URL matches a submodule path on the role (no parent Sales fallback). */
export function hasViewOnRegisteredModulePath(modules, pathname) {
  const { permissions, resolution } = getPathPermissionResolution(
    modules,
    pathname,
  );
  if (resolution !== "path") return false;
  return hasPermission(permissions, PERMISSION_ACTION.VIEW);
}

function uniquePaths(...groups) {
  return [...new Set(groups.flat().filter(Boolean))];
}

function saleOrderListPaths() {
  return uniquePaths(
    getModuleRoutePath("saleOrder", "list"),
    getModuleRouteAliases("saleOrder", "list"),
    "/sales-orders",
    "/sale-order",
  );
}

/**
 * Sales report tab: registered list path and/or submodule name aliases (e.g. "Sale Order").
 */
export function hasSalesReportTabAccess(
  modules,
  isSuperAdmin,
  { paths = [], nameAliases = [] } = {},
) {
  if (isSuperAdmin) return true;
  const pathList = Array.isArray(paths) ? paths : [paths];
  if (pathList.some((p) => hasViewOnRegisteredModulePath(modules, p))) {
    return true;
  }
  const names = Array.isArray(nameAliases) ? nameAliases : [nameAliases];
  return names.some((name) => hasReportSubmoduleView(modules, false, name));
}

/**
 * Sales Reports tab visibility — aligned with sidebar list screens (Sale Order vs Sales Orders naming).
 */
export function useSalesReportModuleTabAccess() {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const modules = adminInfo?.role?.modules;
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

  return useMemo(
    () => ({
      items: hasSalesReportTabAccess(modules, isSuperAdmin, {
        paths: ["/items"],
        nameAliases: ["Items"],
      }),
      customers: hasSalesReportTabAccess(modules, isSuperAdmin, {
        paths: ["/customers"],
        nameAliases: ["Customers"],
      }),
      invoices: hasSalesReportTabAccess(modules, isSuperAdmin, {
        paths: ["/customer-invoices"],
        nameAliases: ["Customer Invoices", "Invoice", "Invoices"],
      }),
      payments: hasSalesReportTabAccess(modules, isSuperAdmin, {
        paths: ["/customer-payments"],
        nameAliases: ["Customer Payments", "Payments"],
      }),
      salesOrders: hasSalesReportTabAccess(modules, isSuperAdmin, {
        paths: saleOrderListPaths(),
        nameAliases: ["Sale Order", "Sales Order", "Sales Orders"],
      }),
    }),
    [modules, isSuperAdmin],
  );
}

/**
 * @returns {{
 *   hasPermission: ((permission: string) => boolean) & ((moduleName: string, subModuleName: string, action: string) => boolean),
 *   adminInfo: object | null,
 *   currentPath: string,
 *   getPathPermissions: () => string[],
 *   hasModulePermission: (moduleName: string, subModuleName: string, action: string) => boolean,
 * }}
 */
export const usePermissions = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const location = useLocation();

  const modules = adminInfo?.role?.modules;

  const pathPermissions = useMemo(() => {
    const { permissions } = getPathPermissionResolution(
      modules,
      location.pathname
    );
    return permissions;
  }, [modules, location.pathname]);

  const hasPermission = (...args) => {
    if (args.length === 1) {
      const [permission] = args;
      if (!permission) return false;
      return pathPermissions.includes(permission);
    }
    if (args.length === 3) {
      const [moduleName, subModuleName, action] = args;
      return hasModulePermission(modules, moduleName, subModuleName, action);
    }
    return false;
  };

  const hasModulePermissionBound = (moduleName, subModuleName, action) =>
    hasModulePermission(modules, moduleName, subModuleName, action);

  return {
    hasPermission,
    adminInfo,
    currentPath: location.pathname,
    getPathPermissions: () => pathPermissions,
    hasModulePermission: hasModulePermissionBound,
  };
};

/**
 * RBAC flags for a module/subModule pair (searches role.modules + subModules).
 * @param {string} moduleName - e.g. "Items", "Customers"
 * @param {string} [subModuleName] - Optional; omit to use parent-only or global submodule match
 */
export function useModulePermissions(moduleName, subModuleName = "") {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const modules = adminInfo?.role?.modules;

  return useMemo(
    () => getModulePermissionFlags(modules, moduleName, subModuleName),
    [modules, moduleName, subModuleName]
  );
}

/**
 * RBAC flags for the current route: uses role module paths + nested routes + fallbacks
 * so Sales, Purchase, Items, Business Group, Global Settings (and submodules) work without
 * hardcoding module names on each page.
 *
 * `shouldBlockEmptyAccess` — true when this URL maps to a module/submodule (path or fallback)
 * but the effective permission list is empty (e.g. submodule permissions: []). Use with
 * RoutePermissionGate for a friendly "no access" screen instead of a blank list.
 */
export function useRouteModulePermissions() {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const location = useLocation();
  const modules = adminInfo?.role?.modules;
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

  return useMemo(() => {
    if (isSuperAdmin) {
      const all = [
        PERMISSION_ACTION.ADD,
        PERMISSION_ACTION.UPDATE,
        PERMISSION_ACTION.DELETE,
        PERMISSION_ACTION.VIEW,
        PERMISSION_ACTION.VIEW_DETAILS,
        PERMISSION_ACTION.BULK_DELETE,
        PERMISSION_ACTION.VIEW_OWN,
      ];
      return {
        ...getPermissionFlagsFromList(all),
        pathResolution: "path",
        shouldBlockEmptyAccess: false,
      };
    }

    const { permissions, resolution } = getPathPermissionResolution(
      modules,
      location.pathname
    );
    const flags = getPermissionFlagsFromList(permissions);
    const hasRoleModules =
      Array.isArray(modules) && modules.length > 0;
    const shouldBlockEmptyAccess =
      hasRoleModules &&
      permissions.length === 0 &&
      (resolution === "path" ||
        resolution === "fallback" ||
        resolution === "myhr");

    return {
      ...flags,
      pathResolution: resolution,
      shouldBlockEmptyAccess,
    };
  }, [modules, location.pathname, isSuperAdmin]);
}
