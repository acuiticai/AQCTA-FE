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

import { AdminContext } from "@/context/AdminContext";
import { SidebarContext } from "@/context/SidebarContext";
import { WindmillContext } from "@windmill/react-ui";
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
import {
  BRANDING_PLACEHOLDER_LOGO,
  fetchBrandingLogo,
  readCachedBrandingLogo,
  writeCachedBrandingLogo,
} from "@/utils/brandingLogo";
import { AQCTA_IDENTITY } from "@/config/aqctaIdentity";

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
  const { mode } = useContext(WindmillContext);
  const { dispatch, state } = useContext(AdminContext);
  const { isSidebarCollapsed } = useContext(SidebarContext);
  const [sidebar, setSidebar] = useState([]);
  const location = useLocation();
  const [logo, setLogo] = useState(
    () =>
      readCachedBrandingLogo() ||
      AQCTA_IDENTITY.logoDarkPath ||
      BRANDING_PLACEHOLDER_LOGO
  );
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
        const headers = {
          "Content-Type": "application/json",
          authorization: `Bearer ${state?.adminInfo?.token}`,
        };
        const response = await getCachedConfigurationResponse(
          state?.adminInfo?.token,
        );
        if (!response) return;
        const configuration = response.data[0];

        if (configuration) {
          try {
            const headers = {
              "Content-Type": "application/json",
              authorization: `Bearer ${state?.adminInfo?.token}`,
            };
            const nextLogo = await fetchBrandingLogo({ headers });
            setLogo(nextLogo || BRANDING_PLACEHOLDER_LOGO);
            writeCachedBrandingLogo(nextLogo);
          } catch (_) {
            const cached = readCachedBrandingLogo();
            setLogo(cached || BRANDING_PLACEHOLDER_LOGO);
          }
        }
      } catch (error) {
        console.error("Failed to fetch configuration:", error);
      }
    };

    if (state.adminInfo?.token) {
      fetchConfiguration();
    }
  }, [state.adminInfo?.token, dispatch, history]);

  const sidebarLogo =
    logo ||
    AQCTA_IDENTITY.logoDarkPath ||
    (mode === "dark"
      ? "/fallback-dark-logo.png"
      : AQCTA_IDENTITY.logoLightPath);

  return (
    <div className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <Link
          to="/home"
          className={`flex items-center justify-center transition-all duration-300 ${
            isSidebarCollapsed ? "px-1" : "px-2"
          }`}
        >
          <img
            src={sidebarLogo}
            alt="Logo"
            width={isSidebarCollapsed ? "40" : "168"}
            height="40"
            className={`object-contain transition-all duration-300 ${
              isSidebarCollapsed ? "h-9 w-9" : "h-10 max-w-[168px]"
            }`}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src =
                AQCTA_IDENTITY.logoDarkPath || BRANDING_PLACEHOLDER_LOGO;
            }}
          />
        </Link>
      </div>

      <div className="admin-sidebar__nav">
        <ul>
          {finalSidebar.map((route) =>
            route.routes && route.routes.length > 0 ? (
              <SidebarSubMenu
                sidebar={finalSidebar}
                route={route}
                key={route.productKey || route._id || route.name}
                isCollapsed={isSidebarCollapsed}
              />
            ) : (
              <li
                className="relative mb-0.5"
                key={route.productKey || route._id || route.name}
              >
                <NavLink
                  to={route.path}
                  target={route?.outside ? "_blank" : "_self"}
                  exact={route.path === "/"}
                  isActive={(match, loc) => {
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
                  }}
                  className={`admin-navitem ${
                    isSidebarCollapsed ? "admin-navitem--collapsed" : ""
                  }`}
                  activeClassName="is-active"
                  rel="noreferrer"
                  title={isSidebarCollapsed ? t(`${route.name}`) : ""}
                >
                  {route.icon &&
                    React.createElement(route.icon, {
                      className: "h-[18px] w-[18px] flex-shrink-0",
                    })}
                  {!isSidebarCollapsed && (
                    <span className="min-w-0 flex-1 truncate">
                      {t(`${route.name}`)}
                    </span>
                  )}
                </NavLink>
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  );
};

export default SidebarContent;
