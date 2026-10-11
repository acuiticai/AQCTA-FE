import React from "react";

/**
 * Warning banner when System Users are near or at the subscription plan limit.
 */
const UserLimitBanner = ({ userUsage, className = "mb-4" }) => {
  if (!userUsage?.limited) return null;

  const showBanner =
    userUsage.atLimit || Boolean(userUsage.usageWarningLevel);
  if (!showBanner) return null;

  const isCritical =
    userUsage.atLimit || userUsage.usageWarningLevel === "critical";

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${className} ${
        isCritical
          ? "border-red-300 bg-red-50 text-red-900"
          : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
      role="status"
    >
      {userUsage.atLimit ? (
        <>
          You have used all <strong>{userUsage.maxUsers}</strong> System User
          {userUsage.maxUsers === 1 ? "" : "s"} included in your{" "}
          <strong>{userUsage.planName || "plan"}</strong>. Delete a user or
          upgrade your subscription to add more.
        </>
      ) : userUsage.usageWarningLevel === "critical" ? (
        <>
          System users: <strong>{userUsage.used}</strong> of{" "}
          <strong>{userUsage.maxUsers}</strong> used
          {userUsage.remaining != null
            ? ` (${userUsage.remaining} remaining)`
            : ""}
          . You are nearly at your plan limit — upgrade your subscription to add
          more users.
        </>
      ) : (
        <>
          System users: <strong>{userUsage.used}</strong> of{" "}
          <strong>{userUsage.maxUsers}</strong> used
          {userUsage.remaining != null
            ? ` (${userUsage.remaining} remaining)`
            : ""}
          . You are approaching your plan&apos;s user limit.
        </>
      )}
    </div>
  );
};

export default UserLimitBanner;
