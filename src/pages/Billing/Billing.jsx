import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  Calendar,
  CreditCard,
  FileText,
  Layers,
  RefreshCw,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { ADJUSTMENT_MODULES_PATH } from "@/utils/subscriptionAdjustment";
import { patchAdminInfoSubscriptionStatus } from "@/utils/subscriptionRedirect";
import {
  Loader,
  PageHeader,
  DataTable,
  ActionButtons,
} from "@/page-layouts/index";
import "./billing.css";
import { formatSubscriptionCents } from "@/utils/subscriptionCurrency";
import { redirectToFiuuPayment } from "@/utils/fiuuPaymentRedirect";

const fmt = (cents, currency = "myr") =>
  formatSubscriptionCents(cents, currency, { detailed: true });

const fmtDate = (ms) => {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

/** UTC billing-period labels (matches invoice line wording, e.g. 3 Jul – 3 Aug). */
const fmtPeriodDate = (ms) => {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
};

const statusBadge = (status) => {
  const s = String(status || "").toLowerCase();
  if (["active", "paid"].includes(s)) return "bl-badge--ok";
  if (["past_due", "unpaid", "open", "pending"].includes(s))
    return "bl-badge--warn";
  if (["canceled", "void", "uncollectible"].includes(s)) return "bl-badge--bad";
  return "bl-badge--neutral";
};

const capitalize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const INVOICE_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "open", label: "Open" },
  { value: "draft", label: "Draft" },
  { value: "void", label: "Void" },
  { value: "uncollectible", label: "Uncollectible" },
];

function MetricCard({ accent, icon: Icon, label, value, sub, badge, footer }) {
  return (
    <div className={`bl-metric-card bl-metric-card--${accent}`}>
      <div className={`bl-metric-card__icon bl-metric-card__icon--${accent}`}>
        <Icon size={20} strokeWidth={2.25} aria-hidden />
      </div>
      <div className="bl-metric-card__content">
        <span className="bl-metric-card__label">{label}</span>
        <div className="bl-metric-card__value-row">
          <span className="bl-metric-card__value">{value}</span>
          {badge ? (
            <span className={`bl-badge ${statusBadge(badge)}`}>
              {capitalize(badge)}
            </span>
          ) : null}
        </div>
        {sub ? <p className="bl-metric-card__sub">{sub}</p> : null}
        {footer ? <div className="bl-metric-card__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

function HeaderActionButton({ onClick, disabled, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bl-header-btn"
    >
      {Icon ? <Icon size={16} /> : null}
      {label}
    </button>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
  tone = "default",
  external = false,
}) {
  return (
    <button
      type="button"
      className={`bl-action-card bl-action-card--${tone}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={`bl-action-card__icon bl-action-card__icon--${tone}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="bl-action-card__text">
        <span className="bl-action-card__title">{title}</span>
        <span className="bl-action-card__desc">{description}</span>
      </span>
      {external ? (
        <ExternalLink size={14} className="bl-action-card__arrow" aria-hidden />
      ) : null}
    </button>
  );
}

function SubscriptionConfirmModal({
  isOpen,
  title,
  description,
  dateLabel,
  dateValue,
  footnote,
  confirmText,
  cancelText = "Keep subscription",
  tone = "danger",
  onClose,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div className="bl-sub-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`bl-sub-modal bl-sub-modal--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bl-sub-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="bl-sub-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className={`bl-sub-modal__accent bl-sub-modal__accent--${tone}`} />

        <h2 id="bl-sub-modal-title" className="bl-sub-modal__title">
          {title}
        </h2>

        {description ? (
          <p className="bl-sub-modal__desc">{description}</p>
        ) : null}

        <div
          className={`bl-sub-modal__date-card bl-sub-modal__date-card--${tone}`}
        >
          <div
            className={`bl-sub-modal__date-icon bl-sub-modal__date-icon--${tone}`}
          >
            <Calendar size={18} strokeWidth={2} aria-hidden />
          </div>
          <div className="bl-sub-modal__date-copy">
            <span className="bl-sub-modal__date-label">{dateLabel}</span>
            <span className="bl-sub-modal__date-value">{dateValue}</span>
          </div>
        </div>

        {footnote ? <p className="bl-sub-modal__footnote">{footnote}</p> : null}

        <div className="bl-sub-modal__footer">
          <button
            type="button"
            className="bl-sub-modal__btn bl-sub-modal__btn--ghost"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`bl-sub-modal__btn bl-sub-modal__btn--${tone}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const Billing = () => {
  const history = useHistory();
  const location = useLocation();
  const { state, dispatch } = useContext(AdminContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billing, setBilling] = useState(null);
  const billingRef = useRef(null);
  billingRef.current = billing;
  const [invoices, setInvoices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    description: "",
    dateLabel: "",
    dateValue: "",
    footnote: "",
    confirmText: "Confirm",
    cancelText: "Keep subscription",
    tone: "danger",
    onConfirm: null,
  });

  const closeConfirm = () =>
    setConfirmModal((prev) => ({ ...prev, isOpen: false, onConfirm: null }));

  const openConfirm = (config) =>
    setConfirmModal({
      isOpen: true,
      title: config.title,
      description: config.description || "",
      dateLabel: config.dateLabel || "",
      dateValue: config.dateValue || "",
      footnote: config.footnote || "",
      confirmText: config.confirmText || "Confirm",
      cancelText: config.cancelText || "Keep subscription",
      tone: config.tone || "danger",
      onConfirm: config.onConfirm,
    });

  const openExternalUrl = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const load = async ({ silent = false } = {}) => {
    const hasCachedData = Boolean(billingRef.current);
    if (!silent && !hasCachedData) setLoading(true);
    else setRefreshing(true);
    try {
      const [ovRes, invRes] = await Promise.allSettled([
        RegistrationServices.getBillingOverview(),
        RegistrationServices.getBillingInvoices(),
      ]);
      if (ovRes.status === "fulfilled") {
        const billingData = ovRes.value.billing || null;
        setBilling(billingData);
        if (
          billingData?.subscriptionStatus === "Cancelled" ||
          billingData?.subscriptionStatus === "Expired" ||
          billingData?.subscriptionStatus === "Active"
        ) {
          const updatedAdminInfo = patchAdminInfoSubscriptionStatus(
            billingData.subscriptionStatus,
          );
          if (updatedAdminInfo) {
            dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });
          }
        }
      }
      if (invRes.status === "fulfilled")
        setInvoices(invRes.value.invoices || []);
      if (ovRes.status === "rejected" && !hasCachedData) {
        notifyError(
          ovRes.reason?.response?.data?.message || "Failed to load billing.",
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (location.state?.billingUpdated) {
      setBilling((prev) => ({
        ...(prev || {}),
        selectedPlanId: location.state.selectedPlanId || prev?.selectedPlanId,
        subscribedPlanId:
          location.state.subscribedPlanId || location.state.selectedPlanId,
        planName: location.state.planName || prev?.planName,
        billingInterval:
          location.state.billingInterval || prev?.billingInterval,
        subscribedModules:
          location.state.subscribedModules || prev?.subscribedModules || [],
        catalogRecurringTotal:
          location.state.catalogRecurringTotal ?? prev?.catalogRecurringTotal,
        recurringAfterDiscount:
          location.state.catalogRecurringTotal ?? prev?.recurringAfterDiscount,
      }));
      history.replace({ pathname: location.pathname, search: location.search });
    }
  }, [location.state, location.pathname, location.search, history]);

  useEffect(() => {
    if (!state?.adminInfo?.token) {
      history.replace("/login");
      return;
    }
    load({
      silent:
        Boolean(billingRef.current) || Boolean(location.state?.billingUpdated),
    });
  }, [state?.adminInfo?.token, location.pathname, location.key]);

  const withBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handlePortal = () =>
    withBusy(async () => {
      const res = await RegistrationServices.createRenewalCheckout().catch(
        (e) => {
          notifyError(
            e?.response?.data?.message ||
              "Could not start renewal payment via Fiuu.",
          );
          return null;
        },
      );
      if (res && redirectToFiuuPayment(res)) return;
      if (res?.renewed) {
        const updatedAdminInfo = patchAdminInfoSubscriptionStatus("Active");
        if (updatedAdminInfo) {
          dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });
        }
        notifySuccess(
          res.creditApplied > 0
            ? `${fmt(res.creditApplied, billing?.currency || "myr")} credit applied. Subscription renewed.`
            : "Subscription renewed.",
        );
        await load({ silent: true });
      }
    });

  const handleRetrySavedCard = () =>
    withBusy(async () => {
      const res = await RegistrationServices.retryFailedPayment().catch(
        (e) => {
          notifyError(
            e?.response?.data?.message ||
              "Could not charge your saved card. Please try again.",
          );
          return null;
        },
      );
      if (!res) return;
      if (res.mitAccepted || res.action === "submitted") {
        notifySuccess(
          "Charging your saved card. This usually completes in a few seconds.",
        );
        await load({ silent: true });
        return;
      }
      if (res.action === "paid_with_credit") {
        notifySuccess("Subscription renewed using account credit.");
        await load({ silent: true });
        return;
      }
      notifyError(
        res.message || "Saved-card charge did not complete. Please try again.",
      );
    });

  const handleCancel = () => {
    const accessUntil = fmtDate(billing?.currentPeriodEnd);
    const hasDate = accessUntil && accessUntil !== "—";
    openConfirm({
      title: "Cancel subscription",
      description:
        "Your plan stays active through the current billing period. After that, renewals stop and access ends.",
      dateLabel: "Access ends",
      dateValue: hasDate ? accessUntil : "End of billing period",
      footnote: hasDate
        ? `You can resume anytime before ${accessUntil}.`
        : "You can resume anytime before the period ends.",
      confirmText: "Confirm cancellation",
      cancelText: "Keep plan",
      tone: "danger",
      onConfirm: async () => {
        closeConfirm();
        await withBusy(async () => {
          const res = await RegistrationServices.cancelSubscription({
            immediately: false,
          }).catch((e) => {
            notifyError(
              e?.response?.data?.message || "Failed to cancel subscription.",
            );
            throw e;
          });
          notifySuccess(
            res?.message ||
              "Subscription scheduled to cancel at the end of the billing period.",
          );
          await load();
        });
      },
    });
  };

  const handleResume = () => {
    const renewOn = fmtDate(billing?.currentPeriodEnd);
    const hasDate = renewOn && renewOn !== "—";
    openConfirm({
      title: "Resume subscription",
      description:
        "We'll withdraw the scheduled cancellation so your plan keeps renewing automatically.",
      dateLabel: "Next renewal",
      dateValue: hasDate ? renewOn : "End of billing period",
      footnote: "Access continues without interruption.",
      confirmText: "Resume plan",
      cancelText: "Not now",
      tone: "success",
      onConfirm: async () => {
        closeConfirm();
        await withBusy(async () => {
          const res = await RegistrationServices.resumeSubscription().catch(
            (e) => {
              notifyError(e?.response?.data?.message || "Failed to resume.");
              throw e;
            },
          );
          notifySuccess(
            res?.message ||
              "Subscription resumed. Your plan will renew as usual.",
          );
          await load();
        });
      },
    });
  };

  const handleAdjustPlan = () => {
    history.push(ADJUSTMENT_MODULES_PATH);
  };

  const hasStripe = billing?.hasStripeSubscription === true;
  const paymentProvider = String(billing?.paymentProvider || "").toLowerCase();
  const isDemo = billing?.isDemo === true;
  const currency = billing?.currency || "usd";
  const cancelScheduled = billing?.cancelAtPeriodEnd === true;
  const stripeStatus = String(billing?.stripeStatus || "").toLowerCase();
  const isExpired =
    billing?.isExpired === true ||
    billing?.subscriptionStatus === "Expired";
  const isPastDue =
    billing?.isPastDue === true ||
    billing?.subscriptionStatus === "PastDue";
  const isSuspended =
    billing?.isSuspended === true ||
    billing?.subscriptionStatus === "Suspended";
  const hasSavedCard = Boolean(billing?.paymentMethod);
  const isCanceled =
    !isExpired &&
    (stripeStatus === "canceled" ||
      billing?.subscriptionStatus === "Cancelled");
  const isActive = billing?.isAccessActive === true;
  const renewalAt = Number(billing?.currentPeriodEnd) || 0;
  const isRenewalDue = renewalAt > 0 && Date.now() >= renewalAt;
  const canRenew =
    paymentProvider === "fiuu" &&
    !hasSavedCard &&
    isRenewalDue &&
    !cancelScheduled &&
    (isActive || isExpired);
  const canRetrySavedCard =
    paymentProvider === "fiuu" &&
    hasSavedCard &&
    !cancelScheduled &&
    (isPastDue || isSuspended);
  const isTrialing =
    billing?.isTrialing === true ||
    String(billing?.stripeStatus || "").toLowerCase() === "trialing";
  const modules = billing?.subscribedModules || [];
  const planId =
    billing?.selectedPlanId ||
    billing?.subscribedPlanId ||
    state?.adminInfo?.subscription?.subscribedPlanId ||
    state?.adminInfo?.subscription?.selectedPlanId;
  const planLabel = billing?.planName || capitalize(planId) || "—";
  const interval =
    billing?.interval ||
    billing?.billingInterval ||
    billing?.subscribedBillingInterval ||
    "month";
  const isSelfRegistered =
    state?.adminInfo?.subscription?.isSelfRegistered === true;
  const hasManagedBilling =
    hasStripe ||
    paymentProvider === "fiuu" ||
    (isSelfRegistered && (isActive || isExpired));
  const planStatus =
    billing?.stripeStatus || billing?.subscriptionStatus || "Unknown";
  const recurringListAmount =
    billing?.amount ?? billing?.catalogRecurringTotal ?? 0;
  const discountAmount = billing?.discountAmount ?? 0;
  const discountPercent = billing?.discountPercent ?? 0;
  const recurringAfterDiscount =
    typeof billing?.recurringAfterDiscount === "number"
      ? billing.recurringAfterDiscount
      : Math.max(0, recurringListAmount - discountAmount);
  const accountCredit = billing?.accountCredit ?? 0;
  const nextPaymentAmount =
    typeof billing?.nextPaymentAmount === "number"
      ? billing.nextPaymentAmount
      : recurringAfterDiscount;
  const creditOnNextPayment = Math.max(
    0,
    recurringAfterDiscount - nextPaymentAmount,
  );

  const nextPaymentSub = useMemo(() => {
    if (cancelScheduled) {
      return billing?.currentPeriodEnd
        ? `Access until ${fmtDate(billing.currentPeriodEnd)} · no further charges`
        : "Access until period end · no further charges";
    }
    if (!hasManagedBilling || recurringListAmount <= 0) return undefined;
    if (isTrialing) {
      const trialEndLabel = billing?.trialEnd
        ? fmtDate(billing.trialEnd)
        : null;
      return trialEndLabel
        ? `Trial ends ${trialEndLabel} · then ${fmt(nextPaymentAmount, currency)}`
        : `Free trial · then ${fmt(nextPaymentAmount, currency)} / ${interval}`;
    }
    const base = `${fmt(recurringAfterDiscount, currency)} / ${interval}`;
    const notes = [];
    if (discountAmount > 0) {
      notes.push(
        discountPercent > 0
          ? `${discountPercent}% discount`
          : `${fmt(discountAmount, currency)} discount`,
      );
    }
    if (creditOnNextPayment > 0) {
      notes.push(`${fmt(creditOnNextPayment, currency)} credit applied`);
    }
    if (!notes.length) return base;
    return `${base} (${notes.join(", ")})`;
  }, [
    hasManagedBilling,
    recurringListAmount,
    recurringAfterDiscount,
    discountAmount,
    discountPercent,
    creditOnNextPayment,
    currency,
    interval,
    isTrialing,
    billing?.trialEnd,
    billing?.currentPeriodEnd,
    nextPaymentAmount,
    cancelScheduled,
  ]);

  const filteredInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return invoices.filter((inv) => {
      const statusOk =
        !statusFilter ||
        String(inv.status || "").toLowerCase() === statusFilter;
      if (!statusOk) return false;
      if (!q) return true;
      const haystack = [
        inv.summary,
        inv.description,
        ...(inv.lineDescriptions || []),
        inv.number,
        inv.id,
        fmtDate(inv.created),
        inv.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, searchTerm, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInvoices.length / recordsPerPage),
  );
  const pagedInvoices = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filteredInvoices.slice(start, start + recordsPerPage);
  }, [filteredInvoices, currentPage, recordsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, recordsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const invoiceFilters = [
    {
      name: "status",
      label: "Status",
      type: "select",
      value: statusFilter,
      onChange: (value) => setStatusFilter(value || ""),
      options: INVOICE_STATUS_OPTIONS,
      placeholder: "All statuses",
    },
  ];

  const getInvoiceActions = (inv) => {
    const items = [];
    if (inv.hostedInvoiceUrl) {
      items.push({
        action: ACTION_BUTTON_TYPES.VIEW,
        title: "View invoice",
        onClick: () =>
          window.open(inv.hostedInvoiceUrl, "_blank", "noopener,noreferrer"),
      });
    }
    if (inv.invoicePdf) {
      items.push({
        action: ACTION_BUTTON_TYPES.VIEW_PDF,
        title: "Download PDF",
        onClick: () =>
          window.open(inv.invoicePdf, "_blank", "noopener,noreferrer"),
      });
    }
    return items;
  };

  let bannerClass = "bl-status-banner--inactive";
  let bannerText = "Subscription inactive";

  if (isDemo) {
    bannerClass = "bl-status-banner--demo";
    bannerText =
      "Demo subscription — billing data is simulated. Use Adjust plan to change modules.";
  } else if (isExpired) {
    bannerClass = "bl-status-banner--inactive";
    bannerText =
      "Your billing period has ended. Renew to restore ERP access.";
  } else if (isCanceled) {
    bannerClass = "bl-status-banner--inactive";
    bannerText =
      "Your subscription has been cancelled. Select modules to subscribe again.";
  } else if (isTrialing) {
    bannerClass = "bl-status-banner--trial";
    bannerText = billing?.trialEnd
      ? `Free trial active. Full access until ${fmtDate(billing.trialEnd)}. Your card will be charged when the trial ends.`
      : "Free trial active. Full access. Your card will be charged when the trial ends.";
  } else if (isActive && cancelScheduled) {
    bannerClass = "bl-status-banner--cancel-scheduled";
    bannerText = billing?.currentPeriodEnd
      ? `Cancellation scheduled. You keep full access until ${fmtDate(billing.currentPeriodEnd)}. No further charges. Resume anytime before then.`
      : "Cancellation scheduled. You keep full access until the end of this billing period. No further charges. Resume anytime before then.";
  } else if (isActive) {
    bannerClass = "bl-status-banner--active";
    bannerText = "Your subscription is active.";
  }

  if (loading && !billing) {
    return (
      <div className="bl-page">
        <div className="bl-loading">
          <Loader color="var(--p-blue)" />
          <p className="bl-loading__text">Loading billing…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bl-page${refreshing ? " bl-page--refreshing" : ""}`}>
      <PageHeader
        variant="large"
        title="Billing & Invoices"
        description="Manage your subscription and invoice history."
        renderActions={
          <>
            <HeaderActionButton
              label="Refresh"
              icon={RefreshCw}
              onClick={() => load({ silent: true })}
              disabled={busy || refreshing}
            />
          </>
        }
      />

      <div className={`bl-status-banner ${bannerClass}`}>{bannerText}</div>

      <div
        className={`bl-metrics-grid${
          accountCredit > 0 ? " bl-metrics-grid--four" : ""
        }`}
      >
        <MetricCard
          accent="violet"
          icon={Sparkles}
          label="Plan"
          value={planLabel}
          badge={planStatus}
        />

        <MetricCard
          accent="blue"
          icon={Calendar}
          label={
            isExpired
              ? "Period ended"
              : isCanceled
                ? "Billing ended"
                : cancelScheduled
                  ? "Access until"
                  : isTrialing
                    ? "Trial ends"
                    : "Next payment"
          }
          value={
            isCanceled
              ? "—"
              : isTrialing
                ? fmtDate(billing?.trialEnd || billing?.currentPeriodEnd)
                : fmtDate(billing?.currentPeriodEnd)
          }
          sub={
            isExpired
              ? "Renew to restore access"
              : isCanceled
                ? undefined
                : nextPaymentSub
          }
        />

        <MetricCard
          accent="amber"
          icon={Layers}
          label="Modules"
          value={String(modules.length)}
          footer={
            modules.length ? (
              <div className="bl-modules-list bl-modules-list--compact">
                {modules.map((m) => (
                  <span key={m} className="bl-module-chip">
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <span className="bl-metric-card__sub bl-metric-card__sub--inline">
                No modules
              </span>
            )
          }
        />

        {accountCredit > 0 ? (
          <MetricCard
            accent="emerald"
            icon={CreditCard}
            label="Account credit"
            value={fmt(accountCredit, currency)}
            sub="Automatically applied to your next Fiuu payment"
          />
        ) : null}
      </div>

      {(isSelfRegistered && isActive) ||
      hasManagedBilling ||
      isDemo ||
      (isSelfRegistered && isCanceled) ||
      (isSelfRegistered && isExpired) ? (
        <div className="bl-actions-section">
          <h3 className="bl-actions-section__title">Subscription actions</h3>
          <div className="bl-actions-grid">
            {isSelfRegistered && isCanceled && (
              <ActionCard
                icon={SlidersHorizontal}
                title="Select modules"
                description="Choose modules and subscribe again"
                onClick={() => history.push("/onboarding/modules")}
                disabled={busy}
                tone="primary"
              />
            )}
            {isSelfRegistered && isActive && (
              <ActionCard
                icon={SlidersHorizontal}
                title="Adjust plan"
                description="Add or remove modules and change your billing tier"
                onClick={handleAdjustPlan}
                disabled={busy}
                tone="primary"
              />
            )}
            {isActive && hasManagedBilling && !cancelScheduled && (
              <ActionCard
                icon={XCircle}
                title="Cancel subscription"
                description={
                  billing?.currentPeriodEnd
                    ? `Keep access until ${fmtDate(billing.currentPeriodEnd)}, then stop renewals`
                    : "Keep access until period end, then stop renewals"
                }
                onClick={handleCancel}
                disabled={busy}
                tone="danger"
              />
            )}
            {hasManagedBilling && cancelScheduled && (
              <ActionCard
                icon={RotateCcw}
                title="Resume subscription"
                description={
                  billing?.currentPeriodEnd
                    ? `Continue renewing after ${fmtDate(billing.currentPeriodEnd)}`
                    : "Withdraw cancellation and keep renewing"
                }
                onClick={handleResume}
                disabled={busy}
                tone="success"
              />
            )}
            {paymentProvider === "fiuu" && canRetrySavedCard && (
              <ActionCard
                icon={CreditCard}
                title="Retry payment"
                description={
                  billing?.paymentMethod?.cardLast4
                    ? `Charge your saved card ending ${billing.paymentMethod.cardLast4}`
                    : "Charge your saved card to restore the subscription"
                }
                onClick={handleRetrySavedCard}
                disabled={busy}
                tone="stripe"
              />
            )}
            {paymentProvider === "fiuu" && !hasSavedCard && (
              <ActionCard
                icon={CreditCard}
                title="Pay / renew"
                description={
                  cancelScheduled
                    ? "Resume your subscription before renewing"
                    : isExpired || isRenewalDue
                      ? "Period ended — renew to restore access"
                      : renewalAt
                        ? `Available after your billing period ends on ${fmtDate(renewalAt)}`
                        : "Available when your current billing period ends"
                }
                onClick={handlePortal}
                disabled={busy || !canRenew}
                tone="stripe"
                external
              />
            )}
          </div>
        </div>
      ) : null}

      <section className="bl-invoices-section">
        <div className="bl-panel__header bl-panel__header--section">
          <div>
            <h2 className="bl-panel__title">
              <FileText size={18} className="bl-panel__title-icon" />
              Invoices
            </h2>
            <p className="bl-panel__sub">
              Download and review past billing documents.
            </p>
          </div>
        </div>

        <DataTable
          onSearch={setSearchTerm}
          searchValue={searchTerm}
          searchPlaceholder="Search by invoice #, date, or status…"
          filters={invoiceFilters}
          headers={[
            "Date",
            "Invoice #",
            "Period",
            "Amount",
            "Status",
            "Action",
          ]}
          headersToHide={[]}
          data={pagedInvoices}
          loading={false}
          totalRecords={filteredInvoices.length}
          currentPage={currentPage}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          onPageChange={setCurrentPage}
          onRecordsPerPageChange={(n) => {
            setRecordsPerPage(n);
            setCurrentPage(1);
          }}
          colWidths={{
            Date: "120px",
            "Invoice #": "160px",
            Amount: "120px",
            Status: "110px",
            Action: "100px",
          }}
          skipDynamicColumnWidths
          emptyMessage={
            invoices.length === 0
              ? isDemo
                ? "Invoices appear only for live subscriptions."
                : "Your first invoice will show here after the billing cycle runs."
              : "No invoices match your filters."
          }
          renderRow={(inv) => (
            <tr
              key={inv.id}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="py-3 px-4 text-sm text-slate-700 whitespace-nowrap">
                {fmtDate(inv.created)}
              </td>
              <td className="py-3 px-4 text-xs font-mono text-slate-600">
                {inv.number || inv.id}
              </td>
              <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                {inv.periodStart &&
                inv.periodEnd &&
                inv.periodEnd > inv.periodStart
                  ? `${fmtPeriodDate(inv.periodStart)} – ${fmtPeriodDate(inv.periodEnd)}`
                  : "—"}
              </td>
              <td className="py-3 px-4 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                {fmt(
                  inv.amountPaid || inv.total || inv.amountDue,
                  inv.currency || currency,
                )}
              </td>
              <td className="py-3 px-4">
                <span className={`bl-badge ${statusBadge(inv.status)}`}>
                  {capitalize(inv.status)}
                </span>
              </td>
              <td className="py-3 px-4">
                <ActionButtons
                  isCell
                  maxVisibleActions={2}
                  items={getInvoiceActions(inv)}
                />
              </td>
            </tr>
          )}
        />
      </section>

      <SubscriptionConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        dateLabel={confirmModal.dateLabel}
        dateValue={confirmModal.dateValue}
        footnote={confirmModal.footnote}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        tone={confirmModal.tone}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
};

export default Billing;
