import { handleNotificationPermission } from "@/utils/generic";

export const requestFirebaseNotificationPermission = async () => {
  return await handleNotificationPermission();
};
