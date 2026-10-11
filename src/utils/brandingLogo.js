import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
export const BRANDING_LOGO_CACHE_KEY = "branding_logo";

/** Neutral placeholder when no logo is uploaded yet (not a brand asset). */
export const BRANDING_PLACEHOLDER_LOGO =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70" viewBox="0 0 220 70"><rect width="220" height="70" rx="8" fill="#F3F4F6"/><text x="110" y="43" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#9CA3AF">LOGO</text></svg>',
  );

export function normalizeLogoUrl(logo) {
  if (!logo || typeof logo !== "string") return null;
  const trimmed = logo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http") || trimmed.startsWith("data:")) return trimmed;
  const base = String(Base_URL || "").replace(/\/$/, "");
  if (!base) return trimmed;
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/**
 * Resolve the logo uploaded in Settings → Configuration (system_logo)
 * or tenant BusinessGroup.logo via GET /branding/logo.
 */
export async function fetchBrandingLogo(axiosConfig = {}) {
  try {
    const brandRes = await axios.get(`${Base_URL}/branding/logo`, axiosConfig);
    const fromBranding = normalizeLogoUrl(brandRes?.data?.logo);
    if (fromBranding) return fromBranding;
  } catch (_) {
    // fall through to configuration
  }

  try {
    const configRes = await axios.get(`${Base_URL}/configuration`, axiosConfig);
    const configuration = Array.isArray(configRes?.data)
      ? configRes.data[0]
      : configRes?.data;
    const fromConfig = normalizeLogoUrl(configuration?.system_logo);
    if (fromConfig) return fromConfig;
  } catch (_) {
    // no uploaded logo
  }

  return null;
}

export function readCachedBrandingLogo() {
  try {
    const cached = localStorage.getItem(BRANDING_LOGO_CACHE_KEY);
    if (!cached) return null;
    // Ignore stale hardcoded assets from earlier rebranding.
    if (
      cached.includes("/pci-full-logo") ||
      cached.includes("/pci-logo") ||
      cached.includes("Flexa_Logo") ||
      cached.includes("flexa-erp-brand") ||
      cached.includes("Flexa.jpeg") ||
      cached.includes("Flexa.png") ||
      cached.includes("/acuitic-logo") ||
      cached.includes("/acuitic-mark")
    ) {
      localStorage.removeItem(BRANDING_LOGO_CACHE_KEY);
      return null;
    }
    return cached;
  } catch (_) {
    return null;
  }
}

export function writeCachedBrandingLogo(url) {
  try {
    if (url) localStorage.setItem(BRANDING_LOGO_CACHE_KEY, url);
    else localStorage.removeItem(BRANDING_LOGO_CACHE_KEY);
  } catch (_) {
    // ignore quota / private mode
  }
}
