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
  const sidebarColor = "#ffffff";
  const [logo, setLogo] = useState(
    () => readCachedBrandingLogo() || BRANDING_PLACEHOLDER_LOGO
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

  return (
    <div
      className="flex h-full flex-col border-r border-[#e2eaf2] bg-white transition-all duration-300"
      style={{ backgroundColor: sidebarColor }}
    >
      {/* Logo Section - Fixed at top */}
      <div className="flex h-20 flex-shrink-0 items-center justify-center border-b border-[#e2eaf2] bg-white px-4">
        <Link
          to="/home"
          className={`flex items-center justify-center transition-all duration-300 ${
            isSidebarCollapsed ? "px-2" : "px-4"
          }`}
        >
          <img
            src={
              logo ||
              (mode === "dark"
                ? "/fallback-dark-logo.png"
                : "/fallback-light-logo.png")
            }
            alt="Logo"
            width={isSidebarCollapsed ? "40" : "160"}
            height="40"
            className={`object-contain transition-all duration-300 ${
              isSidebarCollapsed ? "h-10 w-10" : "h-12"
            }`}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = BRANDING_PLACEHOLDER_LOGO;
            }}
          />
        </Link>
      </div>

      {/* Menu Items - Scrollable (native scroll; PerfectScrollbar conflicts with React DOM updates) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
          <ul className="mt-4 pb-4 px-2">
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
                  className="relative mb-1"
                  key={route.productKey || route._id || route.name}
                >
                  <NavLink
                    to={route.path}
                    target={route?.outside ? "_blank" : "_self"}
                    end={route.path !== "/" && !route.path.endsWith("/")}
                    isActive={(match, location) => {
                      const currentPath = location.pathname;
                      
                      // For routes with path "/", only match if it's exactly "/" or matches a submodule
                      if (route.path === "/") {
                        if (currentPath === "/") return true;
                        // Check if current path matches any submodule of this route
                        if (route.routes && route.routes.length > 0) {
                          return route.routes.some((subRoute) => {
                            const subPath = subRoute.path;
                            return currentPath === subPath || 
                                   currentPath.startsWith(subPath + "/") ||
                                   currentPath.startsWith(subPath + ":");
                          });
                        }
                        return false;
                      }
                      
                      // For other routes, ensure exact match or proper nested match
                      // This prevents /business-group from matching /business
                      if (currentPath === route.path) return true;
                      
                      // Only match if route path is followed by / or : (not other characters)
                      return currentPath.startsWith(route.path + "/") ||
                             currentPath.startsWith(route.path + ":");
                    }}
                    className={({ isActive }) =>
                      `${
                        isSidebarCollapsed ? "px-3 justify-center" : "px-4"
                      } relative inline-flex w-full items-center rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-[#FDECEE] text-[#C5061A] shadow-[inset_3px_0_0_#C5061A]"
                          : "text-[#1A2740] hover:bg-[#F5F2F3] hover:text-[#C5061A]"
                      }`
                    }
                    rel="noreferrer"
                    title={isSidebarCollapsed ? t(`${route.name}`) : ""}
                  >
                    {route.icon &&
                      React.createElement(route.icon, {
                        className: `w-5 h-5 ${
                          isSidebarCollapsed ? "" : "mr-3"
                        }`,
                      })}
                    {!isSidebarCollapsed && (
                      <span className="ml-0">{t(`${route.name}`)}</span>
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
