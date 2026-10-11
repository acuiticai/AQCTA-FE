/**
 * Outbound email defaults — loaded from PCI-BE GET /api/public-config
 * (EMAIL_USER, EMAIL_FROM_NAME, EMAIL_CC).
 */
import {
  ensurePublicEmailConfigLoaded,
  getCachedPublicEmailConfig,
} from "@/services/publicConfigService";

export { ensurePublicEmailConfigLoaded };

export const getDefaultFromEmail = () =>
  getCachedPublicEmailConfig()?.emailUser || "";

export const getDefaultFromName = () =>
  getCachedPublicEmailConfig()?.emailFromName || "";

export const getDefaultCcEmail = () => {
  const cached = getCachedPublicEmailConfig();
  if (!cached) return "";
  return cached.emailCc || cached.emailUser || "";
};

/** Prefer logged-in admin email, then server default */
export const resolveFromEmail = (adminEmail) => {
  const admin = String(adminEmail || "").trim();
  return admin || getDefaultFromEmail();
};

export const defaultEmailFormFields = () => ({
  from: getDefaultFromEmail(),
  cc: getDefaultCcEmail(),
});
