import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

/** API-driven modules may omit `path`; avoid `.split` / `startsWith` on undefined. */
function safePath(p) {
  if (p == null || p === "") return "";
  return String(p);
}

const SidebarSubMenu = ({ sidebar, route, isCollapsed = false }) => {
  const location = useLocation();

  const getInitialExpanded = () => {
    const path = location.pathname;
    const routePaths = (route.routes || [])
      .map((r) => safePath(r.path))
      .filter(Boolean);
    const isExactMatch = routePaths.some((routePath) => path === routePath);
    // More strict matching: only match if routePath is followed by /, :, or end of string
    const isNestedRoute = routePaths.some((routePath) => {
      return (
        path === routePath ||
        path.startsWith(`${routePath}/`) ||
        path.startsWith(`${routePath}:`)
      );
    });
    return isExactMatch || isNestedRoute;
  };

  const isNotASidebarRoute = !sidebar.some((r) =>
    (r.routes || []).some((subRoute) => safePath(subRoute.path) === location.pathname),
  );

  const [expanded, setExpanded] = useState(getInitialExpanded());
  const [isActive, setIsActive] = useState(location.pathname);

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  useEffect(() => {
    if (!isNotASidebarRoute) {
      setExpanded(getInitialExpanded());
      setIsActive(location.pathname);
    }
  }, [location.pathname]);

  // Check if any sub-route is active
  const isParentActive = (route.routes || []).some((subRoute) => {
    const currentPath = location.pathname;
    const subRoutePath = safePath(subRoute.path);
    if (!subRoutePath) return false;
    const isExactMatch = currentPath === subRoutePath;
    const isNestedRoute = currentPath.startsWith(`${subRoutePath}/`);
    const pathBase = subRoutePath.split("/:")[0];
    // More strict matching: only match if pathBase is followed by /, :, or end of string
    // This prevents /business-group from matching /business
    const isEditRoute = Boolean(
      pathBase &&
        (currentPath === pathBase ||
          currentPath.startsWith(`${pathBase}/`) ||
          currentPath.startsWith(`${pathBase}:`)),
    );
    return isExactMatch || isNestedRoute || isEditRoute;
  });

  return (
    <li className="relative mb-1">
      {/* Parent Item */}
      <button
        onClick={toggleExpand}
        className={`flex w-full items-center ${
          isCollapsed ? "px-3 justify-center" : "px-4"
        } rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 focus:outline-none ${
          isParentActive
            ? "bg-[#FDECEE] text-[#C5061A] shadow-[inset_3px_0_0_#C5061A]"
            : "text-[#1A2740] hover:bg-[#F5F2F3] hover:text-[#C5061A]"
        }`}
        title={isCollapsed ? route.name : ""}
      >
        {!isCollapsed && (
          <span className="mr-2">
            {expanded ? (
              <FiChevronDown className="w-4 h-4" />
            ) : (
              <FiChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
        {/* Parent Icon */}
        {route.icon &&
          React.createElement(route.icon, {
            className: `w-5 h-5 ${isCollapsed ? "" : "mr-3"}`,
          })}
        {/* Parent Name */}
        {!isCollapsed && (
          <span className="flex-1 text-left">{route.name}</span>
        )}
      </button>

      {/* Submenu Items - Only show when not collapsed */}
      {!isCollapsed && expanded && route.routes && (
        <ul className="ml-2 mt-1 space-y-1 border-l-2 border-[#D4DEE9] pl-4">
          {route.routes.map((subRoute) => {
            const currentPath = location.pathname;
            const subRoutePath = safePath(subRoute.path);
            if (!subRoutePath) {
              return (
                <li
                  key={subRoute.productKey || subRoute._id || subRoute.name}
                  className="relative"
                >
                  <span className="block px-3 py-2 text-sm italic text-slate-400">
                    {subRoute.name || "Untitled"}{" "}
                    <span className="text-[10px] not-italic">(no path)</span>
                  </span>
                </li>
              );
            }
            const isExactMatch = currentPath === subRoutePath;
            const isNestedRoute = currentPath.startsWith(`${subRoutePath}/`);
            const pathBase = subRoutePath.split("/:")[0];
            // More strict matching: only match if pathBase is followed by /, :, or end of string
            // This prevents /business-group from matching /business
            const isEditRoute = Boolean(
              pathBase &&
                (currentPath === pathBase ||
                  currentPath.startsWith(`${pathBase}/`) ||
                  currentPath.startsWith(`${pathBase}:`)),
            );
            const isCurrentRoute = isExactMatch || isNestedRoute || isEditRoute;

            return (
              <li
                key={subRoute.productKey || subRoute._id || subRoute.name}
                className="relative"
              >
                <NavLink
                  to={subRoutePath}
                  className={({ isActive }) =>
                    `block rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive || isCurrentRoute
                        ? "bg-[#FDECEE] font-semibold text-[#C5061A]"
                        : "text-[#334155] hover:bg-[#F5F2F3] hover:text-[#C5061A]"
                    }`
                  }
                >
                  {subRoute.name}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
};

export default SidebarSubMenu;
