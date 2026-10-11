import React from "react";
import { useTranslation } from "react-i18next";
import { formatCurrencyAmount } from "@/components/formatAmount";

const InvoiceSummaryPanel = ({
  invoiceData,
  onDiscountChange,
  onShippingChange,
  onAdjustmentChange,
  currency = "USD",
  className = "",
  title,
  /** When false, shipping row is hidden (e.g. credit notes where rules disallow shipping). */
  showShipping = true,
}) => {
  const { t } = useTranslation();
  const {
    subtotal = 0,
    discountPercentage = 0,
    discountAmount = 0,
    shippingCharges = 0,
    adjustment = 0,
    taxTotal = 0,
  } = invoiceData;

  // Match invoice/credit-note recalcTotals: line gross subtotal − document discount + shipping + adjustment.
  // Tax is embedded in line subtotals; taxTotal is shown for breakdown only.
  // When shipping is hidden (credit notes without refund shipping), do not include stored shippingCharges in total.
  const subtotalNum = Number(subtotal) || 0;
  const discountNum = Number(discountAmount) || 0;
  const adjustmentNum = Number(adjustment) || 0;
  const effectiveShipping = showShipping ? Number(shippingCharges) || 0 : 0;
  const computedTotal = Math.max(
    0,
    subtotalNum - discountNum + effectiveShipping + adjustmentNum,
  );

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          {title || t("documents.summary.invoiceSummary")}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Subtotal */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {t("documents.summary.subtotal")}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrencyAmount(currency, subtotal)}
          </span>
        </div>

        {/* Discount */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-600">
              {t("documents.summary.discount")}
            </label>
            <div className="relative w-20">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={Number(discountPercentage) || 0}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  onDiscountChange?.(Math.min(100, Math.max(0, value)));
                }}
                className="w-full pr-6 px-2 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                placeholder="0.00"
              />

              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                %
              </span>
            </div>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-end">
              <span className="text-sm text-gray-600">
                {formatCurrencyAmount(currency, discountAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Tax Total */}
        {taxTotal > 0 && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">
              {t("documents.summary.tax")}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrencyAmount(currency, taxTotal)}
            </span>
          </div>
        )}

        {/* Shipping Charges */}
        {showShipping && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600 flex items-center gap-1">
                {t("documents.summary.shippingCharges")}
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600"
                  title={t("documents.summary.shippingChargesInformation")}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCharges}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    onShippingChange?.(value);
                  }}
                  className="w-20 px-2 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  placeholder="0.00"
                />
              </div>
            </div>
            {shippingCharges > 0 && (
              <div className="flex justify-end">
                <span className="text-sm text-gray-600">
                  {formatCurrencyAmount(currency, shippingCharges)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Adjustment */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-600 flex items-center gap-1">
              {t("documents.summary.adjustment")}
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                title={t("documents.summary.adjustmentInformation")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={adjustment}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  onAdjustmentChange?.(value);
                }}
                className="w-20 px-2 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                placeholder="0.00"
              />
            </div>
          </div>
          {adjustment !== 0 && (
            <div className="flex justify-end">
              <span className={`text-sm ${adjustment >= 0 ? "text-gray-600" : "text-red-600"}`}>
                {adjustment >= 0 ? "+" : ""}
                {formatCurrencyAmount(currency, Math.abs(adjustment))}
              </span>
            </div>
          )}
        </div>

        {/* Grand Total */}
        <div className="pt-4 mt-4 border-t-2 border-gray-300">
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-gray-900">
              {t("documents.summary.totalWithCurrency", { currency })}
            </span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrencyAmount(currency, computedTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSummaryPanel;
