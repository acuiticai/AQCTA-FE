/** Shared helpers for in-app subscription module/plan adjustments (active tenants). */

export function isSubscriptionAdjustment(location) {
  if (!location) return false;
  const params = new URLSearchParams(location.search || "");
  const flag = params.get("adjustment");
  return flag === "1" || flag === "true";
}

export const ADJUSTMENT_MODULES_PATH = "/onboarding/modules?adjustment=1";
export const ADJUSTMENT_PRICING_PATH = "/onboarding/pricing?adjustment=1";
