import {
  computeBillCents,
  computeExtraUsers,
} from "./pricingLogic";
import { computeDayBasedProrationCents } from "./prorationLogic";
import { applyPercentDiscountCents } from "@/utils/subscriptionDiscount";

export const CORE_ONLY_PLAN_ID = "__core_only__";

const tierRateCentsFromQuote = (tier) => {
  if (!tier) return 0;
  if (typeof tier.perUserRateCents === "number" && tier.perUserRateCents >= 0) {
    return tier.perUserRateCents;
  }
  const base = Math.max(0, Math.round(Number(tier.monthlyCents) || 0));
  const pct = Math.min(
    100,
    Math.max(0, Math.round(Number(tier.discountPercent) || 0)),
  );
  if (!pct) return base;
  return applyPercentDiscountCents(base, pct);
};

/** Bill for a plan + user count — matches FlexaPricingPage live calculator. */
export const computeQuotePlanRecurringCents = (quote, planId, userCount) => {
  const totalUsers = Math.max(1, Math.round(Number(userCount) || 1));
  if (!quote?.corePlan) return 0;

  const included = Math.max(0, Number(quote.corePlan.includedUsers) || 0);
  const coreCents = Math.max(
    0,
    Number(quote.corePlan.total) || Number(quote.corePlan.monthlyCents) || 0,
  );

  if (
    !planId ||
    String(planId) === CORE_ONLY_PLAN_ID ||
    totalUsers <= included
  ) {
    return coreCents;
  }

  const tier = (quote.plans || []).find((p) => String(p.id) === String(planId));
  if (!tier) return coreCents;

  return computeBillCents(
    coreCents,
    totalUsers,
    included,
    tierRateCentsFromQuote(tier),
  );
};

/** Lower rank = lower tier. Core-only is the lowest paid tier. */
export const getPlanRank = (planId, tierPlans = []) => {
  if (!planId) return -1;
  if (String(planId) === CORE_ONLY_PLAN_ID) return 0;
  const idx = tierPlans.findIndex((p) => String(p.id) === String(planId));
  return idx >= 0 ? idx + 1 : -1;
};

export const comparePlanChange = (
  currentPlanId,
  selectedPlanId,
  tierPlans = [],
) => {
  if (!currentPlanId || !selectedPlanId) return "new";
  if (String(currentPlanId) === String(selectedPlanId)) return "same";
  const currentRank = getPlanRank(currentPlanId, tierPlans);
  const selectedRank = getPlanRank(selectedPlanId, tierPlans);
  if (currentRank < 0 || selectedRank < 0) {
    const currentTotal = tierPlans.find((p) => p.id === currentPlanId)?.total;
    const selectedTotal = tierPlans.find((p) => p.id === selectedPlanId)?.total;
    if (typeof currentTotal === "number" && typeof selectedTotal === "number") {
      if (selectedTotal > currentTotal) return "upgrade";
      if (selectedTotal < currentTotal) return "downgrade";
    }
    return "change";
  }
  if (selectedRank > currentRank) return "upgrade";
  if (selectedRank < currentRank) return "downgrade";
  return "same";
};

export const resolvePlanInQuote = (quote, planId) => {
  if (!planId || !quote) return null;
  if (String(planId) === CORE_ONLY_PLAN_ID) {
    return (
      quote.coreOnlyOption || {
        id: CORE_ONLY_PLAN_ID,
        name: "Core Plan Only",
        total: quote.corePlan?.total ?? 0,
      }
    );
  }
  return (
    (quote.plans || []).find((p) => String(p.id) === String(planId)) || null
  );
};

export const getPlanDisplayName = (quote, planId) =>
  resolvePlanInQuote(quote, planId)?.name || planId || "—";

export const getPlanRecurringCents = (plan) => {
  if (!plan) return 0;
  if (typeof plan.estimatedTotal === "number") return plan.estimatedTotal;
  if (typeof plan.total === "number") return plan.total;
  if (typeof plan.estimatedMinTotal === "number") return plan.estimatedMinTotal;
  return 0;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getBillingPeriodBounds = (
  preview,
  billingInterval = "monthly",
) => {
  const end = preview?.currentPeriodEnd
    ? new Date(preview.currentPeriodEnd)
    : null;
  if (!end || Number.isNaN(end.getTime())) {
    return { periodStart: null, periodEnd: null };
  }
  const periodStart = preview?.currentPeriodStart
    ? new Date(preview.currentPeriodStart)
    : addDays(end, billingInterval === "yearly" ? -365 : -30);
  return { periodStart, periodEnd: end };
};

export const formatPlanChangeDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
};

/**
 * @returns {{
 *   changeType: string,
 *   monthlyDiffCents: number,
 *   proratedExtraCents: number,
 *   usesApiAmount: boolean,
 *   currentRecurringCents: number,
 *   newRecurringCents: number,
 *   periodEnd: Date|null,
 *   nextCycleStart: Date|null,
 * }}
 */
export const computePlanChangeSummary = ({
  currentPlanId,
  selectedPlanId,
  tierPlans = [],
  quote = null,
  preview = null,
  billingInterval = "monthly",
}) => {
  const changeType = comparePlanChange(
    currentPlanId,
    selectedPlanId,
    tierPlans,
  );
  const currentPlan = resolvePlanInQuote(quote, currentPlanId);
  const selectedPlan = resolvePlanInQuote(quote, selectedPlanId);

  const currentRecurringCents =
    preview?.currentRecurringTotal ?? getPlanRecurringCents(currentPlan);
  const newRecurringCents =
    preview?.newRecurringTotal ?? getPlanRecurringCents(selectedPlan);

  const monthlyDiffCents = Math.max(
    0,
    newRecurringCents - currentRecurringCents,
  );
  const { periodStart, periodEnd } = getBillingPeriodBounds(
    preview,
    billingInterval,
  );

  let proratedExtraCents = monthlyDiffCents;
  let usesApiAmount = false;

  if (typeof preview?.amountDueNow === "number" && preview.amountDueNow >= 0) {
    proratedExtraCents = preview.amountDueNow;
    usesApiAmount = true;
  } else if (
    periodStart &&
    periodEnd &&
    periodEnd > new Date()
  ) {
    const included = Math.max(0, Number(quote?.corePlan?.includedUsers) || 0);
    const currentUsers =
      preview?.currentUserCount != null
        ? Number(preview.currentUserCount)
        : null;
    const requestedUsers =
      preview?.requestedUserCount != null
        ? Number(preview.requestedUserCount)
        : null;
    const sameTier =
      String(currentPlanId) === String(selectedPlanId) &&
      currentPlanId &&
      selectedPlanId;

    if (
      sameTier &&
      currentUsers != null &&
      requestedUsers != null &&
      requestedUsers !== currentUsers
    ) {
      const oldExtra = computeExtraUsers(currentUsers, included);
      const newExtra = computeExtraUsers(requestedUsers, included);
      const added = Math.max(0, newExtra - oldExtra);
      const removed = Math.max(0, oldExtra - newExtra);
      const rate = tierRateCentsFromQuote(selectedPlan);
      const charge =
        added > 0
          ? computeDayBasedProrationCents(
              added * rate,
              periodStart,
              periodEnd,
              new Date(),
            )
          : 0;
      const credit =
        removed > 0
          ? computeDayBasedProrationCents(
              removed * rate,
              periodStart,
              periodEnd,
              new Date(),
            )
          : 0;
      proratedExtraCents = Math.max(0, charge - credit);
    } else if (changeType === "upgrade") {
      proratedExtraCents = computeDayBasedProrationCents(
        monthlyDiffCents,
        periodStart,
        periodEnd,
        new Date(),
      );
    }
  }

  const nextCycleStart = periodEnd;

  return {
    changeType,
    monthlyDiffCents,
    proratedExtraCents,
    usesApiAmount,
    currentRecurringCents,
    newRecurringCents,
    periodEnd,
    nextCycleStart,
    currentPlanName:
      currentPlan?.name || getPlanDisplayName(quote, currentPlanId),
    selectedPlanName:
      selectedPlan?.name || getPlanDisplayName(quote, selectedPlanId),
  };
};

/** True when only subscribed modules change — plan, interval, and user count stay the same. */
export const isModuleOnlyAdjustment = (preview) =>
  Boolean(
    preview?.modulesChanged &&
    !preview?.planChanged &&
    !preview?.intervalChanged &&
    !preview?.userCountChanged,
  );

export const isUpgradeAdjustment = (preview) => {
  if (!preview) return false;
  const current = preview.currentRecurringTotal;
  const next = preview.newRecurringTotal;
  return (
    typeof current === "number" && typeof next === "number" && next > current
  );
};

export const isDowngradeAdjustment = (preview) => {
  if (!preview) return false;
  const current = preview.currentRecurringTotal;
  const next = preview.newRecurringTotal;
  return (
    typeof current === "number" && typeof next === "number" && next < current
  );
};

/**
 * Build transparent upcoming-invoice line items for subscription adjustments.
 * Prefers API-computed fields; falls back to netting charge vs due today.
 */
export const getAdjustmentInvoiceBreakdown = (preview) => {
  if (!preview?.hasChanges || isModuleOnlyAdjustment(preview)) return null;

  const chargeTotal = Math.max(0, Number(preview.prorationChargeTotal) || 0);
  const amountDueNow =
    typeof preview.amountDueNow === "number" ? preview.amountDueNow : null;

  if (preview.isOptimistic && amountDueNow === null) return null;

  const accountBalanceApplied = Math.max(
    0,
    Number(preview.accountBalanceApplied) || 0,
  );
  const creditTotal = Math.max(0, Number(preview.creditTotal) || 0);
  const prorationCreditApplied = Math.max(
    0,
    Number(preview.prorationCreditApplied) ||
      (chargeTotal === 0 ? creditTotal : 0) ||
      Math.min(
        creditTotal,
        Math.max(0, chargeTotal - (amountDueNow ?? 0) - accountBalanceApplied),
      ),
  );

  const lines = [];
  if (chargeTotal > 0) {
    lines.push({
      key: "charge",
      label: "Prorated charge",
      amountCents: chargeTotal,
    });
  }
  if (prorationCreditApplied > 0) {
    lines.push({
      key: "prorationCredit",
      label: "Unused time credit",
      amountCents: -prorationCreditApplied,
    });
  }
  if (accountBalanceApplied > 0) {
    lines.push({
      key: "accountBalance",
      label: "Account balance applied",
      amountCents: -accountBalanceApplied,
    });
  }

  if (!lines.length && amountDueNow === null) return null;

  return {
    lines,
    chargeTotal,
    prorationCreditApplied,
    accountBalanceApplied,
    amountDueNow: amountDueNow ?? 0,
    dueTodayKnown: amountDueNow !== null,
    hasLines: lines.length > 0,
  };
};

/** Context-aware payment / billing note for subscription adjustment confirmations. */
export const resolveAdjustmentPaymentNote = ({
  preview,
  isModuleOnlyChange = false,
  willCharge = false,
  isCalculating = false,
}) => {
  if (isCalculating) return null;

  const moduleOnly = isModuleOnlyChange || isModuleOnlyAdjustment(preview);

  if (moduleOnly) {
    return "No payment is due today. Module access updates immediately — your plan tier and billing stay the same.";
  }

  if (willCharge) {
    const useSavedCard =
      preview?.canChargeWithSavedCard === true ||
      preview?.chargeChannel === "mit_recurring";
    if (useSavedCard) {
      return "This amount is due today and will be charged to your saved card.";
    }
    return "This amount is due today. You will complete payment on the Fiuu checkout page.";
  }

  const isUpgrade = isUpgradeAdjustment(preview);
  const isDowngrade = isDowngradeAdjustment(preview);
  const creditTotal = Number(preview?.creditTotal || 0);

  if (creditTotal > 0 && isDowngrade) {
    return "Unused time is credited to your account. Your downgraded plan takes effect immediately and the credit will apply to your next invoice.";
  }
  if (creditTotal > 0 && isUpgrade) {
    return "Prorated credit from unused time on your previous plan has been applied. No charge today — your next invoice will reflect the upgraded subscription.";
  }
  if (isUpgrade) {
    return "No charge today. Your plan has been upgraded — the new rate applies from your next billing cycle.";
  }
  if (isDowngrade) {
    return "No charge today. Your downgraded plan takes effect immediately.";
  }
  if (preview?.note) return preview.note;
  return "Nothing is charged today. Changes apply to your account immediately.";
};

/** Header note for the adjustment preview panel (above Current / New / Due today). */
export const resolveAdjustmentPreviewNote = (preview) => {
  if (!preview || preview.isOptimistic) {
    return "Calculating exact proration…";
  }
  if (!preview.hasChanges) {
    return "Change modules, plan tier, user count, or billing interval to update your subscription.";
  }
  if (isModuleOnlyAdjustment(preview)) {
    return "No payment due today. Module access updates immediately — your plan tier and billing stay the same.";
  }
  if (preview.note) return preview.note;
  return resolveAdjustmentPaymentNote({
    preview,
    willCharge: (preview.amountDueNow || 0) > 0,
  });
};
