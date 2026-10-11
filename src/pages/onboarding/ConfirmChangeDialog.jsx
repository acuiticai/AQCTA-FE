import React, { useState } from "react";
import { Loader } from "@/page-layouts/index";
import {
  isDowngradeAdjustment,
  resolveAdjustmentPaymentNote,
} from "./planChangeLogic";
import UpcomingInvoiceBreakdown from "./UpcomingInvoiceBreakdown";
import { formatSubscriptionCents } from "@/utils/subscriptionCurrency";
import "./onboarding.css";

const formatPrice = (cents, currency = "myr") =>
  formatSubscriptionCents(cents, currency, { detailed: true });

const formatPriceDetailed = formatPrice;

/**
 * Shared confirmation dialog before payment / plan update.
 * Used by self-service PlanPickerModal and invitation onboarding.
 */
const ConfirmChangeDialog = ({
  preview,
  selectedPlan,
  recurringTotalCents,
  billingInterval,
  currency,
  quote,
  isAdjustment,
  isModuleOnlyChange,
  previewRefreshing = false,
  quoteReady = true,
  couponCode,
  onCouponCodeChange,
  appliedCoupon,
  couponError,
  couponApplying,
  onApplyCoupon,
  onClearCoupon,
  checkoutStarted = false,
  onConfirm,
  onCancel,
}) => {
  const [promoOpen, setPromoOpen] = useState(false);
  const [renewalAcknowledged, setRenewalAcknowledged] = useState(false);

  const intervalLabel = "month";
  const billingLabel = "Monthly";

  const planLabel = (planId) =>
    quote?.plans?.find((p) => p.id === planId)?.name || planId || "";

  const rawAmountDue =
    typeof preview?.amountDueNow === "number" ? preview.amountDueNow : null;
  const amountDueNow =
    isModuleOnlyChange && rawAmountDue === null ? 0 : rawAmountDue;
  const willCharge = amountDueNow !== null && amountDueNow > 0;
  const isCalculating =
    isAdjustment &&
    !isModuleOnlyChange &&
    !quoteReady &&
    !isDowngradeAdjustment(preview);

  const displayTotal =
    typeof recurringTotalCents === "number"
      ? recurringTotalCents
      : selectedPlan?.total;
  const finalCheckoutAmount =
    !isAdjustment && appliedCoupon?.finalAmount != null
      ? appliedCoupon.finalAmount
      : displayTotal;

  const changeDescription = (() => {
    if (!isAdjustment && selectedPlan) {
      return (
        <>
          You selected the <strong>{selectedPlan.name}</strong> plan at{" "}
          <strong>
            {formatPrice(displayTotal, currency)}/{intervalLabel}
          </strong>
          .
        </>
      );
    }
    if (isModuleOnlyChange) {
      return (
        <>
          Module access will update. Your plan (
          <strong>{selectedPlan?.name}</strong>) and{" "}
          <strong>{billingLabel.toLowerCase()}</strong> billing stay the same.
        </>
      );
    }
    if (preview?.planChanged && preview?.intervalChanged) {
      return (
        <>
          Moving from <strong>{planLabel(preview.currentPlanId)}</strong> to{" "}
          <strong>{planLabel(preview.planId)}</strong>, and switching billing to{" "}
          <strong>{billingLabel.toLowerCase()}</strong>.
        </>
      );
    }
    if (preview?.planChanged) {
      return (
        <>
          Moving from <strong>{planLabel(preview.currentPlanId)}</strong> to{" "}
          <strong>{planLabel(preview.planId)}</strong> (
          {billingLabel.toLowerCase()}).
        </>
      );
    }
    if (preview?.intervalChanged) {
      return (
        <>
          Changing billing from{" "}
          <strong>
            {preview.currentBillingInterval === "yearly" ? "yearly" : "monthly"}
          </strong>{" "}
          to <strong>{billingLabel.toLowerCase()}</strong> on the{" "}
          <strong>{selectedPlan?.name}</strong> plan.
        </>
      );
    }
    if (preview?.userCountChanged) {
      return (
        <>
          Updating users from <strong>{preview.currentUserCount}</strong> to{" "}
          <strong>{preview.requestedUserCount}</strong> on the{" "}
          <strong>{selectedPlan?.name}</strong> plan (
          {billingLabel.toLowerCase()}).
        </>
      );
    }
    return <>Your subscription will be updated.</>;
  })();

  const trialEnabled = quote?.trial?.enabled === true;
  const trialDays = Math.max(0, Number(quote?.trial?.trialDays) || 0);

  const paymentDetail = !isAdjustment
    ? trialEnabled && trialDays > 0
      ? `Includes a ${trialDays}-day free trial with full access. You won't be charged until the trial ends.`
      : null
    : resolveAdjustmentPaymentNote({
        preview,
        isModuleOnlyChange,
        willCharge,
        isCalculating,
      });

  const dialogTitle = (() => {
    if (!isAdjustment) {
      return trialEnabled && trialDays > 0
        ? "Start your free trial"
        : "Continue to payment";
    }
    if (isCalculating) return "Review your changes";
    if (willCharge) return "Confirm payment";
    if (isModuleOnlyChange) return "Confirm module update";
    return "Confirm plan change";
  })();

  const confirmLabel = (() => {
    if (isCalculating) return "Calculating\u2026";
    if (!isAdjustment) {
      return trialEnabled && trialDays > 0
        ? `Start ${trialDays}-day free trial`
        : "Proceed to Checkout";
    }
    if (willCharge) {
      const useSavedCard = preview?.canChargeWithSavedCard === true;
      return useSavedCard
        ? `Charge ${formatPriceDetailed(amountDueNow, currency)}`
        : `Pay ${formatPriceDetailed(amountDueNow, currency)}`;
    }
    if (isModuleOnlyChange) return "Apply changes";
    return "Confirm change";
  })();

  const canConfirm = isAdjustment
    ? quoteReady && !previewRefreshing
    : !couponApplying && !checkoutStarted && renewalAcknowledged;

  return (
    <div
      className="plan-picker-overlay plan-picker-overlay--dialog"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="plan-picker-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="plan-picker-confirm-dialog__close"
          onClick={onCancel}
          aria-label="Close"
          disabled={checkoutStarted}
        >
          &times;
        </button>

        <h3
          id="confirm-dialog-title"
          className="plan-picker-confirm-dialog__title"
        >
          {dialogTitle}
        </h3>

        <p className="plan-picker-confirm-dialog__summary">
          {changeDescription}
        </p>

        {!isAdjustment && selectedPlan ? (
          <>
            {appliedCoupon ? (
              <div className="plan-picker-coupon plan-picker-coupon--applied">
                <div className="plan-picker-coupon__applied-row">
                  <div className="plan-picker-coupon__applied-info">
                    <div className="plan-picker-coupon__success">
                      <svg
                        className="plan-picker-coupon__check-icon"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span>Promo code applied</span>
                    </div>
                    <p className="plan-picker-coupon__applied-detail">
                      {appliedCoupon.couponCode}
                      {appliedCoupon.discountType === "percentage" &&
                      Number(appliedCoupon.discountValue) > 0
                        ? ` \u00b7 ${Number(appliedCoupon.discountValue)}% off`
                        : appliedCoupon.discount != null
                          ? ` \u00b7 ${formatPrice(appliedCoupon.discount, currency)} off`
                          : ""}
                      {appliedCoupon.durationLabel
                        ? ` \u00b7 ${appliedCoupon.durationLabel}`
                        : appliedCoupon.duration === "forever"
                          ? " \u00b7 Forever"
                          : appliedCoupon.duration === "repeating"
                            ? ` \u00b7 ${appliedCoupon.billingCycles || "?"} cycles`
                            : " \u00b7 Once"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="plan-picker-coupon__remove"
                    onClick={onClearCoupon}
                    disabled={checkoutStarted}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="plan-picker-coupon">
                <button
                  type="button"
                  className="plan-picker-coupon__toggle"
                  onClick={() => setPromoOpen((v) => !v)}
                  disabled={checkoutStarted}
                  aria-expanded={promoOpen}
                >
                  <svg
                    className="plan-picker-coupon__tag-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  <span>Have a promo code?</span>
                  <svg
                    className={`plan-picker-coupon__chevron${promoOpen ? " plan-picker-coupon__chevron--open" : ""}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {promoOpen && (
                  <div className="plan-picker-coupon__expand">
                    <div className="plan-picker-coupon__row">
                      <input
                        id="coupon-code"
                        type="text"
                        className="plan-picker-coupon__input"
                        value={couponCode}
                        onChange={(e) => onCouponCodeChange(e.target.value)}
                        placeholder="Enter promo code"
                        disabled={checkoutStarted}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="plan-picker-coupon__btn"
                        onClick={onApplyCoupon}
                        disabled={
                          checkoutStarted ||
                          couponApplying ||
                          !String(couponCode || "").trim()
                        }
                      >
                        {couponApplying ? "Applying\u2026" : "Apply"}
                      </button>
                    </div>
                    {couponError ? (
                      <p className="plan-picker-coupon__error">{couponError}</p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="plan-picker-coupon__totals">
              <div className="plan-picker-coupon__total-row">
                <span>Subtotal</span>
                <span>{formatPrice(displayTotal, currency)}</span>
              </div>
              {appliedCoupon && (
                <div className="plan-picker-coupon__total-row plan-picker-coupon__total-row--discount">
                  <span>Discount</span>
                  <span>
                    &minus;{formatPrice(appliedCoupon.discount, currency)}
                  </span>
                </div>
              )}
              <div className="plan-picker-coupon__total-row plan-picker-coupon__total-row--final">
                <strong>Today&apos;s total</strong>
                <strong>{formatPrice(finalCheckoutAmount, currency)}</strong>
              </div>
            </div>
          </>
        ) : null}

        {isAdjustment && (
          <>
            <div
              className={`plan-picker-confirm-dialog__due${
                isCalculating
                  ? " plan-picker-confirm-dialog__due--loading"
                  : willCharge
                    ? " plan-picker-confirm-dialog__due--charge"
                    : " plan-picker-confirm-dialog__due--clear"
              }`}
            >
              {isCalculating ? (
                <div className="plan-picker-confirm-dialog__due-loading">
                  <Loader color="var(--p-blue)" />
                  <span>Calculating payment due&hellip;</span>
                </div>
              ) : (
                <>
                  <div className="plan-picker-confirm-dialog__due-row plan-picker-confirm-dialog__due-row--total">
                    <span className="plan-picker-confirm-dialog__due-label">
                      Due today
                    </span>
                    <span className="plan-picker-confirm-dialog__due-amount">
                      {formatPriceDetailed(amountDueNow ?? 0, currency)}
                    </span>
                  </div>
                  {paymentDetail ? (
                    <p className="plan-picker-confirm-dialog__due-note">
                      {paymentDetail}
                    </p>
                  ) : null}
                </>
              )}
            </div>
            {!isCalculating && !isModuleOnlyChange ? (
              <UpcomingInvoiceBreakdown
                preview={preview}
                currency={currency}
                variant="dialog"
                showTitle={false}
                showDueToday={false}
              />
            ) : null}
          </>
        )}

        {!isAdjustment && trialEnabled && trialDays > 0 ? (
          <p className="plan-picker-confirm-dialog__checkout-note">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              Includes a {trialDays}-day free trial. Full ERP access now, billed
              when the trial ends.
            </span>
          </p>
        ) : null}

        {!isAdjustment ? (
          <label className="plan-picker-confirm-dialog__ack">
            <input
              type="checkbox"
              className="plan-picker-confirm-dialog__ack-input"
              checked={renewalAcknowledged}
              onChange={(e) => setRenewalAcknowledged(e.target.checked)}
              disabled={checkoutStarted}
            />
            <span className="plan-picker-confirm-dialog__ack-text">
              I understand that my subscription will remain active for the
              selected billing period and that renewal payments may be processed
              automatically when I save my card details.
            </span>
          </label>
        ) : null}

        <div className="plan-picker-confirm-dialog__footer">
          <button
            type="button"
            className="plan-picker-confirm-dialog__btn plan-picker-confirm-dialog__btn--cancel"
            onClick={onCancel}
            disabled={checkoutStarted}
          >
            Cancel
          </button>
          <button
            type="button"
            className="plan-picker-confirm-dialog__btn plan-picker-confirm-dialog__btn--confirm"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {checkoutStarted ? (
              preview?.canChargeWithSavedCard ? (
                "Charging\u2026"
              ) : (
                "Redirecting\u2026"
              )
            ) : (
              <>
                {!isAdjustment && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                )}
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmChangeDialog;
