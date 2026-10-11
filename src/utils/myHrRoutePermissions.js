/**
 * My HR staff portal: every self-service URL → submodule on role "My HR".
 * Keep in sync with MyHR.jsx cards and routes/index.jsx RouteActionGate routes.
 */

export const MY_HR_MODULE_NAME = "My HR";

/**
 * @typedef {Object} MyHrRouteMapping
 * @property {string} subModuleName - Label in User Roles under "My HR"
 * @property {RegExp[]} pathPatterns
 * @property {{ moduleName: string, subModuleName: string }[]} [legacyCandidates] - When role has no "My HR" parent
 */

/** @type {MyHrRouteMapping[]} */
export const MY_HR_ROUTE_MAPPINGS = [
  {
    subModuleName: "Mark Attendance",
    pathPatterns: [/^\/user-attendance(\/|$)/i],
    legacyCandidates: [
      { moduleName: "Attendance", subModuleName: "Attendance" },
      { moduleName: "Attendance", subModuleName: "" },
      { moduleName: "Mark Attendance", subModuleName: "" },
    ],
  },
  {
    subModuleName: "Request Leaves",
    pathPatterns: [
      /^\/staff-apply-leave(\/|$)/i,
      /^\/staff-leave-management(\/|$)/i,
      /^\/staff-leave-balance(\/|$)/i,
      /^\/my-leave-balance(\/|$)/i,
    ],
    legacyCandidates: [
      { moduleName: "Leave Management", subModuleName: "Leave Management" },
      { moduleName: "Leaves", subModuleName: "" },
      { moduleName: "Leave Management", subModuleName: "" },
    ],
  },
  {
    subModuleName: "Request WFH",
    pathPatterns: [
      /^\/staff-apply-WFH(\/|$)/i,
      /^\/Staff-WFH-management(\/|$)/i,
      /^\/staff-WFH-management(\/|$)/i,
    ],
    legacyCandidates: [
      { moduleName: "WFH Requests", subModuleName: "WFH Requests" },
      { moduleName: "WFH", subModuleName: "" },
    ],
  },
  {
    subModuleName: "Request Claims",
    pathPatterns: [
      /^\/staff-new-claim(\/|$)/i,
      /^\/staff-claim-management(\/|$)/i,
      /^\/staff-claim-details(\/|$)/i,
    ],
    legacyCandidates: [
      { moduleName: "Claims", subModuleName: "Claims" },
      { moduleName: "Claims", subModuleName: "" },
    ],
  },
  {
    subModuleName: "My Payslips",
    pathPatterns: [/^\/my-payslips(\/|$)/i],
    legacyCandidates: [
      { moduleName: "Payroll", subModuleName: "Payroll" },
      { moduleName: "Payroll", subModuleName: "" },
    ],
  },
  {
    subModuleName: "My Events",
    pathPatterns: [
      /^\/staff-event-management(\/|$)/i,
      /^\/staff-task-management(\/|$)/i,
    ],
    legacyCandidates: [
      { moduleName: "Event Management", subModuleName: "Event Management" },
      { moduleName: "Event Management", subModuleName: "" },
    ],
  },
  {
    subModuleName: "My Calendar",
    /** Staff personal calendar only — admin company calendar is `/hr-calendar` (HR Calendar module). */
    pathPatterns: [/^\/my-calendar(\/|$)/i],
    legacyCandidates: [
      { moduleName: "My Calendar", subModuleName: "" },
      { moduleName: "HR Calendar", subModuleName: "HR Calendar" },
      { moduleName: "HR Calendar", subModuleName: "" },
    ],
  },
];

/** Human-readable path → submodule list (for docs / debugging). */
export const MY_HR_ROUTE_TABLE = [
  { path: "/user-attendance", subModule: "Mark Attendance" },
  { path: "/staff-apply-leave", subModule: "Request Leaves" },
  { path: "/staff-leave-management", subModule: "Request Leaves" },
  { path: "/staff-leave-balance", subModule: "Request Leaves" },
  { path: "/my-leave-balance", subModule: "Request Leaves" },
  { path: "/staff-apply-WFH", subModule: "Request WFH" },
  { path: "/Staff-WFH-management", subModule: "Request WFH" },
  { path: "/staff-WFH-management", subModule: "Request WFH" },
  { path: "/staff-new-claim", subModule: "Request Claims" },
  { path: "/staff-claim-management", subModule: "Request Claims" },
  { path: "/staff-claim-details/:id", subModule: "Request Claims" },
  { path: "/my-payslips", subModule: "My Payslips" },
  { path: "/staff-event-management", subModule: "My Events" },
  { path: "/staff-task-management", subModule: "My Events" },
  { path: "/hr-calendar", subModule: "HR Calendar (admin module)" },
  { path: "/my-calendar", subModule: "My Calendar" },
];

function normalizePath(path) {
  if (path == null || path === "") return "";
  const s = String(path).trim();
  if (!s) return "";
  return s.startsWith("/") ? s : `/${s}`;
}

/** @returns {MyHrRouteMapping | null} */
export function matchMyHrRouteMapping(pathname) {
  const current = normalizePath(pathname);
  if (!current) return null;
  for (const mapping of MY_HR_ROUTE_MAPPINGS) {
    if (mapping.pathPatterns.some((re) => re.test(current))) {
      return mapping;
    }
  }
  return null;
}

/** Build ROUTE_PERMISSION_FALLBACKS entries (one rule per mapping). */
export function buildMyHrRoutePermissionFallbacks() {
  return MY_HR_ROUTE_MAPPINGS.map((mapping) => ({
    test: (pathname) => {
      const hit = matchMyHrRouteMapping(pathname);
      return hit != null && hit.subModuleName === mapping.subModuleName;
    },
    candidates: [
      { moduleName: MY_HR_MODULE_NAME, subModuleName: mapping.subModuleName },
      { moduleName: MY_HR_MODULE_NAME, subModuleName: "" },
      ...(mapping.legacyCandidates || []),
    ],
  }));
}
