import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Landmark,
  ReceiptText,
  TrendingUp,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { formatAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import ejs from "ejs";
import numberToWords from "number-to-words";
import { DataTable, SummaryCards } from "@/page-layouts";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Optional `business` id for APIs that resolve the staff profile (multi-company logins). */
function getPayslipScopeParams() {
  const params = {};
  try {
    const fromSettings = sessionStorage.getItem("settingsSelectedOrg");
    if (fromSettings && /^[a-f0-9]{24}$/i.test(fromSettings)) {
      params.business = fromSettings;
      return params;
    }
    const raw = localStorage.getItem("businesses");
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length === 1) {
        const id = list[0]?._id;
        if (id && /^[a-f0-9]{24}$/i.test(String(id))) {
          params.business = String(id);
        }
      }
    }
  } catch (_) {
    /* ignore */
  }
  return params;
}

const MONTH_OPTIONS = [
  { value: "", label: "All months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

/* ─── Utilities ────────────────────────────────────────────────────────────── */

function formatCurrency(value) {
  return `RM ${formatAmount(value || 0)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadBlobFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function getInitials(name = "") {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ─── Status Badge ─────────────────────────────────────────────────────────── */

function statusConfig(status) {
  if (status === "Paid") {
    return { classes: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500" };
  }
  return { classes: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-400" };
}

function StatusBadge({ status }) {
  const cfg = statusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cfg.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

/* ─── Stat Card ────────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, variant = "default" }) {
  const variants = {
    default: {
      wrap: "bg-white border border-slate-200",
      iconWrap: "bg-slate-100",
      icon: "text-slate-600",
      label: "text-slate-500",
      value: "text-slate-900",
      sub: "text-slate-400",
      bar: "",
    },
    blue: {
      wrap: "bg-white border border-blue-100",
      iconWrap: "bg-blue-50",
      icon: "text-blue-600",
      label: "text-slate-500",
      value: "text-blue-700",
      sub: "text-slate-400",
      bar: "from-blue-400 to-indigo-400",
    },
    rose: {
      wrap: "bg-white border border-rose-100",
      iconWrap: "bg-rose-50",
      icon: "text-rose-500",
      label: "text-slate-500",
      value: "text-rose-600",
      sub: "text-slate-400",
      bar: "from-rose-400 to-pink-400",
    },
    emerald: {
      wrap: "bg-white border border-emerald-100",
      iconWrap: "bg-emerald-50",
      icon: "text-emerald-600",
      label: "text-slate-500",
      value: "text-emerald-700",
      sub: "text-slate-400",
      bar: "from-emerald-400 to-teal-400",
    },
    violet: {
      wrap: "bg-white border border-violet-100",
      iconWrap: "bg-violet-50",
      icon: "text-violet-600",
      label: "text-slate-500",
      value: "text-violet-700",
      sub: "text-slate-400",
      bar: "from-violet-400 to-purple-400",
    },
  };
  const v = variants[variant] || variants.default;

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-sm ${v.wrap}`}>
      {/* Coloured top accent bar */}
      {v.bar && (
        <div className={`h-[3px] w-full bg-gradient-to-r ${v.bar}`} />
      )}
      <div className="p-5">
        <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${v.iconWrap}`}>
          <Icon className={`h-5 w-5 ${v.icon}`} />
        </div>
        <p className={`text-xs font-medium uppercase tracking-wide ${v.label}`}>{label}</p>
        <p className={`mt-1 text-2xl font-bold tracking-tight ${v.value}`}>{value}</p>
        {sub && <p className={`mt-1 text-xs ${v.sub}`}>{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Breakdown Table (modal) ──────────────────────────────────────────────── */

function BreakdownTable({ title, items, totalLabel, totalValue, tone = "emerald" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            tone === "rose" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <table className="min-w-full">
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-5 py-4 text-sm text-slate-400">
                No records available
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={`${title}-${item.label}`} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 text-sm text-slate-600">{item.label}</td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className={tone === "rose" ? "bg-rose-50" : "bg-emerald-50"}>
            <td className={`px-5 py-3 text-sm font-semibold ${tone === "rose" ? "text-rose-700" : "text-emerald-700"}`}>
              {totalLabel}
            </td>
            <td className={`px-5 py-3 text-right text-sm font-bold ${tone === "rose" ? "text-rose-700" : "text-emerald-700"}`}>
              {formatCurrency(totalValue)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ─── Payslip Modal ────────────────────────────────────────────────────────── */

function PayslipModal({ loading, payslip, onClose, onDownload, downloading }) {
  if (!loading && !payslip) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-400/30 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/95 shadow-xl">

        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600">
              Payslip Preview
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
              {loading
                ? "Loading payslip…"
                : `${payslip?.employee?.name || "Employee"} — ${payslip?.payPeriod?.label || ""}`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!loading && payslip && (
              <button
                type="button"
                onClick={() => onDownload(payslip.id)}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloading ? "Generating…" : "Download PDF"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-6">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-slate-500">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                <p className="text-sm">Loading payslip details…</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Company + Employee Info */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Company banner — light */}
                <div className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-5">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-100/60 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-6 left-1/3 h-20 w-20 rounded-full bg-indigo-100/50 blur-xl" />
                  <div className="relative">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 ring-1 ring-blue-200">
                      {payslip.brandName}
                    </span>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900">{payslip.companyName}</h3>
                    <p className="mt-1 text-xs text-slate-500">Official employee payslip</p>
                  </div>
                </div>
                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
                  {[
                    ["Pay Period", payslip.payPeriod.label],
                    ["Period", `${formatDate(payslip.payPeriod.start)} – ${formatDate(payslip.payPeriod.end)}`],
                    ["Employee", payslip.employee.name],
                    ["Employee ID", payslip.employee.employeeCode],
                    ["Department", payslip.employee.department],
                    ["Position", payslip.employee.position],
                    ["Bank", payslip.employee.bankName],
                    ["Account No.", payslip.employee.bankAccountNumber],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white px-4 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 leading-tight">{val}</p>
                    </div>
                  ))}
                </div>
                {/* Status row */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <p className="text-xs text-slate-500">Payslip Status</p>
                  <StatusBadge status={payslip.status} />
                </div>
              </div>

              {/* Summary numbers */}
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard icon={Wallet} label="Gross Salary" value={formatCurrency(payslip.grossSalary)} variant="blue" />
                <StatCard icon={ReceiptText} label="Total Deductions" value={formatCurrency(payslip.totalDeductions)} variant="rose" />
                <StatCard icon={Landmark} label="Net Salary" value={formatCurrency(payslip.netSalary)} variant="emerald" />
              </div>

              {/* Earnings summary chips */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="mb-4 text-sm font-semibold text-slate-900">Earnings Breakdown</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Basic Salary", payslip.earnings.basic, "text-slate-900"],
                    ["Allowances", payslip.earnings.allowances, "text-blue-700"],
                    ["Bonus", payslip.earnings.bonus, "text-indigo-700"],
                    ["Overtime", payslip.earnings.overtime, "text-violet-700"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
                      <p className={`mt-1 text-base font-bold ${color}`}>{formatCurrency(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Line-item tables */}
              <div className="grid gap-4 xl:grid-cols-2">
                <BreakdownTable title="Earnings" items={payslip.earnings.items} totalLabel="Gross Salary" totalValue={payslip.grossSalary} />
                <BreakdownTable title="Deductions" items={payslip.deductions.items} totalLabel="Total Deductions" totalValue={payslip.totalDeductions} tone="rose" />
              </div>

              {/* Net pay CTA — light */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-5 shadow-sm">
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-100/60 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                      Take-home Pay
                    </p>
                    <p className="mt-1.5 text-3xl font-bold text-emerald-700">
                      {formatCurrency(payslip.netSalary)}
                    </p>
                    <p className="mt-1 text-xs text-emerald-500">Net salary after all deductions</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 ring-1 ring-emerald-200">
                    <Landmark className="h-7 w-7 text-emerald-600" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Payslip Row ──────────────────────────────────────────────────────────── */

function PayslipRow({ payslip, downloadingId, onView, onDownload }) {
  const isDownloading = downloadingId === payslip.id;

  return (
    <div className="group relative transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent">
      <div className="absolute inset-y-0 left-0 w-[3px] origin-center scale-y-0 rounded-r-full bg-blue-500 transition-transform duration-200 group-hover:scale-y-100" />

      {/* Desktop */}
      <div className="hidden items-center gap-4 px-6 py-5 sm:flex">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors duration-200 group-hover:bg-blue-100">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{payslip.payPeriod.label}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {formatDate(payslip.payPeriod.start)} &ndash; {formatDate(payslip.payPeriod.end)}
            </p>
          </div>
        </div>

        <div className="w-32">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">Allowance</p>
          <p className="text-sm font-semibold text-blue-600">
            {formatCurrency(payslip.earnings?.allowances ?? payslip.allowances ?? 0)}
          </p>
        </div>

        <div className="w-32">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">Bonus</p>
          <p className="text-sm font-semibold text-violet-600">
            {formatCurrency(payslip.earnings?.bonus ?? payslip.bonus ?? 0)}
          </p>
        </div>

        <div className="w-32">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">Gross</p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrency(payslip.grossSalary)}</p>
        </div>

        <div className="w-32">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">Deductions</p>
          <p className="text-sm font-semibold text-rose-500">&minus; {formatCurrency(payslip.totalDeductions)}</p>
        </div>

        <div className="w-40 rounded-xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-100">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-emerald-600">Net Pay</p>
          <p className="text-[15px] font-bold text-emerald-700">{formatCurrency(payslip.netSalary)}</p>
        </div>

        <div className="w-24 flex-shrink-0">
          <StatusBadge status={payslip.status} />
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onView(payslip.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow"
          >
            <Eye className="h-4 w-4" />
            View
          </button>
          <button
            type="button"
            onClick={() => onDownload(payslip.id)}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-700 shadow-sm transition-all duration-150 hover:bg-blue-100 hover:border-blue-300 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Saving…" : "Download"}
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{payslip.payPeriod.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDate(payslip.payPeriod.start)} &ndash; {formatDate(payslip.payPeriod.end)}
              </p>
            </div>
          </div>
          <StatusBadge status={payslip.status} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-blue-50 px-3 py-2">
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-blue-400">Allowance</p>
            <p className="text-xs font-semibold text-blue-600">
              {formatCurrency(payslip.earnings?.allowances ?? payslip.allowances ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-violet-50 px-3 py-2">
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-violet-400">Bonus</p>
            <p className="text-xs font-semibold text-violet-600">
              {formatCurrency(payslip.earnings?.bonus ?? payslip.bonus ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">Gross</p>
            <p className="text-xs font-semibold text-slate-700">{formatCurrency(payslip.grossSalary)}</p>
          </div>
          <div className="rounded-xl bg-rose-50 px-3 py-2">
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-rose-400">Deductions</p>
            <p className="text-xs font-semibold text-rose-600">{formatCurrency(payslip.totalDeductions)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-100">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-emerald-600">Net Pay</p>
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(payslip.netSalary)}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onView(payslip.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Eye className="h-4 w-4 text-blue-600" />
            View
          </button>
          <button
            type="button"
            onClick={() => onDownload(payslip.id)}
            disabled={isDownloading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Saving…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────────────── */

function EmptyState({ yearFilter, monthFilter }) {
  const hasFilters = yearFilter || monthFilter;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24">
      <div className="relative mb-8">
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 via-blue-50 to-white shadow-inner ring-1 ring-blue-100">
          <FileText className="h-12 w-12 text-blue-400" />
        </div>
        <span className="absolute -right-3 -top-2 h-5 w-5 rounded-full bg-blue-200/80" />
        <span className="absolute -bottom-1 -left-4 h-3.5 w-3.5 rounded-full bg-emerald-200/80" />
        <span className="absolute bottom-5 -right-5 h-3 w-3 rounded-full bg-amber-200/80" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900">
        {hasFilters ? "No payslips match your filters" : "No payslips yet"}
      </h3>
      <p className="mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
        {hasFilters
          ? "Try adjusting the month or year filter to find payslips from a different period."
          : "Your payroll department hasn't issued any payslips for your account yet. Check back after the next pay run."}
      </p>
      {hasFilters && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
          <Filter className="h-4 w-4" />
          Active filters — try clearing them
        </div>
      )}
    </div>
  );
}

/* ─── Loading State ────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="divide-y divide-slate-100">
      {[...Array(4)].map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-5">
          <div className="h-11 w-11 flex-shrink-0 rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded-lg bg-slate-100" />
            <div className="h-3 w-52 rounded-lg bg-slate-100" />
          </div>
          <div className="h-10 w-32 rounded-xl bg-slate-100" />
          <div className="h-10 w-32 rounded-xl bg-slate-100" />
          <div className="h-10 w-32 rounded-xl bg-slate-100" />
          <div className="h-10 w-32 rounded-xl bg-slate-100" />
          <div className="h-11 w-40 rounded-xl bg-slate-100" />
          <div className="h-7 w-20 rounded-full bg-slate-100" />
          <div className="flex gap-2">
            <div className="h-9 w-16 rounded-xl bg-slate-100" />
            <div className="h-9 w-22 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

export default function MyPayslips() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};

  const [payslips, setPayslips] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [templateSelectionModal, setTemplateSelectionModal] = useState({
    isOpen: false,
    templates: [],
    payslipId: null,
    payslipData: null,
    businessDetails: null,
  });

  const loadPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...getPayslipScopeParams() };
      if (yearFilter) params.year = yearFilter;
      if (monthFilter) params.month = monthFilter;
      const authHeaders = adminInfo?.token
        ? { Authorization: `Bearer ${adminInfo.token}` }
        : {};
      const { data } = await axios.get(`${BASE_URL}/payslips/me`, { params, headers: authHeaders });
      setPayslips(data?.payslips || []);
      setEmployee(data?.employee || null);
      setAvailableYears(data?.availableYears || []);
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to fetch payslips");
    } finally {
      setLoading(false);
    }
  }, [adminInfo?.token, monthFilter, yearFilter]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    loadPayslips();
  }, [adminInfo?.token, loadPayslips]);

  useEffect(() => { setCurrentPage(1); }, [monthFilter, yearFilter]);

  const totals = useMemo(
    () =>
      payslips.reduce(
        (s, p) => {
          s.gross += Number(p.grossSalary || 0);
          s.deductions += Number(p.totalDeductions || 0);
          s.net += Number(p.netSalary || 0);
          return s;
        },
        { gross: 0, deductions: 0, net: 0 },
      ),
    [payslips],
  );

  const yearOptions = useMemo(
    () => [
      { value: "", label: "All years" },
      ...availableYears.map((y) => ({ value: String(y), label: String(y) })),
    ],
    [availableYears],
  );

  const handleViewPayslip = async (payslipId) => {
    setSelectedPayslipId(payslipId);
    setDetailLoading(true);
    setSelectedPayslip(null);
    try {
      const authHeaders = adminInfo?.token
        ? { Authorization: `Bearer ${adminInfo.token}` }
        : {};
      const { data } = await axios.get(`${BASE_URL}/payslip/${payslipId}`, {
        params: getPayslipScopeParams(),
        headers: authHeaders,
      });
      setSelectedPayslip(data?.payslip || null);
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to fetch payslip");
      setSelectedPayslipId("");
    } finally {
      setDetailLoading(false);
    }
  };

  const processPayslipDownload = async (payslipId, templateHtml, payslipData, businessDetails) => {
    try {
      setDownloadingId(payslipId);
      const authHeaders = adminInfo?.token ? { Authorization: `Bearer ${adminInfo.token}` } : {};
      
      const ps = {
        companyName: payslipData.companyName || businessDetails?.name || "Company",
        companyAddress: businessDetails?.address ? String(businessDetails.address) : "",
        companyLogo: businessDetails?.image || "",
        titleMonth: payslipData.payPeriod?.label || "",
        employeeName: payslipData.employee?.name || "",
        employeeId: payslipData.employee?.employeeCode || "",
        payPeriod: payslipData.payPeriod?.label || "",
        payDate: payslipData.payPeriod?.payDate ? formatDate(payslipData.payPeriod.payDate) : "",
        currencySymbol: "RM",
        currencyCode: "MYR",
        earnings: payslipData.earnings?.items || [],
        deductions: payslipData.deductions?.items || [],
        grossEarnings: payslipData.grossSalary || 0,
        totalDeductions: payslipData.totalDeductions || 0,
        netPay: payslipData.netSalary || 0,
        amountInWords: "",
        currentUrl: getPublicAppUrl(),
        bankName: payslipData.employee?.bankName || "-",
        accountTitle: payslipData.employee?.bankAccountTitle || payslipData.employee?.name || "-",
        iban: payslipData.employee?.bankAccountNumber || "-"
      };

      const net = parseFloat(ps.netPay);
      if (!Number.isNaN(net) && net > 0) {
        const integerPart = Math.floor(net);
        const decimalPart = Math.round((net - integerPart) * 100);
        let words = numberToWords.toWords(integerPart, { and: true }).replace(/^\w/, (c) => c.toUpperCase());
        if (decimalPart > 0) {
          words += " And " + numberToWords.toWords(decimalPart, { and: true }).replace(/^\w/, (c) => c.toUpperCase()) + " Cents";
        }
        ps.amountInWords = `${ps.currencyCode} ${words} Only`;
      }

      const monthLabel = payslipData.payPeriod?.label?.replace(/\s+/g, "_") || "Payslip";
      const empName = payslipData.employee?.name?.replace(/\s+/g, "_") || "Employee";
      const fileName = `Payslip_${empName}_${monthLabel}.pdf`;

      const renderedHtml = ejs.render(templateHtml, { payslip: ps }, { strict: false });

      const response = await axios.post(`${BASE_URL}/html-to-pdf`, {
        html: renderedHtml,
        filename: fileName,
        waitUntil: "domcontentloaded",
        timeout: 10000,
        margin: { top: "0", bottom: "0", left: "0", right: "0" }
      }, {
        responseType: "blob",
        headers: authHeaders
      });

      downloadBlobFile(new Blob([response.data], { type: "application/pdf" }), fileName);
      notifySuccess("Payslip PDF downloaded successfully");
    } catch (error) {
      console.error("PDF generation failed:", error);
      notifyError("Failed to generate PDF from template");
    } finally {
      setDownloadingId("");
      setTemplateSelectionModal({ isOpen: false, templates: [], payslipId: null, payslipData: null, businessDetails: null });
    }
  };

  const handleDownloadPayslip = async (payslipId) => {
    setDownloadingId(payslipId);
    try {
      const authHeaders = adminInfo?.token ? { Authorization: `Bearer ${adminInfo.token}` } : {};
      
      // 1. Fetch Payslip Data
      const psRes = await axios.get(`${BASE_URL}/payslip/${payslipId}`, { params: getPayslipScopeParams(), headers: authHeaders });
      const payslipData = psRes.data?.payslip;
      if (!payslipData) throw new Error("Payslip data not found");

      // 2. Fetch Business Templates
      const businessId = employee?.business || payslipData.employee?.business || getPayslipScopeParams().business;
      const tOut = await axios.get(`${BASE_URL}/business-templates/${businessId}`, { headers: authHeaders });
      
      const bOut = await axios.get(`${BASE_URL}/business/${businessId}`, { headers: authHeaders });
      const businessDetails = bOut.data?.data || bOut.data;

      const assignments = tOut.data?.data || [];
      const activePayslipTemplates = assignments.filter(a => a.type === "payslip" && a.isActive && a.templateId);

      if (activePayslipTemplates.length === 0) {
        const roleLabel = typeof adminInfo?.role === "string" ? adminInfo.role : adminInfo?.role?.name;
        const isSuperAdmin = String(roleLabel).toLowerCase().replace(/\s+/g, '') === 'superadmin';

        if (isSuperAdmin) {
          // Fallback to the default system payslip template for super admins
          const dtOut = await axios.get(`${BASE_URL}/document-templates`, { headers: authHeaders });
          const allDocs = dtOut.data?.data?.data || dtOut.data?.data || dtOut.data || [];
          const defaultTemplate = allDocs.find(t => t.name === "Standard Payslip" || t.type === "payslip");
          
          if (defaultTemplate) {
            const templateHtml = defaultTemplate.htmlContent || defaultTemplate.content;
            await processPayslipDownload(payslipId, templateHtml, payslipData, businessDetails);
            return;
          }
        }

        notifyError("Please assign and enable a Payslip template for this business.");
        setDownloadingId("");
        return;
      }

      if (activePayslipTemplates.length === 1) {
        // Auto download with the single template
        const templateHtml = activePayslipTemplates[0].templateId.htmlContent || activePayslipTemplates[0].templateId.content;
        await processPayslipDownload(payslipId, templateHtml, payslipData, businessDetails);
      } else {
        // Show modal to select template
        setTemplateSelectionModal({
          isOpen: true,
          templates: activePayslipTemplates,
          payslipId,
          payslipData,
          businessDetails
        });
        setDownloadingId(""); // Clear because we're waiting for user input
      }
    } catch (error) {
      console.error("Download Payslip Error:", error);
      notifyError(error.response?.data?.message || "Failed to download payslip");
      setDownloadingId("");
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const params = { ...getPayslipScopeParams() };
      if (yearFilter) params.year = yearFilter;
      if (monthFilter) params.month = monthFilter;
      const authHeaders = adminInfo?.token
        ? { Authorization: `Bearer ${adminInfo.token}` }
        : {};
      const response = await axios.get(`${BASE_URL}/payslips/me/download`, {
        params,
        responseType: "blob",
        headers: authHeaders,
      });
      const contentDisposition = response.headers["content-disposition"] || "";
      const filenameMatch = contentDisposition.match(/filename="?(.*?)"?$/i);
      const filename = filenameMatch?.[1] || "Payslips.pdf";
      downloadBlobFile(new Blob([response.data], { type: "application/pdf" }), filename);
      notifySuccess("All payslips downloaded successfully");
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to download payslips");
    } finally {
      setDownloadingAll(false);
    }
  };

  const activeFilterCount = [yearFilter, monthFilter].filter(Boolean).length;

  /** Prefer HR staff name; when not linked or still loading, show logged-in user from session. */
  const displayName = useMemo(
    () => (employee?.name || adminInfo?.name || "").trim(),
    [employee?.name, adminInfo?.name],
  );
  const displayPosition = useMemo(() => {
    const roleLabel =
      typeof adminInfo?.role === "string" ? adminInfo.role : adminInfo?.role?.name;
    return (employee?.position || roleLabel || "").trim() || "—";
  }, [employee?.position, adminInfo?.role]);

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">

        {/* ── Page Header ── */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Payslips</h1>
              <p className="text-gray-600 mt-2">
                {displayName
                  ? `${displayName}${employee?.department ? ` · ${employee.department}` : ""}${displayPosition && displayPosition !== "—" ? ` · ${displayPosition}` : ""}`
                  : "View your payroll history, track earnings, and download official PDF payslips."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              {payslips.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download size={18} />
                  {downloadingAll ? "Downloading…" : "Download All"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="mb-8 w-full max-w-full min-w-0 overflow-x-hidden">
          <SummaryCards
            columnsCount={4}
            cards={[
              {
                title: "Total Payslips",
                value: payslips.length,
                backgroundColor: "summary-light",
                iconColor: "summary-dark",
                Icon: SummarySvg,
              },
              {
                title: "Total Gross Salary",
                value: formatCurrency(totals.gross),
                backgroundColor: "completed-light",
                iconColor: "completed-dark",
                Icon: CompletedSvg,
              },
              {
                title: "Total Deductions",
                value: formatCurrency(totals.deductions),
                backgroundColor: "processing-light",
                iconColor: "processing-dark",
                Icon: InProgressSvg,
              },
              {
                title: "Total Net Salary",
                value: formatCurrency(totals.net),
                backgroundColor: "completed-light",
                iconColor: "overdue-dark",
                Icon: DelayedSvg,
              },
            ]}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
          <DataTable
            headers={[
              "Pay Period",
              "Allowance",
              "Bonus",
              "Gross Salary",
              "Deductions",
              "Net Pay",
              "Status",
              "Actions",
            ]}
            data={payslips.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage)}
            loading={loading}
            totalRecords={payslips.length}
            currentPage={currentPage}
            totalPages={Math.ceil(payslips.length / recordsPerPage) || 1}
            recordsPerPage={recordsPerPage}
            onPageChange={(p) => setCurrentPage(p)}
            onRecordsPerPageChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
            filters={[
              {
                isClearButton: true,
                buttonProps: {
                  onClick: () => {
                    setMonthFilter("");
                    setYearFilter("");
                  },
                },
              },
              {
                label: "Month",
                value: monthFilter,
                placeholder: "All months",
                onChange: (value) => setMonthFilter(value),
                options: MONTH_OPTIONS,
              },
              {
                label: "Year",
                value: yearFilter,
                placeholder: "All years",
                onChange: (value) => setYearFilter(value),
                options: yearOptions,
              },
            ]}
            onSearch={null}
            searchPlaceholder={null}
            renderRow={(payslip) => (
              <tr key={payslip.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <CalendarRange className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{payslip.payPeriod.label}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatDate(payslip.payPeriod.start)} – {formatDate(payslip.payPeriod.end)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-medium text-blue-600 text-sm">
                  {formatCurrency(payslip.earnings?.allowances ?? payslip.allowances ?? 0)}
                </td>
                <td className="py-3 px-4 font-medium text-violet-600 text-sm">
                  {formatCurrency(payslip.earnings?.bonus ?? payslip.bonus ?? 0)}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-700 text-sm">
                  {formatCurrency(payslip.grossSalary)}
                </td>
                <td className="py-3 px-4 font-semibold text-rose-500 text-sm">
                  − {formatCurrency(payslip.totalDeductions)}
                </td>
                <td className="py-3 px-4">
                  <div className="inline-flex rounded-lg bg-emerald-50 px-3 py-1.5 ring-1 ring-emerald-100">
                    <span className="text-sm font-bold text-emerald-700">{formatCurrency(payslip.netSalary)}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={payslip.status} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewPayslip(payslip.id)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPayslip(payslip.id)}
                      disabled={downloadingId === payslip.id}
                      className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      <PayslipModal
        loading={detailLoading}
        payslip={selectedPayslip}
        downloading={downloadingId === selectedPayslipId}
        onDownload={handleDownloadPayslip}
        onClose={() => {
          setSelectedPayslip(null);
          setSelectedPayslipId("");
          setDetailLoading(false);
        }}
      />
      {/* Template Selection Modal */}
      {templateSelectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-400/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Select Payslip Template</h2>
              <button
                onClick={() => setTemplateSelectionModal({ isOpen: false, templates: [], payslipId: null, payslipData: null, businessDetails: null })}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {templateSelectionModal.templates.map((assignment) => (
                <button
                  key={assignment._id}
                  onClick={() => processPayslipDownload(
                    templateSelectionModal.payslipId,
                    assignment.templateId.htmlContent || assignment.templateId.content,
                    templateSelectionModal.payslipData,
                    templateSelectionModal.businessDetails
                  )}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <span className="font-medium text-slate-700">{assignment.templateId?.name || "Payslip Template"}</span>
                  {assignment.isDefault && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold uppercase">Default</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
