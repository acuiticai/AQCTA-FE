import React from "react";
import { useTranslation } from "react-i18next";

const Bar = ({ className = "" }) => (
  <div className={`bg-gray-200/80 rounded-md animate-pulse ${className}`} />
);

/** Placeholder layout while Zoho Books integration data loads. */
export function ZohoBooksPanelSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label={t("accountsSettings.zohoBooks.loadingAriaLabel", "Loading Zoho Books settings")}
    >
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3 items-start">
          <Bar className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Bar className="h-4 w-48 max-w-full" />
            <Bar className="h-3 w-full max-w-md" />
            <Bar className="h-3 w-4/5 max-w-sm" />
          </div>
          <Bar className="h-9 w-28 shrink-0 hidden sm:block" />
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="space-y-2 flex-1">
            <Bar className="h-5 w-44" />
            <Bar className="h-3 w-64 max-w-full" />
          </div>
          <Bar className="h-9 w-24 shrink-0" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Bar className="h-10 md:col-span-2" />
          <Bar className="h-10" />
          <Bar className="h-10" />
          <Bar className="h-10 md:col-span-2" />
          <Bar className="h-10 md:col-span-2" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <Bar className="h-10 w-32" />
          <Bar className="h-10 w-40" />
          <Bar className="h-10 w-28" />
          <Bar className="h-10 w-28" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <Bar className="h-5 w-52" />
        <Bar className="h-3 w-72 max-w-full" />
        <div className="grid md:grid-cols-3 gap-3">
          <Bar className="h-24 rounded-lg" />
          <Bar className="h-24 rounded-lg" />
          <Bar className="h-24 rounded-lg" />
        </div>
      </section>
    </div>
  );
}
