import React from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Standardized page header used across list and view screens.
 *
 * Provides a consistent layout for:
 *  - Title (h1)
 *  - Optional subtitle line beneath the title
 *  - Optional back-navigation icon (replaces irregular custom back headers)
 *  - Right-aligned action slot (buttons, filters, dropdowns)
 *
 * Typography, spacing, alignment and responsive behavior are intentionally
 * locked here so that Sale Orders, Recurring Invoices, Customer Invoices,
 * Quotations, Purchase Orders, Vendor Invoices and their View screens all
 * render identically.
 */
const StandardPageHeader = ({
  title,
  subtitle,
  actions,
  showBackButton = false,
  onBack,
  backLabel = "Back",
  className = "",
  titleClassName = "",
  subtitleClassName = "",
}) => {
  return (
    <div className={`mb-8 ${className}`}>
      {showBackButton ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          aria-label={backLabel}
        >
          <ChevronLeft size={18} className="mr-1" />
          {backLabel}
        </button>
      ) : null}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <h1
            className={`text-3xl font-bold text-gray-900 truncate ${titleClassName}`}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className={`text-gray-600 mt-2 ${subtitleClassName}`}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-3 lg:gap-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StandardPageHeader;
