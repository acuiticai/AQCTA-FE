/** Extra billable users beyond the core plan's included seats. */
export const computeExtraUsers = (totalUsers, includedUsers) => {
  const total = Math.max(0, Math.round(Number(totalUsers) || 0));
  const included = Math.max(0, Math.round(Number(includedUsers) || 0));
  return Math.max(0, total - included);
};

/** Core + (totalUsers - includedUsers) × per-user tier rate. */
export const computeBillCents = (coreCents, totalUsers, includedUsers, rateCents) => {
  const core = Math.max(0, Math.round(Number(coreCents) || 0));
  const rate = Math.max(0, Math.round(Number(rateCents) || 0));
  const extra = computeExtraUsers(totalUsers, includedUsers);
  return core + extra * rate;
};

/** Tier min/max are total users (not extra users). */
export const tierMatchesTotalUsers = (tier, totalUsers) => {
  const total = Math.round(Number(totalUsers) || 0);
  if (total < 1) return false;
  const min = Math.max(1, Number(tier.minUsers) || 1);
  if (tier.unlimitedMaxUsers || tier.maxUsers == null) {
    return total >= min;
  }
  const max = Math.max(min, Number(tier.maxUsers) || min);
  return total >= min && total <= max;
};

export const resolveTierForTotalUsers = (tiers = [], totalUsers, includedUsers) => {
  const total = Math.round(Number(totalUsers) || 0);
  const included = Math.max(0, Number(includedUsers) || 0);
  if (total <= included) return null;

  const matching = tiers.filter((tier) => tierMatchesTotalUsers(tier, total));
  if (!matching.length) return null;

  // Prefer the highest minUsers so boundary counts (e.g. 201) map to the top tier.
  return matching.reduce((best, tier) => {
    const bestMin = Math.max(1, Number(best.minUsers) || 1);
    const tierMin = Math.max(1, Number(tier.minUsers) || 1);
    return tierMin >= bestMin ? tier : best;
  });
};

/** Fallback when API bounds are not loaded yet (cap is set on the backend via PRICING_MAX_SELECTABLE_USERS). */
export const DEFAULT_UNLIMITED_TIER_USER_CAP = 5000;

export const getUserCountBounds = (
  tiers = [],
  includedUsers = 0,
  unlimitedCap = DEFAULT_UNLIMITED_TIER_USER_CAP,
) => {
  const included = Math.max(0, Number(includedUsers) || 0);
  const cap =
    Number.isFinite(Number(unlimitedCap)) && Number(unlimitedCap) >= 1
      ? Number(unlimitedCap)
      : DEFAULT_UNLIMITED_TIER_USER_CAP;
  let max = Math.max(1, included);
  let hasUnlimitedTier = false;
  let unlimitedTierMin = null;

  for (const tier of tiers) {
    if (tier.unlimitedMaxUsers || tier.maxUsers == null) {
      hasUnlimitedTier = true;
      const min = Math.max(1, Number(tier.minUsers) || 1);
      unlimitedTierMin =
        unlimitedTierMin == null ? min : Math.min(unlimitedTierMin, min);
      max = Math.max(max, cap);
    } else {
      max = Math.max(max, Number(tier.maxUsers) || 0);
    }
  }

  return {
    min: Math.max(1, included > 0 ? included : 1),
    max,
    hasUnlimitedTier,
    unlimitedTierMin,
    unlimitedCap: hasUnlimitedTier ? cap : null,
  };
};

export const getMaxSelectableUsers = (tiers = [], includedUsers = 0) =>
  getUserCountBounds(tiers, includedUsers).max;

/**
 * Scale labels for the total-users slider, derived from core included seats
 * and each tier's range — not even arithmetic steps across the range.
 */
export const buildUserCountSliderMarks = ({
  tiers = [],
  includedUsers = 0,
  minSelectable = 1,
  maxSelectable = 1,
  hasUnlimitedTiers = false,
  unlimitedTierMin = null,
} = {}) => {
  const min = Math.max(1, Math.round(Number(minSelectable) || 1));
  const max = Math.max(min, Math.round(Number(maxSelectable) || min));
  const included = Math.max(0, Math.round(Number(includedUsers) || 0));
  const unlimitedStart = Math.max(
    0,
    Math.round(Number(unlimitedTierMin) || 0),
  );
  const values = new Set([min]);

  if (included >= min && included <= max) {
    values.add(included);
  }

  const sortedTiers = [...tiers].sort(
    (a, b) =>
      Math.max(1, Number(a.minUsers) || 1) -
      Math.max(1, Number(b.minUsers) || 1),
  );

  for (const tier of sortedTiers) {
    const tierMin = Math.max(1, Number(tier.minUsers) || 1);
    if (tier.unlimitedMaxUsers || tier.maxUsers == null) {
      // Shown once as the final "N+" mark below — skip duplicate mid label.
      continue;
    }
    const tierMax = Math.max(tierMin, Number(tier.maxUsers) || tierMin);
    if (tierMax >= min && tierMax <= max) values.add(tierMax);
  }

  // Final mark is always the selectable max so the last track segment spans
  // the full remaining range; its label reads "N+" for unlimited tiers.
  values.add(max);

  let marks = [...values].sort((a, b) => a - b);

  const MAX_MARKS = 6;
  if (marks.length > MAX_MARKS) {
    const kept = new Set([marks[0], marks[marks.length - 1]]);
    const middle = marks.slice(1, -1);
    const step = Math.max(1, Math.ceil(middle.length / (MAX_MARKS - 2)));
    for (let i = 0; i < middle.length; i += step) {
      kept.add(middle[i]);
    }
    marks = [...kept].sort((a, b) => a - b);
  }

  return marks.map((value, index) => {
    const isLast = index === marks.length - 1;
    if (hasUnlimitedTiers && isLast) {
      // Show the configured cap (PRICING_MAX_SELECTABLE_USERS, e.g. 5000+).
      return { value, label: `${value}+` };
    }
    return { value, label: String(value) };
  });
};

/**
 * The slider scale labels are evenly spaced, so the slider itself must be
 * piecewise: each segment between adjacent marks gets equal track width.
 * These helpers convert between a user count and a slider position (0–resolution).
 */
export const SLIDER_POSITION_RESOLUTION = 1000;

export const userCountToSliderPos = (
  marks = [],
  count,
  resolution = SLIDER_POSITION_RESOLUTION,
) => {
  if (!marks.length) return 0;
  const values = marks.map((m) => m.value);
  const value = Math.max(values[0], Math.min(values[values.length - 1], Math.round(Number(count) || 0)));
  if (values.length === 1) return 0;

  const segmentWidth = resolution / (values.length - 1);
  for (let i = 0; i < values.length - 1; i++) {
    const start = values[i];
    const end = values[i + 1];
    if (value <= end) {
      const ratio = end > start ? (value - start) / (end - start) : 0;
      return Math.round(segmentWidth * (i + ratio));
    }
  }
  return resolution;
};

export const sliderPosToUserCount = (
  marks = [],
  pos,
  resolution = SLIDER_POSITION_RESOLUTION,
) => {
  if (!marks.length) return 1;
  const values = marks.map((m) => m.value);
  if (values.length === 1) return values[0];

  const clamped = Math.max(0, Math.min(resolution, Number(pos) || 0));
  const segmentWidth = resolution / (values.length - 1);
  const index = Math.min(values.length - 2, Math.floor(clamped / segmentWidth));
  const ratio = (clamped - index * segmentWidth) / segmentWidth;
  const start = values[index];
  const end = values[index + 1];
  return Math.round(start + (end - start) * ratio);
};

export const formatTotalUserRange = (tier) => {
  const min = Math.max(1, Number(tier.minUsers) || 1);
  if (tier.unlimitedMaxUsers || tier.maxUsers == null) {
    return `${min}+ users`;
  }
  const max = Math.max(min, Number(tier.maxUsers) || min);
  if (min === max) {
    return `${max} user${max === 1 ? "" : "s"}`;
  }
  return `${min}–${max} users`;
};

export const formatExtraUserRange = (tier, includedUsers = 0) => {
  const included = Math.max(0, Number(includedUsers) || 0);
  const minTotal = Math.max(1, Number(tier.minUsers) || 1);
  const minExtra = Math.max(1, minTotal - included);
  if (tier.unlimitedMaxUsers || tier.maxUsers == null) {
    return `${minExtra}+ extra users`;
  }
  const maxTotal = Math.max(minTotal, Number(tier.maxUsers) || minTotal);
  const maxExtra = Math.max(minExtra, maxTotal - included);
  if (minExtra === maxExtra) {
    return `${minExtra} extra user${minExtra === 1 ? "" : "s"}`;
  }
  return `${minExtra}–${maxExtra} extra users`;
};
