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
    (r.routes || []).some(
      (subRoute) => safePath(subRoute.path) === location.pathname,
    ),
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

  const isParentActive = (route.routes || []).some((subRoute) => {
    const currentPath = location.pathname;
    const subRoutePath = safePath(subRoute.path);
    if (!subRoutePath) return false;
    const isExactMatch = currentPath === subRoutePath;
    const isNestedRoute = currentPath.startsWith(`${subRoutePath}/`);
    const pathBase = subRoutePath.split("/:")[0];
    const isEditRoute = Boolean(
      pathBase &&
        (currentPath === pathBase ||
          currentPath.startsWith(`${pathBase}/`) ||
          currentPath.startsWith(`${pathBase}:`)),
    );
    return isExactMatch || isNestedRoute || isEditRoute;
  });

  return (
    <li>
      <button
        type="button"
        onClick={toggleExpand}
        className={`admin-navitem admin-navitem--parent ${
          isCollapsed ? "admin-navitem--collapsed" : ""
        } ${isParentActive ? "is-active" : ""}`}
        title={isCollapsed ? route.name : ""}
        aria-expanded={!isCollapsed && expanded}
      >
        {route.icon && (
          <span className="admin-navitem__icon" aria-hidden="true">
            {React.createElement(route.icon, {
              className: "h-[18px] w-[18px] flex-shrink-0",
            })}
          </span>
        )}
        {!isCollapsed && (
          <>
            <span className="admin-navitem__label">{route.name}</span>
            <span className="admin-navitem__chevron" aria-hidden="true">
              {expanded ? (
                <FiChevronDown className="h-4 w-4" />
              ) : (
                <FiChevronRight className="h-4 w-4" />
              )}
            </span>
          </>
        )}
      </button>

      {!isCollapsed && expanded && route.routes && (
        <ul className="admin-submenu">
          {route.routes.map((subRoute) => {
            const currentPath = location.pathname;
            const subRoutePath = safePath(subRoute.path);
            if (!subRoutePath) {
              return (
                <li
                  key={subRoute.productKey || subRoute._id || subRoute.name}
                  className="relative"
                >
                  <span className="block px-3 py-2 text-sm italic text-white/40">
                    {subRoute.name || "Untitled"}{" "}
                    <span className="text-[10px] not-italic">(no path)</span>
                  </span>
                </li>
              );
            }
            const isExactMatch = currentPath === subRoutePath;
            const isNestedRoute = currentPath.startsWith(`${subRoutePath}/`);
            const pathBase = subRoutePath.split("/:")[0];
            const isEditRoute = Boolean(
              pathBase &&
                (currentPath === pathBase ||
                  currentPath.startsWith(`${pathBase}/`) ||
                  currentPath.startsWith(`${pathBase}:`)),
            );
            const isCurrentRoute =
              isExactMatch || isNestedRoute || isEditRoute;

            return (
              <li
                key={subRoute.productKey || subRoute._id || subRoute.name}
                className="relative"
              >
                <NavLink
                  to={subRoutePath}
                  className={`admin-navitem admin-navitem--child${
                    isCurrentRoute ? " is-active" : ""
                  }`}
                  activeClassName="is-active"
                >
                  <span className="admin-navitem__label">{subRoute.name}</span>
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
