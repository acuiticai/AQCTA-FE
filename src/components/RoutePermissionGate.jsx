import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { FiLock } from "react-icons/fi";
import Button from "@/page-layouts/components/Button";
import { useRouteModulePermissions } from "@/utils/permissionUtils";

/**
 * When the current route maps to a module/submodule but effective permissions are empty
 * (e.g. submodule permissions: []), shows a friendly modal instead of an empty screen.
 * Super admins are not blocked.
 */
export default function RoutePermissionGate({ title = "This area", children }) {
  const history = useHistory();
  const { shouldBlockEmptyAccess } = useRouteModulePermissions();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!shouldBlockEmptyAccess) setShowDetails(false);
  }, [shouldBlockEmptyAccess]);

  if (!shouldBlockEmptyAccess) {
    return children;
  }

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
            You don&apos;t have permission to open {title}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed">
            Your role currently has no allowed actions for this screen. Ask your
            administrator or business owner to update your role access.
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
