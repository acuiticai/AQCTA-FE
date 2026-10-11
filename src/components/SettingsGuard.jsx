import React, { useContext, useEffect, useState } from "react";
import { AdminContext } from "@/context/AdminContext";
import { useHistory } from "react-router-dom";
import { Loader } from "@/page-layouts/index";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import { getCachedDynamicModulesPayload, invalidateModulesCache } from "@/utils/sessionApiCache";

/**
 * Guards the standalone /Settings route (rendered outside the Layout / PageAuth).
 * Redirects to /login if not authenticated and to /unauthorized if the user's
 * role does not include the Settings View permission.
 */
const SettingsGuard = ({ children }) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const [authorized, setAuthorized] = useState(null); // null = still checking

  useEffect(() => {
    if (!adminInfo?.token) {
      history.replace("/login");
      return;
    }

    invalidateModulesCache();
    getCachedDynamicModulesPayload(adminInfo.id, adminInfo.token)
      .then((res) => {
        const role = res?.role || {};
        const modules = Array.isArray(role.modules) ? role.modules : [];
        const isSuperAdmin =
          role?.isSuperAdmin === true || adminInfo?.role?.isSuperAdmin === true;
        const canViewSettings =
          isSuperAdmin ||
          hasPathPermission(modules, "/settings", PERMISSION_ACTION.VIEW);

        setAuthorized(canViewSettings);
      })
      .catch(() => setAuthorized(false));
  }, [adminInfo?.id, adminInfo?.token, adminInfo?.role?.isSuperAdmin, history]);

  useEffect(() => {
    if (authorized === false) {
      history.replace("/unauthorized");
    }
  }, [authorized]);

  if (!adminInfo?.token) return null;

  if (authorized === null) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  if (!authorized) return null;

  return children;
};

export default SettingsGuard;
