import {
  formatDate,
  formatTime,
  formatAttendanceTime,
} from "@/components/formatAmount";

/** Statuses where first check-in time/IP are not shown. */
export const ATTENDANCE_SKIP_IN_STATUSES = [
  "Absent",
  "Leave",
  "Public Holiday",
  "Weekly Off",
];

export const staffNestedName = (value) => {
  if (!value) return "-";
  return typeof value === "object" ? value.name || "-" : String(value);
};

export const staffDeptPositionShift = (staff) => ({
  department: staffNestedName(staff?.department),
  position: staffNestedName(staff?.position),
  shift: staffNestedName(staff?.shift),
});

const formatCheckInTime = (rec, timezone) => {
  if (!rec?.firstCheckIn?.timestamp) return "-";
  if (timezone) {
    return formatAttendanceTime({
      formattedTime: rec.firstCheckIn.formattedTime,
      timestamp: rec.firstCheckIn.timestamp,
      timezone,
    });
  }
  return formatTime(rec.firstCheckIn.timestamp);
};

const formatCheckOutTime = (rec, timezone) => {
  if (!rec?.lastCheckOut?.timestamp) return "-";
  if (timezone) {
    return formatAttendanceTime({
      formattedTime: rec.lastCheckOut.formattedTime,
      timestamp: rec.lastCheckOut.timestamp,
      timezone,
    });
  }
  return formatTime(rec.lastCheckOut.timestamp);
};

/** First check-in / last check-out times (UI, exports). Optional timezone for staff shift. */
export const getAttendanceInOutDisplay = (rec, timezone = null) => {
  const status = rec?.status;
  const skipIn = ATTENDANCE_SKIP_IN_STATUSES.includes(status);
  const inValue = skipIn ? "-" : formatCheckInTime(rec, timezone);
  const outValue =
    status === "Absent" ? "-" : formatCheckOutTime(rec, timezone);
  return { inValue, outValue };
};

/** First check-in / last check-out IP (export + detail popup). */
export const getAttendanceIpDisplay = (rec) => {
  const status = rec?.status;
  const skipIn = ATTENDANCE_SKIP_IN_STATUSES.includes(status);
  const checkInIp = skipIn
    ? "-"
    : rec?.firstCheckIn?.ipAddress?.trim() || "-";
  const checkOutIp =
    status === "Absent"
      ? "-"
      : rec?.lastCheckOut?.ipAddress?.trim() || "-";
  return { checkInIp, checkOutIp };
};

export const getAttendanceStatusColor = (status) => {
  if (status === "Present") return "text-green-500 bg-green-50";
  if (status === "Absent") return "text-red-500 bg-red-50";
  if (status === "Leave") return "text-yellow-500 bg-yellow-50";
  return "text-yellow-500 bg-yellow-50";
};

/**
 * Shared helpers for HR report pages — avoids pagination/limit fetch loops
 * with DataTable's global page-size config.
 */
export const readConfiguredPageSize = (fallback = 10) => {
  try {
    const raw = localStorage.getItem("configurations");
    if (!raw) return fallback;
    const cfg = JSON.parse(raw);
    const stored = cfg?.table_entries_per_page;
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch {
    // ignore
  }
  return fallback;
};

/** Only update state when the value actually changes (avoids extra useEffect runs). */
/** Shared staff columns — use with skipDynamicColumnWidths on HR report tables. */
export const getHrReportStaffColWidths = (t) => ({
  [t("hrReports.common.name")]: "276px",
  [t("hrReports.common.department")]: "88px",
  [t("hrReports.common.position")]: "108px",
  [t("hrReports.common.shift")]: "96px",
});

/** Attendance report column widths (translated header keys). */
export const getHrAttendanceReportColWidths = (t, extra = {}) => ({
  ...getHrReportStaffColWidths(t),
  [t("hrReports.common.date")]: "92px",
  [t("hrReports.common.in")]: "52px",
  [t("hrReports.common.out")]: "52px",
  [t("hrReports.common.totalHours")]: "70px",
  [t("hrReports.common.overtime")]: "70px",
  [t("hrReports.common.status")]: "115px",
  ...extra,
});

export const applyPaginationFromResponse = ({
  res,
  setCurrentPage,
  setTotalPages,
  setTotal,
  fallbackLimit,
}) => {
  const nextPage = res?.data?.currentPage ?? 1;
  const nextTotalPages = res?.data?.totalPages ?? 1;
  const nextTotal = res?.data?.total ?? 0;

  setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
  setTotalPages((prev) => (prev === nextTotalPages ? prev : nextTotalPages));
  setTotal((prev) => (prev === nextTotal ? prev : nextTotal));

  // Do not sync limit from API — parent owns page size (prevents fight with DataTable config).
  void fallbackLimit;
};
