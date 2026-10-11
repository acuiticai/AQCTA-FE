import React, { useContext, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { FiLock } from "react-icons/fi";
import Button from "@/page-layouts/components/Button";
import { AdminContext } from "@/context/AdminContext";
import {
  PERMISSION_ACTION,
  useRouteModulePermissions,
} from "@/utils/permissionUtils";

/**
 * Pathnames where {@link RouteActionGate} does not enforce `requiredPermission` /
 * `allowAnyOf` (user must still be signed in with `adminInfo.role.modules` loaded).
 * Use when the list route only requires View but the detail route used ViewDetails.
 */
export const ROUTE_ACTION_GATE_UNPROTECTED_PATH_TESTS = [
  /^\/staff-claim-details(\/|$)/i,
  /^\/claim-details(\/|$)/i,
];

function permissionVerb(permission) {
  if (permission === PERMISSION_ACTION.VIEW) return "view";
  if (permission === PERMISSION_ACTION.VIEW_DETAILS) return "view details";
  if (permission === PERMISSION_ACTION.VIEW_OWN) return "view own";
  if (permission === PERMISSION_ACTION.ADD) return "add";
  if (permission === PERMISSION_ACTION.UPDATE) return "update";
  if (permission === PERMISSION_ACTION.DELETE) return "delete";
  if (permission === PERMISSION_ACTION.BULK_DELETE) return "bulk delete";
  return String(permission || "").toLowerCase();
}

function singlePermissionAllowed(routePerms, permission) {
  if (!permission) return false;
  switch (permission) {
    case PERMISSION_ACTION.ADD:
      return !!routePerms.canAdd;
    case PERMISSION_ACTION.UPDATE:
      return !!routePerms.canUpdate;
    case PERMISSION_ACTION.DELETE:
      return !!routePerms.canDelete;
    case PERMISSION_ACTION.BULK_DELETE:
      return !!routePerms.canBulkDelete;
    case PERMISSION_ACTION.VIEW:
      return !!routePerms.canView;
    case PERMISSION_ACTION.VIEW_DETAILS:
      return !!routePerms.canViewDetails;
    case PERMISSION_ACTION.VIEW_OWN:
      return !!routePerms.canViewOwn;
    default:
      return false;
  }
}

/**
 * Route-based action gate (Add/Update/Delete/BulkDelete/View/ViewDetails).
 * Uses your existing RBAC engine (`useRouteModulePermissions`) so callers
 * don't need to know module/submodule names.
 *
 * @param {string[]} [allowAnyOf] - If set, access when user has any listed permission (e.g. View or Add on daily-reports list).
 */
export default function RouteActionGate({
  title = "This area",
  requiredPermission = PERMISSION_ACTION.VIEW,
  allowAnyOf = null,
  children,
}) {
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};

  const routePerms = useRouteModulePermissions();
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

  const modulesReady = Array.isArray(adminInfo?.role?.modules);

  const canAccess = useMemo(() => {
    if (
      ROUTE_ACTION_GATE_UNPROTECTED_PATH_TESTS.some((re) =>
        re.test(location.pathname)
      )
    ) {
      return true;
    }
    // Super Admin: full access (matches other RBAC helpers)
    if (isSuperAdmin) return true;
    if (Array.isArray(allowAnyOf) && allowAnyOf.length > 0) {
      return allowAnyOf.some((p) => singlePermissionAllowed(routePerms, p));
    }
    return singlePermissionAllowed(routePerms, requiredPermission);
  }, [
    location.pathname,
    requiredPermission,
    allowAnyOf,
    routePerms,
    isSuperAdmin,
  ]);

  if (!modulesReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div
          className="h-12 w-12 border-4 border-gray-200 border-t-[var(--p-blue,#2563eb)] rounded-full animate-spin"
          aria-hidden
        />
        <p className="mt-4 text-sm text-gray-600">Loading…</p>
      </div>
    );
  }

  if (canAccess) return children;

  const verb = permissionVerb(requiredPermission);
  const useAnyOfCopy = Array.isArray(allowAnyOf) && allowAnyOf.length > 0;
  const goBack = () => {
    if (window?.history?.length > 1) {
      history.goBack();
      return;
    }
    history.push("/home");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4 sm:p-6">
      <div
        className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white px-5 py-7 sm:px-8 sm:py-9 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <FiLock className="h-7 w-7" aria-hidden />
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Access restricted
          </p>
          <h2 className="mt-2 text-base sm:text-xl font-semibold text-gray-900">
            {useAnyOfCopy ? (
              <>You don&apos;t have permission to access {title}</>
            ) : (
              <>
                You don&apos;t have permission to {verb} {title}
              </>
            )}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed">
            {useAnyOfCopy ? (
              <>
                You need at least one of:{" "}
                {allowAnyOf.map((p) => `"${p}"`).join(", ")}. Ask your administrator
                or business owner to update your role access.
              </>
            ) : (
              <>
                This screen requires the &quot;{requiredPermission}&quot; permission.
                Ask your administrator or business owner to update your role access.
              </>
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
          <Button secondary type="button" className="w-full sm:w-auto" onClick={goBack}>
            Go back
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto bg-[var(--p-blue)] hover:opacity-90"
            onClick={() => history.push("/home")}
          >
            Go to home
          </Button>
        </div>
      </div>
    </div>
  );
}

