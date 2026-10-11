import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Landmark,
  Building2,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Wallet,
  Users,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { notifyError } from "@/utils/toast";
import { formatAmount, formatDate } from "@/components/formatAmount";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import { DataTable, SummaryCards, Loader, DropdownBasic } from "@/page-layouts";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import {
  makeChequeReportsT,
  translateChequeStatus,
} from "@/utils/chequeI18n";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const REPORT_VARIANTS = [
  {
    id: "upcoming",
    variantKey: "upcoming",
    icon: CalendarClock,
    color: "text-sky-600",
    bgColor: "bg-sky-100",
  },
  {
    id: "vendor-wise",
    variantKey: "vendorWise",
    icon: Users,
    color: "text-violet-600",
    bgColor: "bg-violet-100",
  },
  {
    id: "bank-wise",
    variantKey: "bankWise",
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    id: "cleared",
    variantKey: "cleared",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  {
    id: "bounced",
    variantKey: "bounced",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  {
    id: "pending-liability",
    variantKey: "pendingLiability",
    icon: Wallet,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
];

const VARIANT_DEFAULTS = {
  upcoming: {
    name: "Upcoming cheques",
    description: "Cheques due in the next 7, 15, or 30 days",
  },
  vendorWise: {
    name: "Vendor-wise",
    description: "Outstanding cheques grouped by vendor",
  },
  bankWise: {
    name: "Bank-wise",
    description: "Outstanding cheques grouped by bank account",
  },
  cleared: {
    name: "Cleared cheques",
    description: "Successfully cleared cheque payments",
  },
  bounced: {
    name: "Bounced cheques",
    description: "Cheques rejected by the bank",
  },
  pendingLiability: {
    name: "Pending liability",
    description: "Future cheque obligations (Draft, Issued, Due Soon)",
  },
};

function formatDateCell(d, withTime = false) {
  if (!d) return "—";
  return formatDate(d, false, withTime) || "—";
}

function statusBadge(s, t) {
  const map = {
    Draft: "bg-slate-100 text-slate-800",
    Issued: "bg-blue-100 text-blue-900",
    "Due Soon": "bg-amber-100 text-amber-900",
    Cleared: "bg-emerald-100 text-emerald-900",
    Bounced: "bg-red-100 text-red-900",
    Cancelled: "bg-gray-200 text-gray-800",
    Replaced: "bg-violet-100 text-violet-900",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || "bg-gray-100"}`}>
      {translateChequeStatus(t, s)}
    </span>
  );
}

function ChequeReports({ onBack = null }) {
  const { t } = useTranslation();
  const cr = makeChequeReportsT(t);
  const checkTokenExpired = useCheckTokenExpired();
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const adminId = adminInfo?.id || adminInfo?._id;
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();

  const [reportVariant, setReportVariant] = useState("upcoming");
  const [upcomingDays, setUpcomingDays] = useState("7");
  const [businessFilter, setBusinessFilter] = useState("");
  const [assignedBusinessIds, setAssignedBusinessIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [hasRun, setHasRun] = useState(false);

  const reportVariants = useMemo(
    () =>
      REPORT_VARIANTS.map((r) => {
        const defaults = VARIANT_DEFAULTS[r.variantKey] || {};
        return {
          ...r,
          name: cr(
            `variants.${r.variantKey}.name`,
            defaults.name || r.id,
          ),
          description: cr(
            `variants.${r.variantKey}.description`,
            defaults.description || "",
          ),
        };
      }),
    [t],
  );

  const tableHeaders = useMemo(
    () => [
      cr("headers.chequeNumber", "Cheque #"),
      cr("headers.vendor", "Vendor"),
      cr("headers.bank", "Bank"),
      cr("headers.amount", "Amount"),
      cr("headers.currency", "Currency"),
      cr("headers.status", "Status"),
      cr("headers.issueDate", "Issue date"),
      cr("headers.dueDate", "Due date"),
      cr("headers.cleared", "Cleared"),
    ],
    [t],
  );

  const buildParams = () => {
    const params = { type: reportVariant };
    if (reportVariant === "upcoming") params.days = upcomingDays;
    if (businessFilter && String(businessFilter).trim()) {
      params.business_id = businessFilter;
    } else if (assignedBusinessIds.length) {
      params.business_ids = assignedBusinessIds.join(",");
    }
    return params;
  };

  const runReport = async () => {
    if (!adminInfo?.token) return;
    const params = buildParams();
    if (!params.business_id && !params.business_ids) {
      notifyError(
        cr(
          "errors.selectBusiness",
          "Select a business or wait for businesses to load.",
        ),
      );
      return;
    }
    try {
      setLoading(true);
      setHasRun(true);
      const res = await axios.get(`${Base_URL}/cheques/reports`, {
        params,
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
        withCredentials: true,
      });
      if (checkTokenExpired(res)) return;
      setReportData(res.data?.data || null);
    } catch (e) {
      console.error(e);
      notifyError(
        e.response?.data?.error ||
          cr("errors.generateFailed", "Failed to generate report"),
      );
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assignedBusinessIds.length === 1 && !businessFilter) {
      setBusinessFilter(assignedBusinessIds[0]);
    }
  }, [assignedBusinessIds, businessFilter]);

  useEffect(() => {
    if (!isSingleBusiness || !singleBusinessId) return;
    setAssignedBusinessIds([singleBusinessId]);
    setBusinessFilter((prev) => prev || singleBusinessId);
  }, [isSingleBusiness, singleBusinessId]);

  const isGrouped = reportVariant === "vendor-wise" || reportVariant === "bank-wise";
  const flatRows = reportData?.rows || [];
  const groups = reportData?.groups || [];
  const summary = reportData?.summary || { count: 0, totalAmount: 0 };

  const summaryCards = useMemo(
    () => [
      {
        title: cr("summaryCheques", "Cheques"),
        value: String(summary.count ?? 0),
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: Landmark,
        renderIconAsComponent: true,
        iconBackdrop: "#2563eb",
      },
      {
        title: cr("summaryTotalAmount", "Total amount"),
        value: formatAmount(summary.totalAmount || 0),
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: Wallet,
        renderIconAsComponent: true,
        iconBackdrop: "#059669",
      },
    ],
    [summary, t],
  );

  const renderTableRow = (row) => (
    <tr
      key={row._id}
      className="border-b hover:bg-slate-50/80 dark:hover:bg-gray-800/50"
    >
      <td className="py-2 px-4 font-medium max-w-[140px] truncate">
        <ChequeNumberLink chequeId={row._id} chequeNumber={row.chequeNumber} />
      </td>
      <td className="py-2 px-4 max-w-[140px] truncate">{row.vendorDisplay || "—"}</td>
      <td className="py-2 px-4 max-w-[160px] truncate text-sm">{row.bankAccountLabel || "—"}</td>
      <td className="py-2 px-4 text-right tabular-nums">{formatAmount(row.amount || 0)}</td>
      <td className="py-2 px-4">{row.currency || "—"}</td>
      <td className="py-2 px-4">{statusBadge(row.status, t)}</td>
      <td className="py-2 px-4 text-sm">{formatDateCell(row.issueDate)}</td>
      <td className="py-2 px-4 text-sm">{formatDateCell(row.dueDate)}</td>
      <td className="py-2 px-4 text-sm">{formatDateCell(row.clearedDate, true)}</td>
    </tr>
  );

  const selectedVariantMeta = reportVariants.find((r) => r.id === reportVariant);

  return (
    <div className="space-y-6">
      {typeof onBack === "function" ? (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {cr("backToReportTypes", "Back to report types")}
          </button>
        </div>
      ) : null}

      {typeof onBack === "function" ? (
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {cr("title", "Cheque reports")}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {selectedVariantMeta?.description ||
              cr(
                "fallbackDescription",
                "Generate cheque management reports",
              )}
          </p>
        </div>
      ) : null}

      {/* Report variant */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reportVariants.map((r) => {
          const Icon = r.icon;
          const active = reportVariant === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setReportVariant(r.id);
                setReportData(null);
                setHasRun(false);
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                active
                  ? "border-[var(--p-blue)] ring-2 ring-[var(--p-blue)]/20 bg-blue-50/50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${r.bgColor} rounded-lg flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${r.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-gray-900 block">{r.name}</span>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{r.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/80">
        {!isSingleBusiness && (
        <div className="w-full sm:w-64">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {cr("business", "Business")}
          </label>
          <DropdownBasic
            isBusinessDropdown
            businessDropdownProps={{
              adminId,
              selectedBusiness: businessFilter || "",
              onChange: (v) => setBusinessFilter(v || ""),
              setAssignedBusinesses: setAssignedBusinessIds,
              placeholder: cr("allBusinesses", "All Businesses"),
              style: { width: "100%" },
            }}
          />
        </div>
        )}
        {reportVariant === "upcoming" && (
          <div className="w-full sm:w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {cr("dueWithin", "Due within")}
            </label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={upcomingDays}
              onChange={(e) => setUpcomingDays(e.target.value)}
            >
              <option value="7">{cr("days7", "7 days")}</option>
              <option value="15">{cr("days15", "15 days")}</option>
              <option value="30">{cr("days30", "30 days")}</option>
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={runReport}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--p-blue)" }}
        >
          {loading
            ? cr("generating", "Generating…")
            : cr("generateReport", "Generate report")}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader color="var(--p-blue)" />
        </div>
      )}

      {!loading && hasRun && reportData && (
        <>
          <SummaryCards cards={summaryCards} columnsCount={2} renderIconAsComponent size="sm" />

          {isGrouped ? (
            <div className="space-y-6">
              {groups.length === 0 ? (
                <p className="text-center text-gray-500 py-12">
                  {cr("empty", "No data for this report.")}
                </p>
              ) : (
                groups.map((g) => (
                  <section
                    key={g.key}
                    className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b">
                      <h3 className="font-semibold text-gray-900">{g.label}</h3>
                      <span className="text-sm text-gray-600 tabular-nums">
                        {cr(
                          "groupCountAmount",
                          "{{count}} cheque(s) · {{amount}}",
                          {
                            count: g.count,
                            amount: formatAmount(g.totalAmount || 0),
                          },
                        )}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-white">
                            {tableHeaders.map((h) => (
                              <th
                                key={h}
                                className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>{(g.rows || []).map(renderTableRow)}</tbody>
                      </table>
                    </div>
                  </section>
                ))
              )}
            </div>
          ) : (
            <DataTable
              headers={tableHeaders}
              data={flatRows}
              totalRecords={flatRows.length}
              loading={false}
              noPagination={flatRows.length <= 25}
              currentPage={1}
              totalPages={Math.max(1, Math.ceil(flatRows.length / 25))}
              recordsPerPage={25}
              onPageChange={() => {}}
              onRecordsPerPageChange={() => {}}
              renderRow={renderTableRow}
            />
          )}
        </>
      )}

      {!loading && hasRun && !reportData && (
        <p className="text-center text-gray-500 py-12">
          {cr("loadFailedEmpty", "Could not load report.")}
        </p>
      )}
    </div>
  );
}

export default ChequeReports;
