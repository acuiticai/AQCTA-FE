/**
 * @deprecated Dashboard widgets now load from live APIs via
 * `buildDashboardPayload` / `useCustomerDashboardData`.
 * Kept empty so any leftover import never shows fake client numbers again.
 */

import { buildDashboardPayload } from "../utils/buildDashboardPayload";

const empty = buildDashboardPayload({ audience: "customer" });

export const dashboardSummary = empty.dashboardSummary;
export const applicationOverview = empty.applicationOverview;
export const pendingActions = empty.pendingActions;
export const upcomingInspections = empty.upcomingInspections;
export const recentUpdates = empty.recentUpdates;
export const recentApplications = empty.recentApplications;
export const certificates = empty.certificates;
