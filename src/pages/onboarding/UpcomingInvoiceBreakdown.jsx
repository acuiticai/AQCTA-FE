import React from "react";
import { getAdjustmentInvoiceBreakdown } from "./planChangeLogic";
import { formatSubscriptionCents } from "@/utils/subscriptionCurrency";

const formatPriceDetailed = (cents, currency = "myr") =>
  formatSubscriptionCents(cents, currency, { detailed: true });

/**
 * Transparent upcoming-invoice preview (proration + credits + due today).
 * @param {"panel"|"inline"|"dialog"} variant
 */
const UpcomingInvoiceBreakdown = ({
  preview,
  currency = "usd",
  variant = "panel",
  showTitle = true,
  showDueToday = true,
}) => {
  const breakdown = getAdjustmentInvoiceBreakdown(preview);
  if (!breakdown) return null;

  const { lines, amountDueNow, dueTodayKnown } = breakdown;
  if (!lines.length && !(showDueToday && dueTodayKnown)) return null;

  const rowClass =
    variant === "inline"
      ? "upcoming-invoice-breakdown__row upcoming-invoice-breakdown__row--inline"
      : "upcoming-invoice-breakdown__row";

  return (
    <div
      className={`upcoming-invoice-breakdown upcoming-invoice-breakdown--${variant}`}
    >
      {showTitle && variant !== "inline" ? (
        <p className="upcoming-invoice-breakdown__title">Upcoming invoice</p>
      ) : null}
      {lines.map((line) => (
        <div
          key={line.key}
          className={`${rowClass}${
            line.amountCents < 0
              ? " upcoming-invoice-breakdown__row--credit"
              : ""
          }`}
        >
          <span>{line.label}</span>
          <strong>
            {line.amountCents < 0 ? "−" : ""}
            {formatPriceDetailed(Math.abs(line.amountCents), currency)}
          </strong>
        </div>
      ))}
      {showDueToday && dueTodayKnown ? (
        <div
          className={`${rowClass} upcoming-invoice-breakdown__row--total`}
        >
          <span>Due today</span>
          <strong>{formatPriceDetailed(amountDueNow, currency)}</strong>
        </div>
      ) : null}
    </div>
  );
};

export default UpcomingInvoiceBreakdown;
