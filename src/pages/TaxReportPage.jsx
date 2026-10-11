import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import {
  FileSpreadsheet as ExcelIcon,
  Download,
  Loader,
  RefreshCw,
  CalendarRange,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import StandardPageHeader from "@/components/StandardPageHeader";
import { DropdownBasic, Loader as LoaderComponent } from "@/page-layouts/index";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";
import { AdminContext } from "@/context/AdminContext";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";
import { formatAmount } from "@/components/formatAmount";
import { roleHasPurchaseModuleAccess } from "@/utils/permissionUtils";
import CustomPagination from "@/components/CustomPagination";
import { notifyError, notifySuccess, notifyWarning } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Match AllReports default page size */
const SST_INVOICES_PAGE_SIZE = 10;

const DEFAULT_REPORT_META = {
  taxKind: "Tax",
  reportTitle: "Tax Report",
  reportSubtitle:
    "Bimonthly tax filing report with accurate invoice totals and tax breakdowns.",
  taxAmountColumnLabel: "Tax",
  taxOnSalesLabel: "Tax on sales",
  taxOnPurchasesLabel: "Tax on purchases",
  exportFilePrefix: "Tax_Report",
  pdfBandTitle: "Tax report",
  netTaxLabel: "Net tax",
};

function inferTaxKindFromFilter(taxCode, label = "") {
  const code = String(taxCode || "")
    .trim()
    .toUpperCase();
  if (!code) return "Tax";
  if (["ZERO", "0", "Z-R", "ZR", "EXV"].includes(code)) return "Tax";
  const text = `${label} ${code}`.toLowerCase();
  if (/\bgst\b/.test(text)) return "GST";
  if (/\bsst\b|service\s*tax|sales\s*tax|^sv\d|^sx-/.test(text)) return "SST";
  if (/\bvat\b/.test(text)) return "VAT";
  return "Tax";
}

function buildReportMetaFromKind(taxKind) {
  const k = taxKind && taxKind !== "Tax" ? taxKind : "Tax";
  const isGeneric = k === "Tax";
  const shortCap = isGeneric ? "Tax" : k;
  return {
    taxKind: k,
    reportTitle: isGeneric ? "Tax Report" : `${k} Tax Report`,
    reportSubtitle: `Bimonthly ${shortCap} filing report with accurate invoice totals and tax breakdowns.`,
    taxAmountColumnLabel: isGeneric ? "Tax" : `${k} / tax`,
    taxOnSalesLabel: isGeneric ? "Tax on sales" : `${k} on sales`,
    taxOnPurchasesLabel: isGeneric ? "Tax on purchases" : `${k} on purchases`,
    exportFilePrefix: isGeneric ? "Tax_Report" : `${k}_Report`,
    pdfBandTitle: isGeneric ? "Tax report" : `${k} / Tax report`,
    netTaxLabel: isGeneric ? "Net tax" : `Net ${k}`,
  };
}

function resolveActiveReportMeta(taxType, taxTypeChoices) {
  const code = String(taxType || "").trim();
  if (!code) return DEFAULT_REPORT_META;
  const choice = (taxTypeChoices || []).find(
    (t) => String(t.taxCode || "").toUpperCase() === code.toUpperCase(),
  );
  return buildReportMetaFromKind(
    inferTaxKindFromFilter(code, choice?.label || choice?.name || ""),
  );
}

const SCOPE_OPTIONS = {
  sales: {
    value: "sales",
    label: "Sales",
    hint: "",
  },
  purchase: {
    value: "purchase",
    label: "Purchases",
    hint: "Vendor invoices & credit/debit notes",
  },
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Matches backend TaxReports bimonthlyRange (UTC). */
function boundsForBimonth(year, periodIndex) {
  const pi = Math.max(0, Math.min(5, Number(periodIndex) || 0));
  const m0 = pi * 2;
  const start = new Date(Date.UTC(year, m0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, m0 + 2, 0, 23, 59, 59, 999));
  return { start, end, periodIndex: pi };
}

/** Filing due — last calendar day of the month following the 2-month block. */
function filingDueForBimonth(year, periodIndex) {
  const pi = Math.max(0, Math.min(5, Number(periodIndex) || 0));
  const m0 = pi * 2;
  return new Date(Date.UTC(year, m0 + 3, 0, 23, 59, 59, 999));
}

function toApiDateFromUtc(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDayMonYear(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTH_SHORT[d.getUTCMonth()] || "";
  const y = d.getUTCFullYear();
  return `${day} ${mon} ${y}`;
}

function buildTaxPeriodOptions(year) {
  const y = Number(year) || new Date().getUTCFullYear();
  return Array.from({ length: 6 }, (_, pi) => {
    const m0 = pi * 2;
    const label = `Period ${pi + 1}: ${MONTH_SHORT[m0]}–${MONTH_SHORT[m0 + 1]} ${y}`;
    const due = filingDueForBimonth(y, pi);
    const dueStr = due.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return {
      value: String(pi),
      label: `${label} (Due: ${dueStr})`,
    };
  });
}

const defaultTaxYearAndPeriod = () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const bimonthIndex = Math.floor(m / 2);
  return { taxYear: y, bimonthIndex: bimonthIndex };
};

const fmtMoney = (value) => formatAmount(Number(value) || 0);

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

function buildQueryParams(period, type, business, taxFilters = {}) {
  const params = {
    startDate: period.startIsoFull,
    endDate: period.endIsoFull,
    type: type === "purchase" ? "purchase" : "sales",
    ...taxFilters,
  };
  if (business) params.businessId = business;
  return params;
}

function detailQueryParams(period, business, taxFilters = {}) {
  return {
    businessId: business,
    startDate: period.startIsoFull,
    endDate: period.endIsoFull,
    grouped: "false",
    ...taxFilters,
  };
}

function streamForScope(type) {
  return type === "purchase" ? "purchases" : "sales";
}

function sanitizeExportFilenamePart(value, fallback = "Business") {
  const raw = String(value ?? "").trim() || fallback;
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (cleaned || fallback).slice(0, 64);
}

function buildTaxReportDownloadFilename({
  exportFilePrefix,
  scopeTag,
  businessName,
  startIso,
  endIso,
  extension,
}) {
  const prefix = sanitizeExportFilenamePart(
    exportFilePrefix || "Tax_Report",
    "Tax_Report",
  );
  const scope = sanitizeExportFilenamePart(scopeTag, "Report");
  const biz = sanitizeExportFilenamePart(businessName, "Business");
  const ext = String(extension || "pdf").replace(/^\./, "");
  return `${prefix}_${scope}_${biz}_${startIso}_${endIso}.${ext}`;
}

function parseFilenameFromDisposition(header) {
  if (!header || typeof header !== "string") return null;
  const utf8 = /filename\*=UTF-8''([^;\n]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const plain = /filename="?([^";\n]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}

async function blobErrorMessage(data) {
  if (!(data instanceof Blob)) return null;
  try {
    const text = await data.text();
    const json = JSON.parse(text);
    return json.error || json.message || null;
  } catch {
    return null;
  }
}

function triggerFileDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

const DOC_LABELS = {
  customer_invoice: "Customer invoice",
  customer_credit_note: "Customer credit note",
  customer_debit_note: "Customer debit note",
  vendor_invoice: "Vendor invoice",
  vendor_credit_note: "Vendor credit note",
  vendor_debit_note: "Vendor debit note",
};

function fmtDocLabel(t) {
  return DOC_LABELS[t] || t || "—";
}

/** Full tax text when API sends bare tax name or code only. */
function displayTaxLabel(row, taxKind = "Tax") {
  const kind = taxKind && taxKind !== "Tax" ? taxKind : "";
  const raw = String(row?.taxLabel || row?.taxCode || "").trim();
  const rate = Number(row?.taxRate);
  if (!raw) {
    if (rate > 0) return kind ? `${kind} ${rate}%` : `${rate}%`;
    return "—";
  }
  if (/%/.test(raw)) return raw;
  if (/^sst$/i.test(raw) && rate > 0) return `SST ${rate}%`;
  if (/^gst$/i.test(raw) && rate > 0) return `GST ${rate}%`;
  if (/^sv6$/i.test(raw)) return "SST 6%";
  if (/^sv8$/i.test(raw)) return "SST 8%";
  if (/^sv10$/i.test(raw)) return "SST 10%";
  const sx = /^sx-([\d.]+)$/i.exec(raw);
  if (sx) {
    const n = parseFloat(sx[1]);
    if (!Number.isNaN(n)) {
      return kind && kind !== "SST" ? `${kind} ${n}%` : `SST ${n}%`;
    }
  }
  if (rate > 0 && !/\d/.test(raw)) return `${raw} ${rate}%`;
  return raw;
}

function formatDocumentSummary(meta) {
  const summary = meta?.documentSummary;
  if (!summary) return null;
  const by = summary.byType || {};
  const parts = [];
  if (by.customer_invoice) {
    parts.push(
      `${by.customer_invoice} customer invoice${by.customer_invoice > 1 ? "s" : ""}`,
    );
  }
  if (by.customer_credit_note) {
    parts.push(
      `${by.customer_credit_note} credit note${by.customer_credit_note > 1 ? "s" : ""}`,
    );
  }
  if (by.customer_debit_note) {
    parts.push(
      `${by.customer_debit_note} debit note${by.customer_debit_note > 1 ? "s" : ""}`,
    );
  }
  if (by.vendor_invoice) {
    parts.push(
      `${by.vendor_invoice} vendor invoice${by.vendor_invoice > 1 ? "s" : ""}`,
    );
  }
  if (by.vendor_credit_note) {
    parts.push(
      `${by.vendor_credit_note} vendor credit note${by.vendor_credit_note > 1 ? "s" : ""}`,
    );
  }
  if (by.vendor_debit_note) {
    parts.push(
      `${by.vendor_debit_note} vendor debit note${by.vendor_debit_note > 1 ? "s" : ""}`,
    );
  }
  const docPart = parts.length
    ? parts.join(", ")
    : `${summary.totalDocuments || 0} documents`;
  const linePart = `${summary.lineCount ?? 0} line row${summary.lineCount === 1 ? "" : "s"}`;
  return `${docPart} · ${linePart}`;
}

function lineTaxTotal(r) {
  const v = r?.taxableAmount ?? r?.principal;
  return Number(v) || 0;
}

function sumMoneyColumns(rows) {
  return (rows || []).reduce(
    (acc, r) => ({
      taxableAmount: acc.taxableAmount + lineTaxTotal(r),
      sst: acc.sst + (Number(r.sst) || 0),
      gross: acc.gross + (Number(r.gross) || 0),
    }),
    { taxableAmount: 0, sst: 0, gross: 0 },
  );
}

function useTaxPeriod(taxYear, bimonthIndex) {
  return useMemo(() => {
    const y = Number(taxYear) || new Date().getUTCFullYear();
    const bi = Math.max(0, Math.min(5, Number(bimonthIndex) || 0));
    const { start, end } = boundsForBimonth(y, bi);
    const due = filingDueForBimonth(y, bi);
    const m0 = bi * 2;
    const periodLabel = `Period ${bi + 1}: ${MONTH_SHORT[m0]}–${MONTH_SHORT[m0 + 1]} ${y}`;
    return {
      taxYear: y,
      bimonthIndex: bi,
      start,
      end,
      /** YYYY-MM-DD for summary API (UTC day). */
      startIso: toApiDateFromUtc(start),
      endIso: toApiDateFromUtc(end),
      /** Full ISO for detail API (inclusive end-of-day). */
      startIsoFull: start.toISOString(),
      endIsoFull: end.toISOString(),
      due,
      periodLabel,
      rangeDisplay: `${formatDayMonYear(start)} – ${formatDayMonYear(end)}`,
    };
  }, [taxYear, bimonthIndex]);
}

const TaxReportPage = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const token = adminInfo?.token;
  const adminId = adminInfo?.id || adminInfo?._id;
  const { isSingleBusiness, singleBusinessId, businesses: assignedBusinesses } =
    useSingleBusinessMode();

  const def = useMemo(() => defaultTaxYearAndPeriod(), []);
  const hasPurchaseAccess = useMemo(
    () => roleHasPurchaseModuleAccess(adminInfo?.role?.modules),
    [adminInfo?.role?.modules],
  );
  const scopeOptions = useMemo(() => {
    const opts = [SCOPE_OPTIONS.sales];
    if (hasPurchaseAccess) opts.push(SCOPE_OPTIONS.purchase);
    return opts;
  }, [hasPurchaseAccess]);

  const [filters, setFilters] = useState({
    business: "",
    type: "sales",
    taxYear: def.taxYear,
    bimonthIndex: def.bimonthIndex,
    taxType: "",
  });

  const period = useTaxPeriod(filters.taxYear, filters.bimonthIndex);

  const yearOptions = useMemo(() => {
    const cy = new Date().getUTCFullYear();
    return Array.from({ length: 7 }, (_, i) => {
      const y = cy - 3 + i;
      return { value: String(y), label: String(y) };
    });
  }, []);

  const taxPeriodOptions = useMemo(
    () => buildTaxPeriodOptions(period.taxYear),
    [period.taxYear],
  );

  const [salesDetail, setSalesDetail] = useState(null);
  const [purchaseDetail, setPurchaseDetail] = useState(null);
  const [taxTypeChoices, setTaxTypeChoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(null);
  const [businessLoading, setBusinessLoading] = useState(Boolean(adminId));
  const [reportDataReady, setReportDataReady] = useState(false);
  const [businessNamesById, setBusinessNamesById] = useState({});

  const authHeaders = useMemo(
    () => (token ? { authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const taxQueryForApi = useMemo(
    () => ({
      taxType: String(filters.taxType || "").trim(),
    }),
    [filters.taxType],
  );

  useEffect(() => {
    setBusinessLoading(Boolean(adminId));
  }, [adminId]);

  useEffect(() => {
    if (!isSingleBusiness || !singleBusinessId) return;
    setBusinessLoading(false);
    setFilters((prev) =>
      prev.business ? prev : { ...prev, business: singleBusinessId },
    );
    const map = {};
    (assignedBusinesses || []).forEach((b) => {
      if (b?._id) map[String(b._id)] = b.name || "";
    });
    setBusinessNamesById(map);
  }, [isSingleBusiness, singleBusinessId, assignedBusinesses]);

  const handleAssignedLoadComplete = useCallback((businesses) => {
    setBusinessLoading(false);
    const map = {};
    (businesses || []).forEach((b) => {
      if (b?._id) map[String(b._id)] = b.name || "";
    });
    setBusinessNamesById(map);
  }, []);

  const taxTypeDropdownOptions = useMemo(
    () => [
      { value: "", label: "All tax types" },
      ...(taxTypeChoices || []).map((t) => ({
        value: t.taxCode,
        label:
          formatTaxTypeChip(t.label || t.taxCode, t.rate) ||
          t.label ||
          t.taxCode,
      })),
    ],
    [taxTypeChoices],
  );

  const activeReportMeta = useMemo(
    () => resolveActiveReportMeta(filters.taxType, taxTypeChoices),
    [filters.taxType, taxTypeChoices],
  );

  const loadTaxReportBundle = useCallback(async () => {
    if (!filters.business || businessLoading) return;

    const scope = filters.type === "purchase" ? "purchase" : "sales";
    const stream = streamForScope(scope);

    setLoading(true);
    try {
      const qDetail = detailQueryParams(
        period,
        filters.business,
        taxQueryForApi,
      );
      const [filterRes, detailRes] = await Promise.all([
        axios.get(`${Base_URL}/tax-reports/filter-options`, {
          params: { businessId: filters.business },
          headers: authHeaders,
        }),
        axios.get(`${Base_URL}/tax-reports/detail`, {
          params: { ...qDetail, stream },
          headers: authHeaders,
        }),
      ]);
      setTaxTypeChoices(filterRes.data?.taxTypes || []);
      if (scope === "purchase") {
        setPurchaseDetail(detailRes.data || null);
      } else {
        setSalesDetail(detailRes.data || null);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to load tax report";
      notifyError(msg);
      setTaxTypeChoices([]);
      setSalesDetail(null);
      setPurchaseDetail(null);
    } finally {
      setLoading(false);
      setReportDataReady(true);
    }
  }, [
    filters.business,
    filters.type,
    period,
    authHeaders,
    taxQueryForApi,
    businessLoading,
  ]);

  const handleAssignedBusinesses = useCallback((businessIds) => {
    const ids = businessIds || [];
    if (!ids.length) return;
    setReportDataReady(false);
    setFilters((prev) => {
      if (prev.business) return prev;
      return { ...prev, business: ids[0] };
    });
  }, []);

  const handleExport = useCallback(
    async (kind) => {
      if (!filters.business) {
        notifyWarning("Select a business to export.");
        return;
      }

      const path = kind === "pdf" ? "export/pdf" : "export/excel";
      const ext = kind === "pdf" ? "pdf" : "xlsx";
      const mimeType =
        kind === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      setExportLoading(kind);
      try {
        const params = buildQueryParams(
          period,
          filters.type,
          filters.business,
          taxQueryForApi,
        );
        const response = await axios.get(`${Base_URL}/tax-reports/${path}`, {
          params,
          headers: authHeaders,
          responseType: "blob",
          timeout: 120000,
        });

        const contentType = response.headers?.["content-type"] || "";
        if (contentType.includes("application/json")) {
          const apiMsg = await blobErrorMessage(response.data);
          throw new Error(apiMsg || "Export failed");
        }

        const scopeTag = filters.type === "purchase" ? "Purchases" : "Sales";
        const businessName =
          businessNamesById[String(filters.business)] || "";
        const defaultFilename = buildTaxReportDownloadFilename({
          exportFilePrefix: activeReportMeta.exportFilePrefix,
          scopeTag,
          businessName,
          startIso: period.startIso,
          endIso: period.endIso,
          extension: ext,
        });
        const filename =
          parseFilenameFromDisposition(
            response.headers?.["content-disposition"],
          ) || defaultFilename;

        const blob = new Blob([response.data], { type: mimeType });
        triggerFileDownload(blob, filename);

        notifySuccess(
          kind === "pdf"
            ? "PDF downloaded successfully!"
            : "Excel export downloaded successfully!",
        );
      } catch (err) {
        const blobMsg = await blobErrorMessage(err.response?.data);
        const msg =
          blobMsg ||
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          `Failed to export ${ext.toUpperCase()}`;
        notifyError(msg);
      } finally {
        setExportLoading(null);
      }
    },
    [
      filters.business,
      filters.type,
      period,
      authHeaders,
      taxQueryForApi,
      activeReportMeta.exportFilePrefix,
      businessNamesById,
    ],
  );

  useEffect(() => {
    if (!hasPurchaseAccess && filters.type === "purchase") {
      setFilters((prev) => ({ ...prev, type: "sales" }));
    }
  }, [hasPurchaseAccess, filters.type]);

  useEffect(() => {
    if (!filters.business) {
      setReportDataReady(false);
      return undefined;
    }
    if (businessLoading) return undefined;
    loadTaxReportBundle();
    return undefined;
  }, [
    loadTaxReportBundle,
    businessLoading,
    filters.business,
    filters.type,
    period.startIsoFull,
    period.endIsoFull,
    taxQueryForApi,
  ]);

  const hasReportData = Boolean(salesDetail || purchaseDetail);
  const belowFiltersBusy =
    businessLoading ||
    (Boolean(filters.business) && !reportDataReady && !hasReportData);
  const isSalesScope = filters.type !== "purchase";
  const activeDetail = isSalesScope ? salesDetail : purchaseDetail;
  const activeTotals = activeDetail?.grandTotals;
  const scopeMeta = isSalesScope ? SCOPE_OPTIONS.sales : SCOPE_OPTIONS.purchase;

  return (
    <div className="p-6 bg-gray-50 w-full min-w-0 max-w-full">
      <div className="w-full max-w-full mx-auto min-w-0 space-y-5 pb-12">
        <StandardPageHeader
          title={activeReportMeta.reportTitle}
          subtitle={activeReportMeta.reportSubtitle}
          actions={
            <>
              <button
                type="button"
                onClick={() => handleExport("excel")}
                disabled={exportLoading || !filters.business}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                title="Export to Excel"
              >
                {exportLoading === "excel" ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <ExcelIcon size={18} />
                    Export
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={exportLoading || !filters.business}
                className="flex items-center gap-2 px-4 py-3 bg-[#0C2E5A] hover:bg-[var(--p-blue-dark)] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                title="Download PDF"
              >
                {exportLoading === "pdf" ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download PDF
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => loadTaxReportBundle()}
                disabled={belowFiltersBusy || !filters.business}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-800 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
                Refresh
              </button>
            </>
          }
        />

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            {!isSingleBusiness && (
            <div className="min-w-[180px] flex-1 sm:flex-none sm:max-w-[240px]">
              <FilterField label="Business">
                <BusinessDropdown
                  adminId={adminId}
                  selectedBusiness={filters.business}
                  placeholder="Business"
                  isClearable={false}
                  setAssignedBusinesses={handleAssignedBusinesses}
                  onAssignedLoadComplete={handleAssignedLoadComplete}
                  onChange={(business) => {
                    setReportDataReady(false);
                    setFilters((prev) => ({
                      ...prev,
                      business: business || "",
                    }));
                  }}
                />
              </FilterField>
            </div>
            )}
            <div className="min-w-[160px] w-[180px] sm:min-w-[180px] sm:w-[200px]">
              <FilterField label="Year">
                <DropdownBasic
                  options={yearOptions}
                  value={String(filters.taxYear)}
                  onChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      taxYear: Number(v) || prev.taxYear,
                    }))
                  }
                  placeholder="Year"
                />
              </FilterField>
            </div>
            <div className="min-w-[280px] flex-1 sm:max-w-[420px]">
              <FilterField label="Tax period">
                <DropdownBasic
                  options={taxPeriodOptions}
                  value={String(filters.bimonthIndex)}
                  onChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      bimonthIndex: Number(v) || 0,
                    }))
                  }
                  placeholder="Select period"
                />
              </FilterField>
            </div>
            <div className="min-w-[200px] w-[230px] sm:min-w-[200px] sm:w-[260px]">
              <FilterField label="Tax type">
                <DropdownBasic
                  options={taxTypeDropdownOptions}
                  value={filters.taxType || ""}
                  onChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      taxType: value || "",
                    }))
                  }
                  placeholder="Tax type"
                  disabled={!filters.business}
                />
              </FilterField>
            </div>
            <div className="min-w-[200px] w-[220px] sm:min-w-[220px] sm:w-[280px]">
              <FilterField label="Report scope">
                {scopeOptions.length > 1 ? (
                  <DropdownBasic
                    options={scopeOptions.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    value={filters.type}
                    onChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        type: value === "purchase" ? "purchase" : "sales",
                      }))
                    }
                    placeholder="Report scope"
                  />
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                    {SCOPE_OPTIONS.sales.label}
                  </div>
                )}
              </FilterField>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {scopeMeta.hint}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 border border-slate-200/80">
              <CalendarRange
                className="w-5 h-5 text-slate-500 shrink-0"
                aria-hidden
              />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Computed window
                </div>
                <div className="text-sm font-medium text-slate-800 tabular-nums">
                  <span className="text-slate-500 font-normal mr-2">
                    CUSTOM:
                  </span>
                  {period.rangeDisplay.replace(" – ", " - ")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {belowFiltersBusy ? (
          <div className="flex justify-center py-20">
            <LoaderComponent />
          </div>
        ) : !filters.business ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 text-sm shadow-sm">
            Select a business to generate the tax report for the chosen tax
            period.
          </div>
        ) : (
          <div className="space-y-6 min-w-0">
            <PeriodTotalsKpi
              scopeLabel={scopeMeta.label}
              scopeHint={scopeMeta.hint}
              totals={activeTotals}
              isSales={isSalesScope}
              reportMeta={activeReportMeta}
            />

            <SstDetailPanel
              title={
                isSalesScope
                  ? "Sales — invoices & notes"
                  : "Purchases — invoices & notes"
              }
              meta={activeDetail?.meta}
              summaryByTaxCode={activeDetail?.summaryByTaxCode}
              invoices={activeDetail?.invoices}
              lines={activeDetail?.lines}
              variant={isSalesScope ? "sales" : "purchases"}
              reportMeta={activeReportMeta}
            />
          </div>
        )}
      </div>
    </div>
  );
};

function FilterField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function PeriodTotalsKpi({
  scopeLabel,
  scopeHint,
  totals,
  isSales,
  reportMeta,
}) {
  const meta = reportMeta || DEFAULT_REPORT_META;
  const prefix = isSales ? "Sales" : "Purchases";
  const taxCol = meta.taxAmountColumnLabel || "Tax";
  const taxOnScope = isSales ? meta.taxOnSalesLabel : meta.taxOnPurchasesLabel;
  const cards = [
    {
      label: `${prefix} — taxable amount`,
      sub: "Sum of line taxable amounts",
      value: fmtMoney(totals?.taxableAmount ?? totals?.principal ?? 0),
      tone: "slate",
    },
    {
      label: taxOnScope,
      sub: `Sum of line ${taxCol}`,
      value: fmtMoney(totals?.sst ?? 0),
      tone: "brand",
    },
    {
      label: `${prefix} — gross`,
      sub: `Taxable amount + ${meta.taxKind === "Tax" ? "tax" : meta.taxKind}`,
      value: fmtMoney(totals?.gross ?? 0),
      tone: "slate",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/80 p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/50">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Period totals
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            {scopeHint}. Figures are from invoice and credit/debit note lines
            only (no sales orders).
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#10468D]/10 text-[#10468D] px-3 py-1 text-xs font-bold uppercase tracking-wide">
          {scopeLabel}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-5 shadow-sm ${
              c.tone === "brand"
                ? "border-[#10468D]/30 bg-[#10468D]/[0.07] ring-1 ring-[#10468D]/15"
                : "border-slate-200/90 bg-white"
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{c.sub}</div>
            <div
              className={`mt-3 tabular-nums tracking-tight font-bold ${
                c.tone === "brand"
                  ? "text-2xl text-[#10468D]"
                  : "text-2xl text-slate-900"
              }`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-md shadow-slate-200/40 overflow-hidden min-w-0 ring-1 ring-slate-200/40">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {action || null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function SimpleTable({ headers, rows, rowKey, renderRow, footerTotals }) {
  if (!rows?.length) {
    return (
      <div className="py-8 text-center text-slate-400 text-sm rounded-xl bg-slate-50 border border-dashed border-slate-200">
        No data found.
      </div>
    );
  }

  const labelColSpan = Math.max(1, headers.length - 3);

  return (
    <div className="overflow-x-auto max-w-full -mx-1 px-1">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
            {headers.map((header) => (
              <th
                key={header}
                className={`px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide ${
                  header === "Taxable Amount" ||
                  header === "Gross" ||
                  (header !== "Tax" && /tax/i.test(header))
                    ? "text-right"
                    : "text-left"
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-t border-slate-100 hover:bg-sky-50/40"
            >
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
        {footerTotals ? (
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-bold">
              <td
                colSpan={labelColSpan}
                className="px-4 py-2.5 text-sm text-slate-800 uppercase tracking-wide"
              >
                Total
              </td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-900">
                {fmtMoney(footerTotals.taxableAmount ?? footerTotals.principal)}
              </td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-900">
                {fmtMoney(footerTotals.sst)}
              </td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-900">
                {fmtMoney(footerTotals.gross)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function formatTaxTypeChip(label, taxRate) {
  const s = String(label || "").trim();
  if (!s) return "";
  if (/%/.test(s)) return s;
  if (/^zero/i.test(s) || /^z-r$/i.test(s)) return "Zero-rated (0%)";
  if (/^exv$/i.test(s)) return "Exempt supply";
  if (/^sv6$/i.test(s)) return "SST 6%";
  if (/^sv8$/i.test(s)) return "SST 8%";
  if (/^sv10$/i.test(s)) return "SST 10%";
  const sx = /^sx-([\d.]+)$/i.exec(s);
  if (sx) {
    const n = parseFloat(sx[1]);
    if (!Number.isNaN(n)) return `SST ${n}%`;
  }
  const rate = Number(taxRate);
  if (/^sst$/i.test(s)) return rate > 0 ? `SST ${rate}%` : "SST";
  if (/^gst$/i.test(s)) return rate > 0 ? `GST ${rate}%` : "GST";
  if (rate > 0 && !/\d/.test(s)) return `${s} ${rate}%`;
  return s;
}

function invoiceTaxLabel(row) {
  const fromTypes = (row?.taxTypes || [])
    .map((t) =>
      formatTaxTypeChip(
        t,
        row?.items?.find((it) => Number(it.taxRate) > 0)?.taxRate,
      ),
    )
    .filter(Boolean);
  if (fromTypes.length) return [...new Set(fromTypes)].join(", ");
  if (row?.items?.length) {
    const fromItems = [
      ...new Set(
        row.items
          .map((item) => formatTaxTypeChip(item.taxType, item.taxRate))
          .filter(Boolean),
      ),
    ];
    if (fromItems.length) return fromItems.join(", ");
  }
  return "—";
}

function sortIcon(sort, key) {
  if (sort.key !== key) return "↕";
  return sort.direction === "asc" ? "↑" : "↓";
}

function SortableHeader({ label, sortKey, sort, onSort, align = "left" }) {
  return (
    <th
      className={`px-3 py-2.5 text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${
          align === "right" ? "justify-end w-full" : ""
        }`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="text-slate-400">{sortIcon(sort, sortKey)}</span>
      </button>
    </th>
  );
}

function InvoiceRowsTable({ invoices, variant, reportMeta }) {
  const labels = reportMeta || DEFAULT_REPORT_META;
  const [expanded, setExpanded] = useState({});
  const [filters, setFilters] = useState({
    invoiceNo: "",
    party: "",
    taxType: "",
  });
  const [sort, setSort] = useState({ key: "date", direction: "asc" });
  const [invoicePage, setInvoicePage] = useState(1);
  const partyLabel = variant === "sales" ? "Customer" : "Vendor";
  const taxColumnLabel =
    labels.taxAmountColumnLabel === "Tax"
      ? "Tax"
      : labels.taxAmountColumnLabel?.split("/")[0]?.trim() || "Tax";

  const onSort = useCallback((key) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const filteredInvoices = useMemo(() => {
    const needleInvoice = filters.invoiceNo.trim().toLowerCase();
    const needleParty = filters.party.trim().toLowerCase();
    const needleTax = filters.taxType.trim().toLowerCase();

    const rows = (invoices || []).filter((row) => {
      const partyName =
        variant === "sales"
          ? row.customer || row.party?.name
          : row.vendor || row.party?.name;
      const taxText = invoiceTaxLabel(row);
      return (
        (!needleInvoice ||
          String(row.invoiceNo || row.documentNo || "")
            .toLowerCase()
            .includes(needleInvoice)) &&
        (!needleParty ||
          String(partyName || "")
            .toLowerCase()
            .includes(needleParty)) &&
        (!needleTax || taxText.toLowerCase().includes(needleTax))
      );
    });

    const dir = sort.direction === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const partyA =
        variant === "sales"
          ? a.customer || a.party?.name
          : a.vendor || a.party?.name;
      const partyB =
        variant === "sales"
          ? b.customer || b.party?.name
          : b.vendor || b.party?.name;
      const values = {
        invoiceNo: [
          String(a.invoiceNo || a.documentNo || ""),
          String(b.invoiceNo || b.documentNo || ""),
        ],
        documentType: [
          fmtDocLabel(a.documentType),
          fmtDocLabel(b.documentType),
        ],
        party: [String(partyA || ""), String(partyB || "")],
        taxType: [invoiceTaxLabel(a), invoiceTaxLabel(b)],
        date: [
          new Date(a.date || a.postedAt || 0),
          new Date(b.date || b.postedAt || 0),
        ],
        subtotal: [Number(a.subtotal) || 0, Number(b.subtotal) || 0],
        totalTax: [Number(a.totalTax) || 0, Number(b.totalTax) || 0],
        grandTotal: [Number(a.grandTotal) || 0, Number(b.grandTotal) || 0],
      };
      const [av, bv] = values[sort.key] || values.date;
      if (av instanceof Date && bv instanceof Date) {
        return (av.getTime() - bv.getTime()) * dir;
      }
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filters, invoices, sort, variant]);

  const totalFiltered = filteredInvoices.length;
  const invoiceTotalPages = Math.max(
    1,
    Math.ceil(totalFiltered / SST_INVOICES_PAGE_SIZE) || 1,
  );

  useEffect(() => {
    setInvoicePage(1);
  }, [invoices, variant, filters.invoiceNo, filters.party, filters.taxType]);

  useEffect(() => {
    if (invoicePage > invoiceTotalPages) setInvoicePage(invoiceTotalPages);
  }, [invoicePage, invoiceTotalPages]);

  const safeInvoicePage = Math.min(Math.max(1, invoicePage), invoiceTotalPages);
  const invoiceOffset =
    Math.max(0, safeInvoicePage - 1) * SST_INVOICES_PAGE_SIZE;
  const paginatedInvoices = filteredInvoices.slice(
    invoiceOffset,
    invoiceOffset + SST_INVOICES_PAGE_SIZE,
  );

  const totals = useMemo(
    () =>
      filteredInvoices.reduce(
        (acc, row) => ({
          subtotal: acc.subtotal + (Number(row.subtotal) || 0),
          totalTax: acc.totalTax + (Number(row.totalTax) || 0),
          grandTotal: acc.grandTotal + (Number(row.grandTotal) || 0),
        }),
        { subtotal: 0, totalTax: 0, grandTotal: 0 },
      ),
    [filteredInvoices],
  );

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={filters.invoiceNo}
          onChange={(e) => setFilter("invoiceNo", e.target.value)}
          placeholder="Filter DOC #"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10468D]/20"
        />
        <input
          type="text"
          value={filters.party}
          onChange={(e) => setFilter("party", e.target.value)}
          placeholder={`Filter ${partyLabel.toLowerCase()}`}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10468D]/20"
        />
        <input
          type="text"
          value={filters.taxType}
          onChange={(e) => setFilter("taxType", e.target.value)}
          placeholder="Filter tax type"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10468D]/20"
        />
      </div>

      <div className="overflow-x-auto max-w-full rounded-xl border border-slate-100">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
              <th className="w-10 px-3 py-2.5" />
              <SortableHeader
                label="DOC #"
                sortKey="invoiceNo"
                sort={sort}
                onSort={onSort}
              />
              <SortableHeader
                label="Doc type"
                sortKey="documentType"
                sort={sort}
                onSort={onSort}
              />
              <SortableHeader
                label="Date"
                sortKey="date"
                sort={sort}
                onSort={onSort}
              />
              <SortableHeader
                label={partyLabel}
                sortKey="party"
                sort={sort}
                onSort={onSort}
              />
              <SortableHeader
                label="Tax Type"
                sortKey="taxType"
                sort={sort}
                onSort={onSort}
              />
              <SortableHeader
                label="Subtotal"
                sortKey="subtotal"
                sort={sort}
                onSort={onSort}
                align="right"
              />
              <SortableHeader
                label={taxColumnLabel}
                sortKey="totalTax"
                sort={sort}
                onSort={onSort}
                align="right"
              />
              <SortableHeader
                label="Grand Total"
                sortKey="grandTotal"
                sort={sort}
                onSort={onSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.map((row, idx) => {
              const rowKey = `${String(row.documentId || row.invoiceNo)}-${invoiceOffset + idx}`;
              const isExpanded = Boolean(expanded[rowKey]);
              const partyName =
                variant === "sales"
                  ? row.customer || row.party?.name
                  : row.vendor || row.party?.name;
              return (
                <React.Fragment key={rowKey}>
                  <tr className="border-t border-slate-100 hover:bg-sky-50/30">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [rowKey]: !prev[rowKey],
                          }))
                        }
                        className="rounded-md p-1 hover:bg-slate-100 text-slate-600"
                        aria-label={
                          isExpanded ? "Collapse invoice" : "Expand invoice"
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">
                      {row.invoiceNo || row.documentNo || "—"}
                    </td>
                    <td className="px-3 py-2 min-w-[120px] max-w-[200px] text-slate-700 leading-snug">
                      {fmtDocLabel(row.documentType)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDate(row.date || row.postedAt)}
                    </td>
                    <td className="px-3 py-2 min-w-[140px] max-w-[240px] break-words">
                      {partyName || "—"}
                    </td>
                    <td className="px-3 py-2 min-w-[120px] max-w-[220px] text-slate-700 leading-snug">
                      {invoiceTaxLabel(row)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmtMoney(row.subtotal)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-[#10468D]">
                      {fmtMoney(row.totalTax)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                      {fmtMoney(row.grandTotal)}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-slate-50/80">
                      <td colSpan={9} className="px-4 py-4">
                        <InvoiceItemsTable items={row.items || []} />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-bold">
              <td
                colSpan={6}
                className="px-3 py-2.5 text-sm text-slate-800 uppercase tracking-wide"
              >
                Total
              </td>
              <td className="px-3 py-2.5 text-sm text-right tabular-nums text-slate-900">
                {fmtMoney(totals.subtotal)}
              </td>
              <td className="px-3 py-2.5 text-sm text-right tabular-nums text-[#10468D]">
                {fmtMoney(totals.totalTax)}
              </td>
              <td className="px-3 py-2.5 text-sm text-right tabular-nums text-slate-900">
                {fmtMoney(totals.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {totalFiltered > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 py-2 text-sm text-slate-600">
          <span className="tabular-nums">
            Showing {invoiceOffset + 1}–
            {Math.min(invoiceOffset + SST_INVOICES_PAGE_SIZE, totalFiltered)} of{" "}
            {totalFiltered} invoice rows ({SST_INVOICES_PAGE_SIZE} per page)
          </span>
          <CustomPagination
            totalResults={totalFiltered}
            resultsPerPage={SST_INVOICES_PAGE_SIZE}
            currentPage={safeInvoicePage}
            onChange={setInvoicePage}
          />
        </div>
      ) : null}
      {!filteredInvoices.length ? (
        <div className="py-6 text-center text-slate-400 text-sm rounded-xl bg-slate-50 border border-dashed border-slate-200">
          No invoice rows match the current filters.
        </div>
      ) : null}
    </div>
  );
}

function InvoiceItemsTable({ items }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            {[
              "Item",
              "Description",
              "Qty",
              "Rate",
              "Discount",
              "Tax Type",
              "Tax %",
              "Tax Amount",
              "Line Total",
            ].map((h) => (
              <th
                key={h}
                className={`px-3 py-2 font-bold uppercase text-slate-600 ${
                  [
                    "Qty",
                    "Rate",
                    "Discount",
                    "Tax %",
                    "Tax Amount",
                    "Line Total",
                  ].includes(h)
                    ? "text-right"
                    : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={`${item.itemName || "item"}-${idx}`}
              className="border-t border-slate-100"
            >
              <td className="px-3 py-2 font-medium text-slate-800">
                {item.itemName || "—"}
              </td>
              <td className="px-3 py-2 text-slate-600 max-w-[240px] break-words">
                {item.description || "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(item.qty) || 0}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtMoney(item.rate)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtMoney(item.discount)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatTaxTypeChip(item.taxType, item.taxRate) || "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(item.taxRate) || 0}%
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#10468D]">
                {fmtMoney(item.taxAmount)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {fmtMoney(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SstDetailPanel({
  title,
  meta,
  summaryByTaxCode,
  invoices,
  lines,
  variant,
  reportMeta,
}) {
  const labels = reportMeta || DEFAULT_REPORT_META;
  const summaryText = formatDocumentSummary(meta);
  const dedupe = meta?.dedupe;
  const mergedDupes =
    (dedupe?.duplicateInvoicesMerged || 0) +
    (dedupe?.duplicateCreditNotesMerged || 0) +
    (dedupe?.duplicateDebitNotesMerged || 0);
  const hasRows =
    (Array.isArray(invoices) && invoices.length > 0) ||
    (Array.isArray(lines) && lines.length > 0);
  const taxHeaders = [
    "Tax",
    "Taxable Amount",
    labels.taxAmountColumnLabel || "Tax",
    "Gross",
  ];
  const summaryTotals = useMemo(
    () => sumMoneyColumns(summaryByTaxCode),
    [summaryByTaxCode],
  );

  return (
    <SectionCard title={title}>
      {mergedDupes > 0 ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {mergedDupes} duplicate document record
          {mergedDupes > 1 ? "s were" : " was"} merged in this report (same DOC#
          in the database). Totals use the latest dated copy.
        </p>
      ) : null}

      {!hasRows ? (
        <div className="py-8 text-center text-slate-400 text-sm rounded-xl bg-slate-50 border border-dashed border-slate-200">
          No {labels.taxKind === "Tax" ? "tax" : labels.taxKind} line rows for
          this tax period (or documents are draft / outside scope).
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
              By tax code
            </h4>
            <SimpleTable
              headers={taxHeaders}
              rows={summaryByTaxCode || []}
              footerTotals={summaryTotals}
              rowKey={(row) => `${row.taxCode}-${lineTaxTotal(row)}-${row.sst}`}
              renderRow={(row) => (
                <>
                  <td className="px-4 py-2 text-sm">
                    {displayTaxLabel(row, labels.taxKind)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right tabular-nums">
                    {fmtMoney(lineTaxTotal(row))}
                  </td>
                  <td className="px-4 py-2 text-sm text-right tabular-nums">
                    {fmtMoney(row.sst)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right tabular-nums">
                    {fmtMoney(row.gross)}
                  </td>
                </>
              )}
            />
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
              Invoice breakdown
            </h4>
            <InvoiceRowsTable
              invoices={invoices || []}
              variant={variant}
              reportMeta={labels}
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export default TaxReportPage;
