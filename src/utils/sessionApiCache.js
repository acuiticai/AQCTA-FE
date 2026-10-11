import axios from "axios";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Default cache window: avoids duplicate network on layout + guards + sidebar while navigating. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** In-flight deduplication (Strict Mode double mount + parallel callers). */
const inflight = new Map();

function runDeduped(key, factory) {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = factory().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

const slots = {
  configuration: { key: null, value: null, expires: 0 },
  modules: { key: null, value: null, expires: 0 },
  assigned: { key: null, value: null, expires: 0 },
};

function cacheGet(slot, key) {
  const e = slots[slot];
  if (e.key === key && e.expires > Date.now()) return e.value;
  return null;
}

function cacheSet(slot, key, value, ttlMs) {
  slots[slot] = { key, value, expires: Date.now() + ttlMs };
}

function tokenKey(token) {
  if (!token || typeof token !== "string") return "";
  return token.length <= 32 ? token : token.slice(-32);
}

/**
 * Clears cached GET responses (call on logout). In-flight requests are not aborted.
 */
export function clearSessionApiCache() {
  slots.configuration = { key: null, value: null, expires: 0 };
  slots.modules = { key: null, value: null, expires: 0 };
  slots.assigned = { key: null, value: null, expires: 0 };
}

/** Force next modules fetch to hit the server (e.g. after subscription role sync). */
export function invalidateModulesCache() {
  slots.modules = { key: null, value: null, expires: 0 };
}

/** Force next configuration fetch to hit the server (e.g. after theme/settings save). */
export function invalidateConfigurationCache() {
  slots.configuration = { key: null, value: null, expires: 0 };
}

/** Dispatched after configuration save so hooks (e.g. useButtonColor) can refetch. */
export const CONFIGURATION_UPDATED_EVENT = "configuration-updated";

export function notifyConfigurationUpdated(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CONFIGURATION_UPDATED_EVENT, { detail }),
  );
}

export { applyThemeColorVars } from "@/utils/themeColors";

/**
 * GET /configuration — deduped + cached. Returns full axios response (for status / interceptors).
 */
export function getCachedConfigurationResponse(token, ttlMs = DEFAULT_TTL_MS) {
  const tk = tokenKey(token);
  if (!tk) {
    return Promise.resolve(null);
  }
  const ck = `cfg:${tk}`;
  const hit = cacheGet("configuration", ck);
  if (hit) return Promise.resolve(hit);

  return runDeduped(`cfg:${ck}`, async () => {
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    };
    const response = await axios.get(`${BASE_URL}/configuration`, { headers });
    cacheSet("configuration", ck, response, ttlMs);
    return response;
  });
}

/**
 * GET /Module/get_Dynamic_Modules/:id — deduped + cached. Returns `response.data` shape.
 */
export function getCachedDynamicModulesPayload(
  adminId,
  token,
  ttlMs = DEFAULT_TTL_MS,
) {
  const id = adminId != null ? String(adminId) : "";
  const tk = tokenKey(token);
  if (!id || !tk) {
    return Promise.reject(new Error("getCachedDynamicModulesPayload: missing id or token"));
  }
  const ck = `mod:${id}:${tk}`;
  const hit = cacheGet("modules", ck);
  if (hit) return Promise.resolve(hit);

  return runDeduped(`mod:${ck}`, async () => {
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    };
    const response = await axios.get(
      `${BASE_URL}/Module/get_Dynamic_Modules/${id}`,
      { headers },
    );
    const payload = response.data;
    cacheSet("modules", ck, payload, ttlMs);
    return payload;
  });
}

/**
 * GET /admin/assigned/:adminId — deduped + cached. Returns axios response (caller reads `data`).
 */
export function getCachedAdminAssignedResponse(
  adminId,
  token,
  ttlMs = DEFAULT_TTL_MS,
  apiBaseUrl = BASE_URL,
) {
  const base = apiBaseUrl || BASE_URL;
  const id = adminId != null ? String(adminId) : "";
  const tk = tokenKey(token);
  const ck = `asg:${base}:${id}:${tk}`;
  const hit = cacheGet("assigned", ck);
  if (hit) return Promise.resolve(hit);

  return runDeduped(`asg:${ck}`, async () => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.get(`${base}/admin/assigned/${id}`, {
      headers,
    });
    cacheSet("assigned", ck, response, ttlMs);
    return response;
  });
}

/**
 * Reload role.modules from the server after subscription activation so
 * permission checks (useModulePermissions) match the updated UserRole.
 */
export async function syncAdminInfoRoleFromServer(adminInfo) {
  if (!adminInfo?.id || !adminInfo?.token) {
    return adminInfo;
  }

  clearSessionApiCache();
  const data = await getCachedDynamicModulesPayload(adminInfo.id, adminInfo.token);
  if (!data?.role) return adminInfo;

  return {
    ...adminInfo,
    role: data.role,
  };
}
