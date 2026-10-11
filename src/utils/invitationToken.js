/**
 * Carries an invitation token across the multi-step registration wizard
 * (Register -> Verify Email -> Set Password -> Modules) when a customer
 * arrives via /onboarding/invitation/:token and needs to create an account
 * (Scenario B of the invitation-based onboarding flow).
 */
export const INVITATION_TOKEN_STORAGE_KEY = "flexa_invitation_token";

export function getStoredInvitationToken() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY) || null;
  } catch (_err) {
    return null;
  }
}

export function setStoredInvitationToken(token) {
  if (typeof window === "undefined" || !token) return;
  try {
    sessionStorage.setItem(INVITATION_TOKEN_STORAGE_KEY, token);
  } catch (_err) {
    /* ignore storage failures (e.g. private browsing) */
  }
}

export function clearStoredInvitationToken() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(INVITATION_TOKEN_STORAGE_KEY);
  } catch (_err) {
    /* ignore */
  }
}
