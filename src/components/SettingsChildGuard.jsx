import React, { useContext, useMemo } from "react";
import { Redirect } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import { Loader } from "@/page-layouts/index";

/**
 * Guards individual settings sub-routes (outside Layout PageAuth).
 * Uses the same /settings permission mapping as the settings hub.
 */
const SettingsChildGuard = ({ children }) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();

  const authorized = useMemo(() => {
    if (!adminInfo?.token) return false;
    if (adminInfo?.role?.isSuperAdmin) return true;
    const modules = adminInfo?.role?.modules;
    if (!Array.isArray(modules)) return false;
    return hasPathPermission(
      modules,
      location.pathname,
      PERMISSION_ACTION.VIEW,
    );
  }, [
    adminInfo?.token,
    adminInfo?.role?.isSuperAdmin,
    adminInfo?.role?.modules,
    location.pathname,
  ]);

  if (!adminInfo?.token) {
    return <Redirect to="/login" />;
  }

  if (!Array.isArray(adminInfo?.role?.modules) && !adminInfo?.role?.isSuperAdmin) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  if (!authorized) {
    return <Redirect to="/unauthorized" />;
  }

  return children;
};

export default SettingsChildGuard;

/** Wrap a settings page component for App.jsx routes outside Layout. */
export function withSettingsChildGuard(Component) {
  const Guarded = (props) => (
    <SettingsChildGuard>
      <Component {...props} />
    </SettingsChildGuard>
  );
  Guarded.displayName = `SettingsGuard(${Component?.displayName || Component?.name || "Page"})`;
  return Guarded;
}
