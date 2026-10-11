import { useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import {
  DAILY_REPORTS_SCOPE,
  resolveDailyReportsScopeFromPath,
} from "@/services/dailyReportsService";

const DAILY_REPORTS_PATH = "/daily-reports";
const DAILY_REPORTS_COLLECTION_PATH = "/daily-reports-collection";

export { resolveDailyReportsScopeFromPath };

function normalizePathSegment(p) {
  return (p?.startsWith("/") ? p : `/${p || ""}`).replace(/\/$/, "") || "/";
}

function normalizeModuleName(value) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function isDailyReportsModuleRef(mod) {
  if (!mod) return false;
  const modulePath = normalizePathSegment(mod.path);
  if (
    modulePath === DAILY_REPORTS_PATH ||
    modulePath.startsWith(`${DAILY_REPORTS_PATH}/`) ||
    modulePath === "/daily-reports-collection" ||
    modulePath.endsWith("/daily-reports-collection")
  ) {
    return true;
  }
  const name = normalizeModuleName(mod.name || mod.module);
  if (!name) return false;
  if (name.includes("daily report") || name.includes("daily collection")) {
    return true;
  }
  return false;
}

/**
 * Collect Daily Reports permission strings from role.modules (any route).
 */
export function collectDailyReportsPermissions(modules) {
  if (!modules || !Array.isArray(modules)) return [];
  let permissions = [];
  modules.forEach((module) => {
    if (isDailyReportsModuleRef(module)) {
      permissions = [...permissions, ...(module.permissions || [])];
    }
    (module.subModules || []).forEach((subModule) => {
      if (isDailyReportsModuleRef(subModule)) {
        permissions = [...permissions, ...(subModule.permissions || [])];
      }
    });
  });
  return [...new Set(permissions)];
}

const normPerms = (perms) =>
  Array.isArray(perms)
    ? perms.map((p) => String(p).trim()).filter(Boolean)
    : [];

function collectDailyReportsModuleEntries(modules) {
  const entries = [];
  if (!modules || !Array.isArray(modules)) return entries;
  for (const module of modules) {
    if (isDailyReportsModuleRef(module)) entries.push(module);
    for (const sub of module.subModules || []) {
      if (isDailyReportsModuleRef(sub)) entries.push(sub);
    }
  }
  return entries;
}

function isCollectionModuleEntry(entry) {
  const p = (entry?.path || "").replace(/\/+$/, "") || "/";
  if (
    p === DAILY_REPORTS_COLLECTION_PATH ||
    p.endsWith(DAILY_REPORTS_COLLECTION_PATH)
  ) {
    return true;
  }
  const name = normalizeModuleName(entry?.name || entry?.module);
  return (
    name === "daily reports collection" ||
    name === "daily report collection" ||
    name.endsWith("reports collection") ||
    name.endsWith("report collection")
  );
}

function isHubModuleEntry(entry) {
  if (isCollectionModuleEntry(entry)) return false;
  const p = (entry?.path || "").replace(/\/+$/, "") || "/";
  if (p === DAILY_REPORTS_PATH || p.startsWith(`${DAILY_REPORTS_PATH}/`)) {
    return true;
  }
  const name = normalizeModuleName(entry?.name || entry?.module);
  if (name.includes("daily report") && !name.includes("reports collection")) {
    return true;
  }
  if (name === "daily collection report") {
    return true;
  }
  return false;
}

/** ViewOwn on any Daily Reports module row (navigation / create-only checks). */
export function roleHasDailyReportsViewOwn(modules) {
  return collectDailyReportsModuleEntries(modules).some((entry) =>
    normPerms(entry.permissions).includes("ViewOwn")
  );
}

function findDailyReportsEntryForScope(modules, scopePath) {
  const scope =
    scopePath === DAILY_REPORTS_SCOPE.collection
      ? DAILY_REPORTS_SCOPE.collection
      : DAILY_REPORTS_SCOPE.hub;
  const entries = collectDailyReportsModuleEntries(modules);
  if (!entries.length) return null;

  if (scope === DAILY_REPORTS_SCOPE.collection) {
    return entries.find((entry) => isCollectionModuleEntry(entry)) || null;
  }

  const hubEntries = entries.filter((entry) => isHubModuleEntry(entry));
  if (!hubEntries.length) return null;
  const exact = hubEntries.find(
    (entry) => (entry.path || "").replace(/\/+$/, "") === DAILY_REPORTS_PATH
  );
  return exact || hubEntries[0];
}

export function getDailyReportsPermissionsForScope(modules, scopePath) {
  const entry = findDailyReportsEntryForScope(modules, scopePath);
  return entry ? normPerms(entry.permissions) : [];
}

/** ViewOwn on the role row for this screen → own records only. */
export function roleRestrictsDailyReportsToOwnForScope(modules, scopePath) {
  const entry = findDailyReportsEntryForScope(modules, scopePath);
  if (!entry) return false;
  return normPerms(entry.permissions).includes("ViewOwn");
}

/**
 * Add-only (Create/Add but no View/ViewOwn/Update/Delete): entry should be create screen.
 * Otherwise use dashboard/list landing.
 */
export function getDailyReportsEntryPath(modules) {
  const uniquePermissions = collectDailyReportsPermissions(modules);
  const hasCreate =
    uniquePermissions.includes("Create") || uniquePermissions.includes("Add");
  const hasView =
    uniquePermissions.includes("View") ||
    uniquePermissions.includes("ViewDetails");
  const hasViewOwn = roleHasDailyReportsViewOwn(modules);
  const hasUpdate = uniquePermissions.includes("Update");
  const hasDelete = uniquePermissions.includes("Delete");
  const isCreateOnly =
    hasCreate && !hasView && !hasViewOwn && !hasUpdate && !hasDelete;
  if (isCreateOnly) return `${DAILY_REPORTS_PATH}/create`;
  return DAILY_REPORTS_PATH;
}

/**
 * Sidebar / nav: if link points at daily-reports home, use create URL for add-only users.
 */
export function resolveDailyReportsNavPath(path, modules) {
  if (path == null || path === "") return path;
  const norm = normalizePathSegment(path);
  if (norm === DAILY_REPORTS_PATH || norm === `${DAILY_REPORTS_PATH}/`) {
    return getDailyReportsEntryPath(modules);
  }
  return path;
}

/**
 * Get permissions for the Daily Reports module from the role (not the current URL).
 */
export const useDailyReportsPermissions = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const scopePath = resolveDailyReportsScopeFromPath(location.pathname);

  const {
    permissions,
    canCreate,
    canView,
    canViewOwn,
    canUpdate,
    canDelete,
    isCreateOnly,
    restrictToOwnRecords,
  } = useMemo(() => {
    if (!adminInfo?.role?.modules) {
      return {
        permissions: [],
        canCreate: false,
        canView: false,
        canViewOwn: false,
        canUpdate: false,
        canDelete: false,
        isCreateOnly: false,
        restrictToOwnRecords: false,
      };
    }

    const scopePermissions = getDailyReportsPermissionsForScope(
      adminInfo.role.modules,
      scopePath,
    );

    const hasCreate =
      scopePermissions.includes("Create") || scopePermissions.includes("Add");
    const hasView =
      scopePermissions.includes("View") ||
      scopePermissions.includes("ViewDetails");
    const hasViewOwnOnScope = scopePermissions.includes("ViewOwn");
    const hasViewAll = scopePermissions.includes("View");
    const hasUpdate = scopePermissions.includes("Update");
    const hasDelete = scopePermissions.includes("Delete");

    return {
      permissions: scopePermissions,
      canCreate: hasCreate,
      canView: hasView || hasViewOwnOnScope,
      canViewAll: hasViewAll,
      canViewOwn: hasViewOwnOnScope,
      canUpdate: hasUpdate,
      canDelete: hasDelete,
      isCreateOnly:
        hasCreate &&
        !hasView &&
        !hasViewOwnOnScope &&
        !hasUpdate &&
        !hasDelete,
      restrictToOwnRecords: roleRestrictsDailyReportsToOwnForScope(
        adminInfo.role.modules,
        scopePath,
      ),
    };
  }, [adminInfo, scopePath]);

  const hasPermission = (permission) => {
    if (permission === "Create" || permission === "Add") return canCreate;
    if (permission === "View" || permission === "ViewDetails") return canView;
    if (permission === "ViewOwn") return canViewOwn;
    if (permission === "Update") return canUpdate;
    if (permission === "Delete") return canDelete;
    return permissions.includes(permission);
  };

  const canList = canView || canViewOwn || canCreate;

  return {
    permissions,
    hasPermission,
    canCreate,
    canView,
    canViewOwn,
    canList,
    canUpdate,
    canDelete,
    isCreateOnly,
    restrictToOwnRecords,
  };
};
