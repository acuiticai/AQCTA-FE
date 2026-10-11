import { getCachedAdminAssignedResponse } from "@/utils/sessionApiCache";

/** Canonical list from login / API — never overwritten by feature screens that reuse `businesses`. */
export const SESSION_ASSIGNED_BUSINESSES_KEY = "sessionAssignedBusinesses";

function getBearerToken() {
  try {
    const t = localStorage.getItem("token");
    if (t) return t;
    const adminRaw = localStorage.getItem("adminInfo");
    if (!adminRaw) return null;
    const admin = JSON.parse(adminRaw);
    return admin?.token || null;
  } catch (_) {
    return null;
  }
}

export function writeSessionAssignedBusinesses(list) {
  try {
    if (!Array.isArray(list)) return;
    localStorage.setItem(
      SESSION_ASSIGNED_BUSINESSES_KEY,
      JSON.stringify(list),
    );
  } catch (_) {
    /* ignore */
  }
}

export function clearSessionAssignedBusinesses() {
  try {
    localStorage.removeItem(SESSION_ASSIGNED_BUSINESSES_KEY);
  } catch (_) {
    /* ignore */
  }
}

/** Reads session snapshot only (no legacy `businesses` key). */
export function readSessionAssignedBusinessesOnly() {
  try {
    const raw = localStorage.getItem(SESSION_ASSIGNED_BUSINESSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Prefer session snapshot; if missing, fall back to legacy `businesses` (may be polluted).
 */
export function readAssignedBusinessesFallback() {
  const session = readSessionAssignedBusinessesOnly();
  if (session.length > 0) return session;
  try {
    const raw = localStorage.getItem("businesses");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

export function isSingleAssignedBusiness(list = readAssignedBusinessesFallback()) {
  return Array.isArray(list) && list.length === 1;
}

export function getSoleAssignedBusinessId(list = readAssignedBusinessesFallback()) {
  if (!isSingleAssignedBusiness(list)) return null;
  return list[0]?._id || list[0]?.id || null;
}

/**
 * Loads assigned businesses for the logged-in admin from the API and refreshes the session snapshot.
 */
export async function syncAssignedBusinessesFromApi(apiBaseUrl) {
  const adminRaw = localStorage.getItem("adminInfo");
  let admin = null;
  try {
    admin = adminRaw ? JSON.parse(adminRaw) : null;
  } catch (_) {
    admin = null;
  }
  const adminId = admin?.id || admin?._id;
  if (!adminId) {
    return readAssignedBusinessesFallback();
  }

  const token = getBearerToken();
  try {
    const res = await getCachedAdminAssignedResponse(adminId, token, undefined, apiBaseUrl);
    const list = Array.isArray(res.data?.businesses)
      ? res.data.businesses.filter(Boolean)
      : [];
    writeSessionAssignedBusinesses(list);
    return list;
  } catch (_) {
    return readAssignedBusinessesFallback();
  }
}
