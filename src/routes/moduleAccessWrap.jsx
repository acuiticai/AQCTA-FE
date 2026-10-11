import React from "react";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";

/**
 * Wraps a route component (lazy or static) with ModuleAccessGate.
 * Default checks View on module + subModule; override with requiredPermission for Add/Update routes.
 */
export function wrapModuleAccess(Component, options) {
  const {
    moduleName,
    subModuleName = "",
    title,
    requiredPermission = PERMISSION_ACTION.VIEW,
  } = options;

  function WrappedRoute(props) {
    return (
      <ModuleAccessGate
        moduleName={moduleName}
        subModuleName={subModuleName}
        title={title}
        requiredPermission={requiredPermission}
      >
        <Component {...props} />
      </ModuleAccessGate>
    );
  }

  WrappedRoute.displayName = `ModuleAccess(${title})`;
  return WrappedRoute;
}

export { PERMISSION_ACTION };
