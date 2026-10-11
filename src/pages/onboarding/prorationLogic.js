const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC calendar day (ignores hours, minutes, seconds). */
export const toUtcCalendarDay = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * Whole calendar days from start (inclusive) to end (exclusive).
 * Example: 3 Jul → 3 Aug = 31 days.
 */
export const calendarDaysBetween = (startValue, endValue) => {
  const startDay = toUtcCalendarDay(startValue);
  const endDay = toUtcCalendarDay(endValue);
  if (startDay == null || endDay == null || endDay <= startDay) return 0;
  return Math.round((endDay - startDay) / MS_PER_DAY);
};

/**
 * Day-based proration ratio for the current billing period.
 * Uses whole calendar days only — never seconds or minutes.
 */
export const computeDayBasedProrationRatio = (
  periodStart,
  periodEnd,
  asOfDate = new Date(),
) => {
  const totalDays = calendarDaysBetween(periodStart, periodEnd);
  if (totalDays <= 0) return 1;
  const remainingDays = calendarDaysBetween(asOfDate, periodEnd);
  if (remainingDays <= 0) return 0;
  return Math.min(1, remainingDays / totalDays);
};

/** Prorate a full-period amount using calendar days (Rule 3). */
export const computeDayBasedProrationCents = (
  periodAmountCents,
  periodStart,
  periodEnd,
  asOfDate = new Date(),
) => {
  const amount = Math.max(0, Math.round(Number(periodAmountCents) || 0));
  if (!amount) return 0;
  const ratio = computeDayBasedProrationRatio(periodStart, periodEnd, asOfDate);
  return Math.round(amount * ratio);
};
