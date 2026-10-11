import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import moment from "moment";
import {
  CalendarRange,
  ExternalLink,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { getActivityTimeline } from "@/services/activityTimelineService";
import { formatAuditTimelineSummary } from "@/utils/auditTimelineFormat";
import { resolveAuditEntryPath } from "@/utils/auditRouteResolver";
import { formatDate } from "@/components/formatAmount";
import { DateRangeComponent } from "@/page-layouts/index";

// const DEBOUNCE_MS = 280; // reserved when search bar is re-enabled

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Same nav button look as `DataTable` pagination (customers list). */
const DATA_TABLE_NAV_BTN_STYLE = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid #e5e7eb",
  opacity: 1,
  backgroundColor: "white",
  cursor: "pointer",
};

/** Snap to allowed option (same options as DataTable / CustomerListScreen). */
function nearestPageSize(value, options = DEFAULT_PAGE_SIZE_OPTIONS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return options.includes(10) ? 10 : options[0];
  if (options.includes(n)) return n;
  return options.reduce((best, cur) =>
    Math.abs(cur - n) < Math.abs(best - n) ? cur : best,
  );
}

function readTableEntriesPerPageFromStorage(options = DEFAULT_PAGE_SIZE_OPTIONS) {
  try {
    const cached = localStorage.getItem("configurations");
    if (cached) {
      const cfg = JSON.parse(cached);
      const stored = Number(cfg?.table_entries_per_page);
      if (Number.isFinite(stored) && stored > 0) return nearestPageSize(stored, options);
    }
  } catch {
    /* ignore */
  }
  return null;
}

const actionTone = (action = "") => {
  const a = String(action || "").toLowerCase();
  if (a.includes("delete") || a.includes("remove")) {
    return "bg-red-50 text-red-800 border-red-100 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/50";
  }
  if (a.includes("create") || a.includes("add")) {
    return "bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/50";
  }
  if (a.includes("status")) {
    return "bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/50";
  }
  return "bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-600";
};

/**
 * Unified activity / audit timeline with dynamic labels, navigation, and pagination.
 *
 * @param {object} props
 * @param {Record<string, string>} [props.query] — passed to GET /activity-timeline (e.g. { customerId }, { vendorId })
 * @param {number} [props.pageSize] — initial rows per page (snapped to pageSizeOptions); overridden by `table_entries_per_page` in localStorage when set
 * @param {number[]} [props.pageSizeOptions] — same as DataTable: 5 / 10 / 25 / 50
 * @param {string} [props.title]
 * @param {boolean} [props.compact] — tighter spacing when embedded in another card
 * @param {boolean} [props.embedded] — no outer card chrome (nested inside another panel)
 */
export default function ActivityTimeline({
  query = {},
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  title = "Activity",
  compact = false,
  embedded = false,
}) {
  const { t } = useTranslation();
  const history = useHistory();
  const { getModuleLabel } = useModuleLabels();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // Search bar temporarily disabled — keep hooks/API wiring easy to restore:
  // const [searchInput, setSearchInput] = useState("");
  // const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    const opts =
      Array.isArray(pageSizeOptions) && pageSizeOptions.length > 0
        ? pageSizeOptions
        : DEFAULT_PAGE_SIZE_OPTIONS;
    const fromConfig = readTableEntriesPerPageFromStorage(opts);
    if (fromConfig != null) return fromConfig;
    return nearestPageSize(pageSize, opts);
  });

  const limit = recordsPerPage;

  // useEffect(() => {
  //   const t = setTimeout(() => {
  //     setDebouncedSearch(searchInput.trim());
  //   }, DEBOUNCE_MS);
  //   return () => clearTimeout(t);
  // }, [searchInput]);

  const dateRangeInvalid = useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    return moment(dateFrom).isAfter(moment(dateTo), "day");
  }, [dateFrom, dateTo]);

  const clearFilters = () => {
    // setSearchInput("");
    // setDebouncedSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(dateFrom) || Boolean(dateTo);

  const resolvedPageSizeOptions = useMemo(() => {
    if (Array.isArray(pageSizeOptions) && pageSizeOptions.length > 0) return pageSizeOptions;
    return DEFAULT_PAGE_SIZE_OPTIONS;
  }, [pageSizeOptions]);

  const load = useCallback(async () => {
    const base = { ...query };
    if (!base.customerId && !base.vendorId && !base.businessGroupId) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let startDate = dateFrom || undefined;
    let endDate = dateTo || undefined;
    if (startDate && endDate && moment(startDate).isAfter(moment(endDate), "day")) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }

    setLoading(true);
    try {
      const res = await getActivityTimeline({
        ...base,
        page,
        limit,
        // search: debouncedSearch || undefined, // disabled while search UI is commented out
        startDate: dateRangeInvalid ? undefined : startDate,
        endDate: dateRangeInvalid ? undefined : endDate,
      });
      setRows(res?.data?.data || []);
      setTotal(res?.data?.pagination?.total ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    query,
    page,
    limit,
    dateFrom,
    dateTo,
    dateRangeInvalid,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const paginationWindow = useMemo(() => {
    const maxPagesToShow = 5;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    return { pageNumbers, endPage };
  }, [page, totalPages]);

  const hasPartyScope = Boolean(
    query.customerId || query.vendorId || query.businessGroupId,
  );

  useEffect(() => {
    setPage(1);
  }, [
    dateFrom,
    dateTo,
    query.customerId,
    query.vendorId,
    query.businessGroupId,
    recordsPerPage,
  ]);

  const displayRows = useMemo(
    () =>
      rows.map((r) => ({
        raw: r,
        summary: formatAuditTimelineSummary(r, getModuleLabel),
        href: resolveAuditEntryPath(r),
        when: r.createdAt,
      })),
    [rows, getModuleLabel],
  );

  const pad = embedded ? "p-0" : compact ? "p-3" : "p-4 sm:p-5";
  const shell = embedded
    ? ""
    : "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm";

  const toolbarClass = embedded
    ? "rounded-xl border border-gray-200/90 dark:border-gray-600/90 bg-slate-50/80 dark:bg-gray-800/50 px-3 py-3 sm:px-4 sm:py-3.5 shadow-sm"
    : "rounded-xl border border-gray-200/90 dark:border-gray-600/90 bg-slate-50/80 dark:bg-gray-800/50 px-3 py-3 sm:px-4 sm:py-3.5 shadow-sm mb-4";

  const onRecordsPerPageChange = (nextRaw) => {
    const next = nearestPageSize(Number(nextRaw), resolvedPageSizeOptions);
    setRecordsPerPage(next);
  };

  return (
    <section className={`${shell} ${pad}`.trim()}>
      <div className={toolbarClass}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              {title ? (
                <div className="flex shrink-0 items-center gap-2">
                  <CalendarRange className="h-4 w-4 shrink-0 text-[var(--p-blue)] opacity-90" aria-hidden />
                  <h3 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    {title}
                  </h3>
                </div>
              ) : (
                <span className="sr-only">Activity</span>
              )}
              {/*
              Search bar — temporarily hidden (match customers list pagination only for now).
              <div className="relative w-full min-w-0 sm:max-w-md lg:max-w-md lg:flex-1">
                <Search ... />
                <input type="search" ... />
              </div>
              */}
            </div>

            <div className="flex w-full min-w-0 flex-col gap-1.5 border-t border-gray-200/70 pt-3 dark:border-gray-600/60 sm:w-auto sm:border-t-0 sm:pt-0 lg:shrink-0 lg:items-end">
              <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 lg:text-end">
                Date range
              </span>
              <div className="flex flex-wrap items-end justify-start gap-2 sm:justify-end">
                <DateRangeComponent
                  startDate={dateFrom || undefined}
                  endDate={dateTo || undefined}
                  onApply={(start, end) => {
                    setDateFrom(start || "");
                    setDateTo(end || "");
                  }}
                  onClear={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  width="auto"
                  className="max-w-xs sm:max-w-sm"
                />
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  title="Reset date filters"
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {dateRangeInvalid ? (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              “From” is after “To”. Adjust the range in the date picker so “From” is on or before “To”.
            </p>
          ) : null}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--p-blue)]" aria-hidden />
          <span className="text-sm font-medium">Loading activity…</span>
        </div>
      )}

      {!loading && displayRows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800/30">
          <CalendarRange className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" aria-hidden />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No activity matches your filters</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Try clearing the date range or check another page of results.
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          ) : null}
        </div>
      )}

      {!loading && displayRows.length > 0 && (
        <ol className="relative ms-1 space-y-3 border-s-2 border-gray-200/90 ps-6 dark:border-gray-600/80">
          {displayRows.map(({ raw, summary, href, when }) => {
            const m = when ? moment(when) : null;
            const exact = when ? formatDate(when, false, true) : "";
            const rel = m?.isValid() ? m.fromNow() : "";
            const clickable = Boolean(href);
            const isDeleted = raw?.metadata?.deletedEntity === true;

            return (
              <li key={raw._id} className="relative">
                <span className="absolute -start-[25px] top-3 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-[var(--p-blue)] shadow-sm ring-2 ring-[var(--p-blue)]/20 dark:border-gray-900" />
                <article
                  className={`group rounded-2xl border border-gray-100/90 bg-white/90 shadow-sm backdrop-blur-[2px] transition dark:border-gray-700 dark:bg-gray-800/60 ${
                    compact ? "px-3.5 py-3" : "px-4 py-3.5"
                  } ${
                    clickable
                      ? "cursor-pointer hover:border-[var(--p-blue)]/45 hover:shadow-md dark:hover:border-[var(--p-blue)]/50"
                      : ""
                  }`}
                  role={clickable ? "link" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => clickable && history.push(href)}
                  onKeyDown={(e) => {
                    if (!clickable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      history.push(href);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{summary}</p>
                    {clickable && (
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-[var(--p-blue)]" aria-hidden />
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{exact}</span>
                    {rel ? (
                      <>
                        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
                          ·
                        </span>
                        <span>{rel}</span>
                      </>
                    ) : null}
                    {raw.action ? (
                      <span
                        className={`ms-auto inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${actionTone(raw.action)}`}
                      >
                        {raw.action}
                      </span>
                    ) : null}
                  </div>
                  {isDeleted ? (
                    <p className="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                      This record was removed from the system; opening it is not available.
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}

      {hasPartyScope && (!loading || total > 0) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            padding: "16px 16px 0px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            <span>{t("common.show")}</span>
            <div style={{ position: "relative" }}>
              <select
                value={recordsPerPage}
                onChange={(e) => onRecordsPerPageChange(Number(e.target.value))}
                style={{
                  appearance: "none",
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "4px 12px 4px 8px",
                  paddingRight: "32px",
                  outline: "none",
                }}
              >
                {resolvedPageSizeOptions.map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
              <div
                style={{
                  pointerEvents: "none",
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: "8px",
                  display: "flex",
                  alignItems: "center",
                  color: "#4B5563",
                }}
              >
                ▼
              </div>
            </div>
            <span>
              {t("common.entries")} {total > 0 && `${t("common.of")} ${total}`}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "4px",
              fontWeight: "600",
              fontSize: "14px",
              padding: 0,
            }}
          >
            <button
              style={DATA_TABLE_NAV_BTN_STYLE}
              type="button"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              «
            </button>
            <button
              style={DATA_TABLE_NAV_BTN_STYLE}
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>

            {paginationWindow.pageNumbers.length > 0 ? (
              paginationWindow.pageNumbers.map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    backgroundColor: page === number ? "var(--p-blue)" : "white",
                    color: page === number ? "white" : "#000",
                    border: page === number ? "none" : "1px solid #e5e7eb",
                  }}
                >
                  {number}
                </button>
              ))
            ) : (
              <button
                type="button"
                disabled
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "white",
                  border: "none",
                }}
              >
                1
              </button>
            )}

            {totalPages > paginationWindow.endPage && (
              <>
                <span style={{ padding: "0 4px" }}>...</span>
                <button
                  type="button"
                  style={DATA_TABLE_NAV_BTN_STYLE}
                  onClick={() => setPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              style={DATA_TABLE_NAV_BTN_STYLE}
              disabled={page === totalPages || totalPages <= 1}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
            <button
              type="button"
              style={DATA_TABLE_NAV_BTN_STYLE}
              disabled={page === totalPages || totalPages <= 1}
              onClick={() => setPage(totalPages)}
            >
              »
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
