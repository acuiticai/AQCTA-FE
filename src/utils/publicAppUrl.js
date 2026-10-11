/** Live AQCTA origin for emails, copied links, QR codes, and exported URLs. */
export const LIVE_FRONT_URL = "https://epics.altitudeprojects.net";

export const isLocalhostUrl = (url) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(\b|:|\/|$)/i.test(String(url || ""));

const trimSlash = (url) => String(url || "").trim().replace(/\/+$/, "");

/**
 * Public app origin. Skips localhost so copied/shown/emailed links always
 * point at the live site, even when the admin is working locally.
 */
export const getPublicAppUrl = () => {
  const envUrl = trimSlash(import.meta.env.VITE_APP_FRONT_URL);
  if (envUrl && !isLocalhostUrl(envUrl)) return envUrl;

  if (typeof window !== "undefined") {
    const origin = trimSlash(window.location.origin);
    if (origin && !isLocalhostUrl(origin)) return origin;
  }

  return LIVE_FRONT_URL;
};
