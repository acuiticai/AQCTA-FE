import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileText,
  Loader2,
  RotateCcw,
  CalendarRange,
  Receipt,
  Mail,
  Pencil,
  CreditCard,
} from "lucide-react";
import { getInvoiceActivityLogs } from "@/services/invoiceActivityService";
import { formatDate } from "@/components/formatAmount";
import { DateRangeComponent } from "@/page-layouts/index";

const actionTone = (action = "") => {
  const a = String(action || "").toLowerCase();
  if (a.includes("payment")) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (a.includes("create")) {
    return "bg-blue-50 text-blue-800 border-blue-200";
  }
  if (a.includes("delete")) {
    return "bg-red-50 text-red-800 border-red-200";
  }
  if (a.includes("email") || a.includes("sent")) {
    return "bg-violet-50 text-violet-800 border-violet-200";
  }
  if (a.includes("update") || a.includes("edit")) {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }
  return "bg-slate-50 text-slate-800 border-slate-200";
};

const IconFor = (action = "") => {
  const a = String(action || "").toLowerCase();
  if (a.includes("payment")) {
    return <CreditCard className="h-4 w-4 text-emerald-600" />;
  }
  if (a.includes("email") || a.includes("sent")) {
    return <Mail className="h-4 w-4 text-violet-600" />;
  }
  if (a.includes("create")) {
    return <Receipt className="h-4 w-4 text-blue-600" />;
  }
  if (a.includes("update") || a.includes("edit")) {
    return <Pencil className="h-4 w-4 text-amber-700" />;
  }
  return <Clock className="h-4 w-4 text-slate-500" />;
};

export default function InvoiceActivityTimeline({ invoiceId }) {
  useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [total, setTotal] = useState(0);

  const dateRangeInvalid = useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    return dateFrom > dateTo;
  }, [dateFrom, dateTo]);

  const loadLogs = useCallback(async () => {
    if (!invoiceId || dateRangeInvalid) return;
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await getInvoiceActivityLogs(invoiceId, params);
      setRows(res.data?.data || []);
      setTotal(res.data?.pagination?.total ?? (res.data?.data || []).length);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, dateFrom, dateTo, dateRangeInvalid]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = Boolean(dateFrom || dateTo);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--p-blue)]/10">
              <FileText className="h-5 w-5 text-[var(--p-blue)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {ciText("Activity Log")}
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {ciText("Track creates, updates, payments, and emails for this invoice.")}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {ciText("Date range")}
            </span>
            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              <DateRangeComponent
                startDate={dateFrom || undefined}
                endDate={dateTo || undefined}
                onApply={(start, end) => {
                  setDateFrom(start || "");
                  setDateTo(end || "");
                }}
                onClear={clearFilters}
                placeholder={ciText("Filter activity")}
                width="auto"
                className="max-w-xs sm:max-w-sm"
              />
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {ciText("Reset")}
              </button>
            </div>
          </div>
        </div>

        {dateRangeInvalid && (
          <p className="mt-3 text-xs font-medium text-amber-700">
            “From” must be on or before “To”. Adjust the date range.
          </p>
        )}
      </div>

      <div className="px-5 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--p-blue)]" />
            <span className="text-sm font-medium">{ciText("Loading activity…")}</span>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 text-center">
            <CalendarRange className="mx-auto mb-3 h-9 w-9 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">
              {ciText("No invoice activity logged yet")}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {hasActiveFilters
                ? "Try clearing the date filter or pick a wider range. This filter only affects activity — not the printable invoice preview."
                : "Record payments, send email, edits, and status changes will show here."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {ciText("Clear filters")}
              </button>
            )}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <p className="mb-4 text-xs text-gray-500">
              Showing {rows.length}
              {total > rows.length ? ` of ${total}` : ""} entries
              {hasActiveFilters ? " (filtered)" : ""}
            </p>
            <ol className="relative space-y-0">
              {rows.map((r, index) => (
                <li key={r._id} className="relative flex gap-4 pb-8 last:pb-0">
                  {index < rows.length - 1 && (
                    <span
                      className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-gray-200"
                      aria-hidden
                    />
                  )}
                  <div className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                    {IconFor(r.actionType)}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${actionTone(r.actionType)}`}
                      >
                        {r.actionType || ciText("Activity")}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(r.timestamp || r.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-gray-900">
                      {r.description || "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {r.performedBy?.name ||
                        r.performedBy?.email ||
                        "System"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
