export const SEND_FREQUENCY_OPTIONS = [
  { value: "once", label: "Just once" },
  { value: "daily", label: "Daily" },
  { value: "every_2_days", label: "Every 2 days" },
  { value: "every_7_days", label: "Every 7 days" },
  { value: "every_14_days", label: "Every 14 days" },
  { value: "every_30_days", label: "Every 30 days" },
  { value: "custom", label: "Custom (every N days)" },
];

export function toYyyyMmDd(value) {
  if (!value) return "";
  if (typeof value === "string") {
    // Date-only strings (date picker / API) — keep as-is, no timezone shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    if (typeof value === "string") {
      const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : "";
    }
    return "";
  }
  // UTC midnight (common when a date-only was stored as Date) — use UTC calendar
  // day so west-of-UTC clients don't show the previous day.
  const useUtc =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  const y = useUtc ? d.getUTCFullYear() : d.getFullYear();
  const m = String((useUtc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, "0");
  const day = String(useUtc ? d.getUTCDate() : d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatScheduleLabel(row) {
  if (!row) return "-";
  if (row.scheduleLabel) return row.scheduleLabel;

  const time = row.sendTime || "";
  const frequency = row.sendFrequency || "once";

  if (frequency === "once") {
    const day = row.startDate ? toYyyyMmDd(row.startDate) : "";
    return day ? `Once on ${day} at ${time || "—"}` : `Once at ${time || "—"}`;
  }
  if (frequency === "custom") {
    const n = row.sendIntervalDays || 1;
    return `Every ${n} day${n === 1 ? "" : "s"} at ${time || "—"}`;
  }

  const opt = SEND_FREQUENCY_OPTIONS.find((o) => o.value === frequency);
  return `${opt?.label || frequency} at ${time || "—"}`;
}
