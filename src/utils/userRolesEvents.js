/** Dispatched when a user role is created or updated (e.g. from User Roles drawer). */
export const USER_ROLES_CHANGED_EVENT = "flexa:user-roles-changed";

export function dispatchUserRolesChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(USER_ROLES_CHANGED_EVENT, { detail })
  );
}
