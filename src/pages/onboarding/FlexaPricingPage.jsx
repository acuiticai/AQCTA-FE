import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import RegistrationServices from "@/services/RegistrationServices";
import { Loader } from "@/page-layouts/index";
import {
  comparePlanChange,
  computePlanChangeSummary,
  formatPlanChangeDate,
  getPlanDisplayName,
  isModuleOnlyAdjustment,
  resolveAdjustmentPreviewNote,
} from "./planChangeLogic";
import { CORE_ONLY_PLAN_ID } from "./planChangeLogic";
import {
  computeBillCents,
  computeExtraUsers,
  formatTotalUserRange,
  getUserCountBounds,
  buildUserCountSliderMarks,
  userCountToSliderPos,
  sliderPosToUserCount,
  SLIDER_POSITION_RESOLUTION,
  resolveTierForTotalUsers,
  tierMatchesTotalUsers,
} from "./pricingLogic";
import {
  formatSubscriptionAmount,
  formatSubscriptionAmountDetailed,
  formatSubscriptionCents,
} from "@/utils/subscriptionCurrency";
import { applyPercentDiscountCents } from "@/utils/subscriptionDiscount";
import "./FlexaPricingPage.css";

const BRAND = "#0C2E5A";

const formatMoney = (amount, currency = "myr") =>
  formatSubscriptionAmount(amount, currency);

const formatMoneyDetailed = (amount, currency = "myr") =>
  formatSubscriptionAmountDetailed(amount, currency);

const formatMoneyFromCents = (cents, currency = "myr") =>
  formatSubscriptionCents(cents, currency);

const centsToUnits = (cents) => (Number(cents) || 0) / 100;

const discountedCents = (listCents, discountPercent) =>
  applyPercentDiscountCents(listCents, discountPercent);

const formatMoneyShort = (amount, currency = "myr") =>
  formatSubscriptionAmount(amount, currency);

const getTierEstimateLabel = (tier, coreAmount, includedUsers, currency = "myr") => {
  const minTotal = Math.max(1, Number(tier.minUsers) || 1);
  const discPct = tier.discountPercent || 0;
  const rate = centsToUnits(discountedCents(tier.monthlyCents, discPct));

  const minExtra = Math.max(0, minTotal - includedUsers);
  const minEst = coreAmount + minExtra * rate;

  if (tier.unlimitedMaxUsers || tier.maxUsers == null) {
    return `Est. ${formatMoneyShort(minEst, currency)}+/mo`;
  }

  const maxTotal = Math.max(minTotal, Number(tier.maxUsers) || minTotal);
  const maxExtra = Math.max(0, maxTotal - includedUsers);
  const maxEst = coreAmount + maxExtra * rate;

  return `Est. ${formatMoneyShort(minEst, currency)}–${formatMoneyShort(maxEst, currency)}/mo`;
};

const buildCoreOnlyOption = (corePlan, includedUsers, currency, fromApi) => {
  if (fromApi) {
    return {
      ...fromApi,
      badge: fromApi.badge || corePlan?.badge || "",
    };
  }
  if (!corePlan) return null;
  return {
    id: CORE_ONLY_PLAN_ID,
    name: "Core Plan Only",
    planType: "core_only",
    eligible: true,
    minTotalUsers: 1,
    maxTotalUsers: includedUsers,
    userRangeLabel: `1–${includedUsers} users`,
    monthlyCents: corePlan.monthlyCents,
    discountPercent: corePlan.discountPercent || 0,
    total: discountedCents(
      corePlan.monthlyCents,
      corePlan.discountPercent || 0,
    ),
    badge: corePlan.badge || "",
    description: corePlan.description || "",
    features: (corePlan.features || []).filter(Boolean),
    currency,
  };
};

const normalizePlanFromApi = (plan) => ({
  ...plan,
  id: plan.id || plan.code,
  name: plan.name,
  description: plan.description || "",
  planType: plan.planType === "core" ? "core" : "tier",
  monthlyCents: Number(plan.monthlyCents || 0),
  discountPercent:
    Number(plan.effectiveDiscountPercent ?? plan.discountPercent) || 0,
  minUsers: Math.max(1, Number(plan.minUsers) || 1),
  maxUsers:
    plan.unlimitedMaxUsers || plan.maxUsers == null
      ? null
      : Math.max(1, Number(plan.maxUsers) || 1),
  unlimitedMaxUsers: plan.unlimitedMaxUsers === true || plan.maxUsers == null,
  includedUsers: Math.max(0, Number(plan.includedUsers) || 0),
  features: Array.isArray(plan.features) ? plan.features : [],
  badge: plan.badge || "",
  recommended: plan.recommended === true,
  eligible: plan.eligible !== false && plan.seatBlocked !== true,
  ineligibleReason: plan.ineligibleReason || "",
  currency: (plan.currency || "myr").toLowerCase(),
  order: Number(plan.order || 0),
  totalUserLabel: plan.totalUserLabel || "",
  extraUserLabel: plan.extraUserLabel || "",
  estimatedMinTotal: plan.estimatedMinTotal,
  estimatedMaxTotal: plan.estimatedMaxTotal,
  estimatedTotal: plan.estimatedTotal,
  total: plan.total,
});

/** Prefer each plan's own currency; never force one catalog-wide code onto every card. */
const resolvePlanCurrency = (plan, fallback = "myr") =>
  String(plan?.currency || fallback || "myr")
    .trim()
    .toLowerCase();

const splitPlans = (plans = []) => {
  const normalized = plans.map(normalizePlanFromApi);
  const core =
    normalized.find((p) => p.planType === "core" && p.eligible !== false) ||
    null;
  const tiers = normalized
    .filter((p) => p.planType !== "core")
    .sort((a, b) => a.order - b.order || a.minUsers - b.minUsers);
  return { core, tiers };
};

const getPlanFeatureList = (plan) =>
  (plan?.features || []).map((f) => String(f).trim()).filter(Boolean);

const FlexaPricingPage = ({
  plans: plansProp,
  corePlan: corePlanProp,
  tierPlans: tierPlansProp,
  currency: currencyProp,
  selectedTierId: selectedTierIdProp,
  selectedUserCount: selectedUserCountProp,
  onSelectTier,
  onUserCountChange,
  fetchPlans = true,
  activeOnly = true,
  activeUsers = null,
  coreOnlyOption: coreOnlyOptionProp = null,
  currentPlanId = null,
  planChangePreview = null,
  previewRefreshing = false,
  billingInterval = "monthly",
  quote = null,
  onPlanChangeMeta,
  title = "Choose your plan",
  moduleCount = null,
  onEditModules = null,
  continueLabel = null,
  onContinue = null,
  continueDisabled = false,
  continueLoading = false,
  invitationPlanLocked = false,
}) => {
  const [loading, setLoading] = useState(fetchPlans && !plansProp);
  const [fetchedPlans, setFetchedPlans] = useState([]);
  const [fetchedUserCountBounds, setFetchedUserCountBounds] = useState(null);
  const [selectedTierId, setSelectedTierId] = useState(
    selectedTierIdProp || null,
  );
  const [selectedUserCount, setSelectedUserCount] = useState(
    selectedUserCountProp ?? null,
  );
  const [manualTierId, setManualTierId] = useState(null);
  // Raw track position (0..SLIDER_POSITION_RESOLUTION) while the user drags
  // the slider; null when idle. See the slider section for why this exists.
  const [sliderDragPos, setSliderDragPos] = useState(null);

  useEffect(() => {
    if (selectedUserCountProp != null) {
      setSelectedUserCount(selectedUserCountProp);
    }
  }, [selectedUserCountProp]);

  useEffect(() => {
    if (selectedTierIdProp != null) {
      setSelectedTierId(selectedTierIdProp);
    }
  }, [selectedTierIdProp]);

  useEffect(() => {
    if (!fetchPlans || plansProp) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await RegistrationServices.getPricingPlans({
          channel: "self-service",
          activeOnly,
        });
        if (!cancelled) {
          setFetchedPlans(
            (res.plans || []).filter((p) =>
              activeOnly ? p.active !== false : true,
            ),
          );
          setFetchedUserCountBounds(res.userCountBounds || null);
        }
      } catch {
        if (!cancelled) setFetchedPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPlans, plansProp, activeOnly]);

  const { corePlan, tierPlans, currency } = useMemo(() => {
    if (corePlanProp) {
      const tiers = (
        tierPlansProp?.length ? tierPlansProp : plansProp || []
      ).map(normalizePlanFromApi);
      return {
        corePlan: normalizePlanFromApi(corePlanProp),
        tierPlans: tiers,
        currency:
          currencyProp || corePlanProp?.currency || tiers[0]?.currency || "myr",
      };
    }

    if (tierPlansProp?.length) {
      return {
        corePlan: null,
        tierPlans: tierPlansProp.map(normalizePlanFromApi),
        currency: currencyProp || tierPlansProp[0]?.currency || "myr",
      };
    }

    const source = plansProp || fetchedPlans;
    if (!source.length) {
      return {
        corePlan: null,
        tierPlans: [],
        currency: currencyProp || "myr",
      };
    }

    const { core, tiers } = splitPlans(source);
    return {
      corePlan: core,
      tierPlans: tiers,
      currency: currencyProp || core?.currency || tiers[0]?.currency || "myr",
    };
  }, [plansProp, fetchedPlans, corePlanProp, tierPlansProp, currencyProp]);

  const coreAmount = corePlan
    ? centsToUnits(
        discountedCents(corePlan.monthlyCents, corePlan.discountPercent),
      )
    : 0;
  const includedUsers = corePlan
    ? Math.max(0, Number(corePlan.includedUsers) || 0)
    : 0;
  const userCountBounds = useMemo(() => {
    if (quote?.userCountBounds?.max != null) return quote.userCountBounds;
    if (fetchedUserCountBounds?.max != null) return fetchedUserCountBounds;
    return getUserCountBounds(tierPlans, includedUsers);
  }, [
    quote?.userCountBounds,
    fetchedUserCountBounds,
    tierPlans,
    includedUsers,
  ]);
  const maxSelectableUsers = userCountBounds.max;

  // The slider always spans the full catalog range; manually picking a tier
  // must not shrink it (dragging outside the tier auto-switches tiers).
  const minSelectableUsers = useMemo(() => {
    let min = Math.max(1, Number(userCountBounds.min) || 1);

    if (typeof activeUsers === "number" && activeUsers >= 1) {
      min = Math.max(min, activeUsers);
    }

    return min;
  }, [userCountBounds.min, activeUsers]);

  const defaultUserCount = useMemo(() => {
    if (typeof activeUsers === "number" && activeUsers >= 1) {
      return Math.max(activeUsers, minSelectableUsers);
    }
    if (selectedUserCountProp != null) {
      return Math.max(minSelectableUsers, Number(selectedUserCountProp) || 1);
    }
    return Math.max(minSelectableUsers, includedUsers || 1);
  }, [activeUsers, selectedUserCountProp, includedUsers, minSelectableUsers]);

  const effectiveUserCount = Math.max(
    minSelectableUsers,
    Number(selectedUserCountProp ?? selectedUserCount ?? defaultUserCount) || 1,
  );

  const matchedTier = useMemo(() => {
    if (manualTierId) {
      const manual = tierPlans.find(
        (tier) => String(tier.id) === String(manualTierId),
      );
      // A manual tier choice is only valid while the selected user count is
      // inside that tier's range. The user count remains the source of truth.
      if (manual && tierMatchesTotalUsers(manual, effectiveUserCount)) {
        return manual;
      }
    }
    return resolveTierForTotalUsers(
      tierPlans,
      effectiveUserCount,
      includedUsers,
    );
  }, [tierPlans, effectiveUserCount, includedUsers, manualTierId]);

  const resolvedPlanId = useMemo(() => {
    if (effectiveUserCount <= includedUsers) return CORE_ONLY_PLAN_ID;
    return matchedTier?.id || null;
  }, [effectiveUserCount, includedUsers, matchedTier]);

  const coreOnlyOption = useMemo(
    () =>
      corePlan
        ? buildCoreOnlyOption(
            corePlan,
            includedUsers,
            currency,
            coreOnlyOptionProp,
          )
        : null,
    [corePlan, includedUsers, currency, coreOnlyOptionProp],
  );

  const lastNotifiedRef = useRef({ planId: null, userCount: null });

  useEffect(() => {
    if (!corePlan || selectedUserCount != null) return;
    setSelectedUserCount(defaultUserCount);
  }, [corePlan, defaultUserCount, selectedUserCount]);

  useEffect(() => {
    if (selectedUserCountProp != null) return;
    const current = selectedUserCount;
    if (current != null && current < minSelectableUsers) {
      setSelectedUserCount(minSelectableUsers);
      onUserCountChange?.(minSelectableUsers);
    }
  }, [
    minSelectableUsers,
    selectedUserCount,
    selectedUserCountProp,
    onUserCountChange,
  ]);

  useEffect(() => {
    if (!resolvedPlanId || !corePlan) return;
    const last = lastNotifiedRef.current;
    if (
      last.planId === resolvedPlanId &&
      last.userCount === effectiveUserCount
    ) {
      return;
    }
    lastNotifiedRef.current = {
      planId: resolvedPlanId,
      userCount: effectiveUserCount,
    };
    setSelectedTierId(resolvedPlanId);
    const option =
      resolvedPlanId === CORE_ONLY_PLAN_ID
        ? coreOnlyOptionProp || coreOnlyOption
        : tierPlans.find((t) => t.id === resolvedPlanId);
    if (option) onSelectTier?.(option, effectiveUserCount);
  }, [
    resolvedPlanId,
    effectiveUserCount,
    corePlan,
    coreOnlyOptionProp,
    coreOnlyOption,
    tierPlans,
    onSelectTier,
  ]);

  const isCoreOnlySelected = resolvedPlanId === CORE_ONLY_PLAN_ID;
  const selectedTier = matchedTier;

  const handleUserCountChange = (nextCount) => {
    const clamped = Math.min(
      maxSelectableUsers,
      Math.max(minSelectableUsers, Math.round(Number(nextCount) || 1)),
    );
    if (manualTierId) {
      const manual = tierPlans.find(
        (tier) => String(tier.id) === String(manualTierId),
      );
      if (manual && !tierMatchesTotalUsers(manual, clamped)) {
        setManualTierId(null);
      }
    }
    setSelectedUserCount(clamped);
    onUserCountChange?.(clamped);
  };

  const handleSelectTier = (tier) => {
    if (tier.eligible === false) return;
    const minTotal = Math.max(1, Number(tier.minUsers) || 1);
    const maxTotal =
      tier.unlimitedMaxUsers || tier.maxUsers == null
        ? maxSelectableUsers
        : Math.max(minTotal, Number(tier.maxUsers) || minTotal);
    const nextCount =
      effectiveUserCount >= minTotal && effectiveUserCount <= maxTotal
        ? effectiveUserCount
        : minTotal;

    setManualTierId(tier.id);
    setSelectedUserCount(nextCount);
    onUserCountChange?.(nextCount);
    onSelectTier?.(tier, nextCount);
  };

  const handleSelect = (option) => {
    if (option.eligible === false) return;
    if (option.id === CORE_ONLY_PLAN_ID) {
      handleUserCountChange(Math.max(includedUsers || minSelectableUsers, 1));
      return;
    }
    handleSelectTier(option);
  };

  const allSelectableTiers = useMemo(() => {
    const list = [...tierPlans];
    if (coreOnlyOption) list.unshift(coreOnlyOption);
    return list;
  }, [tierPlans, coreOnlyOption]);

  const planChange = useMemo(() => {
    if (!currentPlanId || !resolvedPlanId) return null;
    return computePlanChangeSummary({
      currentPlanId,
      selectedPlanId: resolvedPlanId,
      tierPlans: allSelectableTiers,
      quote,
      preview: planChangePreview,
      billingInterval,
    });
  }, [
    currentPlanId,
    resolvedPlanId,
    allSelectableTiers,
    quote,
    planChangePreview,
    billingInterval,
  ]);

  useEffect(() => {
    onPlanChangeMeta?.(planChange);
  }, [planChange, onPlanChangeMeta]);

  if (loading) {
    return (
      <div className="flexa-pricing-page flexa-pricing-page--loading">
        <Loader color={BRAND} />
      </div>
    );
  }

  const isFlatPricing = !corePlan && tierPlans.length > 0;
  const isInvitationLocked = invitationPlanLocked === true;
  const isModuleOnlyReview =
    Boolean(currentPlanId) &&
    Boolean(planChangePreview?.hasChanges) &&
    isModuleOnlyAdjustment(planChangePreview);

  if (!corePlan && !isFlatPricing) {
    return (
      <div className="flexa-pricing-page flexa-pricing-page--empty">
        No core plan configured. Create an active Core plan in the subscription
        catalog.
      </div>
    );
  }

  const selectedFlatPlan = isFlatPricing
    ? tierPlans.find(
        (plan) =>
          String(plan.id) ===
          String(selectedTierIdProp || selectedTierId || ""),
      ) ||
      tierPlans.find(
        (plan) => String(plan.id) === String(currentPlanId || ""),
      ) ||
      tierPlans.find((plan) => plan.eligible !== false) ||
      tierPlans[0] ||
      null
    : null;

  const coreCents = corePlan
    ? discountedCents(corePlan.monthlyCents, corePlan.discountPercent)
    : 0;
  const tierRateCents = selectedTier
    ? discountedCents(selectedTier.monthlyCents, selectedTier.discountPercent)
    : 0;
  const tierRate = centsToUnits(tierRateCents);
  const extraUsers = computeExtraUsers(effectiveUserCount, includedUsers);
  const extraUserCostCents = extraUsers * tierRateCents;
  const flatBillCents = isFlatPricing
    ? Math.max(
        0,
        Number(
          selectedFlatPlan?.total ??
            selectedFlatPlan?.estimatedTotal ??
            discountedCents(
              selectedFlatPlan?.monthlyCents || 0,
              selectedFlatPlan?.discountPercent || 0,
            ) ??
            0,
        ) || 0,
      )
    : 0;
  const estimatedBillCents = isFlatPricing
    ? flatBillCents
    : isCoreOnlySelected
      ? coreCents
      : computeBillCents(
          coreCents,
          effectiveUserCount,
          includedUsers,
          tierRateCents,
        );
  const estimatedBillAmount = centsToUnits(estimatedBillCents);
  const hasTierForCount =
    isFlatPricing || Boolean(matchedTier) || isCoreOnlySelected;

  // Summary / totals follow the selected plan (not the first catalog plan).
  const billCurrency = resolvePlanCurrency(
    isFlatPricing
      ? selectedFlatPlan
      : selectedTier || corePlan,
    currency,
  );
  const coreCurrency = resolvePlanCurrency(corePlan, currency);

  const trialEnabled = quote?.trial?.enabled === true;
  const trialDays = Math.max(0, Number(quote?.trial?.trialDays) || 0);
  const showFreeTrial =
    trialEnabled && trialDays > 0 && !currentPlanId && !planChangePreview;

  const renderModuleChanges = () => {
    const preview = planChangePreview;
    if (!preview?.hasChanges) return null;
    if (!preview.addedModules?.length && !preview.removedModules?.length) {
      return null;
    }

    const moduleName = (key) =>
      preview.newLineItems?.find(
        (item) => String(item.key).toUpperCase() === String(key).toUpperCase(),
      )?.name ||
      quote?.lineItems?.find(
        (item) => String(item.key).toUpperCase() === String(key).toUpperCase(),
      )?.name ||
      key;

    return (
      <div className="flexa-pricing-page__module-changes onboarding-adjustment-preview__modules">
        {preview.addedModules?.length > 0 ? (
          <div className="flexa-pricing-page__module-change-group">
            <span className="onboarding-adjustment-preview__chip-label">
              Adding
            </span>
            <div className="onboarding-pricing-chips">
              {preview.addedModules.map((key) => (
                <span
                  key={key}
                  className="onboarding-pricing-chip onboarding-pricing-chip--add"
                >
                  {moduleName(key)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {preview.removedModules?.length > 0 ? (
          <div className="flexa-pricing-page__module-change-group">
            <span className="onboarding-adjustment-preview__chip-label">
              Removing
            </span>
            <div className="onboarding-pricing-chips">
              {preview.removedModules.map((key) => (
                <span
                  key={key}
                  className="onboarding-pricing-chip onboarding-pricing-chip--remove"
                >
                  {moduleName(key)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderExtraUsersBreakdown = () => {
    if (!selectedTier || extraUsers <= 0) return null;
    const tierCurrency = resolvePlanCurrency(selectedTier, billCurrency);
    return (
      <div className="flexa-pricing-page__summary-row">
        <span className="flexa-pricing-page__summary-row-label">
          {selectedTier.name} · {extraUsers} × {formatMoney(tierRate, tierCurrency)}
          <span className="flexa-pricing-page__summary-row-sub">
            per user/mo
          </span>
        </span>
        <strong>{formatMoney(centsToUnits(extraUserCostCents), tierCurrency)}</strong>
      </div>
    );
  };

  const renderBillSummary = (totalBillAmount, localBillCents) => {
    const preview = planChangePreview;
    const isAdjustmentPreview = Boolean(preview?.hasChanges);
    const currentCents =
      preview?.currentRecurringTotal ?? planChange?.currentRecurringCents ?? 0;
    const newCents = localBillCents ?? estimatedBillCents;
    const isLocalUpgrade =
      isAdjustmentPreview && currentCents > 0 && newCents > currentCents;
    const isLocalDowngrade =
      isAdjustmentPreview && currentCents > 0 && newCents < currentCents;
    const isPlanChange =
      !isAdjustmentPreview &&
      planChange &&
      planChange.changeType !== "new" &&
      planChange.changeType !== "same";

    let summaryTitle = "Bill summary";

    if (isAdjustmentPreview) {
      const moduleOnly = isModuleOnlyAdjustment(preview);
      summaryTitle = moduleOnly
        ? "Updating module access"
        : isLocalUpgrade
          ? "Upgrading subscription"
          : isLocalDowngrade
            ? "Downgrading subscription"
            : "Changing subscription";
    } else if (planChange?.changeType === "upgrade") {
      summaryTitle = `Upgrading from ${planChange.currentPlanName}`;
    } else if (planChange?.changeType === "downgrade") {
      summaryTitle = `Downgrading from ${planChange.currentPlanName}`;
    }

    const periodEndLabel = formatPlanChangeDate(
      preview?.currentPeriodEnd || planChange?.periodEnd?.toISOString(),
    );
    const nextStartLabel = formatPlanChangeDate(
      planChange?.nextCycleStart?.toISOString(),
    );
    const currentBill =
      currentCents > 0
        ? `${formatMoneyFromCents(currentCents, billCurrency)}/month`
        : null;
    const newBill =
      newCents > 0 ? `${formatMoneyFromCents(newCents, billCurrency)}/month` : null;
    const monthlyDiff =
      planChange?.monthlyDiffCents > 0
        ? `+${formatMoneyFromCents(planChange.monthlyDiffCents, billCurrency)}`
        : null;
    const dueTodayKnown = typeof preview?.amountDueNow === "number";
    const dueTodaySubLabel =
      dueTodayKnown && preview.amountDueNow === 0
        ? "no charge"
        : preview?.isOptimistic && !dueTodayKnown
          ? "estimate"
          : "";
    const dueToday = dueTodayKnown
      ? formatMoneyDetailed(centsToUnits(preview.amountDueNow), billCurrency)
      : isLocalDowngrade
        ? formatMoneyDetailed(0, billCurrency)
        : preview?.isOptimistic && !isLocalDowngrade
          ? "…"
          : null;
    const showPreviewSync =
      previewRefreshing && isLocalUpgrade && !dueTodayKnown;
    const proratedExtra =
      planChange?.changeType === "upgrade" && planChange.proratedExtraCents > 0
        ? formatMoneyFromCents(planChange.proratedExtraCents, billCurrency)
        : null;
    const previewNote = (() => {
      if (!preview) return null;
      if (previewRefreshing && isLocalDowngrade) {
        if (!preview.isOptimistic && preview.note) return preview.note;
        return "No charge today. Your downgraded plan takes effect immediately.";
      }
      if (!preview.isOptimistic && preview.note) return preview.note;
      if (preview.isOptimistic && isLocalDowngrade) {
        return "No charge today. Your downgraded plan takes effect immediately.";
      }
      return resolveAdjustmentPreviewNote(preview);
    })();
    const planLabel = (planId) => getPlanDisplayName(quote, planId);

    return (
      <aside
        className={[
          "flexa-pricing-page__summary-panel",
          previewRefreshing
            ? "flexa-pricing-page__calc-summary--refreshing"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <h3
          className={[
            "flexa-pricing-page__summary-title",
            isLocalUpgrade ? "flexa-pricing-page__summary-header--upgrade" : "",
            isLocalDowngrade
              ? "flexa-pricing-page__summary-header--downgrade"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isAdjustmentPreview ? summaryTitle : "Bill summary"}
        </h3>
        <div className="flexa-pricing-page__summary-body">
          {isAdjustmentPreview ? (
            <>
              {previewNote ? (
                <p className="flexa-pricing-page__summary-note">{previewNote}
                  {preview.currentPeriodEnd ? (
                    <> Billing period ends {periodEndLabel}.</>
                  ) : null}
                  {showPreviewSync ? <> Updating…</> : null}
                </p>
              ) : null}
              {(preview.planChanged ||
                preview.intervalChanged ||
                (preview.userCountChanged &&
                  preview.currentUserCount != null &&
                  preview.requestedUserCount != null)) && (
                <p className="flexa-pricing-page__summary-note">
                  {preview.planChanged ? (
                    <>
                      Plan: <strong>{planLabel(preview.currentPlanId)}</strong>
                      {" → "}
                      <strong>{planLabel(preview.planId)}</strong>
                    </>
                  ) : null}
                  {preview.planChanged && preview.intervalChanged
                    ? " · "
                    : null}
                  {preview.intervalChanged ? (
                    <>
                      Billing:{" "}
                      <strong>
                        {preview.currentBillingInterval || "monthly"}
                      </strong>
                      {" → "}
                      <strong>{preview.billingInterval}</strong>
                    </>
                  ) : null}
                  {preview.userCountChanged &&
                  !preview.planChanged &&
                  preview.currentUserCount != null &&
                  preview.requestedUserCount != null ? (
                    <>
                      {preview.intervalChanged ? " · " : null}
                      Users:{" "}
                      <strong>{preview.currentUserCount}</strong>
                      {" → "}
                      <strong>{preview.requestedUserCount}</strong>
                    </>
                  ) : null}
                </p>
              )}
              {currentBill ? (
                <div className="flexa-pricing-page__summary-row">
                  <span>Current</span>
                  <strong>{currentBill}</strong>
                </div>
              ) : null}
              {newBill ? (
                <div className="flexa-pricing-page__summary-row">
                  <span>New</span>
                  <strong>{newBill}</strong>
                </div>
              ) : null}
              {!isModuleOnlyAdjustment(preview) ? (
                <>
                  {dueToday ? (
                    <div className="flexa-pricing-page__summary-row">
                      <span>Due today</span>
                      <strong>{dueToday}</strong>
                    </div>
                  ) : null}
                  {dueToday && dueTodaySubLabel ? (
                    <p className="flexa-pricing-page__summary-note">
                      {dueTodaySubLabel}
                    </p>
                  ) : null}
                </>
              ) : null}
              {isModuleOnlyAdjustment(preview) ? (
                <p className="flexa-pricing-page__summary-note">
                  No payment due today. Module access updates immediately.
                </p>
              ) : null}
            </>
          ) : isPlanChange && planChange.changeType === "upgrade" ? (
            <>
              {currentBill ? (
                <div className="flexa-pricing-page__summary-row">
                  <span>Current bill</span>
                  <strong>{currentBill}</strong>
                </div>
              ) : null}
              {newBill ? (
                <div className="flexa-pricing-page__summary-row">
                  <span>New bill</span>
                  <strong>{newBill}</strong>
                </div>
              ) : null}
              {monthlyDiff ? (
                <div className="flexa-pricing-page__summary-row">
                  <span>Monthly difference</span>
                  <strong>{monthlyDiff}</strong>
                </div>
              ) : null}
              {proratedExtra ? (
                <p className="flexa-pricing-page__summary-note">
                  <strong style={{ color: "#86efac" }}>{proratedExtra}</strong>{" "}
                  extra this month
                  {planChange.usesApiAmount ? "" : " (estimated)"}.
                  {nextStartLabel ? ` New rate from ${nextStartLabel}.` : null}
                </p>
              ) : null}
            </>
          ) : isPlanChange && planChange.changeType === "downgrade" ? (
            <>
              {currentBill ? (
                <div className="flexa-pricing-page__summary-row">
                  <span>Current bill</span>
                  <strong>{currentBill}</strong>
                </div>
              ) : null}
              {newBill ? (
                <div className="flexa-pricing-page__summary-row">
                  <span>New bill (next cycle)</span>
                  <strong>{newBill}</strong>
                </div>
              ) : null}
              <p className="flexa-pricing-page__summary-note">
                Plan changes at the next billing cycle. No refund for the
                current month.
              </p>
              {periodEndLabel ? (
                <p className="flexa-pricing-page__summary-note">
                  Active until <strong>{periodEndLabel}</strong>
                  {nextStartLabel ? (
                    <>
                      {" "}
                      · New plan from <strong>{nextStartLabel}</strong>
                    </>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : isFlatPricing ? (
            <>
              {selectedFlatPlan?.discountPercent > 0 &&
              (selectedFlatPlan.listPriceCents ||
                selectedFlatPlan.monthlyCents) >
                (selectedFlatPlan.total ??
                  selectedFlatPlan.estimatedTotal ??
                  0) ? (
                <>
                  <div className="flexa-pricing-page__summary-row">
                    <span>List price</span>
                    <strong className="flexa-pricing-page__summary-was">
                      {formatMoney(
                        centsToUnits(
                          selectedFlatPlan.listPriceCents ||
                            selectedFlatPlan.monthlyCents ||
                            0,
                        ),
                        billCurrency,
                      )}
                    </strong>
                  </div>
                  <div className="flexa-pricing-page__summary-row">
                    <span>
                      Plan discount ({selectedFlatPlan.discountPercent}% off
                      {selectedFlatPlan.discountDuration === "once"
                        ? ", first payment"
                        : selectedFlatPlan.discountDuration === "repeating"
                          ? `, ${Math.max(1, Number(selectedFlatPlan.discountBillingCycles) || 1)} cycles`
                          : ", every renewal"}
                      )
                    </span>
                    <strong>
                      −
                      {formatMoney(
                        centsToUnits(
                          Math.max(
                            0,
                            (selectedFlatPlan.listPriceCents ||
                              selectedFlatPlan.monthlyCents ||
                              0) -
                              (selectedFlatPlan.total ??
                                selectedFlatPlan.estimatedTotal ??
                                0),
                          ),
                        ),
                        billCurrency,
                      )}
                    </strong>
                  </div>
                </>
              ) : null}
              <div className="flexa-pricing-page__summary-row">
                <span>{selectedFlatPlan?.name || "Selected plan"}</span>
                <strong>{formatMoney(totalBillAmount, billCurrency)}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="flexa-pricing-page__summary-row">
                <span>
                  {corePlan.name} (includes {includedUsers} user
                  {includedUsers === 1 ? "" : "s"})
                </span>
                <strong>{formatMoney(coreAmount, coreCurrency)}</strong>
              </div>
              {renderExtraUsersBreakdown()}
            </>
          )}
        </div>
        <div className="flexa-pricing-page__summary-total">
          <span className="flexa-pricing-page__summary-total-label">
            Total monthly bill
          </span>
          <div>
            <span className="flexa-pricing-page__summary-total-amount">
              {formatMoney(totalBillAmount, billCurrency)}
            </span>
            <span className="flexa-pricing-page__summary-total-unit"> /mo</span>
          </div>
          {!isAdjustmentPreview && !isPlanChange ? (
            <p className="flexa-pricing-page__summary-meta">
              {isFlatPricing
                ? selectedFlatPlan
                  ? `${selectedFlatPlan.name} selected`
                  : "Select a plan"
                : `${effectiveUserCount} total user${effectiveUserCount === 1 ? "" : "s"}${selectedTier ? ` · ${selectedTier.name} applied` : ""}`}
            </p>
          ) : null}
        </div>
        {onContinue ? (
          <div className="flexa-pricing-page__summary-cta">
            <button
              type="button"
              className="flexa-pricing-page__continue-btn"
              onClick={onContinue}
              disabled={continueDisabled || continueLoading}
            >
              {continueLoading
                ? "Please wait…"
                : continueLabel ||
                  (showFreeTrial
                    ? `Start ${trialDays}-day free trial`
                    : "Continue to Payment")}
            </button>
            <p className="flexa-pricing-page__summary-footer">
              {showFreeTrial
                ? `${trialDays}-day free trial · full access now · billed after trial · cancel anytime`
                : "Billed monthly per branch · cancel anytime"}
            </p>
          </div>
        ) : null}
      </aside>
    );
  };

  const [expandedTiers, setExpandedTiers] = useState({});

  const toggleTierExpand = useCallback((tierId, e) => {
    e.stopPropagation();
    setExpandedTiers((prev) => ({ ...prev, [tierId]: !prev[tierId] }));
  }, []);

  const renderTierRow = (tier) => {
    const tierCurrency = resolvePlanCurrency(tier, currency);
    const isSelected =
      String(matchedTier?.id) === String(tier.id) &&
      tierMatchesTotalUsers(tier, effectiveUserCount);
    const isActive = currentPlanId && String(currentPlanId) === String(tier.id);
    const discPct = tier.discountPercent || 0;
    const listRate = centsToUnits(tier.monthlyCents || 0);
    const rate = centsToUnits(
      discountedCents(tier.monthlyCents, discPct),
    );
    const disabled = tier.eligible === false;
    const planBadge = (tier.badge || "").trim();
    const userRange = formatTotalUserRange(tier);
    const features = (tier.features || []).filter(Boolean);
    const isExpanded = Boolean(expandedTiers[tier.id]);

    const coreAmountVal = centsToUnits(corePlan?.monthlyCents || 0);
    const estimateLabel = getTierEstimateLabel(
      tier,
      coreAmountVal,
      includedUsers,
      tierCurrency,
    );

    return (
      <article
        key={tier.id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={isSelected}
        className={[
          "flexa-pricing-page__tier-row",
          isSelected ? "flexa-pricing-page__tier-row--selected" : "",
          disabled ? "flexa-pricing-page__tier-row--disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => !disabled && handleSelect(tier)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelect(tier);
          }
        }}
      >
        <span className="flexa-pricing-page__tier-radio" aria-hidden>
          <span className="flexa-pricing-page__tier-radio-dot" />
        </span>
        <div className="flexa-pricing-page__tier-body">
          <div className="flexa-pricing-page__tier-top">
            <span className="flexa-pricing-page__tier-name">{tier.name}</span>
            {discPct > 0 ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--discount">
                {discPct}% off
                {tier.discountDuration === "once"
                  ? " · first payment"
                  : tier.discountDuration === "repeating"
                    ? ` · ${Math.max(1, Number(tier.discountBillingCycles) || 1)} cycles`
                    : ""}
              </span>
            ) : null}
            {planBadge ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--popular">
                {planBadge}
              </span>
            ) : tier.recommended ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--popular">
                Most popular
              </span>
            ) : null}
            {isActive ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--yours">
                Your tier
              </span>
            ) : null}
          </div>
          {tier.description ? (
            <p className="flexa-pricing-page__tier-desc">{tier.description}</p>
          ) : null}
          {disabled && tier.ineligibleReason ? (
            <p className="flexa-pricing-page__tier-ineligible">
              {tier.ineligibleReason}
            </p>
          ) : null}
          {features.length > 0 && (
            <>
              <button
                type="button"
                className="flexa-pricing-page__tier-expand-btn"
                onClick={(e) => toggleTierExpand(tier.id, e)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? "Hide features ▲" : `View features (${features.length}) ▼`}
              </button>
              {isExpanded && (
                <ul className="flexa-pricing-page__tier-features">
                  {features.map((f) => (
                    <li key={f}>
                      <span className="flexa-pricing-page__tier-feature-check" aria-hidden>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="flexa-pricing-page__tier-range-block">
          <div className="flexa-pricing-page__tier-range-val">{userRange}</div>
        </div>
        <div className="flexa-pricing-page__tier-price">
          {discPct > 0 && listRate > rate ? (
            <div className="flexa-pricing-page__tier-rate-was">
              {formatMoney(listRate, tierCurrency)}
            </div>
          ) : null}
          <div className="flexa-pricing-page__tier-rate-wrap">
            <span className="flexa-pricing-page__tier-rate">
              {formatMoney(rate, tierCurrency)}
            </span>
            <span className="flexa-pricing-page__tier-rate-unit">/user/mo</span>
          </div>
        </div>
      </article>
    );
  };

  const sliderMarks = useMemo(
    () =>
      buildUserCountSliderMarks({
        tiers: tierPlans,
        includedUsers,
        minSelectable: minSelectableUsers,
        maxSelectable: maxSelectableUsers,
        hasUnlimitedTiers: Boolean(userCountBounds?.hasUnlimitedTier),
        unlimitedTierMin: userCountBounds?.unlimitedTierMin,
      }),
    [
      tierPlans,
      includedUsers,
      minSelectableUsers,
      maxSelectableUsers,
      userCountBounds?.hasUnlimitedTier,
      userCountBounds?.unlimitedTierMin,
    ],
  );

  // Piecewise slider: track position follows the evenly-spaced scale marks,
  // so e.g. 1140 users sits between the 200 and 5000 labels — not near 10.
  //
  // While dragging, the raw track position is the source of truth for the
  // input. Deriving the input value from the rounded user count instead would
  // move the thumb to a slightly different position on every re-render,
  // making the browser's drag events race React and the display trail behind.
  const sliderPos =
    sliderDragPos != null
      ? sliderDragPos
      : userCountToSliderPos(sliderMarks, effectiveUserCount);
  const sliderFillPct = (sliderPos / SLIDER_POSITION_RESOLUTION) * 100;

  const handleSliderChange = (e) => {
    const pos = Math.round(Number(e.target.value) || 0);
    setSliderDragPos(pos);
    handleUserCountChange(sliderPosToUserCount(sliderMarks, pos));
  };

  const handleSliderDragEnd = () => {
    // Re-sync the thumb to the canonical (clamped/rounded) user count.
    setSliderDragPos(null);
  };

  const coreFeatures = corePlan ? getPlanFeatureList(corePlan) : [];
  const defaultCoreFeatures =
    includedUsers > 0
      ? [
          `${includedUsers} user${includedUsers === 1 ? "" : "s"} included`,
          "Full system access",
          "Cloud hosting (fair usage)",
        ]
      : ["Full system access", "Cloud hosting (fair usage)"];
  const displayCoreFeatures = coreFeatures.length
    ? coreFeatures
    : defaultCoreFeatures;
  const coreFeaturesInline = displayCoreFeatures.join(" · ");

  const renderFlatPlanRow = (plan) => {
    const planCurrency = resolvePlanCurrency(plan, currency);
    const isSelected = String(selectedFlatPlan?.id) === String(plan.id);
    const isActive = currentPlanId && String(currentPlanId) === String(plan.id);
    const locked = isInvitationLocked;
    const disabled = locked || plan.eligible === false;
    const planBadge = (plan.badge || "").trim();
    const discPct = plan.discountPercent || 0;
    const listAmount = centsToUnits(
      plan.listPriceCents || plan.monthlyCents || 0,
    );
    const amount = centsToUnits(
      plan.total ??
        plan.estimatedTotal ??
        discountedCents(plan.monthlyCents || 0, discPct),
    );
    const features = (plan.features || []).filter(Boolean);
    const userRange =
      plan.totalUserLabel || plan.userRangeLabel || formatTotalUserRange(plan);

    return (
      <article
        key={plan.id}
        role={locked ? "group" : "button"}
        tabIndex={disabled || locked ? -1 : 0}
        aria-pressed={locked ? undefined : isSelected}
        aria-disabled={locked ? undefined : disabled}
        className={[
          "flexa-pricing-page__tier-row",
          isSelected || locked ? "flexa-pricing-page__tier-row--selected" : "",
          locked ? "flexa-pricing-page__tier-row--locked" : "",
          !locked && disabled ? "flexa-pricing-page__tier-row--disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          if (locked || disabled) return;
          setSelectedTierId(plan.id);
          onSelectTier?.(plan, null);
        }}
        onKeyDown={(e) => {
          if (locked || disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedTierId(plan.id);
            onSelectTier?.(plan, null);
          }
        }}
      >
        <div className="flexa-pricing-page__tier-radio" aria-hidden>
          <span
            className={
              isSelected || locked
                ? "flexa-pricing-page__tier-radio-dot flexa-pricing-page__tier-radio-dot--on"
                : "flexa-pricing-page__tier-radio-dot"
            }
          />
        </div>
        <div className="flexa-pricing-page__tier-body">
          <div className="flexa-pricing-page__tier-top">
            <span className="flexa-pricing-page__tier-name">{plan.name}</span>
            {locked || isActive ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--yours">
                {locked ? "Assigned plan" : "Your plan"}
              </span>
            ) : null}
            {discPct > 0 ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--discount">
                {discPct}% off
                {plan.discountDuration === "once"
                  ? " · first payment"
                  : plan.discountDuration === "repeating"
                    ? ` · ${Math.max(1, Number(plan.discountBillingCycles) || 1)} cycles`
                    : ""}
              </span>
            ) : null}
            {!locked && planBadge ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--popular">
                {planBadge}
              </span>
            ) : null}
          </div>
          {userRange ? (
            <p className="flexa-pricing-page__tier-user-range">{userRange}</p>
          ) : null}
          {plan.description ? (
            <p className="flexa-pricing-page__tier-desc">{plan.description}</p>
          ) : null}
          {features.length > 0 ? (
            <ul className="flexa-pricing-page__tier-features">
              {features.slice(0, 4).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          ) : null}
          {locked ? (
            <p className="flexa-pricing-page__tier-locked-note">
              Plan is fixed by your invitation. You can still add or remove
              modules.
            </p>
          ) : null}
          {!locked && !plan.eligible && plan.ineligibleReason ? (
            <p className="flexa-pricing-page__tier-warning">
              {plan.ineligibleReason}
            </p>
          ) : null}
        </div>
        <div className="flexa-pricing-page__tier-price">
          {discPct > 0 && listAmount > amount ? (
            <div className="flexa-pricing-page__tier-rate-was">
              {formatMoney(listAmount, planCurrency)}
            </div>
          ) : null}
          <div className="flexa-pricing-page__tier-rate-wrap">
            <span className="flexa-pricing-page__tier-rate">
              {formatMoney(amount, planCurrency)}
            </span>
            <span className="flexa-pricing-page__tier-rate-unit">/mo</span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div
      className={[
        "flexa-pricing-page",
        "flexa-pricing-page--split",
        isFlatPricing ? "flexa-pricing-page--flat" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flexa-pricing-page__main">
        <header className="flexa-pricing-page__header">
          <h2 className="flexa-pricing-page__title">{title}</h2>
          <div className="flexa-pricing-page__subtitle-row">
            <span>
              {isInvitationLocked
                ? isModuleOnlyReview || currentPlanId
                  ? "Your invitation plan stays the same. Review and confirm the module updates below."
                  : "Your invitation includes a fixed plan assigned by your administrator."
                : moduleCount != null && moduleCount > 0
                  ? `${moduleCount} module${moduleCount !== 1 ? "s" : ""} selected`
                  : isFlatPricing
                    ? currentPlanId
                      ? "Your plan tier and billing stay the same unless you pick a different plan."
                      : "Pick a plan for your workspace."
                    : "Configure your workspace plan"}
            </span>
            {onEditModules ? (
              <>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  className="flexa-pricing-page__edit-modules"
                  onClick={onEditModules}
                >
                  Edit modules
                </button>
              </>
            ) : null}
          </div>
        </header>

        {isFlatPricing ? (
          <section className="flexa-pricing-page__tiers">
            <div className="flexa-pricing-page__tiers-header">
              <span className="flexa-pricing-page__label-caps">
                {isInvitationLocked ? "Assigned plan" : "Available plans"}
              </span>
              <p className="flexa-pricing-page__tiers-note">
                {isInvitationLocked
                  ? "Fixed by your invitation. Modules can still change"
                  : "Select a plan for your subscription"}
              </p>
            </div>
            {isInvitationLocked ? (
              <div className="flexa-pricing-page__module-changes-priority">
                {renderModuleChanges()}
              </div>
            ) : null}
            <div className="flexa-pricing-page__tier-list">
              {tierPlans.map((plan) => renderFlatPlanRow(plan))}
            </div>
            {!isInvitationLocked ? renderModuleChanges() : null}
          </section>
        ) : (
          <>
        <section className="flexa-pricing-page__core" aria-label="Core plan">
          <div className="flexa-pricing-page__core-left">
            <div className="flexa-pricing-page__core-heading">
              <h3 className="flexa-pricing-page__core-name">{corePlan.name}</h3>
              {(corePlan.badge || "Mandatory").trim() ? (
                <span className="flexa-pricing-page__core-badge">
                  {(corePlan.badge || "Mandatory").trim()}
                </span>
              ) : null}
            </div>
            <p className="flexa-pricing-page__core-features-inline">
              {coreFeaturesInline}
            </p>
          </div>
          <div className="flexa-pricing-page__core-price-block">
            {corePlan.discountPercent > 0 ? (
              <span className="flexa-pricing-page__tier-badge flexa-pricing-page__tier-badge--discount">
                {corePlan.discountPercent}% off
                {corePlan.discountDuration === "once"
                  ? " · first payment"
                  : corePlan.discountDuration === "repeating"
                    ? ` · ${Math.max(1, Number(corePlan.discountBillingCycles) || 1)} cycles`
                    : ""}
              </span>
            ) : null}
            {corePlan.discountPercent > 0 && centsToUnits(corePlan.monthlyCents) > coreAmount ? (
              <div className="flexa-pricing-page__core-price-was">
                {formatMoney(centsToUnits(corePlan.monthlyCents), coreCurrency)}
              </div>
            ) : null}
            <div className="flexa-pricing-page__core-price">
              {formatMoney(coreAmount, coreCurrency)}
            </div>
            <div className="flexa-pricing-page__core-price-unit">
              /month/branch
            </div>
          </div>
        </section>

        <section className="flexa-pricing-page__users-section" aria-live="polite">
          <div className="flexa-pricing-page__users-header">
            <span className="flexa-pricing-page__label-caps" style={{ margin: 0 }}>Total users</span>
            <div className="flexa-pricing-page__user-controls">
              <button
                type="button"
                className="flexa-pricing-page__stepper-btn"
                aria-label="Decrease users"
                onClick={() => handleUserCountChange(effectiveUserCount - 1)}
                disabled={effectiveUserCount <= minSelectableUsers}
              >
                −
              </button>
              <span className="flexa-pricing-page__stepper-value">
                {effectiveUserCount}
              </span>
              <button
                type="button"
                className="flexa-pricing-page__stepper-btn"
                aria-label="Increase users"
                onClick={() => handleUserCountChange(effectiveUserCount + 1)}
                disabled={effectiveUserCount >= maxSelectableUsers}
              >
                +
              </button>
            </div>
          </div>
          <div className="flexa-pricing-page__slider-wrap">
            <span
              className="flexa-pricing-page__slider-tooltip"
              style={{ left: `${sliderFillPct}%` }}
            >
              {effectiveUserCount} users
            </span>
            <input
              type="range"
              className="flexa-pricing-page__slider"
              style={{ "--slider-fill": `${sliderFillPct}%` }}
              min={0}
              max={SLIDER_POSITION_RESOLUTION}
              step={1}
              value={sliderPos}
              onChange={handleSliderChange}
              onPointerUp={handleSliderDragEnd}
              onKeyUp={handleSliderDragEnd}
              onBlur={handleSliderDragEnd}
              aria-label="Total users slider"
              aria-valuemin={minSelectableUsers}
              aria-valuemax={maxSelectableUsers}
              aria-valuenow={effectiveUserCount}
              aria-valuetext={`${effectiveUserCount} users`}
            />
            <div className="flexa-pricing-page__slider-scale">
              {sliderMarks.map((mark, index) => {
                const pct = (index / (sliderMarks.length - 1)) * 100;
                let transform = "translateX(-50%)";
                if (index === 0) transform = "none";
                else if (index === sliderMarks.length - 1) transform = "translateX(-100%)";
                return (
                  <span
                    key={mark.value}
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      transform,
                      whiteSpace: "nowrap"
                    }}
                  >
                    {mark.label}
                  </span>
                );
              })}
            </div>
          </div>
          {!hasTierForCount ? (
            <p className="flexa-pricing-page__warning">
              No tier covers {effectiveUserCount} users. Adjust your count or
              contact sales.
            </p>
          ) : null}
          {renderModuleChanges()}
        </section>

        <section className="flexa-pricing-page__tiers">
          <div className="flexa-pricing-page__tiers-header">
            <span className="flexa-pricing-page__label-caps">
              Additional users · beyond the {includedUsers} included
            </span>
            <p className="flexa-pricing-page__tiers-note">
              Tier set automatically by team size
            </p>
          </div>
          <div className="flexa-pricing-page__tier-list">
            {tierPlans.map((tier) => renderTierRow(tier))}
          </div>
        </section>
          </>
        )}
      </div>

      {renderBillSummary(estimatedBillAmount, estimatedBillCents)}
    </div>
  );
};

export default FlexaPricingPage;
export { CORE_ONLY_PLAN_ID } from "./planChangeLogic";
export { splitPlans, discountedCents, buildCoreOnlyOption };
export {
  formatTotalUserRange,
  formatExtraUserRange,
  computeBillCents,
  computeExtraUsers,
  resolveTierForTotalUsers,
  getUserCountBounds,
  buildUserCountSliderMarks,
} from "./pricingLogic";
