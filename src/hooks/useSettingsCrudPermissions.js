import { useContext, useMemo } from "react";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";

/**
 * CRUD flags for settings screens (inherits /settings from useRouteModulePermissions).
 * Super admins bypass Add / Update / Delete checks.
 */
export function useSettingsCrudPermissions() {
  const { state } = useContext(AdminContext);
  const isSuperAdmin = state?.adminInfo?.role?.isSuperAdmin === true;
  const routePerms = useRouteModulePermissions();

  return useMemo(
    () => ({
      ...routePerms,
      isSuperAdmin,
      canAdd: routePerms.canAdd || isSuperAdmin,
      canUpdate: routePerms.canUpdate || isSuperAdmin,
      canDelete: routePerms.canDelete || isSuperAdmin,
    }),
    [routePerms, isSuperAdmin],
  );
}
