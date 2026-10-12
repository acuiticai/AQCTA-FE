"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useHistory } from "react-router-dom";
import Cookies from "js-cookie";
import { useTranslation } from "react-i18next";
import * as CiIcons from "react-icons/ci";
import * as FiIcons from "react-icons/fi";
import * as AiIcons from "react-icons/ai";
import * as PiIcons from "react-icons/pi";
import * as LiaIcons from "react-icons/lia";
import * as GiIcons from "react-icons/gi";
import * as BiIcons from "react-icons/bi";
import * as FaIcons from "react-icons/fa";
import * as Fa6Icons from "react-icons/fa6";
import * as MdIcons from "react-icons/md";
import * as TbIcons from "react-icons/tb";
import { FiLogOut } from "react-icons/fi";

import { AdminContext } from "@/context/AdminContext";
import { SidebarContext } from "@/context/SidebarContext";
import SidebarSubMenu from "@/components/sidebar/SidebarSubMenu";
import { Link } from "react-router-dom";
import {
  getCachedConfigurationResponse,
  getCachedDynamicModulesPayload,
} from "@/utils/sessionApiCache";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { normalizeSaleOrderSidebarPath } from "@/utils/moduleLabels";
import {
  buildProductSidebar,
  getProductNavDisplayName,
} from "@/utils/hiddenSidebarPaths";
import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";
import { AQCTA_IDENTITY } from "@/config/aqctaIdentity";
import { logoutUser } from "@/utils/generic";
import { groupAdminSidebarRoutes } from "@/utils/adminSidebarSections";
import {
  DEFAULT_ADMIN_AVATAR_URL,
  getAdminAvatarUrl,
} from "@/utils/adminAvatar";

/** White TECHNICAL wordmark on dark sidebar (customer portal uses the same asset). */
const ADMIN_SIDEBAR_LOGO = AQCTA_IDENTITY.logoDarkPath;

const normalizeModulePath = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

const isRemovedVendorOpsModule = ({ name = "", path = "" } = {}) => {
  const normalizedName = String(name || "").trim().toLowerCase();
  const normalizedPath = normalizeModulePath(path);
  return (
    normalizedPath.includes("vendors-wallet") ||
    normalizedPath.includes("vendors-points") ||
    normalizedPath.includes("vendors-settings") ||
    normalizedPath.includes("rider-points") ||
    normalizedPath.includes("admin/wallet") ||
    normalizedName.includes("vendor wallet") ||
    normalizedName.includes("vendor points") ||
    normalizedName.includes("rider points")
  );
};

// Consolidate all icons into a single map
const iconLibraries = {
  ...CiIcons,
  ...FiIcons,
  ...AiIcons,
  ...PiIcons,
  ...LiaIcons,
  ...BiIcons,
  ...GiIcons,
  ...FaIcons,
  ...Fa6Icons,
  ...MdIcons,
};

const StaffRoute = {
  name: "Attendance & Requests",
  path: "/dashboard",
  icon: FiIcons.FiUser,
  routes: [
    {
      name: "Mark Attendance",
      path: "/user-attendance",
    },
    {
      name: "Request WFH",
      path: "/staff-WFH-management",
    },
    {
      name: "Event Management",
      path: "/staff-event-management",
    },
  ],
};

const SidebarContent = () => {
  const { t } = useTranslation();
  const { dispatch, state } = useContext(AdminContext);
  const { isSidebarCollapsed } = useContext(SidebarContext);
  const [sidebar, setSidebar] = useState([]);
  const location = useLocation();
  const history = useHistory();
  const { getModuleLabel } = useModuleLabels();

  const isStaff = state?.adminInfo?.userType === "staff" || false;

  // Function to process sidebar and add StaffRoute if needed
  const getProcessedSidebar = (originalSidebar) => {
    if (!isStaff) return originalSidebar;

    // Create a copy of the original sidebar
    const processedSidebar = [...originalSidebar];

    // Check if Global Settings exists
    const globalSettingsIndex = processedSidebar.findIndex(
      (route) => route.name === "Global Settings"
    );

    if (globalSettingsIndex !== -1) {
      // Insert StaffRoute before Global Settings
      processedSidebar.splice(globalSettingsIndex, 0, StaffRoute);
    } else if (processedSidebar.length > 2) {
      // If more than 2 items and no Global Settings, insert before the last item
      processedSidebar.splice(processedSidebar.length - 1, 0, StaffRoute);
    } else {
      // If 2 or fewer items, append at the end
      processedSidebar.push(StaffRoute);
    }

    return processedSidebar;
  };

  const getDynamicSalesOrderName = () => getModuleLabel("saleOrder", "Sale Order");

  const mapSalesOrderPath = (path = "") =>
    normalizeSaleOrderSidebarPath(path || "");

  const applyDynamicRouteMeta = (route = {}, parentName = "") => {
    const currentName = String(route?.name || "");
    const lowered = currentName.toLowerCase();
    const isSalesOrderName =
      lowered === "sale order" || lowered === "sales orders";
    const labeledName = isSalesOrderName
      ? getDynamicSalesOrderName()
      : getProductNavDisplayName(currentName, { parentName });
    const nextPath = mapSalesOrderPath(route?.path);
    const nextChildren = Array.isArray(route?.routes)
      ? route.routes.map((child) =>
          applyDynamicRouteMeta(child, labeledName || currentName)
        )
      : route?.routes;
    return {
      ...route,
      name: labeledName,
      path: nextPath,
      routes: nextChildren,
    };
  };

  const finalSidebar = useMemo(
    () => sidebar.map((route) => applyDynamicRouteMeta(route)),
    [sidebar, getModuleLabel]
  );

  const sidebarSections = useMemo(
    () => groupAdminSidebarRoutes(finalSidebar),
    [finalSidebar]
  );

  const adminName =
    state?.adminInfo?.name ||
    state?.adminInfo?.username ||
    state?.adminInfo?.email ||
    "Admin";
  const adminEmail = state?.adminInfo?.email || "";
  const adminAvatarUrl = getAdminAvatarUrl(state?.adminInfo);

  const handleLogout = () => {
    logoutUser();
    history.push("/login");
  };

  const isRouteActive = (route, loc) => {
    const currentPath = loc.pathname;

    if (route.path === "/") {
      if (currentPath === "/") return true;
      if (route.routes && route.routes.length > 0) {
        return route.routes.some((subRoute) => {
          const subPath = subRoute.path;
          return (
            currentPath === subPath ||
            currentPath.startsWith(subPath + "/") ||
            currentPath.startsWith(subPath + ":")
          );
        });
      }
      return false;
    }

    if (currentPath === route.path) return true;

    return (
      currentPath.startsWith(route.path + "/") ||
      currentPath.startsWith(route.path + ":")
    );
  };

  const renderNavRoute = (route) => {
    if (route.routes && route.routes.length > 0) {
      return (
        <SidebarSubMenu
          sidebar={finalSidebar}
          route={route}
          key={route.productKey || route._id || route.name}
          isCollapsed={isSidebarCollapsed}
        />
      );
    }

    return (
      <li key={route.productKey || route._id || route.name}>
        <NavLink
          to={route.path}
          target={route?.outside ? "_blank" : "_self"}
          exact={route.path === "/"}
          isActive={(match, loc) => isRouteActive(route, loc)}
          className={`admin-navitem ${
            isSidebarCollapsed ? "admin-navitem--collapsed" : ""
          }`}
          activeClassName="is-active"
          rel="noreferrer"
          title={isSidebarCollapsed ? t(`${route.name}`) : ""}
        >
          {route.icon && (
            <span className="admin-navitem__icon" aria-hidden="true">
              {React.createElement(route.icon, {
                className: "h-[18px] w-[18px] flex-shrink-0",
              })}
            </span>
          )}
          {!isSidebarCollapsed && (
            <span className="admin-navitem__label">{t(`${route.name}`)}</span>
          )}
        </NavLink>
      </li>
    );
  };

  useEffect(() => {
    const fetchAndProcessModules = async () => {
      try {
        const data = await getCachedDynamicModulesPayload(
          state.adminInfo.id,
          state.adminInfo.token,
        );
        const roleDetails = data.role;
        const authorizedModules = roleDetails.modules || [];

        // Collect all authorized paths (unfiltered) for the Header permission check
        const allPaths = [];
        authorizedModules.forEach((m) => {
          if (isRemovedVendorOpsModule({ name: m?.name, path: m?.path })) return;
          if (m.path) {
            allPaths.push(m.path.startsWith("/") ? m.path : `/${m.path}`);
          }
          (m.subModules || []).forEach((s) => {
            if (isRemovedVendorOpsModule({ name: s?.name, path: s?.path })) return;
            if (s.path) {
              allPaths.push(s.path.startsWith("/") ? s.path : `/${s.path}`);
            }
          });
        });
        dispatch({ type: "SET_USER_MODULES", payload: allPaths });

        // Product IA filtered to this role's modules (same rules as Home).
        const productSidebar = buildProductSidebar(authorizedModules, {
          ...iconLibraries,
          ...TbIcons,
          FiGrid: FiIcons.FiGrid,
          FiList: FiIcons.FiList,
          FiUsers: FiIcons.FiUsers,
          FiUserCheck: FiIcons.FiUserCheck,
          FiBriefcase: FiIcons.FiBriefcase,
          FiCreditCard: FiIcons.FiCreditCard,
          FiSettings: FiIcons.FiSettings,
        });

        setSidebar(productSidebar);
      } catch (error) {
        console.error("Error fetching sidebar modules:", error);
      }
    };

    if (state.adminInfo) {
      fetchAndProcessModules();
    }
  }, [state.adminInfo?.id, state.adminInfo?.token, dispatch]);

  useEffect(() => {
    const fetchConfiguration = async () => {
      if (!state.adminInfo?.token) {
        dispatch({ type: "USER_LOGOUT" });
        Cookies.remove("adminInfo");
        history.push("/login");
        return;
      }
      try {
        await getCachedConfigurationResponse(state?.adminInfo?.token);
      } catch (error) {
        console.error("Failed to fetch configuration:", error);
      }
    };

    if (state.adminInfo?.token) {
      fetchConfiguration();
    }
  }, [state.adminInfo?.token, dispatch, history]);

  return (
    <div className="admin-sidebar">
      <div
        className={`admin-sidebar__brand${
          isSidebarCollapsed ? " admin-sidebar__brand--collapsed" : ""
        }`}
      >
        <Link to="/home" className="admin-sidebar__brand-link">
          <img
            src={ADMIN_SIDEBAR_LOGO}
            alt="Technical Assessors"
            className="admin-sidebar__logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = ADMIN_SIDEBAR_LOGO || BRANDING_PLACEHOLDER_LOGO;
            }}
          />
        </Link>
      </div>

      <nav className="admin-sidebar__nav" aria-label="Admin sections">
        {sidebarSections.map((section) => (
          <div className="admin-navgroup" key={section.id}>
            {!isSidebarCollapsed && (
              <p className="admin-navgroup__label">{section.label}</p>
            )}
            <ul className="admin-navgroup__list">
              {section.routes.map((route) => renderNavRoute(route))}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={`admin-sidebar__foot${
          isSidebarCollapsed ? " admin-sidebar__foot--collapsed" : ""
        }`}
      >
        <button
          type="button"
          className="admin-navitem admin-navitem--quiet"
          onClick={handleLogout}
          title={isSidebarCollapsed ? "Logout" : ""}
        >
          <span className="admin-navitem__icon" aria-hidden="true">
            <FiLogOut className="h-[18px] w-[18px]" />
          </span>
          {!isSidebarCollapsed && (
            <span className="admin-navitem__label">Logout</span>
          )}
        </button>

        <div
          className="admin-account"
          title={
            isSidebarCollapsed ? `${adminName}${adminEmail ? ` · ${adminEmail}` : ""}` : ""
          }
        >
          <img
            src={adminAvatarUrl}
            alt=""
            className="admin-avatar admin-avatar--photo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = DEFAULT_ADMIN_AVATAR_URL;
            }}
          />
          {!isSidebarCollapsed && (
            <span className="admin-account__text">
              <span className="admin-account__name">{adminName}</span>
              {adminEmail && (
                <span className="admin-account__email">{adminEmail}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SidebarContent;
