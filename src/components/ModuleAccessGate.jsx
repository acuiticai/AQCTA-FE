import React, { useContext } from "react";
import { useHistory } from "react-router-dom";
import { FiLock } from "react-icons/fi";
import { AdminContext } from "@/context/AdminContext";
import Button from "@/page-layouts/components/Button";
import {
  usePermissions,
  PERMISSION_ACTION,
} from "@/utils/permissionUtils";

function permissionVerb(permission) {
  if (permission === PERMISSION_ACTION.VIEW) return "view";
  if (permission === PERMISSION_ACTION.ADD) return "add";
  if (permission === PERMISSION_ACTION.UPDATE) return "update";
  if (permission === PERMISSION_ACTION.DELETE) return "delete";
  if (permission === PERMISSION_ACTION.BULK_DELETE) return "bulk delete";
  if (permission === PERMISSION_ACTION.VIEW_DETAILS) return "view details";
  return String(permission || "").toLowerCase();
}

/**
 * Blocks children until role modules are loaded, then checks a single permission
 * (default: View). If denied: friendly modal + optional inline card; URL is unchanged.
 */
export default function ModuleAccessGate({
  moduleName,
  subModuleName = "",
  title,
  requiredPermission = PERMISSION_ACTION.VIEW,
  children,
}) {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const { hasModulePermission } = usePermissions();

  const modulesReady = Array.isArray(adminInfo?.role?.modules);
  const canAccess =
    modulesReady &&
    hasModulePermission(moduleName, subModuleName, requiredPermission);

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

  if (!canAccess) {
    const verb = permissionVerb(requiredPermission);
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
              You don&apos;t have permission to {verb} {title}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed">
              This screen requires the &quot;{requiredPermission}&quot; permission.
              Ask your administrator or business owner to update your role access.
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

  return children;
}
