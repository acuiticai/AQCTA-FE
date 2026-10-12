export const DEFAULT_ADMIN_AVATAR_URL =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

export function getAdminAvatarUrl(adminInfo) {
  const image = adminInfo?.image?.trim();
  return image || DEFAULT_ADMIN_AVATAR_URL;
}
