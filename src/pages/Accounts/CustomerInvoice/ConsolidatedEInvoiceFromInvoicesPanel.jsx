import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import { useState, useEffect, useContext, useCallback, useMemo } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  CheckSquare,
  Square,
  Send,
  RefreshCw,
  Building,
  Building2,
  Calendar,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { notifyError, notifySuccess } from "@/utils/toast";
import { formatLhdnValidationErrorsNotifyBody } from "@/utils/formatLhdnValidationErrors";
import EInvoiceServices from "@/services/EInvoiceServices";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { isEInvoiceEnabledValue } from "@/hooks/useBusinessEInvoiceEnabled";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const LHDN_ELIGIBLE = new Set(["Pending", "Invalid", "Rejected"]);

function formatDateForInput(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** @returns {string} YYYY-MM for `<input type="month" />` */
function formatYearMonthForInput(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

/** First and last calendar day of YYYY-MM (for API invoice_date range). */
function getMonthDateRange(ym) {
  if (!/^\d{4}-\d{2}$/.test(String(ym).trim())) return { dateFrom: "", dateTo: "" };
  const [y, mo] = String(ym)
    .split("-")
    .map((n) => parseInt(n, 10));
  if (!y || !mo || mo < 1 || mo > 12) return { dateFrom: "", dateTo: "" };
  const pad = (n) => String(n).padStart(2, "0");
  const dateFrom = `${y}-${pad(mo)}-01`;
  const lastD = new Date(y, mo, 0).getDate();
  const dateTo = `${y}-${pad(mo)}-${pad(lastD)}`;
  return { dateFrom, dateTo };
}

function isEligibleForConsolidation(inv) {
  if (!inv || inv.isConsolidated) return false;
  if (inv.consolidatedInvoiceId) {
    const parentStatus = String(
      inv._consolidatedParentStatus || inv.consolidatedParentStatus || "",
    )
      .trim()
      .toLowerCase();
    if (parentStatus !== "draft") return false;
  }
  const l = (inv.lhdn_status || "Pending").toString();
  if (!LHDN_ELIGIBLE.has(l)) return false;
  const st = (inv.status || "").toString().toLowerCase();
  if (st === "draft") return false;
  return true;
}

/**
 * LHDN consolidated e-invoice (B2C) — merge line items from several customer
 * invoices into one proforma, same pattern as InvoisPls.
 */
export default function ConsolidatedEInvoiceFromInvoicesPanel({
  businesses,
  selectedBusinessFilter,
  onBusinessChange,
  onConsolidationCreated,
}) {
  useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  const [pool, setPool] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  /** Invoices are only fetched after the user clicks Load (not on every filter change). */
  const [sourceInvoicesLoaded, setSourceInvoicesLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(formatDateForInput());
  const [dueDate, setDueDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return formatDateForInput(nextWeek);
  });

  /** Filter source pool by original invoice date — same idea as InvoisPls (month vs range). */
  const [dateSelectionMode, setDateSelectionMode] = useState("month");
  const [sourceMonth, setSourceMonth] = useState(() => formatYearMonthForInput());
  const [sourceRangeFrom, setSourceRangeFrom] = useState(() => {
    const { dateFrom } = getMonthDateRange(formatYearMonthForInput());
    return dateFrom;
  });
  const [sourceRangeTo, setSourceRangeTo] = useState(() => {
    const { dateTo } = getMonthDateRange(formatYearMonthForInput());
    return dateTo;
  });

  const selectedBusiness = useMemo(
    () =>
      (businesses || []).find(
        (x) => String(x._id) === String(selectedBusinessFilter),
      ),
    [businesses, selectedBusinessFilter],
  );

  const eInvoiceOnSelection = useMemo(() => {
    if (selectedBusinessFilter) {
      return selectedBusiness ? isEInvoiceEnabledValue(selectedBusiness) : false;
    }
    return (businesses || []).some((b) => isEInvoiceEnabledValue(b));
  }, [businesses, selectedBusiness, selectedBusinessFilter]);

  const businessSelectOptions = useMemo(
    () =>
      (businesses || []).map((b) => ({
        value: b._id,
        label: `${b.name || "—"}${!isEInvoiceEnabledValue(b) ? " (e-invoice off)" : ""}`,
        isDisabled: !isEInvoiceEnabledValue(b),
      })),
    [businesses],
  );

  const canLoadSourceInvoices = useMemo(() => {
    if (!adminInfo?.token || !selectedBusinessFilter || !eInvoiceOnSelection) {
      return false;
    }
    if (dateSelectionMode === "month") {
      const { dateFrom, dateTo } = getMonthDateRange(sourceMonth);
      return Boolean(dateFrom && dateTo);
    }
    if (!sourceRangeFrom || !sourceRangeTo) return false;
    const a = new Date(`${sourceRangeFrom}T00:00:00`);
    const b = new Date(`${sourceRangeTo}T00:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
    if (a > b) return false;
    return true;
  }, [
    adminInfo?.token,
    selectedBusinessFilter,
    eInvoiceOnSelection,
    dateSelectionMode,
    sourceMonth,
    sourceRangeFrom,
    sourceRangeTo,
  ]);

  const fetchPool = useCallback(async () => {
    if (!adminInfo?.token || !businesses?.length || !selectedBusinessFilter) {
      setPool([]);
      setSourceInvoicesLoaded(false);
      return;
    }
    let dateFrom;
    let dateTo;
    if (dateSelectionMode === "month") {
      const r = getMonthDateRange(sourceMonth);
      dateFrom = r.dateFrom;
      dateTo = r.dateTo;
      if (!dateFrom || !dateTo) {
        notifyError(ciText("Select a month"));
        setPool([]);
        setSourceInvoicesLoaded(false);
        return;
      }
    } else {
      dateFrom = sourceRangeFrom;
      dateTo = sourceRangeTo;
    }
    if (dateSelectionMode === "range") {
      if (!dateFrom || !dateTo) {
        notifyError(ciText("Select both start and end dates for the range"));
        setPool([]);
        setSourceInvoicesLoaded(false);
        return;
      }
      const a = new Date(`${dateFrom}T00:00:00`);
      const b = new Date(`${dateTo}T00:00:00`);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
        notifyError(ciText("Select valid start and end dates"));
        setPool([]);
        setSourceInvoicesLoaded(false);
        return;
      }
      if (a > b) {
        notifyError(ciText("End date must be on or after the start date"));
        setPool([]);
        setSourceInvoicesLoaded(false);
        return;
      }
    }
    setLoading(true);
    try {
      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      const params = {
        page: 1,
        limit: 5000,
        businessId: selectedBusinessFilter,
        dateFrom,
        dateTo,
        consolidationPool: true,
      };
      const res = await axios.get(`${Base_URL}/proforma-invoice`, {
        params,
        headers,
      });
      const rows = res.data?.data || [];
      const assignedSet = new Set(assignedIds.map((id) => String(id)));
      const list = (Array.isArray(rows) ? rows : []).filter((inv) => {
        const bid = inv.business_id?._id ?? inv.business_id;
        if (!bid) return false;
        return assignedSet.has(String(bid));
      });
      setPool(list.filter(isEligibleForConsolidation));
      setSourceInvoicesLoaded(true);
    } catch (e) {
      console.error(e);
      notifyError(ciText("Could not load invoices for consolidation"));
      setPool([]);
      setSourceInvoicesLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [
    adminInfo?.token,
    businesses,
    selectedBusinessFilter,
    dateSelectionMode,
    sourceMonth,
    sourceRangeFrom,
    sourceRangeTo,
  ]);

  useEffect(() => {
    setPool([]);
    setSelectedIds(new Set());
    setSourceInvoicesLoaded(false);
  }, [
    selectedBusinessFilter,
    dateSelectionMode,
    sourceMonth,
    sourceRangeFrom,
    sourceRangeTo,
  ]);

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === pool.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pool.map((p) => p._id)));
    }
  };

  const handleBusinessSelect = (value) => {
    setSelectedIds(new Set());
    if (onBusinessChange) onBusinessChange(value ?? "");
  };

  const handleCreateAndSubmit = async (opts = {}) => {
    const { isDraft = false, submit = true } = opts;
    if (!selectedBusinessFilter) {
      notifyError(ciText("Select a business first"));
      return;
    }
    if (selectedIds.size < 1) {
      notifyError(ciText("Select at least one source invoice"));
      return;
    }
    if (!eInvoiceOnSelection) {
      notifyError(ciText("E-invoice is not enabled for the selected business"));
      return;
    }
    if (!invoiceDate) {
      notifyError(ciText("Select an invoice date"));
      return;
    }
    if (!dueDate) {
      notifyError(ciText("Select a due date"));
      return;
    }
    const invDate = new Date(`${invoiceDate}T00:00:00`);
    const invoiceDueDate = new Date(`${dueDate}T00:00:00`);
    if (
      Number.isNaN(invDate.getTime()) ||
      Number.isNaN(invoiceDueDate.getTime())
    ) {
      notifyError(ciText("Select valid invoice and due dates"));
      return;
    }
    if (invoiceDueDate < invDate) {
      notifyError(ciText("Due date cannot be earlier than invoice date"));
      return;
    }
    const selectedRows = pool.filter((inv) => selectedIds.has(inv._id));
    if (selectedRows.length !== selectedIds.size) {
      notifyError(
        "Some selected invoices are no longer eligible. Refresh and try again.",
      );
      return;
    }
    const selectedCurrencies = new Set(
      selectedRows.map((inv) => String(inv.currency || "MYR").trim() || "MYR"),
    );
    if (selectedCurrencies.size > 1) {
      notifyError(ciText("Select invoices with the same currency only"));
      return;
    }
    const invalidInvoice = selectedRows.find(
      (inv) => !isEligibleForConsolidation(inv),
    );
    if (invalidInvoice) {
      notifyError(
        `Invoice ${invalidInvoice.invoice_number || ""} is not eligible for consolidation. Refresh and try again.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await EInvoiceServices.createConsolidatedFromInvoices({
        businessId: selectedBusinessFilter,
        sourceInvoiceIds: Array.from(selectedIds),
        invoice_date: invoiceDate,
        due_date: dueDate,
        isDraft,
        submitToLhdn: submit,
      });
      if (data?.status) {
        notifySuccess(
          data.message || ciText("Consolidated e-invoice created successfully"),
        );
        setSelectedIds(new Set());
        if (onConsolidationCreated) onConsolidationCreated();
        await fetchPool();
        if (data.data?._id) {
          history.push(`/view-customer-invoice/${data.data._id}`);
        }
      } else {
        notifyError(data?.message || ciText("Consolidation failed"));
      }
    } catch (e) {
      const ves = e?.response?.data?.validationErrors;
      if (Array.isArray(ves) && ves.length) {
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            ves,
            "Couldn’t create or submit the consolidated e-invoice to MyInvois (LHDN)",
            { maxLines: 8 },
          ),
        );
      } else {
        notifyError(
          e?.response?.data?.message || e.message || ciText("Consolidation failed"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const consolidationAlert = (() => {
    if (!selectedBusinessFilter) {
      return (
        <div className="flex gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <Building className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {ciText("Select a")} <strong>business</strong> with e-invoice (MyInvois) turned
            on, then choose a month or date range and click{" "}
            <strong>{ciText("Load Invoices")}</strong>.
          </span>
        </div>
      );
    }
    if (!eInvoiceOnSelection) {
      return (
        <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          E-invoice is not enabled for this business. Enable it in business
          settings, then try again.
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="rounded-2xl border border-[var(--p-gray-dark)]/80 bg-white shadow-sm overflow-hidden">
        <div className="h-1 " />
        <div className="p-5 sm:p-6 space-y-5 bg-gradient-to-b from-[var(--p-gray-light)]/90 to-white">
        <h2 className="text-base sm:text-lg font-bold text-[var(--p-black2)] tracking-tight">
          {ciText("Selection Criteria")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:items-start">
          {!isSingleAssignedBusiness() && (
          <div className="min-w-0 space-y-1.5">
            <label
              className="block text-sm font-semibold text-[var(--p-black2)]"
              htmlFor="consolidated-einv-business"
            >
              {ciText("Business")}
              <span className="text-[var(--p-red)]" aria-hidden>
                {" "}
                *
              </span>
            </label>
            <div
              className="bg-white rounded-lg  ring-[var(--p-gray-dark)]/90 shadow-sm"
              id="consolidated-einv-business"
            >
              <DropdownBasic
                options={businessSelectOptions}
                value={selectedBusinessFilter || ""}
                onChange={(v) => handleBusinessSelect(v)}
                placeholder={ciText("Select Business")}
                appearance="document"
                isClearable={(businesses || []).length > 1}
                sortOptions={true}
                width="100%"
              />
            </div>
          </div>
          )}

          <div
            className="min-w-0 flex flex-col gap-1.5 w-full md:row-span-2 md:row-start-1 md:col-start-2 self-start"
          >
            <p className="text-sm font-semibold text-[var(--p-black2)]">
              {ciText("Date Selection Mode")}
            </p>
            <div
              className="inline-flex rounded-lg border border-[var(--p-gray-dark)]/60 p-1 w-full justify-center"
              style={{ background: "var(--p-gray-light)" }}
            >
              <button
                type="button"
                onClick={() => {
                  setDateSelectionMode("month");
                  if (sourceRangeFrom) {
                    setSourceMonth(sourceRangeFrom.slice(0, 7));
                  }
                }}
                className={`min-w-0 flex-1 px-8 py-2.5 text-sm font-medium rounded-md transition-all ${
                  dateSelectionMode === "month"
                    ? "text-white shadow-md bg-[var(--p-blue)] hover:bg-[var(--p-blue-dark)]"
                    : "text-[var(--p-gray)] hover:text-[var(--p-black2)] bg-transparent"
                }`}
              >
                {ciText("Month")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateSelectionMode("range");
                  const { dateFrom: df, dateTo: dt } = getMonthDateRange(sourceMonth);
                  if (df && dt) {
                    setSourceRangeFrom(df);
                    setSourceRangeTo(dt);
                  }
                }}
                className={`min-w-0 flex-1 px-8 py-2.5 text-sm font-medium rounded-md transition-all ${
                  dateSelectionMode === "range"
                    ? "text-white shadow-md bg-[var(--p-blue)] hover:bg-[var(--p-blue-dark)]"
                    : "text-[var(--p-gray)] hover:text-[var(--p-black2)] bg-transparent"
                }`}
              >
                {ciText("Date Range")}
              </button>
            </div>
          </div>

          {dateSelectionMode === "month" ? (
            <div className="min-w-0 space-y-1.5 md:col-start-1">
              <label
                className="block text-sm font-semibold text-[var(--p-black2)]"
                htmlFor="consolidated-einv-source-month"
              >
                {ciText("Month")}
                <span className="text-[var(--p-red)]" aria-hidden>
                  {" "}
                  *
                </span>
              </label>
              <div className="relative max-w-md">
                <input
                  id="consolidated-einv-source-month"
                  type="month"
                  value={sourceMonth}
                  onChange={(e) => setSourceMonth(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg text-sm text-[var(--p-black2)] border border-[var(--p-gray-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] [color-scheme:light]"
                />
                <span
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--p-gray)]"
                  aria-hidden
                >
                  <Calendar className="w-4 h-4" strokeWidth={2} />
                </span>
              </div>
            </div>
          ) : (
            <div className="min-w-0 space-y-1.5 md:col-start-1">
              <p className="text-sm font-semibold text-[var(--p-black2)]">
                {ciText("Date range")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                <div className="space-y-1.5">
                  <label
                    className="block text-sm text-[var(--p-gray)]"
                    htmlFor="consolidated-einv-range-from"
                  >
                    {ciText("From")}
                    <span className="text-[var(--p-red)]" aria-hidden>
                      {" "}
                      *
                    </span>
                  </label>
                  <input
                    id="consolidated-einv-range-from"
                    type="date"
                    value={sourceRangeFrom}
                    onChange={(e) => setSourceRangeFrom(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border border-[var(--p-gray-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-sm text-[var(--p-gray)]"
                    htmlFor="consolidated-einv-range-to"
                  >
                    {ciText("To")}
                    <span className="text-[var(--p-red)]" aria-hidden>
                      {" "}
                      *
                    </span>
                  </label>
                  <input
                    id="consolidated-einv-range-to"
                    type="date"
                    value={sourceRangeTo}
                    min={sourceRangeFrom || undefined}
                    onChange={(e) => setSourceRangeTo(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border border-[var(--p-gray-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-1 md:col-start-1">
            <button
              type="button"
              onClick={fetchPool}
              disabled={loading || !canLoadSourceInvoices}
              title={
                !canLoadSourceInvoices
                  ? "Select a business with e-invoice, then a valid month or date range"
                  : undefined
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg text-white bg-[var(--p-blue)] hover:bg-[var(--p-blue-dark)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              <Calendar className="w-4 h-4 shrink-0" strokeWidth={2} />
              {loading ? ciText("Loading…") : ciText("Load Invoices")}
            </button>
          </div>
        </div>
        </div>
      </div>

      {consolidationAlert}

      {(loading || sourceInvoicesLoaded) && (
        <>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={fetchPool}
              disabled={loading || !canLoadSourceInvoices}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {ciText("Reload list")}
            </button>
            <button
              type="button"
              onClick={() =>
                handleCreateAndSubmit({ isDraft: true, submit: false })
              }
              disabled={submitting}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-400 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {ciText("Save draft only")}
            </button>
            <button
              type="button"
              onClick={() =>
                handleCreateAndSubmit({ isDraft: false, submit: true })
              }
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[var(--p-blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? ciText("Working…") : ciText("Create & submit to LHDN")}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>
                {loading
                  ? ciText("Loading…")
                  : `${pool.length} invoice(s) eligible`}{" "}
                · {selectedIds.size} selected
              </span>
              {!loading && pool.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[var(--p-blue)] hover:underline"
                >
                  {selectedIds.size === pool.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              )}
            </div>
            <div className="overflow-x-hidden max-h-[480px] overflow-y-auto min-w-0">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-3 py-2 w-10" />
                    <th className="px-3 py-2">{ciText("Invoice")}</th>
                    <th className="px-3 py-2">{ciText("Customer")}</th>
                    <th className="px-3 py-2">{ciText("LHDN")}</th>
                    <th className="px-3 py-2">{ciText("Date")}</th>
                    <th className="px-3 py-2 text-right">{ciText("Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-gray-600"
                      >
                        <RefreshCw
                          className="w-5 h-5 animate-spin inline-block align-middle mr-2"
                          aria-hidden
                        />
                        {ciText("Loading eligible invoices…")}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    sourceInvoicesLoaded &&
                    pool.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No eligible invoices in this period. Try another month
                        or range, or use Reload list.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    sourceInvoicesLoaded &&
                    pool.map((inv) => {
                    const id = inv._id;
                    const on = selectedIds.has(id);
                    return (
                      <tr
                        key={id}
                        className={on ? "bg-blue-50/50" : "hover:bg-gray-50"}
                      >
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(id)}
                            className="text-gray-600"
                          >
                            {on ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 align-top">
                          <div className="truncate" title={inv.invoice_number}>
                            {inv.invoice_number}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 align-top">
                          <div
                            className="truncate"
                            title={
                              inv.customer_id?.basicInformation
                                ?.customerDisplayName ||
                              inv.customer_name ||
                              ""
                            }
                          >
                            {inv.customer_id?.basicInformation
                              ?.customerDisplayName ||
                              inv.customer_name ||
                              "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="truncate" title={String(inv.lhdn_status || "")}>
                            {inv.lhdn_status || "Pending"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="truncate">
                            {formatDate(inv.invoice_date)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                          {formatCurrencyAmount(
                            inv.currency || "MYR",
                            inv.grandTotal || inv.subTotal || 0,
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
