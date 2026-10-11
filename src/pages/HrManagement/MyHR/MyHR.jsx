"use client";

import {
  Clock,
  Home,
  Calendar,
  ArrowRight,
  User,
  Receipt,
  Umbrella,
} from "lucide-react";
import { X } from "lucide-react";
import { useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import {
  PERMISSION_ACTION,
  findModuleByName,
  findSubModuleByName,
  getPathPermissionResolution,
  getPermissionFlagsFromList,
  getPermissionsForModule,
} from "@/utils/permissionUtils";

/** When this parent exists on the role, cards use only its submodules (not global path fallbacks). */
const MY_HR_PORTAL_MODULE_NAME = "My HR";

function withLeadingSlash(p) {
  if (p == null || String(p).trim() === "") return "";
  const s = String(p).trim();
  return s.startsWith("/") ? s : `/${s}`;
}

/** Aligns with `Protected.jsx` checkAuthorization (path equals or is under a module/submodule path). */
function isPathAllowedByRoleModules(path, modules) {
  if (!Array.isArray(modules) || !path) return false;
  const p = withLeadingSlash(path);
  for (const module of modules) {
    const top = module?.path ? withLeadingSlash(module.path) : "";
    if (top && (p === top || (top !== "/" && p.startsWith(top)))) {
      return true;
    }
    for (const sub of module.subModules || []) {
      const sp = sub?.path ? withLeadingSlash(sub.path) : "";
      if (sp && (p === sp || (sp !== "/" && p.startsWith(sp)))) {
        return true;
      }
    }
  }
  return false;
}

function firstPathAllowedByRoleModules(modules, candidates) {
  if (!Array.isArray(candidates)) return null;
  for (const c of candidates) {
    const norm = withLeadingSlash(c);
    if (norm && isPathAllowedByRoleModules(norm, modules)) return norm;
  }
  return null;
}

function mergedPermissionFlags(modules, paths) {
  const merged = new Set();
  for (const path of paths) {
    const norm = withLeadingSlash(path);
    if (!norm) continue;
    const { permissions } = getPathPermissionResolution(modules, norm);
    for (const perm of permissions || []) merged.add(perm);
  }
  return getPermissionFlagsFromList([...merged]);
}

/**
 * Permissions for a My HR dashboard card.
 * If the role includes a "My HR" parent module, only that parent's matching submodule
 * counts (matches the User Roles UI). Otherwise use path-based resolution for legacy roles.
 */
function getMyHrCardPermissionFlags(modules, route) {
  const myHrParent = findModuleByName(modules, MY_HR_PORTAL_MODULE_NAME);
  const subLabel = route.myHrSubModuleName;
  if (myHrParent && subLabel) {
    const list = getPermissionsForModule(
      modules,
      MY_HR_PORTAL_MODULE_NAME,
      subLabel,
    );
    return getPermissionFlagsFromList(list);
  }
  const paths =
    route.pathsForPermissionAndNavigation?.length > 0
      ? route.pathsForPermissionAndNavigation
      : [route.path];
  return mergedPermissionFlags(modules, paths);
}

const StaffRoute = {
  name: "My HR",
  icon: User,
  routes: [
    {
      name: "Mark Attendance",
      path: "/user-attendance",
      myHrSubModuleName: "Mark Attendance",
      requiredPermission: PERMISSION_ACTION.VIEW,
      description: "Clock in/out and track your daily attendance",
      icon: Clock,
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      borderColor: "border-blue-200",
      hoverBg: "hover:bg-blue-100",
    },
    {
      name: "Request Leaves",
      path: "/staff-apply-leave",
      myHrSubModuleName: "Request Leaves",
      requiredPermission: PERMISSION_ACTION.ADD,
      description: "Apply for leaves and view leave history",
      icon: Umbrella,
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      borderColor: "border-red-200",
      hoverBg: "hover:bg-red-100",
    },
    {
      name: "Request WFH",
      path: "/staff-apply-WFH",
      myHrSubModuleName: "Request WFH",
      /** Legacy only: when "My HR" parent is absent, merge these paths. */
      pathsForPermissionAndNavigation: [
        "/staff-apply-WFH",
        "/Staff-WFH-management",
        "/staff-WFH-management",
        "/WFH-management",
      ],
      requiredPermission: PERMISSION_ACTION.ADD,
      description: "Submit work from home requests and track status",
      icon: Home,
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      borderColor: "border-green-200",
      hoverBg: "hover:bg-green-100",
    },
    {
      name: "Request Claims",
      path: "/staff-new-claim",
      myHrSubModuleName: "Request Claims",
      requiredPermission: PERMISSION_ACTION.ADD,
      description: "Submit and track expense claims",
      icon: Receipt,
      bgColor: "bg-white",
      textColor: "text-yellow-600",
      borderColor: "border-yellow-200",
      hoverBg: "hover:bg-yellow-100",
    },
    {
      name: "My Payslips",
      path: "/my-payslips",
      myHrSubModuleName: "My Payslips",
      requiredPermission: PERMISSION_ACTION.VIEW,
      description: "Review salary snapshots and download your monthly payslips",
      icon: Receipt,
      bgColor: "bg-cyan-50",
      textColor: "text-cyan-600",
      borderColor: "border-cyan-200",
      hoverBg: "hover:bg-cyan-100",
    },
    {
      name: "My Events",
      path: "/staff-event-management",
      myHrSubModuleName: "My Events",
      requiredPermission: PERMISSION_ACTION.VIEW,
      description: "View upcoming events and company announcements",
      icon: Calendar,
      bgColor: "bg-purple-50",
      textColor: "text-purple-600",
      borderColor: "border-purple-200",
      hoverBg: "hover:bg-purple-100",
    },
    {
      name: "My Calendar",
      path: "/hr-calendar",
      myHrSubModuleName: "My Calendar",
      description: "View your personal HR calendar events, leaves, and WFH",
      icon: Calendar,
      bgColor: "bg-indigo-50",
      textColor: "text-indigo-600",
      borderColor: "border-indigo-200",
      hoverBg: "hover:bg-indigo-100",
    },
    // {
    //   name: "My Calendar",
    //   path: "/my-calendar",
    //   description: "View your personal HR calendar events, leaves, and WFH",
    //   icon: Calendar,
    //   bgColor: "bg-indigo-50",
    //   textColor: "text-indigo-600",
    //   borderColor: "border-indigo-200",
    //   hoverBg: "hover:bg-indigo-100",
    // },
  ],
};

export default function MyHr() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const modules = adminInfo?.role?.modules;
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

  const accessibleRoutes = useMemo(() => {
    if (isSuperAdmin) return StaffRoute.routes;
    if (!Array.isArray(modules) || modules.length === 0) return [];

    return StaffRoute.routes.filter((route) => {
      const requiredPermission =
        route.requiredPermission || PERMISSION_ACTION.VIEW;
      const flags = getMyHrCardPermissionFlags(modules, route);

      let allowed = false;
      switch (requiredPermission) {
        case PERMISSION_ACTION.ADD:
          allowed = flags.canAdd;
          break;
        case PERMISSION_ACTION.UPDATE:
          allowed = flags.canUpdate;
          break;
        case PERMISSION_ACTION.DELETE:
          allowed = flags.canDelete;
          break;
        case PERMISSION_ACTION.VIEW_DETAILS:
          allowed = flags.canViewDetails;
          break;
        case PERMISSION_ACTION.VIEW:
        default:
          allowed = flags.canView;
          break;
      }

      if (!allowed) return false;

      const myHrMod = findModuleByName(modules, MY_HR_PORTAL_MODULE_NAME);
      if (myHrMod && route.myHrSubModuleName) {
        const sub = findSubModuleByName(myHrMod, route.myHrSubModuleName);
        const nav = sub?.path
          ? withLeadingSlash(sub.path)
          : withLeadingSlash(route.path);
        return isPathAllowedByRoleModules(nav, modules);
      }

      if (route.pathsForPermissionAndNavigation?.length > 0) {
        return Boolean(
          firstPathAllowedByRoleModules(
            modules,
            route.pathsForPermissionAndNavigation,
          ),
        );
      }
      return true;
    });
  }, [isSuperAdmin, modules]);

  const handleCardClick = (route) => {
    const myHrMod = findModuleByName(modules, MY_HR_PORTAL_MODULE_NAME);
    if (myHrMod && route.myHrSubModuleName) {
      const sub = findSubModuleByName(myHrMod, route.myHrSubModuleName);
      if (sub?.path) {
        history.push(withLeadingSlash(sub.path));
        return;
      }
    }
    const paths =
      route.pathsForPermissionAndNavigation?.length > 0
        ? route.pathsForPermissionAndNavigation
        : [route.path];
    const dest =
      firstPathAllowedByRoleModules(modules, paths) ||
      withLeadingSlash(route.path);
    history.push(dest);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[var(--p-blue)] rounded-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {StaffRoute.name}
                </h1>
              </div>
            </div>
            <button
              onClick={() => {
                history.push("/home");
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#fff1f2] text-[#ef4444] rounded-md hover:bg-[#fee2e2] transition-colors"
            >
              <X className="w-4 h-4" />
              Exit
            </button>
          </div>
          <p className="text-slate-600 mt-1">
            Manage your attendance, requests, and stay updated with events
          </p>
        </div>

        {/* Cards Grid - Three in One Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {accessibleRoutes.map((route, index) => {
            const IconComponent = route.icon;
            return (
              <div
                key={index}
                onClick={() => handleCardClick(route)}
                className={`flex flex-col group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2 ${route.bgColor} ${route.borderColor} ${route.hoverBg} border-2 rounded-xl p-6 bg-white shadow-sm`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-6">
                  <div
                    className={`p-4 rounded-xl ${route.bgColor} ${route.textColor} shadow-sm`}
                  >
                    <IconComponent className="h-8 w-8" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>

                {/* Card Content */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-slate-900 group-hover:text-slate-700 mb-3">
                    {route.name}
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    {route.description}
                  </p>
                </div>

                {/* Card Button */}
                <button
                  className="mt-auto w-full py-3 px-4 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium 
    hover:bg-slate-50 hover:shadow-md transition-all duration-300 
    group-hover:border-slate-400 flex items-center justify-center gap-2"
                >
                  Access {route.name}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
        {accessibleRoutes.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">
            You do not have permission to access My HR actions.
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 text-sm">
            Need assistance? Contact your HR department for support.
          </p>
        </div>
      </div>
    </div>
  );
}
