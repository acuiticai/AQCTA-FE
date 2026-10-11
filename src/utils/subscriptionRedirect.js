import {
  hasPathPermission,
  PERMISSION_ACTION,
} from "@/utils/permissionUtils";

const ONBOARDING_PATHS = [
  "/register",
  "/verify-email",
  "/set-password",
  "/onboarding/modules",
  "/onboarding/pricing",
  "/onboarding/payment-success",
  // Invitation onboarding pages (assigned plan checkout + legacy wait pages)
  "/onboarding/registration-submitted",
  "/onboarding/waiting-invitation",
  "/onboarding/invitation",
];

const RESUBSCRIBE_PATHS = [
  ...ONBOARDING_PATHS,
  "/billing",
  "/billing/adjust/modules",
  "/billing/adjust/pricing",
];

export function isOnboardingRoute(pathname) {
  const p = pathname || "";
  return ONBOARDING_PATHS.some(
    (route) => p === route || p.startsWith(`${route}/`),
  );
}

export function isResubscribeRoute(pathname) {
  const p = pathname || "";
  return RESUBSCRIBE_PATHS.some(
    (route) => p === route || p.startsWith(`${route}/`),
  );
}

/**
 * Invitation checkout path: Pending tenants who already selected modules and
 * have an assigned invitation plan go to their read-only invitation page.
 * Otherwise return null so callers continue to the modules / pricing flow.
 */
function resolveInvitationModePath(sub) {
  if (
    sub?.invitation?.token &&
    sub.invitation?.hasPlan &&
    sub.selectedModules?.length > 0
  ) {
    return `/onboarding/invitation/${sub.invitation.token}`;
  }
  return null;
}

function normalizeLandingPath(path) {
  if (path == null || path === "") return "/home";
  const raw = String(path).trim();
  if (!raw) return "/home";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function canViewMarkAttendance(loginResponse) {
  if (loginResponse?.role?.isSuperAdmin === true) return true;
  const modules = loginResponse?.role?.modules;
  if (!Array.isArray(modules)) return false;
  return hasPathPermission(
    modules,
    "/user-attendance",
    PERMISSION_ACTION.VIEW,
  );
}

/**
 * Resolve landing path after login based on subscription state.
 * Legacy/admin-provisioned users are unaffected (subscription is null).
 */
export function resolvePostLoginPath(loginResponse) {
  const sub = loginResponse?.subscription;
  if (sub?.isSelfRegistered && sub.subscriptionStatus === "Expired") {
    return "/billing";
  }

  if (sub?.isSelfRegistered && sub.subscriptionStatus === "Pending") {
    const invitationPath = resolveInvitationModePath(sub);
    if (invitationPath) return invitationPath;
  }

  if (
    sub?.isSelfRegistered &&
    (sub.subscriptionStatus === "Pending" ||
      sub.subscriptionStatus === "Cancelled")
  ) {
    if (sub.selectedModules?.length > 0) {
      return "/onboarding/modules?plan=1";
    }
    return "/onboarding/modules";
  }

  const attendanceAllowed = canViewMarkAttendance(loginResponse);

  // Staff preference — only honor when role can actually open Mark Attendance.
  if (loginResponse?.viewAttendanceAfterLogin && attendanceAllowed) {
    return "/user-attendance";
  }

  const landing = normalizeLandingPath(
    loginResponse?.role?.landing_page || "/home",
  );

  // Role landing_page may still point at attendance without View permission.
  if (
    landing.toLowerCase() === "/user-attendance" &&
    !attendanceAllowed
  ) {
    return "/home";
  }

  return landing;
}

/**
 * Returns true when an authenticated self-registered user must complete onboarding,
 * renew an expired plan, or resubscribe.
 */
export function requiresSubscriptionRedirect(adminInfo, pathname) {
  const sub = adminInfo?.subscription;
  if (!sub?.isSelfRegistered) return false;
  if (sub.subscriptionStatus === "Active") return false;
  if (isResubscribeRoute(pathname)) return false;
  return (
    sub.subscriptionStatus === "Pending" ||
    sub.subscriptionStatus === "Cancelled" ||
    sub.subscriptionStatus === "Expired"
  );
}

export function getSubscriptionRedirectPath(adminInfo) {
  const sub = adminInfo?.subscription;
  if (sub?.subscriptionStatus === "Expired") {
    return "/billing";
  }
  if (sub?.subscriptionStatus === "Pending") {
    const invitationPath = resolveInvitationModePath(sub);
    if (invitationPath) return invitationPath;
  }
  if (sub?.selectedModules?.length > 0) {
    return "/onboarding/modules?plan=1";
  }
  return "/onboarding/modules";
}

export function patchAdminInfoSubscriptionStatus(status) {
  if (typeof window === "undefined" || !status) return null;
  try {
    const raw = localStorage.getItem("adminInfo");
    if (!raw) return null;
    const adminInfo = JSON.parse(raw);
    adminInfo.subscription = {
      ...(adminInfo.subscription || {}),
      isSelfRegistered: true,
      subscriptionStatus: status,
    };
    localStorage.setItem("adminInfo", JSON.stringify(adminInfo));
    return adminInfo;
  } catch {
    return null;
  }
}
