/** Subscription / onboarding / billing UI currency helpers (MYR shown as RM, no space). */

export const normalizeSubscriptionCurrencyCode = (currency) =>
  String(currency || "myr")
    .trim()
    .toLowerCase();

/** Display code for labels (MYR → RM). */
export const getSubscriptionCurrencyDisplayCode = (currency) => {
  const code = normalizeSubscriptionCurrencyCode(currency);
  if (code === "myr") return "RM";
  return code.toUpperCase();
};

/**
 * Format a major-unit amount (e.g. 4.5 for RM 4.50).
 * MYR: RM4.00 (no space). Subscription billing always shows two decimal places.
 */
export const formatSubscriptionAmount = (
  amount,
  currency = "myr",
  { detailed = true, compact = false } = {},
) => {
  const code = normalizeSubscriptionCurrencyCode(currency);
  const value = Number(amount) || 0;
  const digits = compact && !detailed ? 0 : 2;

  if (code === "myr") {
    const number = new Intl.NumberFormat("en-MY", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Math.abs(value));
    return value < 0 ? `-RM${number}` : `RM${number}`;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

  return formatted.replace(/\bMYR\b/g, "RM").replace(/RM\s+/g, "RM");
};

/** Format cents as currency (subscription UI). */
export const formatSubscriptionCents = (cents, currency = "myr", options) =>
  formatSubscriptionAmount((Number(cents) || 0) / 100, currency, options);

export const formatSubscriptionCentsDetailed = (cents, currency = "myr") =>
  formatSubscriptionCents(cents, currency, { detailed: true });

export const formatSubscriptionAmountDetailed = (amount, currency = "myr") =>
  formatSubscriptionAmount(amount, currency, { detailed: true });
