import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import RegistrationServices from "@/services/RegistrationServices";
import SubscriptionCouponServices from "@/services/SubscriptionCouponServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import Button from "@/page-layouts/components/Button";
import { Loader } from "@/page-layouts/index";
import { syncAdminInfoRoleFromServer } from "@/utils/sessionApiCache";
import FlexaPricingPage from "./FlexaPricingPage";
import ConfirmChangeDialog from "./ConfirmChangeDialog";
import UpcomingInvoiceBreakdown from "./UpcomingInvoiceBreakdown";
import {
  CORE_ONLY_PLAN_ID,
  isModuleOnlyAdjustment,
  isDowngradeAdjustment,
  isUpgradeAdjustment,
  resolveAdjustmentPreviewNote,
  computeQuotePlanRecurringCents,
} from "./planChangeLogic";
import { tierMatchesTotalUsers } from "./pricingLogic";
import { formatSubscriptionCents } from "@/utils/subscriptionCurrency";
import { redirectToFiuuPayment } from "@/utils/fiuuPaymentRedirect";
import "./onboarding.css";

const formatPrice = (cents, currency = "myr") =>
  formatSubscriptionCents(cents, currency, { detailed: true });

const formatPriceDetailed = formatPrice;

const BILLING_INTERVAL = "monthly";

const fmtPeriodDate = (iso) => {
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

const AdjustmentPreviewPanel = ({
  preview,
  currency,
  quote,
  refreshing = false,
}) => {
  if (!preview) return null;

  const intervalLabel = "month";
  const planLabel = (planId) =>
    quote?.plans?.find((p) => p.id === planId)?.name || planId || "—";
  const dueTodayKnown = typeof preview.amountDueNow === "number";
  const moduleName = (key) =>
    preview.newLineItems?.find(
      (item) => String(item.key).toUpperCase() === String(key).toUpperCase(),
    )?.name ||
    quote?.lineItems?.find(
      (item) => String(item.key).toUpperCase() === String(key).toUpperCase(),
    )?.name ||
    key;

  const dueTodaySubLabel =
    preview.isOptimistic && !dueTodayKnown ? "estimate" : "";

  const moduleOnly = isModuleOnlyAdjustment(preview);
  const isUpgrade = isUpgradeAdjustment(preview);
  const isDowngrade = isDowngradeAdjustment(preview);

  const changeTypeLabel = moduleOnly
    ? "Updating module access"
    : isUpgrade
      ? "Upgrading subscription"
      : isDowngrade
        ? "Downgrading subscription"
        : preview.hasChanges
          ? "Changing subscription"
          : "Active subscription";

  const previewNote = resolveAdjustmentPreviewNote(preview);

  return (
    <div
      className={`onboarding-adjustment-preview${
        refreshing ? " onboarding-adjustment-preview--refreshing" : ""
      }`}
    >
      <div className="onboarding-adjustment-preview__header">
        <h3 className="onboarding-adjustment-preview__title">
          {preview.hasChanges ? changeTypeLabel : "Active subscription"}
        </h3>
        <p className="onboarding-adjustment-preview__note">
          {previewNote}
          {preview.currentPeriodEnd ? (
            <> Billing period ends {fmtPeriodDate(preview.currentPeriodEnd)}.</>
          ) : null}
          {refreshing ? (
            <span className="onboarding-adjustment-preview__sync">
              {" "}
              Updating…
            </span>
          ) : null}
        </p>
      </div>

      {!preview.hasChanges ? (
        <p
          className="onboarding-adjustment-preview__fallback"
          style={{ margin: 0 }}
        >
          Change modules, plan tier, or user count to update your subscription.
        </p>
      ) : (
        <>
          {(preview.planChanged ||
            preview.intervalChanged ||
            (preview.userCountChanged &&
              preview.currentUserCount != null &&
              preview.requestedUserCount != null)) && (
            <p className="onboarding-adjustment-preview__plan-change">
              {preview.planChanged ? (
                <>
                  Plan: <strong>{planLabel(preview.currentPlanId)}</strong>
                  {" → "}
                  <strong>{planLabel(preview.planId)}</strong>
                </>
              ) : null}
              {preview.planChanged && preview.intervalChanged ? " · " : null}
              {preview.intervalChanged ? (
                <>
                  Billing:{" "}
                  <strong>{preview.currentBillingInterval || "monthly"}</strong>
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
                  Users: <strong>{preview.currentUserCount}</strong>
                  {" → "}
                  <strong>{preview.requestedUserCount}</strong>
                </>
              ) : null}
            </p>
          )}
          <div className="onboarding-adjustment-preview__grid">
            <div className="onboarding-adjustment-preview__card">
              <span className="onboarding-adjustment-preview__label">
                Current
              </span>
              <strong>
                {formatPrice(preview.currentRecurringTotal, currency)}
              </strong>
              <span className="onboarding-adjustment-preview__sub">
                per {intervalLabel}
              </span>
            </div>
            <div className="onboarding-adjustment-preview__card onboarding-adjustment-preview__card--highlight">
              <span className="onboarding-adjustment-preview__label">New</span>
              <strong>
                {formatPrice(preview.newRecurringTotal, currency)}
              </strong>
              <span className="onboarding-adjustment-preview__sub">
                per {intervalLabel}
              </span>
            </div>
            <div className="onboarding-adjustment-preview__card">
              <span className="onboarding-adjustment-preview__label">
                Due today
              </span>
              <strong
                className={
                  !dueTodayKnown ? "onboarding-adjustment-preview__pending" : ""
                }
              >
                {dueTodayKnown
                  ? formatPriceDetailed(preview.amountDueNow, currency)
                  : "…"}
              </strong>
              <span className="onboarding-adjustment-preview__sub">
                {dueTodaySubLabel}
              </span>
            </div>
          </div>

          {!moduleOnly ? (
            <UpcomingInvoiceBreakdown
              preview={preview}
              currency={currency}
              variant="panel"
              showDueToday={false}
            />
          ) : null}

          {(preview.addedModules?.length > 0 ||
            preview.removedModules?.length > 0) && (
            <div className="onboarding-adjustment-preview__modules">
              {preview.addedModules?.length > 0 && (
                <div>
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
              )}
              {preview.removedModules?.length > 0 && (
                <div>
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
              )}
            </div>
          )}
        </>
      )}

      {preview.previewFallback && preview.previewError ? (
        <p className="onboarding-adjustment-preview__fallback">
          {preview.previewError}
        </p>
      ) : null}
    </div>
  );
};

const pickDefaultPlanId = (quote, savedPlanId) => {
  const included = quote?.corePlan?.includedUsers ?? 3;
  const activeUsers = quote?.seatUsage?.activeUsers;

  if (savedPlanId === CORE_ONLY_PLAN_ID && quote?.coreOnlyOption) {
    return CORE_ONLY_PLAN_ID;
  }

  const eligible = (quote?.plans || []).filter((p) => p.eligible);
  const savedEligible = eligible.find((p) => p.id === savedPlanId);
  if (savedEligible) return savedPlanId;

  if (
    quote?.coreOnlyOption &&
    typeof activeUsers === "number" &&
    activeUsers >= 1 &&
    activeUsers <= included
  ) {
    return CORE_ONLY_PLAN_ID;
  }

  if (!eligible.length) {
    return quote?.coreOnlyOption ? CORE_ONLY_PLAN_ID : null;
  }
  const rec = eligible.find((p) => p.recommended);
  return rec?.id || eligible[eligible.length - 1].id;
};

const PlanPickerModal = ({ open, onClose, isAdjustment = false }) => {
  const history = useHistory();
  const location = useLocation();
  const { state, dispatch } = useContext(AdminContext);

  const [quote, setQuote] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedUserCount, setSelectedUserCount] = useState(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const [modalWide, setModalWide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [planChangeMeta, setPlanChangeMeta] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const userSelectedPlanRef = useRef(false);
  const quotePlanRef = useRef(null);
  const quoteUserCountRef = useRef(null);

  const fetchQuote = useCallback(
    async (planId, userCount) => {
      const data = await RegistrationServices.getPricingQuote(
        BILLING_INTERVAL,
        {
          adjustment: isAdjustment,
          planId: isAdjustment && planId ? planId : undefined,
          userCount: userCount != null ? userCount : undefined,
        },
      ).catch(() => null);

      if (data) {
        quotePlanRef.current = planId || null;
        quoteUserCountRef.current =
          userCount != null ? userCount : (data.userCount ?? null);
        setQuote(data);
      }
      return data;
    },
    [isAdjustment],
  );

  const loadInitialQuote = useCallback(
    async (planId, userCount) => {
      const loaded = await fetchQuote(planId, userCount);

      if (!loaded) {
        throw new Error("Failed to load pricing.");
      }

      if (!userSelectedPlanRef.current) {
        const saved =
          loaded?.activePlanId ||
          loaded?.selectedPlanId ||
          state.adminInfo?.subscription?.subscribedPlanId ||
          state.adminInfo?.subscription?.selectedPlanId;
        const savedUserCount =
          loaded?.selectedUserCount ??
          loaded?.userCount ??
          loaded?.seatUsage?.activeUsers ??
          null;
        if (savedUserCount != null) {
          setSelectedUserCount(Math.max(1, Number(savedUserCount) || 1));
        }
        setSelectedPlanId((prev) =>
          prev && (loaded?.plans || []).some((p) => p.id === prev && p.eligible)
            ? prev
            : pickDefaultPlanId(loaded, saved),
        );
      }

      return loaded;
    },
    [
      fetchQuote,
      state.adminInfo?.subscription?.selectedPlanId,
      state.adminInfo?.subscription?.subscribedPlanId,
    ],
  );

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(location.search);
    if (params.get("cancelled")) {
      notifyError("Payment was cancelled. You can try again.");
    }
  }, [open, location.search]);

  useEffect(() => {
    if (!open) {
      userSelectedPlanRef.current = false;
      setSelectedUserCount(null);
      setModalWide(false);
      return;
    }
    const sub = state.adminInfo?.subscription;
    const activePlan = sub?.subscribedPlanId || sub?.selectedPlanId;
    if (activePlan) {
      userSelectedPlanRef.current = false;
      setSelectedPlanId(activePlan);
    }
  }, [
    open,
    state.adminInfo?.subscription?.selectedPlanId,
    state.adminInfo?.subscription?.subscribedPlanId,
  ]);

  useEffect(() => {
    if (!open || !state?.adminInfo?.token) {
      if (!open) {
        setQuote(null);
        quotePlanRef.current = null;
        quoteUserCountRef.current = null;
      }
      return;
    }

    let cancelled = false;
    setInitialLoading(true);

    const planIdForFetch =
      state.adminInfo?.subscription?.subscribedPlanId ||
      state.adminInfo?.subscription?.selectedPlanId ||
      undefined;
    const userCountForFetch =
      selectedUserCount ??
      state.adminInfo?.subscription?.selectedUserCount ??
      undefined;

    loadInitialQuote(planIdForFetch, userCountForFetch)
      .catch((err) => {
        if (!cancelled) {
          notifyError(err?.message || "Failed to load pricing.");
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, state?.adminInfo?.token, loadInitialQuote]);

  useEffect(() => {
    if (!open || !state?.adminInfo?.token || initialLoading) return;

    const planIdForFetch =
      selectedPlanId ||
      state.adminInfo?.subscription?.subscribedPlanId ||
      state.adminInfo?.subscription?.selectedPlanId;
    const userCountForFetch =
      selectedUserCount ??
      quote?.userCount ??
      state.adminInfo?.subscription?.selectedUserCount ??
      undefined;

    if (!planIdForFetch && isAdjustment) return;

    if (
      quotePlanRef.current === planIdForFetch &&
      quoteUserCountRef.current === (userCountForFetch ?? null) &&
      quote
    ) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewRefreshing(true);
      fetchQuote(planIdForFetch, userCountForFetch)
        .catch(() => {
          if (!cancelled) notifyError("Failed to refresh plan preview.");
        })
        .finally(() => {
          if (!cancelled) setPreviewRefreshing(false);
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    state?.adminInfo?.token,
    isAdjustment,
    selectedPlanId,
    selectedUserCount,
    initialLoading,
    fetchQuote,
    quote,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Fallback to the other interval's plans when the current interval hasn't loaded yet
  // so selectedPlan is never undefined while switching tabs.
  const anyQuote = quote;
  const selectedPlan =
    selectedPlanId === CORE_ONLY_PLAN_ID
      ? anyQuote?.coreOnlyOption || {
          id: CORE_ONLY_PLAN_ID,
          name: "Core Plan Only",
          eligible: true,
          total: anyQuote?.corePlan?.total ?? 0,
        }
      : quote?.plans?.find((p) => p.id === selectedPlanId) ||
        anyQuote?.plans?.find((p) => p.id === selectedPlanId) ||
        null;
  const activeUsers =
    quote?.seatUsage?.activeUsers ??
    anyQuote?.seatUsage?.activeUsers ??
    selectedPlan?.activeUsers;
  const currency = anyQuote?.currency || "usd";
  const resolvePickerCurrency = (plan) =>
    String(plan?.currency || currency || "usd")
      .trim()
      .toLowerCase();
  const selectedCurrency = resolvePickerCurrency(selectedPlan);
  const apiAdjustmentPreview = isAdjustment ? quote?.adjustmentPreview : null;
  const useCoreTierPricing =
    anyQuote?.pricingModel === "core_plus_tier" || Boolean(anyQuote?.corePlan);
  // Always use the modern FlexaPricingPage split UI (self-service and invitation).
  // Flat invitation catalogs render in FlexaPricingPage flat mode; core+tier
  // catalogs keep the Confirm your plan layout.
  const useModernPricingUi =
    Boolean(anyQuote) &&
    (useCoreTierPricing || (anyQuote?.plans || []).length > 0);
  const activePlanId =
    anyQuote?.activePlanId ||
    state.adminInfo?.subscription?.subscribedPlanId ||
    state.adminInfo?.subscription?.selectedPlanId ||
    null;
  const samePlanSelected =
    Boolean(activePlanId) &&
    Boolean(selectedPlanId) &&
    String(activePlanId) === String(selectedPlanId);

  const effectiveUserCountForPricing =
    selectedUserCount ??
    anyQuote?.userCount ??
    state.adminInfo?.subscription?.selectedUserCount ??
    null;

  const computedRecurringTotalCents = useMemo(() => {
    if (!anyQuote?.corePlan || !selectedPlanId) {
      return selectedPlan?.total ?? 0;
    }
    return computeQuotePlanRecurringCents(
      anyQuote,
      selectedPlanId,
      effectiveUserCountForPricing,
    );
  }, [
    anyQuote,
    selectedPlanId,
    effectiveUserCountForPricing,
    selectedPlan?.total,
  ]);

  const selectedTierSupportsUserCount = useMemo(() => {
    if (effectiveUserCountForPricing == null || !selectedPlanId) return true;
    const count = Math.max(1, Number(effectiveUserCountForPricing) || 1);
    if (String(selectedPlanId) === CORE_ONLY_PLAN_ID) {
      const included = Math.max(
        0,
        Number(anyQuote?.corePlan?.includedUsers) || 0,
      );
      return count <= included;
    }
    const tier = (anyQuote?.plans || []).find(
      (p) => String(p.id) === String(selectedPlanId),
    );
    if (!tier) return true;
    return tierMatchesTotalUsers(tier, count);
  }, [anyQuote, selectedPlanId, effectiveUserCountForPricing]);

  const adjustmentPreview = useMemo(() => {
    if (!isAdjustment || !selectedPlanId || !anyQuote) {
      return apiAdjustmentPreview;
    }

    const activePlanId =
      anyQuote.activePlanId ||
      state.adminInfo?.subscription?.subscribedPlanId ||
      state.adminInfo?.subscription?.selectedPlanId;
    const savedInterval = BILLING_INTERVAL;

    const planChanged = String(selectedPlanId) !== String(activePlanId || "");
    const intervalChanged = false;

    // Compute module diff from the quote's subscribedModules/pendingModules — available
    // immediately on first load, no need to wait for the API adjustment preview.
    const subscribedModules = (anyQuote.subscribedModules || []).map((k) =>
      String(k).toUpperCase(),
    );
    const pendingModules = (
      anyQuote.pendingModules ||
      anyQuote.selectedModules ||
      []
    ).map((k) => String(k).toUpperCase());
    const computedAdded = pendingModules.filter(
      (k) => !subscribedModules.includes(k),
    );
    const computedRemoved = subscribedModules.filter(
      (k) => !pendingModules.includes(k),
    );
    const computedModulesChanged =
      computedAdded.length > 0 || computedRemoved.length > 0;

    // Prefer API preview values only when they match the current full selection
    // (plan, interval, AND user count). Without the userCount check, changing the
    // slider while staying on the same tier would show a stale preview with the
    // wrong note (e.g. "downgrade" note while the price actually went up).
    const apiPreviewUserCount =
      apiAdjustmentPreview?.requestedUserCount ?? null;
    const currentSelectedUserCount =
      selectedUserCount ?? anyQuote?.userCount ?? null;
    const userCountMatchesApi =
      apiPreviewUserCount == null ||
      currentSelectedUserCount == null ||
      Number(apiPreviewUserCount) === Number(currentSelectedUserCount);
    const apiMatchesSelection =
      apiAdjustmentPreview &&
      String(apiAdjustmentPreview.planId) === String(selectedPlanId) &&
      apiAdjustmentPreview.billingInterval === BILLING_INTERVAL &&
      userCountMatchesApi;

    const currentUserCount =
      anyQuote?.subscribedUserCount ??
      anyQuote?.selectedUserCount ??
      state.adminInfo?.subscription?.subscribedUserCount ??
      state.adminInfo?.subscription?.selectedUserCount ??
      null;
    const requestedUserCount =
      selectedUserCount ?? anyQuote?.userCount ?? currentUserCount;

    const computeNewTotal = () =>
      computeQuotePlanRecurringCents(
        anyQuote,
        selectedPlanId,
        requestedUserCount,
      );

    if (apiMatchesSelection && !previewRefreshing) {
      const apiCurrentUsers = apiAdjustmentPreview.currentUserCount ?? currentUserCount;
      const apiRequestedUsers =
        apiAdjustmentPreview.requestedUserCount ?? requestedUserCount;
      const normalizedUserCountChanged =
        apiCurrentUsers != null &&
        apiRequestedUsers != null &&
        Number(apiCurrentUsers) !== Number(apiRequestedUsers);
      return {
        ...apiAdjustmentPreview,
        currentUserCount: apiCurrentUsers,
        requestedUserCount: apiRequestedUsers,
        userCountChanged: normalizedUserCountChanged,
        newRecurringTotal: computeNewTotal(),
      };
    }

    const addedModules =
      apiAdjustmentPreview?.addedModules?.length > 0
        ? apiAdjustmentPreview.addedModules
        : computedAdded;
    const removedModules =
      apiAdjustmentPreview?.removedModules?.length > 0
        ? apiAdjustmentPreview.removedModules
        : computedRemoved;
    const modulesChanged =
      apiAdjustmentPreview?.modulesChanged ?? computedModulesChanged;
    const userCountChanged =
      requestedUserCount != null &&
      currentUserCount != null &&
      Number(requestedUserCount) !== Number(currentUserCount);
    const hasChanges =
      planChanged || intervalChanged || modulesChanged || userCountChanged;

    // For "current" price use the saved-interval quote so we show what the customer
    // actually pays today, not what the newly-toggled interval would cost.
    const savedIntervalQuote = anyQuote;
    const activePlanInSavedQuote =
      activePlanId === CORE_ONLY_PLAN_ID
        ? savedIntervalQuote?.coreOnlyOption
        : savedIntervalQuote?.plans?.find((p) => p.id === activePlanId);
    const currentRecurringTotal =
      apiAdjustmentPreview?.currentRecurringTotal ??
      activePlanInSavedQuote?.total ??
      (activePlanId === CORE_ONLY_PLAN_ID
        ? savedIntervalQuote?.corePlan?.total
        : 0) ??
      0;

    const newRecurringTotal = computeNewTotal();
    const isOptimisticDowngrade =
      hasChanges &&
      typeof currentRecurringTotal === "number" &&
      typeof newRecurringTotal === "number" &&
      newRecurringTotal < currentRecurringTotal;

    return {
      billingInterval: BILLING_INTERVAL,
      planId: selectedPlanId,
      currentPlanId: activePlanId,
      currentBillingInterval: savedInterval,
      currentRecurringTotal,
      newRecurringTotal,
      planChanged,
      intervalChanged,
      modulesChanged,
      addedModules,
      removedModules,
      hasChanges,
      userCountChanged,
      currentUserCount,
      requestedUserCount,
      newLineItems: anyQuote.lineItems,
      amountDueNow: isOptimisticDowngrade ? 0 : undefined,
      creditTotal: isOptimisticDowngrade ? 0 : undefined,
      note: isOptimisticDowngrade
        ? "No charge today. Your downgraded plan takes effect immediately."
        : "Estimated pricing — confirming exact proration…",
      isOptimistic: !isOptimisticDowngrade,
    };
  }, [
    isAdjustment,
    quote,
    anyQuote,
    selectedPlanId,
    selectedUserCount,
    apiAdjustmentPreview,
    state.adminInfo?.subscription,
    previewRefreshing,
  ]);

  const blockProceedForSamePlan =
    isAdjustment &&
    samePlanSelected &&
    adjustmentPreview &&
    adjustmentPreview.hasChanges === false;

  if (!open) return null;

  const noChangesToApply =
    isAdjustment && adjustmentPreview && adjustmentPreview.hasChanges === false;
  // Module-only: something changed but it's not the plan tier or billing interval.
  // Use explicit flags instead of price equality (prices may coincidentally match).
  const isModuleOnlyChange =
    isAdjustment &&
    adjustmentPreview?.hasChanges === true &&
    adjustmentPreview.modulesChanged === true &&
    !adjustmentPreview.planChanged &&
    !adjustmentPreview.intervalChanged &&
    !adjustmentPreview.userCountChanged;
  const isDowngradePreview = isDowngradeAdjustment(adjustmentPreview);
  const needsStripeQuote = isAdjustment && !isModuleOnlyChange;
  const stripeQuoteReady =
    !needsStripeQuote ||
    (adjustmentPreview &&
      (isDowngradePreview ||
        (!previewRefreshing &&
          adjustmentPreview.isOptimistic !== true &&
          typeof adjustmentPreview.amountDueNow === "number")));
  const seatBlocked =
    selectedPlan?.seatBlocked === true ||
    selectedPlan?.ineligibleReason === "Delete users first.";
  const hasSeatBlockedPlans = quote?.seatUsage?.hasSeatBlockedPlans === true;
  const showSeatNote =
    (seatBlocked || hasSeatBlockedPlans) && typeof activeUsers === "number";
  const moduleLabels = (quote?.lineItems || []).map((item) => item.name);
  const intervalLabel = "mo";

  // Step 1 — validate and open the confirmation dialog.
  const handleContinueClick = () => {
    if (!selectedPlanId || !selectedPlan?.eligible) {
      notifyError("Select a plan with configured pricing to continue.");
      return;
    }
    if (
      useCoreTierPricing &&
      effectiveUserCountForPricing != null &&
      !selectedTierSupportsUserCount
    ) {
      notifyError("No tier covers your selected user count.");
      return;
    }
    if (noChangesToApply) {
      notifyError(
        "No changes to apply. Your selection matches your current active subscription.",
      );
      return;
    }
    if (seatBlocked) {
      notifyError("Delete users first.");
      return;
    }
    if (needsStripeQuote && !stripeQuoteReady) {
      notifyError("Please wait — we're calculating the amount due.");
      return;
    }
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponError("");
    setCheckoutStarted(false);
    setConfirmDialogOpen(true);
  };

  const handleApplyCoupon = async () => {
    const code = String(couponCode || "").trim();
    if (!code || !selectedPlan) return;
    setCouponApplying(true);
    setCouponError("");
    try {
      const amount =
        typeof computedRecurringTotalCents === "number"
          ? computedRecurringTotalCents
          : selectedPlan.total;
      const res = await SubscriptionCouponServices.validate({
        couponCode: code,
        planId: selectedPlanId,
        amount,
        userId: state?.adminInfo?._id || state?.adminInfo?.id,
      });
      setAppliedCoupon({
        couponId: res.couponId,
        couponCode: res.couponCode,
        discount: res.discount,
        discountType: res.discountType,
        discountValue: res.discountValue,
        duration: res.duration || "once",
        billingCycles: res.billingCycles ?? null,
        durationLabel: res.durationLabel || null,
        finalAmount: res.finalAmount,
        originalAmount: res.originalAmount ?? amount,
      });
      setCouponCode(res.couponCode || code);
      notifySuccess("Promo code applied successfully.");
    } catch (err) {
      console.error("Promo code validate failed:", err?.response || err);
      setAppliedCoupon(null);
      const errorCode = err?.response?.data?.code;
      const serverMessage = err?.response?.data?.message;
      if (
        ["NOT_FOUND", "EXPIRED", "INACTIVE", "NOT_STARTED"].includes(errorCode)
      ) {
        setCouponError("Invalid or expired promo code.");
      } else if (errorCode === "SESSION_EXPIRED") {
        setCouponError("Your session has expired. Please log in again.");
      } else if (serverMessage) {
        setCouponError(
          serverMessage.replace(/coupon/gi, (m) =>
            m[0] === "C" ? "Promo code" : "promo code",
          ),
        );
      } else if (!err?.response) {
        setCouponError(
          "Could not reach the server. Please check your connection and try again.",
        );
      } else {
        setCouponError("Failed to apply promo code.");
      }
    } finally {
      setCouponApplying(false);
    }
  };

  const handleClearCoupon = () => {
    if (checkoutStarted) return;
    setAppliedCoupon(null);
    setCouponError("");
    setCouponCode("");
  };

  // Step 2 — user confirmed; fire the actual API call.
  const handleConfirmedSubmit = async () => {
    setSubmitting(true);
    try {
      if (isAdjustment) {
        setConfirmDialogOpen(false);
        const result = await RegistrationServices.applyAdjustment({
          planId: selectedPlanId,
          billingInterval: BILLING_INTERVAL,
          userCount: selectedUserCount ?? quote?.userCount,
        });

        if (result?.mitSubmitted && result?.sessionId) {
          setCheckoutStarted(true);
          notifySuccess(
            result.message ||
              "Charging your saved card. Please wait a moment…",
          );
          let verified = null;
          for (let i = 0; i < 12; i += 1) {
            await new Promise((r) => setTimeout(r, 2000));
            verified = await RegistrationServices.verifyPayment(
              result.sessionId,
            ).catch(() => null);
            if (verified?.activated || verified?.paymentStatus === "paid") {
              break;
            }
            if (
              verified?.paymentStatus === "failed" ||
              verified?.paymentStatus === "cancelled"
            ) {
              break;
            }
          }
          setCheckoutStarted(false);
          if (verified?.activated || verified?.paymentStatus === "paid") {
            const withRole = await syncAdminInfoRoleFromServer(state.adminInfo);
            const updatedAdminInfo = {
              ...withRole,
              subscription: {
                ...(withRole.subscription || {}),
                subscribedModules:
                  verified.subscribedModules || result.subscribedModules || [],
                selectedModules:
                  verified.subscribedModules || result.subscribedModules || [],
                selectedPlanId: result.selectedPlanId,
                subscribedPlanId:
                  result.subscribedPlanId || result.selectedPlanId,
                billingInterval: result.billingInterval,
                subscribedBillingInterval:
                  result.billingInterval || BILLING_INTERVAL,
                subscriptionStatus: "Active",
              },
            };
            localStorage.setItem(
              "adminInfo",
              JSON.stringify(updatedAdminInfo),
            );
            dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });
            notifySuccess("Subscription updated. Saved card charged successfully.");
            history.push("/billing", {
              billingUpdated: true,
              selectedPlanId: result.selectedPlanId,
              subscribedPlanId:
                result.subscribedPlanId || result.selectedPlanId,
              planName: result.planName,
              billingInterval: result.billingInterval,
              subscribedModules: result.subscribedModules || [],
              catalogRecurringTotal: selectedPlan?.total,
            });
            return;
          }
          notifyError(
            verified?.paymentStatus === "failed"
              ? "Saved-card charge failed. Please try again or update your card."
              : "Payment is still processing. Check Billing in a moment, or update your card and retry.",
          );
          return;
        }

        if (result?.requiresCheckout || result?.url || result?.formFields) {
          setCheckoutStarted(true);
          if (redirectToFiuuPayment(result)) return;
          setCheckoutStarted(false);
          notifyError("Failed to start adjustment payment.");
          return;
        }

        const withRole = await syncAdminInfoRoleFromServer(state.adminInfo);
        const updatedAdminInfo = {
          ...withRole,
          subscription: {
            ...(withRole.subscription || {}),
            subscribedModules: result.subscribedModules || [],
            subscribedSubModules: result.subscribedSubModules || [],
            selectedModules: result.subscribedModules || [],
            selectedSubModules: result.subscribedSubModules || [],
            selectedPlanId: result.selectedPlanId,
            subscribedPlanId: result.subscribedPlanId || result.selectedPlanId,
            billingInterval: result.billingInterval,
            subscribedBillingInterval:
              result.billingInterval || BILLING_INTERVAL,
            subscriptionStatus: "Active",
          },
        };
        localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
        dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });
        const dueNow = result?.stripe?.amountDueNow ?? 0;
        const paid = result?.stripe?.amountPaid ?? 0;
        const creditGranted = result?.stripe?.creditGranted ?? 0;
        const creditApplied = result?.stripe?.accountBalanceApplied ?? 0;
        if (dueNow > 0 || paid > 0) {
          notifySuccess(
            `Subscription updated. ${formatPriceDetailed(paid || dueNow, selectedCurrency)} charged.`,
          );
        } else if (creditGranted > 0) {
          notifySuccess(
            `Subscription downgraded. ${formatPriceDetailed(creditGranted, selectedCurrency)} added to your account credit.`,
          );
        } else if (creditApplied > 0) {
          notifySuccess(
            `Subscription updated. ${formatPriceDetailed(creditApplied, selectedCurrency)} account credit applied. No charge today.`,
          );
        } else if (isModuleOnlyChange) {
          notifySuccess(
            "Modules updated. Your plan tier and billing stay the same. No charge today.",
          );
        } else {
          notifySuccess(
            "Subscription updated. No prorated charge today. Your current billing period is already covered.",
          );
        }
        history.push("/billing", {
          billingUpdated: true,
          selectedPlanId: result.selectedPlanId,
          subscribedPlanId: result.subscribedPlanId || result.selectedPlanId,
          planName: result.planName,
          billingInterval: result.billingInterval,
          subscribedModules: result.subscribedModules || [],
          catalogRecurringTotal: selectedPlan?.total,
        });
        return;
      }

      setCheckoutStarted(true);
      await RegistrationServices.selectPlan({
        planId: selectedPlanId,
        billingInterval: BILLING_INTERVAL,
        adjustment: false,
        userCount: selectedUserCount ?? quote?.userCount,
      });

      const checkout = await RegistrationServices.createCheckout(
        appliedCoupon?.couponCode || undefined,
      );
      if (redirectToFiuuPayment(checkout)) {
        return;
      }
      setCheckoutStarted(false);
      notifyError("Failed to start checkout.");
    } catch (err) {
      setCheckoutStarted(false);
      notifyError(
        err?.response?.data?.message || "Failed to proceed to payment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const continueLabel = (() => {
    if (!selectedPlan?.eligible) {
      if (seatBlocked) return "Delete users first";
      return "Select a plan";
    }
    if (noChangesToApply) return "No changes to apply";
    if (needsStripeQuote && !stripeQuoteReady)
      return "Calculating payment due…";
    if (isAdjustment) {
      if (
        typeof adjustmentPreview?.amountDueNow === "number" &&
        adjustmentPreview.amountDueNow > 0
      ) {
        return `Review ${formatPriceDetailed(adjustmentPreview.amountDueNow, selectedCurrency)} due today`;
      }
      if (isModuleOnlyChange) return "Review module changes";
      if (isDowngradePreview) return "Review plan change";
      return "Review plan change";
    }
    const trialOn =
      anyQuote?.trial?.enabled === true &&
      Math.max(0, Number(anyQuote?.trial?.trialDays) || 0) > 0;
    if (trialOn) {
      const days = Math.max(0, Number(anyQuote.trial.trialDays) || 0);
      return `Start ${days}-day free trial`;
    }
    return `Continue ${formatPrice(
      useCoreTierPricing ? computedRecurringTotalCents : selectedPlan.total,
      currency,
    )}/${intervalLabel}`;
  })();

  return (
    <>
      <div
        className="plan-picker-overlay"
        role="presentation"
        onClick={onClose}
      >
        <div
          className={[
            "plan-picker-modal",
            modalWide ? "plan-picker-modal--wide" : "",
            useModernPricingUi ? "plan-picker-modal--split" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-picker-title"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="plan-picker-modal__resize"
            onClick={() => setModalWide((wide) => !wide)}
            aria-label={
              modalWide ? "Minimize modal width" : "Maximize modal width"
            }
            title={modalWide ? "Minimize width" : "Maximize width"}
          >
            {modalWide ? "⤡" : "⤢"}
          </button>
          <button
            type="button"
            className="plan-picker-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>

          {!useModernPricingUi ? (
            <div className="plan-picker-modal__header">
              <h2 id="plan-picker-title" className="plan-picker-modal__title">
                {isAdjustment
                  ? isModuleOnlyChange
                    ? "Review module changes"
                    : "Confirm your plan"
                  : "Choose your plan"}
              </h2>
              <div className="plan-picker-modal__subtitle-row">
                <p className="plan-picker-modal__subtitle">
                  {isAdjustment && isModuleOnlyChange
                    ? "Your plan tier and billing stay the same. Confirm to apply the module updates below."
                    : moduleLabels.length > 0
                      ? `${moduleLabels.length} module${moduleLabels.length !== 1 ? "s" : ""} selected. Pick a plan tier.`
                      : "Pick a plan tier for your workspace."}
                </p>
                {!isAdjustment ? (
                  <button
                    type="button"
                    className="plan-picker-modal__edit-modules"
                    onClick={() => {
                      onClose?.();
                      history.push("/onboarding/modules");
                    }}
                  >
                    Edit modules
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <h2 id="plan-picker-title" className="sr-only">
              {isAdjustment ? "Confirm your plan" : "Choose your plan"}
            </h2>
          )}

          {isAdjustment && adjustmentPreview && !useModernPricingUi && (
            <AdjustmentPreviewPanel
              preview={adjustmentPreview}
              currency={selectedCurrency}
              quote={quote}
              refreshing={previewRefreshing}
            />
          )}

          {showSeatNote && (
            <p className="plan-picker-modal__seat-note">
              System users in your workspace: <strong>{activeUsers}</strong>.
              {seatBlocked
                ? ` ${selectedPlan?.ineligibleReason || "Delete users before switching to this plan."}`
                : " Plans with a lower user cap are disabled until you delete System Users."}
            </p>
          )}

          {initialLoading ? (
            <div className="plan-picker-modal__loading">
              <Loader color="var(--p-blue)" />
            </div>
          ) : useModernPricingUi ? (
            <FlexaPricingPage
              fetchPlans={false}
              corePlan={anyQuote?.corePlan}
              tierPlans={quote?.plans || anyQuote?.plans || []}
              activeUsers={activeUsers}
              coreOnlyOption={anyQuote?.coreOnlyOption}
              currentPlanId={isAdjustment ? activePlanId : null}
              planChangePreview={isAdjustment ? adjustmentPreview : null}
              previewRefreshing={previewRefreshing}
              billingInterval={BILLING_INTERVAL}
              quote={anyQuote}
              selectedTierId={selectedPlanId}
              selectedUserCount={selectedUserCount ?? quote?.userCount}
              onPlanChangeMeta={setPlanChangeMeta}
              title={
                isAdjustment
                  ? isModuleOnlyChange
                    ? "Review module changes"
                    : "Confirm your plan"
                  : "Choose your plan"
              }
              moduleCount={moduleLabels.length}
              onEditModules={
                isAdjustment
                  ? null
                  : () => {
                      onClose?.();
                      history.push("/onboarding/modules");
                    }
              }
              continueLabel={continueLabel}
              onContinue={handleContinueClick}
              continueDisabled={
                !selectedPlan?.eligible ||
                submitting ||
                initialLoading ||
                noChangesToApply ||
                blockProceedForSamePlan ||
                seatBlocked ||
                (needsStripeQuote && !stripeQuoteReady)
              }
              continueLoading={submitting}
              onUserCountChange={(count) => {
                userSelectedPlanRef.current = true;
                setSelectedUserCount(count);
              }}
              onSelectTier={(tier, userCount) => {
                if (tier?.eligible === false) return;
                if (
                  anyQuote?.invitationPlanLocked &&
                  activePlanId &&
                  String(tier.id) !== String(activePlanId)
                ) {
                  return;
                }
                userSelectedPlanRef.current = true;
                setSelectedPlanId(tier.id);
                if (userCount != null) {
                  setSelectedUserCount(userCount);
                }
              }}
              invitationPlanLocked={
                anyQuote?.invitationPlanLocked === true ||
                anyQuote?.pricingChannel === "invitation"
              }
            />
          ) : (
            <div className="plan-picker-modal__plans">
              {(quote?.plans || []).map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const isSeatBlocked = plan.seatBlocked === true;
                return (
                  <div
                    key={plan.id}
                    role="button"
                    tabIndex={plan.eligible ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-disabled={!plan.eligible}
                    onClick={() => {
                      if (!plan.eligible) return;
                      userSelectedPlanRef.current = true;
                      setSelectedPlanId(plan.id);
                    }}
                    onKeyDown={(e) => {
                      if (!plan.eligible) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        userSelectedPlanRef.current = true;
                        setSelectedPlanId(plan.id);
                      }
                    }}
                    className={[
                      "plan-picker-plan",
                      isSelected ? "plan-picker-plan--selected" : "",
                      !plan.eligible ? "plan-picker-plan--disabled" : "",
                      isSeatBlocked ? "plan-picker-plan--seat-blocked" : "",
                      plan.recommended ? "plan-picker-plan--recommended" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {(plan.badge || "").trim() ? (
                      <span className="plan-picker-plan__tag">
                        {plan.badge.trim()}
                      </span>
                    ) : null}
                    <div className="plan-picker-plan__name">{plan.name}</div>
                    <div className="plan-picker-plan__price">
                      {plan.discountPercent > 0 &&
                      plan.listPriceCents > plan.total ? (
                        <>
                          <span className="plan-picker-plan__price-was">
                            {formatPrice(
                              plan.listPriceCents,
                              resolvePickerCurrency(plan),
                            )}
                          </span>
                          {formatPrice(plan.total, resolvePickerCurrency(plan))}
                        </>
                      ) : (
                        formatPrice(plan.total, resolvePickerCurrency(plan))
                      )}
                      <span className="plan-picker-plan__interval">
                        /{intervalLabel}
                      </span>
                    </div>
                    {plan.discountPercent > 0 ? (
                      <p className="plan-picker-plan__discount">
                        {plan.discountPercent}% volume discount
                      </p>
                    ) : null}
                    {plan.description && (
                      <p className="plan-picker-plan__desc">
                        {plan.description}
                      </p>
                    )}
                    {!plan.eligible && (
                      <p className="plan-picker-plan__ineligible">
                        {plan.ineligibleReason}
                      </p>
                    )}
                    <ul className="plan-picker-plan__features">
                      {(plan.features || []).slice(0, 5).map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                    <span className="plan-picker-plan__radio" aria-hidden />
                  </div>
                );
              })}
            </div>
          )}

          {!useModernPricingUi ? (
            <div className="plan-picker-modal__footer">
              <Button
                label={continueLabel}
                onClick={handleContinueClick}
                loading={submitting}
                disabled={
                  !selectedPlan?.eligible ||
                  submitting ||
                  initialLoading ||
                  noChangesToApply ||
                  blockProceedForSamePlan ||
                  seatBlocked ||
                  (needsStripeQuote && !stripeQuoteReady)
                }
                className="plan-picker-modal__cta"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Confirmation dialog ──────────────────────────────────── */}
      {confirmDialogOpen && (
        <ConfirmChangeDialog
          preview={isAdjustment ? adjustmentPreview : null}
          selectedPlan={selectedPlan}
          recurringTotalCents={computedRecurringTotalCents}
          billingInterval={BILLING_INTERVAL}
          currency={selectedCurrency}
          quote={quote || anyQuote}
          isAdjustment={isAdjustment}
          isModuleOnlyChange={isModuleOnlyChange}
          previewRefreshing={previewRefreshing}
          quoteReady={stripeQuoteReady}
          couponCode={couponCode}
          onCouponCodeChange={(value) => {
            setCouponCode(value);
            setCouponError("");
          }}
          appliedCoupon={appliedCoupon}
          couponError={couponError}
          couponApplying={couponApplying}
          onApplyCoupon={handleApplyCoupon}
          onClearCoupon={handleClearCoupon}
          checkoutStarted={checkoutStarted}
          onConfirm={handleConfirmedSubmit}
          onCancel={() => {
            if (checkoutStarted) return;
            setConfirmDialogOpen(false);
          }}
        />
      )}
    </>
  );
};

export default PlanPickerModal;
