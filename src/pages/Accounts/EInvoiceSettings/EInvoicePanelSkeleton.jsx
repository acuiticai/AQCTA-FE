import React from "react";
import { useTranslation } from "react-i18next";

const Bar = ({ className = "" }) => (
  <div className={`bg-gray-200/80 rounded-md animate-pulse ${className}`} />
);

/** Placeholder layout while E-Invoice settings data loads (same pattern as Zoho Books). */
export function EInvoicePanelSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label={t(
        "accountsSettings.eInvoice.loadingAriaLabel",
        "Loading e-invoice settings"
      )}
    >
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="space-y-2 border-b border-gray-100 pb-4">
          <Bar className="h-5 w-64 max-w-full" />
          <Bar className="h-3 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10 md:col-span-2" />
          <Bar className="h-24 md:col-span-2 rounded-lg" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="space-y-2 border-b border-gray-100 pb-4">
          <Bar className="h-5 w-52" />
          <Bar className="h-3 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10 md:col-span-2" />
          <Bar className="h-10 md:col-span-2" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <Bar className="h-10 w-28" />
          <Bar className="h-10 w-36" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <Bar className="h-5 w-56" />
        <Bar className="h-3 w-72 max-w-full" />
        <Bar className="h-10 w-full max-w-md" />
      </section>
    </div>
  );
}
