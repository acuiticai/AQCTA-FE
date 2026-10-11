import React from "react";
import { hasConfiguredBillingAndShippingPair } from "@/utils/addressTypeUtils";

const inputClass =
  "w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]";

/**
 * Billing / shipping inputs. "Same as {billing}" keeps label + shipping input visible
 * (mirrors billing, read-only). Only the parent "Add shipping address" prompt is hidden when checked.
 */
export default function CustomerBillShipAddressFields({
  addressTypeConfig = {},
  billingAddress = "",
  shippingAddress = "",
  sameAsBilling = false,
  onBillingChange,
  onShippingChange,
  onSameAsBillingToggle,
  disabled = false,
}) {
  const config = addressTypeConfig || {};
  const billingLabel = config.billingLabel || "Billing";
  const shippingLabel = config.shippingLabel || "Shipping";

  const billTrim = String(billingAddress || "").trim();
  const shipTrim = String(shippingAddress || "").trim();
  const showSameAsCheckbox =
    hasConfiguredBillingAndShippingPair(config) && !!billTrim;

  const showShippingSection =
    shipTrim || sameAsBilling || showSameAsCheckbox;
  const showShippingInput = sameAsBilling || !!shipTrim;
  const shippingDisabled = disabled || (sameAsBilling && !!billTrim);

  const displayBilling = String(billingAddress || "").replace(/\n/g, ", ");
  const displayShipping =
    sameAsBilling && billTrim
      ? displayBilling
      : String(shippingAddress || "").replace(/\n/g, ", ");

  return (
    <>
      {billTrim && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {billingLabel} Address
          </label>
          <input
            type="text"
            name="billingAddress"
            value={displayBilling}
            onChange={(e) => onBillingChange?.(e.target.value)}
            placeholder={`Enter ${String(billingLabel).toLowerCase()} address`}
            disabled={disabled}
            className={`${inputClass}${disabled ? " cursor-not-allowed opacity-60" : ""}`}
          />
        </div>
      )}

      {showShippingSection && (
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <label className="block text-sm font-medium text-gray-700">
              {shippingLabel} Address
            </label>
            {showSameAsCheckbox && (
              <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => onSameAsBillingToggle?.(e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4"
                />
                Same as {billingLabel}
              </label>
            )}
          </div>
          {showShippingInput && (
            <input
              type="text"
              name="shippingAddress"
              value={displayShipping}
              onChange={(e) => onShippingChange?.(e.target.value)}
              placeholder={`Enter ${String(shippingLabel).toLowerCase()} address`}
              disabled={shippingDisabled}
              className={`${inputClass} ${shippingDisabled ? "cursor-not-allowed opacity-60" : ""}`}
            />
          )}
        </div>
      )}
    </>
  );
}
