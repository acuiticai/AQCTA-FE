import React, { useContext, useEffect, useLayoutEffect, useState } from "react";
import { AdminContext } from "@/context/AdminContext";
import { useHistory, useLocation } from "react-router-dom";
import { Loader } from "@/page-layouts/index";
import { getCachedDynamicModulesPayload } from "@/utils/sessionApiCache";
import {
  requiresSubscriptionRedirect,
  getSubscriptionRedirectPath,
  isOnboardingRoute,
} from "@/utils/subscriptionRedirect";

/**
 * Pure access check from cached module payload (no network).
 */
function computePageAccess(authorizedModules, currentPath, allowedPaths) {
  const userPaths = [];

  authorizedModules.forEach((module) => {
    if (module.path) {
      userPaths.push(module.path);
    }

    if (module.subModules) {
      module.subModules.forEach((subModule) => {
        if (subModule.path) {
          userPaths.push(subModule.path);
        }
      });
    }
  });

  const publicPaths = [
    "/",
    "/dashboard",
    "/home",
    "/unauthorized",
    "/test-permissions",
  ];

  const mainSidebarRoutes = [
    "/staff-management",
    "/attendance",
    "/event-management",
    "/claim-management",
    "/leave-management",
    "/WFH-management",
    "/sales",
    "/purchase_contracts",
    "/operations",
    "/finance",
    "/accounts",
    "/items",
    "/customers",
    "/products",
    "/categories",
    "/orders",
    "/settings",
    "/configuration",
    "/email-templates",
    "/activity-logs",
    "/email-logs",
    "/user-roles",
    "/system-users",
    "/modules",
    "/business",
    "/documents",
    "/folders",
    "/StaffListScreen",
    "/purchases",
    "/HR-Analytics",
    "/reports",
    "/payroll",
    "/hr-calendar",
    "/billing",
    "/subscription-management",
    "/subscription-catalog",
    "/billing/adjust",
  ];

  if (publicPaths.includes(currentPath)) {
    return true;
  }

  const isMainRoute = mainSidebarRoutes.some(
    (route) =>
      currentPath === route || currentPath.startsWith(route + "/"),
  );

  if (!isMainRoute) {
    return true;
  }

  const modulePathMapping = {
    "Staff Management": "/staff-management",
    Attendance: "/attendance",
    "Event Management": "/event-management",
    "Task Management": "/task-management",
    Claims: "/claim-management",
    "Claim Management": "/claim-management",
    "Leave Management": "/leave-management",
    "WFH Management": "/WFH-management",
    "WFH Requests": "/WFH-management",
    Analytics: "/HR-Analytics",
    "HR Reports": "/reports",
    Payroll: "/payroll",
    "HR Calendar": "/hr-calendar",
    "User Attendance": "/user-attendance",
    "Staff Event Management": "/staff-event-management",
    "Staff Task Management": "/staff-task-management",
    "Staff Claim Management": "/staff-claim-management",
    "Staff Leave Management": "/staff-leave-management",
    "Staff WFH Management": "/Staff-WFH-management",
    "Treasury Receivables": "/treasury/receivables",
    "Treasury Authorization Requests":
      "/treasury/authorization-requests",
    "Treasury Create Authorization": "/treasury/create-authorization",
    "Treasury Authorization Templates":
      "/treasury/authorization-templates",
    "Treasury Send Email": "/treasury/send-email",
    Sales: "/sales",
    "Purchase Contracts": "/purchase_contracts",
    Operations: "/campaigns",
    Finance: "/finance",
    Accounts: "/accounts",
    Items: "/items",
    Customers: "/customers",
    Products: "/products",
    Categories: "/categories",
    Orders: "/orders",
    Settings: "/settings",
    Configuration: "/configuration",
    "Email Templates": "/email-templates",
    "Activity Logs": "/activity-logs",
    "Email Logs": "/email-logs",
    "User Roles": "/user-roles",
    "System Users": "/system-users",
    Modules: "/modules",
    Business: "/business",
    Documents: "/documents",
    Folders: "/folders",
    "Staff List": "/StaffListScreen",
    Purchases: "/purchases",
    "Subscription Management": "/subscription-management",
    "Billing & Invoices": "/billing",
    "Billing and Invoices": "/billing",
    "Subscription Catalog": "/subscription-catalog",
    "Customer Onboarding": "/subscription-catalog",
    "Subscription Coupons": "/subscription-catalog",
  };

  for (const path of userPaths) {
    if (currentPath === path) {
      return true;
    }
    if (path && currentPath.startsWith(path + "/")) {
      return true;
    }
    if (path && path.startsWith(currentPath + "/")) {
      return true;
    }
  }

  for (const module of authorizedModules) {
    const mappedPath = modulePathMapping[module.name];
    if (mappedPath) {
      if (
        currentPath === mappedPath ||
        currentPath.startsWith(mappedPath + "/")
      ) {
        return true;
      }
    }

    if (module.subModules) {
      for (const subModule of module.subModules) {
        const mappedSubPath = modulePathMapping[subModule.name];
        if (mappedSubPath) {
          if (
            currentPath === mappedSubPath ||
            currentPath.startsWith(mappedSubPath + "/")
          ) {
            return true;
          }
        }
      }
    }
  }

  if (allowedPaths.length > 0) {
    for (const allowedPath of allowedPaths) {
      if (
        currentPath === allowedPath ||
        currentPath.startsWith(allowedPath + "/")
      ) {
        return true;
      }
    }
  }

  return false;
}

const PageAuth = ({ children, allowedPaths = [] }) => {
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [modulePayload, setModulePayload] = useState(null);
  const [modulesLoading, setModulesLoading] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const currentPath = location.pathname;

  // useLayoutEffect so `modulesLoading === true` is committed before the auth
  // useEffect runs; otherwise both fire in the same tick, state is still stale,
  // and we briefly set authorized=false → redirect to /unauthorized.
  useLayoutEffect(() => {
    if (!adminInfo?.token) {
      try {
        const stored = localStorage.getItem("adminInfo");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.token) {
            dispatch({ type: "USER_LOGIN", payload: parsed });
            return;
          }
        }
      } catch (_) {}
      setModulePayload(null);
      setModulesLoading(false);
      setLoading(false);
      setAuthorized(false);
      return;
    }

    let cancelled = false;
    setModulesLoading(true);
    getCachedDynamicModulesPayload(adminInfo.id, adminInfo.token)
      .then((data) => {
        if (cancelled) return;
        setModulePayload(data);
        setModulesLoading(false);
        // Keep AdminContext role.modules in sync with get_Dynamic_Modules so
        // RouteActionGate / useRouteModulePermissions match sidebar access
        // (login payload can be stale or miss submodule perms after role seeds).
        if (data?.role?.modules) {
          const prevMods = adminInfo?.role?.modules;
          const nextMods = data.role.modules;
          const prevJson = JSON.stringify(prevMods || []);
          const nextJson = JSON.stringify(nextMods || []);
          if (
            prevJson !== nextJson ||
            Boolean(adminInfo?.role?.isSuperAdmin) !==
              Boolean(data.role.isSuperAdmin)
          ) {
            dispatch({
              type: "UPDATE_ADMIN_INFO",
              payload: {
                role: {
                  ...(adminInfo?.role || {}),
                  ...data.role,
                },
              },
            });
          }
        }
      })
      .catch((error) => {
        console.error("Error loading modules for PageAuth:", error);
        if (cancelled) return;
        setModulePayload(null);
        setModulesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [adminInfo?.id, adminInfo?.token, dispatch]);

  useEffect(() => {
    if (!adminInfo?.token) {
      return;
    }
    if (modulesLoading) {
      setLoading(true);
      return;
    }
    if (!modulePayload?.role) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const authorizedModules = modulePayload.role.modules || [];
    const hasAccess = computePageAccess(
      authorizedModules,
      currentPath,
      allowedPaths,
    );
    setAuthorized(hasAccess);
    setLoading(false);
  }, [
    adminInfo?.token,
    modulesLoading,
    modulePayload,
    currentPath,
    allowedPaths,
  ]);

  useEffect(() => {
    if (!loading) {
      if (!adminInfo?.token) {
        history.replace("/login");
      } else if (
        requiresSubscriptionRedirect(adminInfo, currentPath)
      ) {
        history.replace(getSubscriptionRedirectPath(adminInfo));
      } else if (!authorized && !isOnboardingRoute(currentPath)) {
        history.replace("/unauthorized");
      }
    }
  }, [loading, adminInfo, authorized, history, currentPath]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return children;
};

export default PageAuth;
