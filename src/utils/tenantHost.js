/**
 * True when the browser hostname is a tenant URL that must exist in BusinessGroup (mirrors backend).
 */
export function hostnameRequiresTenantCheck(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1") return false;
  if (h === "app.flexaerp.com" || h === "flexaerp.com") return false;
  if (h === "app.localhost") return false;

  if (h.endsWith(".flexaerp.com")) {
    const raw = h.slice(0, -".flexaerp.com".length);
    if (!raw || raw.includes(".")) return false;
    if (raw === "app" || raw === "www" || raw === "demo") return false;
    return true;
  }

  if (h.endsWith(".localhost")) {
    const raw = h.slice(0, -".localhost".length);
    if (!raw || raw.includes(".")) return false;
    if (raw === "app" || raw === "demo") return false;
    return true;
  }

  return false;
}

/**
 * Initial tenant gate for first paint: non-subdomain hosts skip the loading screen
 * until the effect runs (same outcome, no flash).
 */
export function getInitialTenantGate() {
  if (typeof window === "undefined") return { ready: false, invalid: false };
  if (!hostnameRequiresTenantCheck(window.location.hostname)) {
    return { ready: true, invalid: false };
  }
  return { ready: false, invalid: false };
}

/**
 * Routes that may render before /api/configuration finishes on tenant subdomains.
 * Avoids blocking the login and other public pages on slow configuration checks.
 */
export function isTenantPublicRoute(pathname) {
  const p = pathname || "";
  if (p === "/login" || p.startsWith("/login/")) return true;
  if (p === "/User_Login" || p.startsWith("/User_Login/")) return true;
  if (p === "/forgot-password" || p.startsWith("/forgot-password")) return true;
  if (p.startsWith("/reset-password/")) return true;
  if (p.startsWith("/signup/")) return true;
  if (p === "/OtpVerification") return true;
  if (p === "/Reset") return true;
  if (p === "/privacy-policy" || p.startsWith("/privacy-policy/")) return true;
  if (p === "/support" || p.startsWith("/support/")) return true;
  if (p.startsWith("/sign-contract/")) return true;
  if (p.startsWith("/sign-purchase-contract/")) return true;
  // Public POS QR ordering page — customers scan from their phone
  if (p.startsWith("/qr-order/")) return true;
  if (p === "/register" || p.startsWith("/register/")) return true;
  if (p === "/verify-email" || p.startsWith("/verify-email")) return true;
  if (p === "/set-password" || p.startsWith("/set-password")) return true;
  if (p.startsWith("/onboarding/")) return true;
  // Public campaign QR sign-up page
  if (p.startsWith("/campaign-signup/")) return true;
  // AQCTA Customer Portal — the whole surface is public (sign-in, registration,
  // OTP) and never sits behind an admin session.
  if (p === "/customer" || p.startsWith("/customer/")) return true;
  return false;
}

/**
 * Returns normalized tenant slug from hostname when tenant validation is required.
 */
export function getTenantSlugFromHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!hostnameRequiresTenantCheck(h)) return "";

  if (h.endsWith(".flexaerp.com")) return h.slice(0, -".flexaerp.com".length);
  if (h.endsWith(".localhost")) return h.slice(0, -".localhost".length);
  return "";
}

function collectSubdomainsFromNode(node, acc = new Set(), depth = 0) {
  if (!node || depth > 4) return acc;

  if (Array.isArray(node)) {
    node.forEach((item) => collectSubdomainsFromNode(item, acc, depth + 1));
    return acc;
  }

  if (typeof node !== "object") return acc;

  const toSlug = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const normalizeTenantCandidate = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (!normalized) return "";
    if (normalized.endsWith(".flexaerp.com")) {
      return normalized.slice(0, -".flexaerp.com".length);
    }
    if (normalized.endsWith(".localhost")) {
      return normalized.slice(0, -".localhost".length);
    }
    return normalized;
  };

  const directCandidates = [
    node.subdomain,
    node.tenant,
    node.tenantSlug,
    node.tenant_slug,
    node.businessGroupSubdomain,
    node.business_group_subdomain,
  ];
  directCandidates.forEach((value) => {
    const normalized = normalizeTenantCandidate(value);
    if (normalized) acc.add(normalized);
  });

  // Some payloads only include names (companyName/name). Convert to a slug and match host slug.
  const nameCandidates = [
    node.companyName,
    node.company_name,
    node.businessGroupName,
    node.business_group_name,
    node.name,
  ];
  nameCandidates.forEach((value) => {
    const slug = toSlug(value);
    if (slug) acc.add(slug);
  });

  collectSubdomainsFromNode(node.businessGroup, acc, depth + 1);
  collectSubdomainsFromNode(node.business_group, acc, depth + 1);
  collectSubdomainsFromNode(node.businesses, acc, depth + 1);
  collectSubdomainsFromNode(node.businessGroups, acc, depth + 1);
  collectSubdomainsFromNode(node.business_groups, acc, depth + 1);
  collectSubdomainsFromNode(node.role, acc, depth + 1);

  return acc;
}

function isSuperAdminUser(node) {
  const role = node?.role || {};
  if (role?.isSuperAdmin === true) return true;

  const roleName = String(role?.name || role?.title || "").toLowerCase();
  return roleName.includes("super admin");
}

function hasAssignedBusinessContext(node, depth = 0) {
  if (!node || depth > 4) return false;
  if (Array.isArray(node)) {
    if (node.length > 0) return true;
    return node.some((item) => hasAssignedBusinessContext(item, depth + 1));
  }
  if (typeof node !== "object") return false;

  const directArrays = [
    node.businesses,
    node.businessGroups,
    node.business_groups,
  ];
  if (directArrays.some((arr) => Array.isArray(arr) && arr.length > 0))
    return true;

  if (node.businessGroup || node.business_group) return true;
  if (node.role?.businessGroup || node.role?.business_group) return true;

  return false;
}

function normalizeTenantSlugValue(value) {
  if (value == null || value === "") return "";
  return String(value).trim().toLowerCase();
}

/**
 * Checks whether user payload/session belongs to the current tenant host.
 * Prefer Business Group `subdomain` from the API (`role.businessGroup` or `tenantSubdomain`).
 */
export function isUserAuthorizedForCurrentTenant(userData, hostname) {
  const tenantSlug = getTenantSlugFromHostname(hostname);
  if (!tenantSlug) return true;

  if (isSuperAdminUser(userData)) return true;

  const explicitFromRoot = normalizeTenantSlugValue(
    userData?.tenantSubdomain || userData?.businessGroupSubdomain,
  );
  if (explicitFromRoot && explicitFromRoot === tenantSlug) return true;

  const bg = userData?.role?.businessGroup;
  if (bg && typeof bg === "object") {
    const sub = normalizeTenantSlugValue(bg.subdomain);
    if (sub) {
      return sub === tenantSlug;
    }
    // Group exists but subdomain not set in DB — cannot match host; allow (same as legacy permissive path)
    return true;
  }

  // Legacy: role.businessGroup was only an ObjectId string in localStorage
  if (typeof bg === "string" && /^[a-f0-9]{24}$/i.test(bg)) {
    return true;
  }

  const allowedSubdomains = Array.from(
    collectSubdomainsFromNode(userData, new Set()),
  );

  if (allowedSubdomains.length === 0) return true;
  return allowedSubdomains.includes(tenantSlug);
}
