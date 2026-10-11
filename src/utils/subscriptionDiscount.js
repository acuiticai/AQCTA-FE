/** Shared subscription discount math (integer cents, half-up rounding). */

export const roundSubscriptionCents = (value) =>
  Math.max(0, Math.round(Number(value) || 0));

export const normalizeSubscriptionPercent = (value) => {
  const pct = Number(value);
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
};

/** Discount cents from a percentage of a base amount (e.g. 22% of RM4.00 → 88). */
export const computePercentDiscountCents = (baseCents, discountPercent) => {
  const base = roundSubscriptionCents(baseCents);
  const pct = normalizeSubscriptionPercent(discountPercent);
  if (!pct || !base) return 0;
  return Math.min(base, Math.round((base * pct) / 100));
};

/** Final amount after applying a percentage discount. */
export const applyPercentDiscountCents = (baseCents, discountPercent) => {
  const base = roundSubscriptionCents(baseCents);
  const discount = computePercentDiscountCents(base, discountPercent);
  return Math.max(0, base - discount);
};
