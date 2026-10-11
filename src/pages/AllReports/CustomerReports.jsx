import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Calculator,
  CreditCard,
  FileSpreadsheet as ExcelIcon,
  FileText,
  Loader,
  Package,
  Percent,
  RefreshCw,
  Search,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Eye,
} from "lucide-react";
import StandardPageHeader from "@/components/StandardPageHeader";
import {
  DataTable,
  DateRangeComponent,
  DropdownBasic,
  Loader as LoaderComponent,
  CustomModal,
} from "@/page-layouts/index";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";
import { AdminContext } from "@/context/AdminContext";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";
import { useSalesReportModuleTabAccess } from "@/utils/permissionUtils";
import { formatAmount } from "@/components/formatAmount";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const BRAND = "#0C2E5A";
const ACCENT = "#1d9e6b";
const BLUE = "#6366F1";

/** Smooth splines like Daily Report Cash Flow Overview (recharts). */
const TREND_CURVE = "natural";

/** Default trend bucket: weekly (day-based ISO weeks). */
const DEFAULT_TREND_GRANULARITY = "week";

/** Tailwind accent bundles for KPI / dock cards (one distinct palette per card, no repeats in overview) */
const KPI_ACCENTS = [
  {
    border: "border-l-orange-500",
    bg: "bg-gradient-to-br from-orange-50/80 via-orange-50/30 to-white",
    iconBg: "bg-orange-100 text-orange-700",
    label: "text-orange-900/70",
  },
  {
    border: "border-l-emerald-500",
    bg: "bg-gradient-to-br from-emerald-50/80 via-emerald-50/30 to-white",
    iconBg: "bg-emerald-100 text-emerald-700",
    label: "text-emerald-900/70",
  },
  {
    border: "border-l-violet-500",
    bg: "bg-gradient-to-br from-violet-50/80 via-violet-50/30 to-white",
    iconBg: "bg-violet-100 text-violet-700",
    label: "text-violet-900/70",
  },
  {
    border: "border-l-sky-500",
    bg: "bg-gradient-to-br from-sky-50/80 via-sky-50/30 to-white",
    iconBg: "bg-sky-100 text-sky-700",
    label: "text-sky-900/70",
  },
  {
    border: "border-l-rose-500",
    bg: "bg-gradient-to-br from-rose-50/80 via-rose-50/30 to-white",
    iconBg: "bg-rose-100 text-rose-700",
    label: "text-rose-900/70",
  },
  {
    border: "border-l-amber-500",
    bg: "bg-gradient-to-br from-amber-50/80 via-amber-50/30 to-white",
    iconBg: "bg-amber-100 text-amber-700",
    label: "text-amber-900/70",
  },
  {
    border: "border-l-indigo-500",
    bg: "bg-gradient-to-br from-indigo-50/80 via-indigo-50/30 to-white",
    iconBg: "bg-indigo-100 text-indigo-700",
    label: "text-indigo-900/70",
  },
  {
    border: "border-l-teal-500",
    bg: "bg-gradient-to-br from-teal-50/80 via-teal-50/30 to-white",
    iconBg: "bg-teal-100 text-teal-700",
    label: "text-teal-900/70",
  },
];

const DEFAULT_PAGE_SIZE = 10;

function buildAnalyticsSearchParams(filters, grain, topN) {
  const q = new URLSearchParams({
    business: filters.business,
    grain,
    topN: String(topN),
  });
  if (filters.startDate) q.append("startDate", filters.startDate);
  if (filters.endDate) q.append("endDate", filters.endDate);
  if (filters.customer) q.append("customer", filters.customer);
  if (filters.salesperson) q.append("salesperson", filters.salesperson);
  if (filters.item) q.append("item", filters.item);
  return q;
}

/** API filters: full analytics in one request (dimensional filters applied in the UI only) */
function buildBaseAnalyticsFilters(filtersState) {
  return {
    business: filtersState.business,
    startDate: filtersState.startDate,
    endDate: filtersState.endDate,
    customer: "",
    salesperson: "",
    item: "",
  };
}

/** Narrow lists/charts for Customers / Sales Persons / Items tabs without refetching */
function analyticsViewForTab(data, activeTab, tabFilters) {
  if (!data) return null;
  if (activeTab === "customers" && tabFilters.customers.customer) {
    const cid = String(tabFilters.customers.customer);
    const topCustomers = (data.topCustomers || []).filter(
      (c) => String(c.customerId) === cid,
    );
    const customerPerformanceReport = (
      data.customerPerformanceReport || []
    ).filter((c) => String(c.customerId) === cid);
    const names = new Set(topCustomers.map((c) => c.customerName));
    return {
      ...data,
      topCustomers,
      customerPerformanceReport,
      customerPareto: (data.customerPareto || []).filter((p) =>
        names.has(p.name),
      ),
    };
  }
  if (activeTab === "salespersons" && tabFilters.salespersons.salesperson) {
    const sid = String(tabFilters.salespersons.salesperson);
    const bySalesPerson = (data.bySalesPerson || []).filter(
      (r) => String(r.salespersonId ?? "") === sid,
    );
    const salespersonCommissionReport = (
      data.salespersonCommissionReport || []
    ).filter((r) => String(r.salespersonId ?? "") === sid);
    return {
      ...data,
      bySalesPerson,
      salespersonCommissionReport,
    };
  }
  if (activeTab === "items" && tabFilters.items.item) {
    const iid = String(tabFilters.items.item);
    return {
      ...data,
      topItems: (data.topItems || []).filter((r) => String(r.itemKey) === iid),
    };
  }
  return data;
}

function safeSheetName(name) {
  return String(name || "Sheet")
    .slice(0, 31)
    .replace(/[*?:\\/[\]]/g, "_");
}

function setSheetColumns(ws, rows) {
  const first = rows?.[0] || {};
  const keys = Array.isArray(first) ? first.map((_, i) => i) : Object.keys(first);
  ws["!cols"] = keys.map((key) => {
    const values = (rows || []).map((row) =>
      Array.isArray(row) ? row[key] : row?.[key],
    );
    const maxLen = Math.max(
      String(key).length,
      ...values.map((value) => String(value ?? "").length),
    );
    return { wch: Math.max(12, Math.min(42, maxLen + 2)) };
  });
}

function appendSheetFromRows(workbook, rows, sheetName) {
  const safeRows = rows.length ? rows : [{ Note: "No rows available" }];
  const ws = XLSX.utils.json_to_sheet(safeRows);
  setSheetColumns(ws, safeRows);
  XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(sheetName));
}

function objectEntriesToRows(obj, keyLabel, valueLabel) {
  return Object.entries(obj || {}).map(([key, value]) => ({
    [keyLabel]: key,
    [valueLabel]: value,
  }));
}

function exportDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
}

function num(value) {
  return Number(value) || 0;
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "";
}

function exportAnalyticsToExcel(
  payload,
  meta,
  {
    includeItems = true,
    includeCustomers = true,
    includeInvoices = true,
    includeSalesOrders = true,
    includePayments = true,
  } = {},
) {
  const wb = XLSX.utils.book_new();
  const { filters, filterLabels = {}, grain, topN } = meta;
  const summary = payload.summary || {};
  const approx = summary.totalsApproximateInBaseCurrency || {};
  const ek = payload.executiveKpis || {};
  const baseCurrency = summary.baseCurrencyApprox || "";
  const payments = payload.payments || {};
  const invoiceSummary = payload.invoices?.summary || {};
  const salesOrderSummary = payload.salesOrders?.summary || {};
  const topCustomer = payload.topCustomers?.[0];
  const topItem = payload.topItems?.[0];
  const topSalesperson = payload.bySalesPerson?.[0];
  const totalCustomerRevenue = (payload.topCustomers || []).reduce(
    (sum, r) => sum + num(r.billingTotal) + num(r.openPipelineRemainder),
    0,
  );
  const topCustomerShare =
    topCustomer && totalCustomerRevenue
      ? ((num(topCustomer.billingTotal) + num(topCustomer.openPipelineRemainder)) /
          totalCustomerRevenue) *
        100
      : 0;

  appendSheetFromRows(
    wb,
    [
      {
        Section: "Filters",
        Metric: "Business",
        Value: filterLabels.business || "Selected business",
        Notes: "",
      },
      {
        Section: "Filters",
        Metric: "Date range",
        Value:
          filters.startDate && filters.endDate
            ? `${filters.startDate} to ${filters.endDate}`
            : "All time",
        Notes: "",
      },
      ...(includeCustomers
        ? [
            {
              Section: "Filters",
              Metric: "Customer",
              Value: filterLabels.customer || "All customers",
              Notes: "",
            },
          ]
        : []),
      {
        Section: "Filters",
        Metric: "Sales person",
        Value: filterLabels.salesperson || "All sales persons",
        Notes: "",
      },
      ...(includeItems
        ? [
            {
              Section: "Filters",
              Metric: "Item / product",
              Value: filterLabels.item || "All items",
              Notes: "",
            },
          ]
        : []),
      {
        Section: "Filters",
        Metric: "Trend bucket",
        Value: grain === "day" ? "Daily" : grain === "week" ? "Weekly" : "Monthly",
        Notes: "",
      },
      {
        Section: "Filters",
        Metric: "Dashboard Top N",
        Value: topN,
        Notes: "Export mode includes fuller rankings and detail rows.",
      },
      {
        Section: "Totals",
        Metric: `Invoiced billing (${baseCurrency})`,
        Value: approx.invoicedBilling ?? "",
        Notes: "Confirmed invoice value in the selected period.",
      },
      ...(includeSalesOrders
        ? [
            {
              Section: "Totals",
              Metric: `Open sales order remainder (${baseCurrency})`,
              Value: approx.openSalesOrderRemainder ?? "",
              Notes: "Sales order amount not yet invoiced.",
            },
          ]
        : []),
      {
        Section: "Totals",
        Metric: `Combined sales view (${baseCurrency})`,
        Value: approx.combined ?? "",
        Notes:
          "ERP-style view: invoiced billing plus uninvoiced sales order balance.",
      },
      ...(includePayments
        ? [
            {
              Section: "Totals",
              Metric: `Payments received (${baseCurrency})`,
              Value:
                payments.summary?.totalApproximateInBaseCurrency ??
                payments.summary?.total ??
                "",
              Notes: "Collections recorded in the selected period.",
            },
          ]
        : []),
      ...(includeInvoices
        ? [
            {
              Section: "Counts",
              Metric: "Invoices",
              Value: summary.counts?.invoices ?? "",
              Notes: `${invoiceSummary.count ?? 0} invoice rows included in workbook.`,
            },
          ]
        : []),
      ...(includeSalesOrders
        ? [
            {
              Section: "Counts",
              Metric: "Sales orders",
              Value: summary.counts?.salesOrders ?? "",
              Notes: `${salesOrderSummary.count ?? 0} sales order rows included in workbook.`,
            },
          ]
        : []),
      ...(includePayments
        ? [
            {
              Section: "Counts",
              Metric: "Payments",
              Value: payments.summary?.count ?? "",
              Notes: `${payments.rows?.length ?? 0} payment rows included in workbook.`,
            },
          ]
        : []),
      {
        Section: "Export",
        Metric: "Exported at (UTC)",
        Value: new Date().toISOString(),
        Notes: payload.meta?.exportDetailRowLimit
          ? `Detail tabs are capped at ${payload.meta.exportDetailRowLimit} rows each for browser performance.`
          : "",
      },
    ],
    "Report Summary",
  );

  appendSheetFromRows(
    wb,
    [
      {
        Insight: "Revenue",
        Value: ek.grossRevenue ?? approx.invoicedBilling ?? "",
        Meaning: "Recognized invoice revenue before collection timing.",
      },
      ...(includePayments || includeInvoices
        ? [
            {
              Insight: "Collection efficiency",
              Value: pct(ek.collectionEfficiency),
              Meaning: "How much of invoiced revenue has been collected.",
            },
            {
              Insight: "Outstanding receivables",
              Value: ek.outstandingReceivables ?? "",
              Meaning: "Invoice value still unpaid after recorded payments.",
            },
          ]
        : []),
      {
        Insight: "Sales growth",
        Value: pct(ek.salesGrowthPct),
        Meaning: "Current period invoiced revenue compared with the prior period.",
      },
      ...(includeSalesOrders
        ? [
            {
              Insight: "Fulfillment rate",
              Value: pct(ek.fulfillmentRate),
              Meaning: "Ordered quantity that has been fulfilled.",
            },
          ]
        : []),
      ...(includeCustomers
        ? [
            {
              Insight: "Repeat customer ratio",
              Value: pct(ek.repeatCustomerRatio),
              Meaning: "Customers with more than one sales order in the period.",
            },
            {
              Insight: "Top customer",
              Value: topCustomer?.customerName || "",
              Meaning: topCustomer
                ? `${pct(topCustomerShare)} of listed customer revenue; combined value ${num(topCustomer.billingTotal) + num(topCustomer.openPipelineRemainder)}.`
                : "",
            },
          ]
        : []),
      {
        Insight: "Top sales person",
        Value: topSalesperson?.name || "",
        Meaning: topSalesperson
          ? `Revenue ${num(topSalesperson.revenueTotal ?? topSalesperson.invoiceBilling)} (invoiced + uninvoiced balance, not double-counted).`
          : "",
      },
      ...(includeItems
        ? [
            {
              Insight: "Top item",
              Value: topItem?.name || "",
              Meaning: topItem
                ? `Invoiced revenue ${num(topItem.revenue)} from ${num(topItem.qty)} units.`
                : "",
            },
          ]
        : []),
      ...(summary.notes || []).map((note) => ({
        Insight: "Report note",
        Value: "",
        Meaning: note,
      })),
    ],
    "Executive Insights",
  );

  appendSheetFromRows(
    wb,
    [
      { KPI: "Gross revenue", Value: ek.grossRevenue ?? "" },
      { KPI: "Net revenue", Value: ek.netRevenue ?? "" },
      ...(includeSalesOrders
        ? [{ KPI: "Average sales order value", Value: ek.averageOrderValue ?? "" }]
        : []),
      ...(includeInvoices
        ? [{ KPI: "Average invoice value", Value: ek.averageInvoiceValue ?? "" }]
        : []),
      ...(includePayments || includeInvoices
        ? [
            {
              KPI: "Collection efficiency %",
              Value: ek.collectionEfficiency ?? "",
            },
            {
              KPI: "Outstanding receivables",
              Value: ek.outstandingReceivables ?? "",
            },
          ]
        : []),
      ...(includeSalesOrders
        ? [{ KPI: "Fulfillment rate %", Value: ek.fulfillmentRate ?? "" }]
        : []),
      ...(includeCustomers
        ? [
            {
              KPI: "Repeat customer ratio %",
              Value: ek.repeatCustomerRatio ?? "",
            },
            { KPI: "Revenue per customer", Value: ek.revenuePerCustomer ?? "" },
          ]
        : []),
      { KPI: "Sales growth %", Value: ek.salesGrowthPct ?? "" },
      { KPI: "Revenue per salesperson", Value: ek.revenuePerSalesperson ?? "" },
      ...(includeSalesOrders
        ? [
            { KPI: "Ordered quantity", Value: ek.orderedQty ?? "" },
            { KPI: "Fulfilled quantity", Value: ek.fulfilledQty ?? "" },
          ]
        : []),
      { KPI: "Discount total", Value: ek.discountTotal ?? "" },
    ],
    "Executive KPIs",
  );

  if (includeInvoices || includeSalesOrders) {
    appendSheetFromRows(wb, payload.monthlyTrend || [], "Revenue Trend");
  }
  if (includeSalesOrders || includeInvoices || includePayments) {
    const funnelStageAccess = {
      "Sales Orders": includeSalesOrders,
      Invoices: includeInvoices,
      Payments: includePayments,
    };
    const funnelRows = (payload.salesFunnel || []).filter(
      (row) => funnelStageAccess[row.stage],
    );
    if (funnelRows.length) {
      appendSheetFromRows(wb, funnelRows, "Sales Funnel");
    }
  }

  if (includeCustomers) {
    appendSheetFromRows(
      wb,
      (payload.topCustomers || []).map((r) => ({
        customerName: r.customerName,
        invoicedBilling: r.billingTotal,
        openSalesOrderRemainder: r.openPipelineRemainder,
        combinedValue: num(r.billingTotal) + num(r.openPipelineRemainder),
        invoiceCount: r.invoices,
        salesOrderCount: r.orders,
      })),
      "Customer Ranking",
    );
    appendSheetFromRows(wb, payload.customerPareto || [], "Customer Pareto");
    appendSheetFromRows(
      wb,
      (payload.customerPerformanceReport || []).map((r) => ({
        customer: r.customerName,
        salesOrders: r.orders,
        orderNumbers: (r.orderNumbers || []).join(", "),
        invoiced: r.invoiced,
        collected: r.collected,
        unpaidSalesOrderRemainder: r.salesOrderUnpaid ?? r.unpaid,
        collectionPercent: r.collectionPct,
        primaryCurrency: r.primaryCurrency,
        status: r.status,
      })),
      "Customer Performance",
    );
  }

  appendSheetFromRows(
    wb,
    (payload.bySalesPerson || []).map((r) => ({
      name: r.name,
      invoiceBilling: r.invoiceBilling,
      orderBooking: r.orderBooking,
      revenueTotal: r.revenueTotal,
      salesOrders: r.orders,
      invoices: r.invoices,
    })),
    "Salesperson Ranking",
  );
  appendSheetFromRows(
    wb,
    (payload.salespersonCommissionReport || []).map((r) => ({
      salesperson: r.name,
      salesOrders: r.orders,
      orderNumbers: (r.orderNumbers || []).join(", "),
      invoiced: r.invoiced,
      collected: r.collected,
      unpaid: r.unpaid,
      ratePercent: r.ratePercent,
      commissionBase: r.commissionBase,
      commissionEarned: r.commissionEarned,
      status: r.status,
    })),
    "Salesperson Commission",
  );

  if (includeItems) {
    appendSheetFromRows(
      wb,
      (payload.topItems || []).map((r) => ({
        product: r.name,
        qtyInvoiced: r.qty,
        invoicedRevenue: r.revenue,
        invoiceLines: r.lineRows,
      })),
      "Item Performance",
    );
    appendSheetFromRows(
      wb,
      [
        {
          Metric: "Products invoiced",
          Value: payload.itemsSummary?.productCount ?? "",
        },
        {
          Metric: "Quantity invoiced",
          Value: payload.itemsSummary?.qtyInvoiced ?? "",
        },
        {
          Metric: "Invoiced revenue",
          Value: payload.itemsSummary?.invoicedRevenue ?? "",
        },
        {
          Metric: "Invoice line count",
          Value: payload.itemsSummary?.invoiceLines ?? "",
        },
        {
          Metric: "Products requested on sales orders",
          Value: payload.itemsSummary?.productsRequested ?? "",
        },
        {
          Metric: "Quantity requested",
          Value: payload.itemsSummary?.qtyRequested ?? "",
        },
        {
          Metric: "Requested value",
          Value: payload.itemsSummary?.requestedValue ?? "",
        },
      ],
      "Item Summary",
    );
  }

  if (includeInvoices) {
    appendSheetFromRows(
      wb,
      (payload.invoices?.rows || []).map((r) => ({
        invoiceNumber: r.invoiceNumber,
        invoiceDate: exportDate(r.invoiceDate),
        customerName: r.customerName,
        status: r.status,
        currency: r.currency,
        amount: r.amount,
      })),
      "Invoices",
    );
  }
  if (includeSalesOrders) {
    appendSheetFromRows(
      wb,
      (payload.salesOrders?.rows || []).map((r) => ({
        salesOrderNumber: r.salesOrderNumber,
        salesOrderDate: exportDate(r.salesOrderDate),
        customerName: r.customerName,
        items: r.itemsSummary,
        salespersonName: r.salespersonName,
        orderTotal: r.total,
        currency: r.currency,
        lineCount: r.lineCount,
        status: r.status,
      })),
      "Sales Orders",
    );
  }
  if (includePayments) {
    appendSheetFromRows(
      wb,
      (payload.payments?.rows || []).map((r) => ({
        paymentDate: exportDate(r.paymentDate),
        invoiceNumber: r.invoiceNumber,
        customerName: r.customerName,
        paymentMode: r.paymentMode,
        paymentStatus: r.paymentStatus,
        reference: r.reference,
        currency: r.currency,
        amount: r.amount,
      })),
      "Payments",
    );
  }

  const cmp = payload.invoiceVsSalesOrderComparison?.overall || {};
  appendSheetFromRows(
    wb,
    [
      ...(includeInvoices
        ? [
            {
              Metric: "Total invoiced billing",
              Value: cmp.totalInvoicedBilling ?? "",
            },
          ]
        : []),
      ...(includeSalesOrders
        ? [{ Metric: "Total order booking", Value: cmp.totalOrderBooking ?? "" }]
        : []),
      ...(includeInvoices
        ? objectEntriesToRows(
            summary.totalsByCurrency?.invoicedBilling,
            "Invoiced currency",
            "Amount",
          )
        : []),
      ...(includeSalesOrders
        ? objectEntriesToRows(
            summary.totalsByCurrency?.openSalesOrderRemainder,
            "Open SO currency",
            "Amount",
          )
        : []),
    ],
    "Currency Totals",
  );
  appendSheetFromRows(
    wb,
    [
      ...(includeInvoices
        ? objectEntriesToRows(
            payload.invoices?.summary?.statusBreakdown,
            "Invoice status",
            "Count",
          )
        : []),
      ...(includeSalesOrders
        ? objectEntriesToRows(
            payload.salesOrders?.summary?.statusBreakdown,
            "Sales order status",
            "Count",
          )
        : []),
      ...(includePayments
        ? [
            ...objectEntriesToRows(
              payments.summary?.byMode,
              "Payment method",
              "Amount",
            ),
            ...objectEntriesToRows(
              payments.summary?.byCurrency,
              "Payment currency",
              "Amount",
            ),
          ]
        : []),
      ...(includeInvoices
        ? (payload.agingBuckets || []).map((r) => ({
            Breakdown: "Receivable aging",
            Name: r.bucket,
            Count: r.count,
            Amount: r.amount,
          }))
        : []),
      ...(includeInvoices || includeSalesOrders
        ? (payload.revenueBySource || []).map((r) => ({
            Breakdown: "Revenue source",
            Name: r.source,
            Count: r.count,
            Amount: r.revenue,
          }))
        : []),
      ...(includeSalesOrders
        ? (payload.fulfillmentByStatus || []).map((r) => ({
            Breakdown: "Fulfillment status",
            Name: r.status,
            Count: r.orders,
            Amount: r.value,
          }))
        : []),
    ],
    "Breakdowns",
  );
  if (includePayments) {
    appendSheetFromRows(wb, payments.monthlySeries || [], "Payments Trend");
  }

  const fname = `sales-analytics_${filters.startDate && filters.endDate ? `${filters.startDate}_${filters.endDate}` : "all-time"}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fname);
}

const fmtMoney = (value, currency = "") => {
  const amount = formatAmount(Number(value) || 0);
  return currency ? `${currency} ${amount}` : amount;
};

const fmtPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
};

const fmtDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
};

const toApiDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/** Detail URLs for sales report tables — opens in a new browser tab when enabled. */
function useSalesReportDocumentNav() {
  const { getModuleRoutePath } = useModuleLabels();
  const access = useSalesReportModuleTabAccess();

  return useMemo(
    () => ({
      canLinkInvoice: !!access.invoices,
      canLinkSalesOrder: !!access.salesOrders,
      invoiceDetailPath: (invoiceId) =>
        invoiceId ? `/view-customer-invoice/${invoiceId}` : null,
      salesOrderDetailPath: (salesOrderId) =>
        salesOrderId
          ? getModuleRoutePath("saleOrder", "view", { id: salesOrderId })
          : null,
    }),
    [access, getModuleRoutePath],
  );
}

function ReportDocLink({ enabled, href, children, className = "" }) {
  if (!enabled || !href) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-[var(--p-blue)] hover:underline ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}

/** ISO week key (UTC) for client-side fallback — aligns with typical Mongo %G / %V bucketing. */
function isoWeekBucketKeyUTC(d) {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

function formatTrendAxisLabel(period, grain) {
  if (period == null) return "";
  const p = String(period);
  const g = (grain || "month").toLowerCase();
  if (g === "day") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    const d = new Date(`${p}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? p : d.toISOString().slice(0, 10);
  }
  if (g === "week") {
    const m = p.match(/^(\d{4})-W(\d{2})$/i);
    if (m) return `W${Number(m[2])} ${m[1]}`;
    return p;
  }
  const [y, mo] = p.split("-");
  if (y && mo) {
    const d = new Date(`${y}-${mo}-01T12:00:00.000Z`);
    return Number.isNaN(d.getTime())
      ? p
      : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  return p;
}

function trendPeriodTooltipTitle(period, grain) {
  const g = (grain || "month").toLowerCase();
  const bucket = g === "day" ? "Day" : g === "week" ? "Week" : "Month";
  return `${bucket}: ${formatTrendAxisLabel(period, grain)}`;
}

/** Daily Report–style tooltip; amounts use business base formatting. */
function SalesAnalyticsTooltip({
  active,
  payload,
  label,
  title,
  base,
  labelDetail,
}) {
  if (!active || !payload?.length) return null;
  const detail = labelDetail ?? (label != null ? String(label) : "");
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[160px]">
      {title ? (
        <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
      ) : null}
      {detail ? (
        <p className="text-sm font-bold text-gray-800 mb-2">{detail}</p>
      ) : null}
      {payload.map((entry, index) => {
        const nm = String(entry.name || "");
        const isCount =
          nm.toLowerCase().includes("count") ||
          nm === "Orders" ||
          nm === "Payment count";
        const display = isCount
          ? formatAmount(entry.value)
          : fmtMoney(entry.value, base);
        return (
          <div
            key={index}
            className="flex items-center justify-between gap-4 py-0.5"
          >
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="text-xs font-semibold text-gray-900">
              {display}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "customers", label: "Customers" },
  { id: "salespersons", label: "Sales Persons" },
  { id: "items", label: "Items / Products" },
  { id: "invoices", label: "Invoices" },
  { id: "salesOrders", label: "Sales Orders" },
  { id: "payments", label: "Payments" },
];

/** Plain labels aligned with ERP module names (Sales Order, Invoice, etc.) */
const L = {
  salesOrder: "Sales Order",
  salesOrders: "Sales Orders",
  invoice: "Invoice",
  invoices: "Invoices",
  customer: "Customer",
  customers: "Customers",
  payment: "Payment",
  payments: "Payments",
  salesPerson: "Sales Person",
  salesPersons: "Sales Persons",
  product: "Product",
  products: "Products",
};

const countLabel = (n, singular, plural) => {
  const num = Number(n) || 0;
  return `${formatAmount(num)} ${num === 1 ? singular : plural}`;
};

const CustomerReports = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const token = adminInfo?.token;
  const adminId = adminInfo?.id || adminInfo?._id;
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();
  const reportTabAccess = useSalesReportModuleTabAccess();
  const {
    items: canViewItems,
    customers: canViewCustomers,
    invoices: canViewInvoices,
    salesOrders: canViewSalesOrders,
    payments: canViewPayments,
  } = reportTabAccess;

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => reportTabAccess[tab.id] ?? true),
    [reportTabAccess],
  );
  const initialFetchDoneRef = useRef(false);
  const [assignedBusinessIds, setAssignedBusinessIds] = useState([]);

  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [filters, setFilters] = useState({
    business: "",
    startDate: "",
    endDate: "",
  });
  const [tabFilters, setTabFilters] = useState({
    customers: { customer: "" },
    salespersons: { salesperson: "" },
    items: { item: "" },
  });
  const [trendGranularity, setTrendGranularity] = useState(
    DEFAULT_TREND_GRANULARITY,
  );
  const [topN, setTopN] = useState(15);
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [customerOptions, setCustomerOptions] = useState([
    { value: "", label: "All customers" },
  ]);
  const [salespersonOptions, setSalespersonOptions] = useState([
    { value: "", label: "All sales persons" },
  ]);
  const [itemOptions, setItemOptions] = useState([
    { value: "", label: "All items" },
  ]);

  const updateTabFilter = (tabKey, field, value) => {
    setTabFilters((prev) => ({
      ...prev,
      [tabKey]: { ...prev[tabKey], [field]: value || "" },
    }));
  };

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate || "");
    setDateRangeEnd(endDate || "");
    setFilters((prev) => ({
      ...prev,
      startDate: toApiDate(startDate),
      endDate: toApiDate(endDate),
    }));
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setFilters((prev) => ({
      ...prev,
      startDate: "",
      endDate: "",
    }));
  };

  const handleAssignedBusinesses = useCallback((businessIds) => {
    const ids = businessIds || [];
    setAssignedBusinessIds(ids);
    if (!ids.length) return;
    setFilters((prev) => {
      if (prev.business) return prev;
      return { ...prev, business: ids[0] };
    });
  }, []);

  useEffect(() => {
    if (!isSingleBusiness || !singleBusinessId) return;
    setAssignedBusinessIds([singleBusinessId]);
    setFilters((prev) =>
      prev.business ? prev : { ...prev, business: singleBusinessId },
    );
  }, [isSingleBusiness, singleBusinessId]);

  const handleResetFilters = () => {
    const resetFilters = {
      business: assignedBusinessIds[0] || "",
      startDate: "",
      endDate: "",
    };
    setDateRangeStart("");
    setDateRangeEnd("");
    setFilters(resetFilters);
    setTabFilters({
      customers: { customer: "" },
      salespersons: { salesperson: "" },
      items: { item: "" },
    });
    setTrendGranularity(DEFAULT_TREND_GRANULARITY);
    setTopN(15);
    setData(null);
    initialFetchDoneRef.current = true;
    setCustomerOptions([{ value: "", label: "All customers" }]);
    setSalespersonOptions([{ value: "", label: "All sales persons" }]);
    setItemOptions([{ value: "", label: "All items" }]);
    fetchAnalytics({
      filters: resetFilters,
      topN: 15,
      grain: DEFAULT_TREND_GRANULARITY,
    });
  };

  const fetchFilterOptions = useCallback(async () => {
    if (!filters.business) {
      setCustomerOptions([{ value: "", label: "All customers" }]);
      setSalespersonOptions([{ value: "", label: "All sales persons" }]);
      setItemOptions([{ value: "", label: "All items" }]);
      return;
    }

    setLoadingFilters(true);
    try {
      const q = new URLSearchParams({ business: filters.business });
      const res = await axios.get(
        `${Base_URL}/sales-reports/analytics/filters?${q}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      if (canViewCustomers) {
        setCustomerOptions([
          { value: "", label: "All customers" },
          ...(res.data?.data?.customers || []),
        ]);
      } else {
        setCustomerOptions([{ value: "", label: "All customers" }]);
      }
      setSalespersonOptions([
        { value: "", label: "All sales persons" },
        ...(res.data?.data?.salespersons || []),
      ]);
      if (canViewItems) {
        setItemOptions([
          { value: "", label: "All items" },
          ...(res.data?.data?.items || []),
        ]);
      } else {
        setItemOptions([{ value: "", label: "All items" }]);
      }
    } catch (err) {
      console.error(err);
      setCustomerOptions([{ value: "", label: "All customers" }]);
      setSalespersonOptions([{ value: "", label: "All sales persons" }]);
      setItemOptions([{ value: "", label: "All items" }]);
    } finally {
      setLoadingFilters(false);
    }
  }, [filters.business, token, canViewItems, canViewCustomers]);

  const fetchAnalytics = useCallback(
    async (override) => {
      const activeFilters = override?.filters ?? filters;
      const activeGrain = override?.grain ?? trendGranularity;
      const activeTopN = override?.topN ?? topN;
      if (!activeFilters.business) return;

      const q = buildAnalyticsSearchParams(
        buildBaseAnalyticsFilters(activeFilters),
        activeGrain,
        activeTopN,
      );

      setLoading(true);
      try {
        const res = await axios.get(
          `${Base_URL}/sales-reports/analytics?${q}`,
          {
            headers: { authorization: `Bearer ${token}` },
          },
        );
        if (!res.data?.success) {
          toast.error(res.data?.message || "Failed to load reports");
          setData(null);
          return;
        }
        setData(res.data.data);
      } catch (err) {
        const msg =
          err.response?.data?.errors?.join?.("; ") ||
          err.response?.data?.message ||
          err.message ||
          "Failed to load reports";
        toast.error(msg);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [filters, trendGranularity, topN, token],
  );

  const handleExportExcel = useCallback(async () => {
    if (!filters.business) {
      toast.warn("Select a business to export.");
      return;
    }

    const q = buildAnalyticsSearchParams(
      buildBaseAnalyticsFilters(filters),
      trendGranularity,
      topN,
    );
    q.append("export", "xlsx");
    setExportLoading(true);
    try {
      const res = await axios.get(`${Base_URL}/sales-reports/analytics?${q}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.data?.success) {
        toast.error(res.data?.message || "Export failed");
        return;
      }

      let businessLabel = "Selected business";
      if (adminId && filters.business) {
        try {
          const bizRes = await axios.get(
            `${Base_URL}/admin/assigned/${adminId}`,
            { headers: { authorization: `Bearer ${token}` } },
          );
          const match = (bizRes.data?.businesses || []).find(
            (b) => String(b._id) === String(filters.business),
          );
          if (match?.name) businessLabel = match.name;
        } catch (_) {
          /* keep fallback label */
        }
      }

      exportAnalyticsToExcel(
        res.data.data,
        {
          filters: buildBaseAnalyticsFilters(filters),
          filterLabels: {
            business: businessLabel,
            customer: "All customers",
            salesperson: "All sales persons",
            item: "All items",
          },
          grain: trendGranularity,
          topN,
        },
        {
          includeItems: canViewItems,
          includeCustomers: canViewCustomers,
          includeInvoices: canViewInvoices,
          includeSalesOrders: canViewSalesOrders,
          includePayments: canViewPayments,
        },
      );
      toast.success("Excel export downloaded.");
    } catch (err) {
      const msg =
        err.response?.data?.errors?.join?.("; ") ||
        err.response?.data?.message ||
        err.message ||
        "Export failed";
      toast.error(msg);
    } finally {
      setExportLoading(false);
    }
  }, [
    adminId,
    filters,
    topN,
    token,
    trendGranularity,
    canViewItems,
    canViewCustomers,
    canViewInvoices,
    canViewSalesOrders,
    canViewPayments,
  ]);

  useEffect(() => {
    if (reportTabAccess[activeTab] === false) {
      setActiveTab("overview");
    }
  }, [activeTab, reportTabAccess]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    if (!filters.business || initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    fetchAnalytics();
  }, [filters.business, fetchAnalytics]);

  const tabViewData = useMemo(
    () => (data ? analyticsViewForTab(data, activeTab, tabFilters) : null),
    [data, activeTab, tabFilters],
  );

  const derived = useMemo(() => {
    if (!tabViewData) return null;
    const customers = tabViewData.topCustomers || [];
    const customerPerf = tabViewData.customerPerformanceReport || [];
    const salespersons = tabViewData.bySalesPerson || [];
    const spCommissionRows = tabViewData.salespersonCommissionReport || [];
    const items = tabViewData.topItems || [];
    const itemsSummary = tabViewData.itemsSummary;
    const invRows = tabViewData.invoices?.rows || [];
    const soRows = tabViewData.salesOrders?.rows || [];
    const payRows = tabViewData.payments?.rows || [];

    const custBilling = customers.reduce(
      (s, r) => s + (Number(r.billingTotal) || 0),
      0,
    );
    const custOpen = customers.reduce(
      (s, r) => s + (Number(r.openPipelineRemainder) || 0),
      0,
    );
    const custInvoices = customers.reduce(
      (s, r) => s + (Number(r.invoices) || 0),
      0,
    );
    const custOrders = customers.reduce(
      (s, r) => s + (Number(r.orders) || 0),
      0,
    );

    const spInvoice = salespersons.reduce(
      (s, r) => s + (Number(r.invoiceBilling) || 0),
      0,
    );
    const spOrdersVal = salespersons.reduce(
      (s, r) => s + (Number(r.orderBooking) || 0),
      0,
    );
    const spOrderCount = salespersons.reduce(
      (s, r) => s + (Number(r.orders) || 0),
      0,
    );
    const spInvoiceCount = salespersons.reduce(
      (s, r) => s + (Number(r.invoices) || 0),
      0,
    );

    const itemQty =
      itemsSummary?.qtyInvoiced ??
      items.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const itemRev =
      itemsSummary?.invoicedRevenue ??
      items.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const itemLines =
      itemsSummary?.invoiceLines ??
      items.reduce((s, r) => s + (Number(r.lineRows) || 0), 0);
    const invTotal = invRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const soTotal = soRows.reduce((s, r) => s + (Number(r.total) || 0), 0);

    const custPerfInvoiced = customerPerf.reduce(
      (s, r) => s + (Number(r.invoiced) || 0),
      0,
    );
    const custPerfCollected = customerPerf.reduce(
      (s, r) => s + (Number(r.collected) || 0),
      0,
    );
    const custPerfUnpaid = customerPerf.reduce(
      (s, r) => s + (Number(r.salesOrderUnpaid ?? r.unpaid) || 0),
      0,
    );

    const spCommissionEarned = spCommissionRows.reduce(
      (s, r) => s + (Number(r.commissionEarned) || 0),
      0,
    );
    const spCommissionPayable = spCommissionRows.reduce(
      (s, r) =>
        s + (r.status === "Payable" ? Number(r.commissionEarned) || 0 : 0),
      0,
    );
    const spCommissionOnHold = spCommissionRows.reduce(
      (s, r) =>
        s + (r.status === "On Hold" ? Number(r.commissionEarned) || 0 : 0),
      0,
    );
    const spCollected = spCommissionRows.reduce(
      (s, r) => s + (Number(r.collected) || 0),
      0,
    );

    return {
      custBilling,
      custOpen,
      custInvoices,
      custOrders,
      spInvoice,
      spOrdersVal,
      spOrderCount,
      spInvoiceCount,
      itemQty,
      itemRev,
      itemLines,
      invTotal,
      soTotal,
      customersLen: customerPerf.length || customers.length,
      custPerfInvoiced,
      custPerfCollected,
      custPerfUnpaid,
      salespersonsLen: spCommissionRows.length || salespersons.length,
      spCommissionEarned,
      spCommissionPayable,
      spCommissionOnHold,
      spCollected,
      itemsLen: itemsSummary?.productCount ?? items.length,
      invRowsCount: invRows.length,
      soRowsCount: soRows.length,
      payRowsCount: payRows.length,
    };
  }, [tabViewData]);

  const summary = data?.summary || {};
  const base = summary.baseCurrencyApprox || "";
  const approx = summary.totalsApproximateInBaseCurrency || {};
  const blockingLoad = loading && !data;
  const reportTrendGrain = data?.meta?.trendGrain || trendGranularity;
  const trendBucketHint =
    data?.meta?.trendGrainLabel ||
    (reportTrendGrain === "day"
      ? "Daily"
      : reportTrendGrain === "week"
        ? "Weekly"
        : "Monthly");

  return (
    <div className="p-6 bg-gray-50 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto min-w-0 space-y-5 pb-12 overflow-x-hidden">
        <StandardPageHeader
          title="Sales Reports"
          subtitle="Track revenue, sales activity, collections, and product performance for the selected business."
          actions={
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportLoading || !filters.business}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                title="Export to Excel"
              >
                {exportLoading ? (
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
                onClick={fetchAnalytics}
                disabled={loading || !filters.business}
                className="flex items-center gap-2 px-4 py-3 bg-[#0C2E5A] hover:bg-[var(--p-blue-dark)] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Search
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-800 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                title="Reset filters"
              >
                <RefreshCw size={18} />
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
                  onChange={(business) =>
                    setFilters((prev) => ({
                      ...prev,
                      business: business || "",
                    }))
                  }
                />
              </FilterField>
            </div>
            )}
            <div className="min-w-[260px] flex-1 sm:flex-[1.25]">
              <FilterField label="Date range">
                <DateRangeComponent
                  startDate={dateRangeStart}
                  endDate={dateRangeEnd}
                  onApply={handleDateRangeApply}
                  onClear={handleDateRangeClear}
                  placeholder="Select dates"
                  width="100%"
                />
              </FilterField>
            </div>
            <div className="min-w-[140px] w-[150px] sm:min-w-[160px] sm:w-[170px]">
              <FilterField label="Top N">
                <DropdownBasic
                  options={[10, 15, 20, 30, 50].map((n) => ({
                    value: String(n),
                    label: String(n),
                  }))}
                  value={String(topN)}
                  onChange={(value) => setTopN(Number(value) || 15)}
                  placeholder="Top N"
                />
              </FilterField>
            </div>
            <div className="min-w-[160px] w-[170px] sm:min-w-[175px] sm:w-[185px]">
              <FilterField label="Trend period">
                <DropdownBasic
                  options={[
                    { value: "day", label: "Daily" },
                    { value: "week", label: "Weekly" },
                    { value: "month", label: "Monthly" },
                  ]}
                  value={trendGranularity}
                  onChange={(value) =>
                    setTrendGranularity(value || DEFAULT_TREND_GRANULARITY)
                  }
                  placeholder="Trend period"
                />
              </FilterField>
            </div>
          </div>
        </div>

        {blockingLoad && (
          <div className="py-24 flex justify-center">
            <LoaderComponent />
          </div>
        )}

        {!blockingLoad && !data && (
          <div className="text-center py-14 text-gray-500 text-sm">
            Select a business to load the sales report. Change filters and click
            Search to refresh. Leave the date range empty to include all data
            for the selected business.
          </div>
        )}

        {data && derived && tabViewData && (
          <>
            <div className="mb-6 flex w-full min-w-0 overflow-x-auto rounded-t-xl border border-b-0 border-gray-200 bg-white shadow-sm">
              <nav
                className="flex w-full min-w-max sm:min-w-0"
                aria-label="Report tabs"
              >
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-[88px] shrink-0 px-3 sm:px-4 py-3.5 text-center text-xs sm:text-sm font-semibold border-b-[3px] ${
                      activeTab === tab.id
                        ? "border-[#0C2E5A] text-[#c2670a] bg-gray-50"
                        : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-gray-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="rounded-b-xl border border-gray-200 border-t-0 bg-white p-4 sm:p-6 shadow-sm">
              {activeTab === "overview" && (
                <OverviewTab
                  data={data}
                  approx={approx}
                  summary={summary}
                  base={base}
                  executiveKpis={data.executiveKpis}
                  trendGrain={reportTrendGrain}
                  trendBucketHint={trendBucketHint}
                  moduleAccess={reportTabAccess}
                />
              )}
              {activeTab === "customers" && canViewCustomers && (
                <>
                  <TabFilterBar
                    label={
                      loadingFilters ? "Customer..." : "Filter by customer"
                    }
                  >
                    <DropdownBasic
                      options={customerOptions}
                      value={tabFilters.customers.customer}
                      onChange={(value) =>
                        updateTabFilter("customers", "customer", value)
                      }
                      placeholder="All customers"
                      isClearable
                    />
                  </TabFilterBar>
                  <SectionStatStrip
                    title="Customers"
                    stats={[
                      {
                        title: `Total ${L.customers}`,
                        value: formatAmount(derived.customersLen),
                        sub: "In this report",
                        icon: Users,
                      },
                      {
                        title: "Total invoiced",
                        value: fmtMoney(
                          derived.custPerfInvoiced || derived.custBilling,
                        ),
                        sub: "Confirmed invoice value",
                        icon: FileText,
                      },
                      {
                        title: "Total collected",
                        value: fmtMoney(derived.custPerfCollected),
                        sub: "Payments in period",
                        icon: Wallet,
                      },
                      {
                        title: "OPEN ORDERS VALUE",
                        value: fmtMoney(
                          derived.custPerfUnpaid || derived.custOpen,
                        ),
                        sub: "Uninvoiced sales order balance",
                        icon: ShoppingCart,
                      },
                      {
                        title: "Repeat customers",
                        value: `${formatAmount(data.executiveKpis?.repeatCustomerRatio || 0)}%`,
                        sub: "2+ sales orders in period",
                        icon: Users,
                      },
                      {
                        title: "Average per customer",
                        value: fmtMoney(
                          data.executiveKpis?.revenuePerCustomer,
                          base,
                        ),
                        sub: "Revenue share",
                        icon: Target,
                      },
                    ]}
                  />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-5">
                    <CustomerParetoChartCard data={tabViewData} base={base} />
                    <TopBarPanel
                      title="Top customers by revenue"
                      data={(tabViewData.topCustomers || []).map((r) => ({
                        name: r.customerName,
                        value:
                          (Number(r.billingTotal) || 0) +
                          (Number(r.openPipelineRemainder) || 0),
                      }))}
                      color={ACCENT}
                    />
                  </div>
                  <CustomerPerformanceTab
                    rows={tabViewData.customerPerformanceReport || []}
                  />
                </>
              )}
              {activeTab === "salespersons" && (
                <>
                  <TabFilterBar label="Filter by sales person">
                    <DropdownBasic
                      options={salespersonOptions}
                      value={tabFilters.salespersons.salesperson}
                      onChange={(value) =>
                        updateTabFilter("salespersons", "salesperson", value)
                      }
                      placeholder="All sales persons"
                      isClearable
                    />
                  </TabFilterBar>
                  <SectionStatStrip
                    title={L.salesPersons}
                    stats={[
                      {
                        title: `Total ${L.salesPersons}`,
                        value: formatAmount(derived.salespersonsLen),
                        sub: "Active in sales settings",
                        icon: Users,
                      },
                      {
                        title: "Commission earned",
                        value: fmtMoney(derived.spCommissionEarned),
                        sub: "Based on collection rules",
                        icon: Percent,
                      },
                      {
                        title: "Invoiced amount",
                        value: fmtMoney(derived.spInvoice),
                        sub: "Total invoiced for selected period",
                        icon: Wallet,
                      },
                      {
                        title: "Collected amount",
                        value: fmtMoney(derived.spCollected),
                        sub: "Payments received in selected period",
                        icon: TrendingDown,
                      },
                    ]}
                  />
                  <div className="mb-5">
                    <TopBarPanel
                      title="Top sales persons by revenue"
                      subtitle="Invoiced amount plus uninvoiced order balance"
                      data={(tabViewData.bySalesPerson || []).map((r) => ({
                        name: r.name,
                        value:
                          Number(r.revenueTotal) ??
                          (Number(r.invoiceBilling) || 0) +
                            (Number(r.orderBooking) || 0),
                      }))}
                      color={BRAND}
                    />
                  </div>
                  <SalespersonCommissionTab
                    rows={tabViewData.salespersonCommissionReport || []}
                  />
                </>
              )}
              {activeTab === "items" && canViewItems && (
                <>
                  <TabFilterBar
                    label={
                      loadingFilters
                        ? "Item / product..."
                        : "Filter by item / product"
                    }
                  >
                    <DropdownBasic
                      options={itemOptions}
                      value={tabFilters.items.item}
                      onChange={(value) =>
                        updateTabFilter("items", "item", value)
                      }
                      placeholder="All items"
                      isClearable
                    />
                  </TabFilterBar>
                  <SectionStatStrip
                    title={L.products}
                    stats={[
                      {
                        title: "Products invoiced",
                        value: formatAmount(derived.itemsLen),
                        sub: "Distinct products billed in period",
                        icon: Package,
                      },
                      {
                        title: "Quantity invoiced",
                        value: formatAmount(derived.itemQty),
                        sub: "Units sold on customer invoices",
                        icon: ShoppingCart,
                      },
                      {
                        title: "Invoiced revenue",
                        value: fmtMoney(derived.itemRev),
                        sub: "Revenue from invoice line items",
                        icon: Calculator,
                      },
                    ]}
                    maxColumns={3}
                  />
                  <div className="mb-5">
                    <TopBarPanel
                      title="Top items by invoiced revenue"
                      data={(tabViewData.topItems || []).map((r) => ({
                        name: r.name,
                        value: Number(r.revenue) || 0,
                      }))}
                      color={BLUE}
                    />
                  </div>
                  <ItemsTab rows={tabViewData.topItems || []} />
                </>
              )}
              {activeTab === "invoices" && canViewInvoices && (
                <>
                  <SectionStatStrip
                    title={L.invoices}
                    stats={[
                      {
                        title: "Total invoice amount",
                        value: fmtMoney(derived.invTotal),
                        sub: "Billed in selected period",
                        icon: Wallet,
                      },
                      {
                        title: "Collection efficiency",
                        value: `${formatAmount(data.executiveKpis?.collectionEfficiency || 0)}%`,
                        sub: "Payments vs billing",
                        icon: Percent,
                      },
                      {
                        title: "Outstanding receivables",
                        value: fmtMoney(
                          data.executiveKpis?.outstandingReceivables,
                          base,
                        ),
                        sub: "Unpaid balance",
                        icon: TrendingDown,
                      },
                    ]}
                  />
                  <InvoicesTab data={data.invoices || {}} />
                </>
              )}
              {activeTab === "salesOrders" && canViewSalesOrders && (
                <>
                  <SectionStatStrip
                    title={L.salesOrders}
                    stats={[
                      {
                        title: "Total gross sales",
                        value: fmtMoney(
                          data.executiveKpis?.orderBookingTotal,
                          base,
                        ),
                        sub: "All sales orders in period",
                        icon: Calculator,
                      },
                      {
                        title: `Average ${L.salesOrder} value`,
                        value: fmtMoney(
                          data.executiveKpis?.averageOrderValue,
                          base,
                        ),
                        sub: "Gross booking ÷ order count",
                        icon: Target,
                      },
                      {
                        title: "Fulfillment rate",
                        value: `${formatAmount(data.executiveKpis?.fulfillmentRate || 0)}%`,
                        sub: "Orders fulfilled",
                        icon: Truck,
                      },
                    ]}
                  />
                  <SalesOrdersTab
                    data={data.salesOrders || {}}
                    trend={data.monthlyTrend || []}
                    trendGrain={reportTrendGrain}
                    trendBucketHint={trendBucketHint}
                    base={base}
                  />
                </>
              )}
              {activeTab === "payments" && canViewPayments && (
                <>
                  <SectionStatStrip
                    title={L.payments}
                    stats={[
                      {
                        title: "Total amount received",
                        value: fmtMoney(
                          data.payments?.summary
                            ?.totalApproximateInBaseCurrency ??
                            data.payments?.summary?.total ??
                            0,
                          base,
                        ),
                        sub: "Collections in period",
                        icon: Wallet,
                      },
                      {
                        title: "Collection efficiency",
                        value: `${formatAmount(data.executiveKpis?.collectionEfficiency || 0)}%`,
                        sub: "Against billed revenue",
                        icon: Percent,
                      },
                      {
                        title: "Outstanding receivables",
                        value: fmtMoney(
                          data.executiveKpis?.outstandingReceivables,
                          base,
                        ),
                        sub: "Invoiced − payments (base)",
                        icon: TrendingDown,
                      },
                    ]}
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-5">
                    <PaymentsTrendChart
                      series={data.payments?.monthlySeries}
                      paymentRows={data.payments?.rows}
                      grain={reportTrendGrain}
                      base={base}
                    />
                    <PaymentMethodsDonutCard
                      data={data}
                      base={base}
                      title="Collection by payment method"
                    />
                  </div>
                  <PaymentsTab data={data.payments || {}} />
                </>
              )}
            </div>
          </>
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

function TabFilterBar({ label, children }) {
  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
      <div className="max-w-md">
        <FilterField label={label}>{children}</FilterField>
      </div>
    </div>
  );
}

function SectionStatStrip({ title, stats, maxColumns }) {
  if (!stats?.length) return null;
  const colCount = maxColumns
    ? Math.min(stats.length, maxColumns)
    : stats.length;
  return (
    <div className="mb-5 w-full min-w-0">
      {title ? (
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3 px-1">
          {title}
        </h2>
      ) : null}
      <div
        className="grid gap-3 w-full"
        style={{
          gridTemplateColumns: `repeat(${colCount}, minmax(11rem, 1fr))`,
        }}
      >
        {stats.map((s, i) => (
          <KpiCard
            key={s.title}
            {...s}
            accent={s.accent ?? KPI_ACCENTS[i % KPI_ACCENTS.length]}
          />
        ))}
      </div>
    </div>
  );
}

const PIE_COLORS = [
  BRAND,
  ACCENT,
  BLUE,
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

/** Build payment totals by period when API series is missing (matches UTC bucketing from analytics). */
function buildPaymentsTrendFromRows(rows, grain) {
  const amounts = new Map();
  const counts = new Map();
  const g = (grain || "month").toLowerCase();
  for (const row of rows || []) {
    const raw = row.paymentDate;
    if (raw == null) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    let key;
    if (g === "day") key = d.toISOString().slice(0, 10);
    else if (g === "week") key = isoWeekBucketKeyUTC(d);
    else
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const amt = Number(row.amount) || 0;
    amounts.set(key, (amounts.get(key) || 0) + amt);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...amounts.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((period) => ({
      period,
      amount: amounts.get(period) || 0,
      count: counts.get(period) || 0,
    }));
}

function PaymentsTrendChart({ series, paymentRows, grain, base }) {
  const chartData = useMemo(() => {
    const fromApi = (series || [])
      .map((d) => ({
        period: d?.period == null ? "" : String(d.period).trim(),
        amount: Number(d?.amount) || 0,
        count: Number(d?.count) || 0,
      }))
      .filter((d) => d.period.length > 0)
      .sort((a, b) => a.period.localeCompare(b.period));
    if (fromApi.length > 0) return fromApi;
    return buildPaymentsTrendFromRows(paymentRows, grain);
  }, [series, paymentRows, grain]);

  const showCountAxis = chartData.some((d) => (Number(d.count) || 0) > 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            Collections trend
          </h3>
        </div>
        <TrendingUp className="w-5 h-5 text-gray-400 shrink-0" />
      </div>
      {chartData.length ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 8,
                right: showCountAxis ? 10 : 8,
                left: 0,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
              />
              <XAxis
                dataKey="period"
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                tickFormatter={(v) => formatTrendAxisLabel(v, grain)}
              />
              <YAxis
                yAxisId="amt"
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                tickFormatter={(v) => formatAmount(v)}
                width={72}
              />
              {showCountAxis ? (
                <YAxis
                  yAxisId="cnt"
                  orientation="right"
                  stroke="#6b7280"
                  style={{ fontSize: 12 }}
                  tickFormatter={(v) => formatAmount(v)}
                  width={52}
                  allowDecimals={false}
                />
              ) : null}
              <Tooltip
                content={(props) => (
                  <SalesAnalyticsTooltip
                    {...props}
                    title="Collections"
                    base={base}
                    labelDetail={
                      props.label != null
                        ? trendPeriodTooltipTitle(String(props.label), grain)
                        : undefined
                    }
                  />
                )}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="amt"
                type={TREND_CURVE}
                dataKey="amount"
                name="Collected"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              {showCountAxis ? (
                <Line
                  yAxisId="cnt"
                  type={TREND_CURVE}
                  dataKey="count"
                  name="Payment count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
          <p className="text-sm">No trend data available</p>
        </div>
      )}
    </div>
  );
}

/** Cash Flow Overview–style dual area (booking vs. invoiced billing, same period). */
function SalesOrdersTrendChart({ trend, grain, base, trendBucketHint }) {
  const rows = useMemo(() => {
    return (trend || [])
      .map((r) => ({
        period: r?.period == null ? "" : String(r.period).trim(),
        orderBooking: Number(r?.orderBooking) || 0,
        billed: Number(r?.billed) || 0,
      }))
      .filter((r) => r.period.length > 0)
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [trend]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            Order activity overview
          </h3>
          {trendBucketHint ? (
            <p className="text-xs text-gray-500 mt-1">
              {trendBucketHint} periods · dual area (like Daily Report cash
              flow): booking vs. invoiced
            </p>
          ) : null}
        </div>
        <BarChart3 className="w-5 h-5 text-gray-400 shrink-0" />
      </div>
      {rows.length ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rows}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="srSoBooking" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="srSoBilled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
              />
              <XAxis
                dataKey="period"
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                tickFormatter={(v) => formatTrendAxisLabel(v, grain)}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                tickFormatter={(v) => formatAmount(v)}
                width={72}
              />
              <Tooltip
                content={(props) => (
                  <SalesAnalyticsTooltip
                    {...props}
                    title="Sales orders"
                    base={base}
                    labelDetail={
                      props.label != null
                        ? trendPeriodTooltipTitle(String(props.label), grain)
                        : undefined
                    }
                  />
                )}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type={TREND_CURVE}
                dataKey="orderBooking"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#srSoBooking)"
                name="Sales order booking"
                strokeWidth={2}
              />
              <Area
                type={TREND_CURVE}
                dataKey="billed"
                stroke="#EF4444"
                fillOpacity={1}
                fill="url(#srSoBilled)"
                name="Invoiced billing"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
          <p className="text-sm">No trend data available</p>
        </div>
      )}
    </div>
  );
}

/** Donut chart for document status counts (invoices / sales orders) */
function StatusBreakdownDonutCard({ title, data, unitLabel = "records" }) {
  const pieData = Object.entries(data || {})
    .map(([name, value]) => ({
      name,
      value: Math.round(Number(value)) || 0,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = pieData.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard title={title}>
      {pieData.length ? (
        <div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
                label={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, _name, entry) => [
                  `${formatAmount(v)} ${unitLabel}`,
                  entry?.payload?.name || _name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul
            className="mt-3 space-y-2 border-t border-gray-100 pt-3"
            aria-label="Status breakdown"
          >
            {pieData.map((d, i) => {
              const pct =
                total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0";
              return (
                <li
                  key={d.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                      aria-hidden
                    />
                    <span
                      className="font-medium text-gray-800 truncate"
                      title={d.name}
                    >
                      {d.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-gray-600 tabular-nums">
                    {formatAmount(d.value)}
                    <span className="ml-1.5 font-semibold text-gray-800">
                      ({pct}%)
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyBanner />
      )}
    </ChartCard>
  );
}

function PaymentMethodsDonutCard({ data, base, title = "Payment methods" }) {
  const paymentDonut = Object.entries(data.payments?.summary?.byMode || {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = paymentDonut.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard title={title}>
      {paymentDonut.length ? (
        <div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={paymentDonut}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
                label={false}
              >
                {paymentDonut.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, _name, entry) => [
                  fmtMoney(v, base),
                  entry?.payload?.name || _name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul
            className="mt-3 space-y-2 border-t border-gray-100 pt-3"
            aria-label="Payment method breakdown"
          >
            {paymentDonut.map((d, i) => {
              const pct =
                total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0";
              return (
                <li
                  key={d.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                      aria-hidden
                    />
                    <span
                      className="font-medium text-gray-800 truncate"
                      title={d.name}
                    >
                      {d.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-gray-600 tabular-nums">
                    {fmtMoney(d.value, base)}
                    <span className="ml-1.5 font-semibold text-gray-800">
                      ({pct}%)
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyBanner />
      )}
    </ChartCard>
  );
}

function CustomerParetoChartCard({ data, base }) {
  return (
    <ChartCard title="Customer Pareto (top contribution)">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data.customerPareto || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9 }}
            angle={-25}
            textAnchor="end"
            height={70}
            interval={0}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            unit="%"
          />
          <Tooltip
            formatter={(v, name) =>
              name === "cumulativePct"
                ? `${formatAmount(v)}%`
                : fmtMoney(v, base)
            }
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="value"
            name="Revenue"
            fill={ACCENT}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulativePct"
            name="Cumulative %"
            stroke={BRAND}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Keep overview KPI/chart when user has View on the linked ERP submodule. */
function overviewAllowsModule(access, moduleKey) {
  if (!moduleKey) return true;
  if (Array.isArray(moduleKey)) {
    return moduleKey.some((key) => !!access?.[key]);
  }
  return !!access?.[moduleKey];
}

function OverviewTab({
  data,
  approx,
  summary,
  base,
  executiveKpis: ek = {},
  trendGrain,
  trendBucketHint,
  moduleAccess = {},
}) {
  const growth = Number(ek.salesGrowthPct) || 0;
  const growthUp = growth >= 0;
  const canInvoices = !!moduleAccess.invoices;
  const canSalesOrders = !!moduleAccess.salesOrders;
  const canPayments = !!moduleAccess.payments;

  const paymentsReceived =
    data.payments?.summary?.totalApproximateInBaseCurrency ??
    data.payments?.summary?.total ??
    0;

  const overviewKpiDefs = [
    {
      module: "invoices",
      title: "Total Revenue",
      value: fmtMoney(
        ek.totalRevenue ?? ek.grossRevenue ?? approx.invoicedBilling,
        base,
      ),
      sub: "Invoiced revenue in period (excludes draft & cancelled)",
      icon: Calculator,
    },
    {
      module: "salesOrders",
      title: "Order average",
      value: fmtMoney(ek.averageOrderValue, base),
      sub: "Average sales order value (gross booking ÷ orders)",
      icon: Target,
    },
    {
      module: "invoices",
      title: "Total Invoiced Amount",
      value: fmtMoney(approx.invoicedBilling, base),
      sub: "Confirmed invoice billing",
      icon: FileText,
    },
    {
      module: "salesOrders",
      title: "Open Sales Orders",
      value: fmtMoney(approx.openSalesOrderRemainder, base),
      sub: "Uninvoiced order balance",
      icon: ShoppingCart,
    },
    {
      module: "payments",
      title: "Total Payments Received",
      value: fmtMoney(paymentsReceived, base),
      sub: "Collections in selected period",
      icon: Wallet,
    },
    {
      module: ["invoices", "payments"],
      title: "Collection Rate",
      value: `${formatAmount(ek.collectionEfficiency || 0)}%`,
      sub: "Payments vs invoiced amount",
      icon: Percent,
    },
    {
      module: "invoices",
      title: "Outstanding Receivables",
      value: fmtMoney(ek.outstandingReceivables, base),
      sub: "Unpaid invoice balance",
      icon: TrendingDown,
    },
    {
      module: "invoices",
      title: "Sales Growth",
      value: `${growthUp ? "+" : ""}${formatAmount(growth)}%`,
      sub: "Compared to previous period",
      icon: growthUp ? TrendingUp : TrendingDown,
    },
  ];

  const overviewKpis = overviewKpiDefs
    .filter((kpi) => overviewAllowsModule(moduleAccess, kpi.module))
    .map(({ module: _m, ...kpi }) => kpi);

  const funnelStageAccess = {
    "Sales Orders": canSalesOrders,
    Invoices: canInvoices,
    Payments: canPayments,
  };
  const funnelData = (data.salesFunnel || []).filter(
    (row) => funnelStageAccess[row.stage],
  );

  const showRevenueTrend = canInvoices || canSalesOrders;
  const showSalesFunnel = funnelData.length > 0;
  const showAging = canInvoices;
  const showPaymentMethods = canPayments;
  const showRevenueBySource = canInvoices || canSalesOrders;

  const hasOverviewContent =
    overviewKpis.length > 0 ||
    showRevenueTrend ||
    showSalesFunnel ||
    showAging ||
    showPaymentMethods ||
    showRevenueBySource;

  return (
    <>
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3 px-1">
        Executive overview
      </h2>
      {overviewKpis.length > 0 ? (
        <SectionStatStrip stats={overviewKpis} maxColumns={4} />
      ) : null}

      {!hasOverviewContent ? (
        <div className="text-center py-14 text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl">
          No overview metrics are available for your role permissions. Grant
          View on Sales submodules (e.g. {L.salesOrders}, {L.invoices},{" "}
          {L.payments}) to see executive cards and charts here.
        </div>
      ) : null}

      {(showRevenueTrend || showSalesFunnel) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {showRevenueTrend && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-800">
                Revenue trend
              </h3>
              {trendBucketHint ? (
                <p className="text-xs text-gray-500 mt-1">
                  {trendBucketHint} periods · Cash Flow Overview–style dual area
                  (invoiced vs. order booking)
                </p>
              ) : null}
            </div>
            <TrendingUp className="w-5 h-5 text-gray-400 shrink-0" />
          </div>
          {(data.monthlyTrend || []).length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.monthlyTrend || []}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="srRevBilled"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="srRevBooking"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="period"
                    stroke="#6b7280"
                    style={{ fontSize: 12 }}
                    tickFormatter={(v) => formatTrendAxisLabel(v, trendGrain)}
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: 12 }}
                    tickFormatter={(v) => formatAmount(v)}
                    width={72}
                  />
                  <Tooltip
                    content={(props) => (
                      <SalesAnalyticsTooltip
                        {...props}
                        title="Revenue"
                        base={base}
                        labelDetail={
                          props.label != null
                            ? trendPeriodTooltipTitle(
                                String(props.label),
                                trendGrain,
                              )
                            : undefined
                        }
                      />
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {canInvoices ? (
                    <Area
                      type={TREND_CURVE}
                      dataKey="billed"
                      stroke="#10B981"
                      fillOpacity={1}
                      fill="url(#srRevBilled)"
                      name="Invoiced revenue"
                      strokeWidth={2}
                    />
                  ) : null}
                  {canSalesOrders ? (
                    <Area
                      type={TREND_CURVE}
                      dataKey="orderBooking"
                      stroke="#EF4444"
                      fillOpacity={1}
                      fill="url(#srRevBooking)"
                      name="Sales order booking"
                      strokeWidth={2}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
              <p className="text-sm">No trend data available</p>
            </div>
          )}
        </div>
        )}
        {showSalesFunnel && (
        <ChartCard
          title={`Sales funnel - ${L.salesOrders} to ${L.invoices} to ${L.payments}`}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v, name) =>
                  name === "count" ? formatAmount(v) : fmtMoney(v, base)
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="count"
                name="Count"
                fill={BLUE}
                radius={[6, 6, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="value"
                name="Value"
                fill={ACCENT}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        )}
      </div>
      )}

      {(showAging || showPaymentMethods || showRevenueBySource) && (
      <div
        className={`grid grid-cols-1 gap-6 mb-6 ${
          [showAging, showPaymentMethods, showRevenueBySource].filter(Boolean)
            .length >= 2
            ? "lg:grid-cols-2"
            : ""
        } ${
          [showAging, showPaymentMethods, showRevenueBySource].filter(Boolean)
            .length >= 3
            ? "lg:grid-cols-3"
            : ""
        }`}
      >
        {showAging && (
        <ChartCard title="Receivable aging">
          {(data.agingBuckets || []).some((b) => Number(b.amount) > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.agingBuckets || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, _n, props) => [
                    fmtMoney(v, base),
                    props?.payload?.count != null
                      ? `${props.payload.count} invoice(s)`
                      : "Outstanding",
                  ]}
                />
                <Bar
                  dataKey="amount"
                  name="Outstanding"
                  fill="#e85555"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyBanner />
          )}
        </ChartCard>
        )}
        {showPaymentMethods && (
          <PaymentMethodsDonutCard data={data} base={base} />
        )}
        {showRevenueBySource && (
        <ChartCard title="POS vs manual sales">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.revenueBySource || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="source" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtMoney(v, base)} />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill={BRAND}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        )}
      </div>
      )}
      {/* Fulfillment status (operations) chart hidden */}
    </>
  );
}

function normalizeStatusKey(status) {
  return String(status || "unknown")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Badge + card accents for sales order / invoice document statuses */
const DOCUMENT_STATUS_STYLES = {
  draft: {
    badge: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
    card: {
      border: "border-l-slate-400",
      bg: "bg-gradient-to-br from-slate-50 to-white",
      label: "text-slate-700",
    },
  },
  confirmed: {
    badge: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
    card: {
      border: "border-l-blue-500",
      bg: "bg-gradient-to-br from-blue-50 to-white",
      label: "text-blue-800",
    },
  },
  closed: {
    badge: "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200",
    card: {
      border: "border-l-indigo-500",
      bg: "bg-gradient-to-br from-indigo-50 to-white",
      label: "text-indigo-800",
    },
  },
  "partially invoiced": {
    badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
    card: {
      border: "border-l-amber-500",
      bg: "bg-gradient-to-br from-amber-50 to-white",
      label: "text-amber-900",
    },
  },
  "fully invoiced": {
    badge: "bg-teal-100 text-teal-800 ring-1 ring-teal-200",
    card: {
      border: "border-l-teal-500",
      bg: "bg-gradient-to-br from-teal-50 to-white",
      label: "text-teal-800",
    },
  },
  "partially delivered": {
    badge: "bg-violet-100 text-violet-800 ring-1 ring-violet-200",
    card: {
      border: "border-l-violet-500",
      bg: "bg-gradient-to-br from-violet-50 to-white",
      label: "text-violet-800",
    },
  },
  delivered: {
    badge: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    card: {
      border: "border-l-emerald-500",
      bg: "bg-gradient-to-br from-emerald-50 to-white",
      label: "text-emerald-800",
    },
  },
  paid: {
    badge: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    card: {
      border: "border-l-emerald-500",
      bg: "bg-gradient-to-br from-emerald-50 to-white",
      label: "text-emerald-800",
    },
  },
  unpaid: {
    badge: "bg-red-100 text-red-800 ring-1 ring-red-200",
    card: {
      border: "border-l-red-500",
      bg: "bg-gradient-to-br from-red-50 to-white",
      label: "text-red-800",
    },
  },
  partial: {
    badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
    card: {
      border: "border-l-amber-500",
      bg: "bg-gradient-to-br from-amber-50 to-white",
      label: "text-amber-900",
    },
  },
  cancelled: {
    badge: "bg-rose-100 text-rose-800 ring-1 ring-rose-200",
    card: {
      border: "border-l-rose-500",
      bg: "bg-gradient-to-br from-rose-50 to-white",
      label: "text-rose-800",
    },
  },
  canceled: {
    badge: "bg-rose-100 text-rose-800 ring-1 ring-rose-200",
    card: {
      border: "border-l-rose-500",
      bg: "bg-gradient-to-br from-rose-50 to-white",
      label: "text-rose-800",
    },
  },
  generated: {
    badge: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
    card: {
      border: "border-l-sky-500",
      bg: "bg-gradient-to-br from-sky-50 to-white",
      label: "text-sky-800",
    },
  },
  unknown: {
    badge: "bg-gray-100 text-gray-800 ring-1 ring-gray-200",
    card: {
      border: "border-l-gray-400",
      bg: "bg-gradient-to-br from-gray-50 to-white",
      label: "text-gray-700",
    },
  },
};

function resolveDocumentStatusStyle(status) {
  const key = normalizeStatusKey(status);
  if (DOCUMENT_STATUS_STYLES[key]) return DOCUMENT_STATUS_STYLES[key];
  if (key.includes("confirm")) return DOCUMENT_STATUS_STYLES.confirmed;
  if (key.includes("close")) return DOCUMENT_STATUS_STYLES.closed;
  if (key.includes("deliver")) return DOCUMENT_STATUS_STYLES.delivered;
  if (key.includes("invoic")) {
    if (key.includes("partial"))
      return DOCUMENT_STATUS_STYLES["partially invoiced"];
    if (key.includes("full")) return DOCUMENT_STATUS_STYLES["fully invoiced"];
  }
  if (key.includes("paid")) return DOCUMENT_STATUS_STYLES.paid;
  if (key.includes("unpaid")) return DOCUMENT_STATUS_STYLES.unpaid;
  if (key.includes("partial")) return DOCUMENT_STATUS_STYLES.partial;
  if (key.includes("cancel")) return DOCUMENT_STATUS_STYLES.cancelled;
  if (key.includes("draft")) return DOCUMENT_STATUS_STYLES.draft;
  return DOCUMENT_STATUS_STYLES.unknown;
}

function formatCommissionRateCell(ratePercent, commissionBase) {
  const rate = Number(ratePercent);
  const base = Number(commissionBase) || 0;
  if (Number.isFinite(rate) && rate > 0) {
    return `${rate}%`;
  }
  if (Number.isFinite(rate) && rate === 0) {
    return "0%";
  }
  if (base > 0) {
    return (
      <span
        className="text-amber-700 text-xs font-medium"
        title="Commission % is not set on this salesperson (HR / Sales person settings)"
      >
        Not set
      </span>
    );
  }
  return "";
}

function DocumentStatusBadge({ status }) {
  if (!status) return null;
  const style = resolveDocumentStatusStyle(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}
    >
      {status}
    </span>
  );
}

function PerformanceStatusBadge({ status }) {
  if (!status) return null;
  const key = String(status).toLowerCase();
  const styles = {
    payable: "bg-emerald-100 text-emerald-800",
    "fully collected": "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-900",
    "partial collection": "bg-amber-100 text-amber-900",
    "on hold": "bg-slate-200 text-slate-800",
    outstanding: "bg-red-100 text-red-800",
    "no invoice": "bg-gray-100 text-gray-700",
  };
  const cls = styles[key] || "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {status}
    </span>
  );
}

function formatOrderRefs(numbers) {
  const list = (numbers || []).filter((n) => n && n !== "?" && n !== "-");
  if (!list.length) return "";
  return list.join(", ");
}

function SalespersonCommissionTab({ rows }) {
  const documentNav = useSalesReportDocumentNav();
  const [ordersModal, setOrdersModal] = useState(null);

  const openOrdersModal = (row) => {
    const orders = (row.linkedSalesOrders || []).length
      ? row.linkedSalesOrders
      : (row.orderNumbers || []).map((num) => ({
          salesOrderId: null,
          salesOrderNumber: num,
        }));
    setOrdersModal({
      name: row.name,
      orders,
      commissionEarned: row.commissionEarned,
      commissionBase: row.commissionBase,
      ratePercent: row.ratePercent,
      invoiced: row.invoiced,
      collected: row.collected,
    });
  };

  const renderSalespersonOrderRow = (order, idx) => {
    const label = order.salesOrderNumber || order.docNo || "";
    const soHref = documentNav.salesOrderDetailPath(order.salesOrderId);
    const canOpenSo =
      documentNav.canLinkSalesOrder && Boolean(order.salesOrderId) && soHref;
    const orderAmt = Number(order.amount) || 0;
    const invoicedAmt = Number(order.invoiced) || 0;
    const paidAmt = Number(order.collected) || 0;
    const commissionBase = Number(order.commissionBase) || 0;
    const estCommission = Number(order.commissionEarned) || 0;
    const invoiceRefs =
      Array.isArray(order.invoiceRefs) && order.invoiceRefs.length > 0
        ? order.invoiceRefs
        : Array.isArray(order.invoiceNumbers)
          ? order.invoiceNumbers.map((n) => ({
              invoiceId: "",
              invoiceNumber: n,
            }))
          : [];

    return (
      <tr key={order.salesOrderId || `${label}-${idx}`}>
        <td className="px-3 py-2">
          <ReportDocLink
            enabled={canOpenSo}
            href={soHref}
            className="font-medium text-left text-sm"
          >
            {label}
          </ReportDocLink>
          {order.status ? (
            <div className="text-xs text-gray-500 mt-0.5">{order.status}</div>
          ) : null}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-600">
          {order.salesOrderDate ? fmtDate(order.salesOrderDate) : ""}
        </td>
        <td
          className="px-3 py-2 text-gray-700 max-w-[220px] truncate"
          title={
            invoiceRefs.length
              ? invoiceRefs.map((r) => r.invoiceNumber).join(", ")
              : ""
          }
        >
          {renderInvoiceRefLinks(invoiceRefs, documentNav)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {fmtMoney(orderAmt, order.currency)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {fmtMoney(invoicedAmt, order.currency)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {fmtMoney(paidAmt, order.currency)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {fmtMoney(commissionBase, order.currency)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums font-medium">
          {fmtMoney(estCommission, order.currency)}
        </td>
      </tr>
    );
  };

  return (
    <>
      <ReportTable
        title="Salesperson Commission Report"
        icon={Percent}
        headers={[
          L.salesPerson,
          L.salesOrders,
          "Rate",
          "Commission Base",
          "Commission Earned",
          "Actions",
        ]}
        rows={rows}
        renderRow={(row) => {
          const orderCount =
            row.orders ??
            (row.linkedSalesOrders || []).length ??
            (row.orderNumbers || []).length;
          const hasOrders = Number(orderCount) > 0;

          return (
            <tr
              key={row.salespersonId || row.name}
              className="border-b hover:bg-gray-50/60"
            >
              <td className="px-4 py-3 text-sm align-top">
                <div className="font-semibold text-gray-900">{row.name}</div>
              </td>
              <td className="px-4 py-3 text-sm text-center tabular-nums align-top">
                {Number(orderCount) || 0}
              </td>
              <td className="px-4 py-3 text-sm text-center tabular-nums align-top">
                {formatCommissionRateCell(
                  row.ratePercent,
                  row.commissionBase,
                )}
              </td>
              <td className="px-4 py-3 text-sm text-right align-top">
                <div className="tabular-nums font-medium">
                  {fmtMoney(row.commissionBase)}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold text-gray-900 align-top">
                {fmtMoney(row.commissionEarned)}
              </td>
              <td className="px-4 py-3 text-sm align-top">
                {hasOrders ? (
                  <button
                    type="button"
                    onClick={() => openOrdersModal(row)}
                    className="p-1.5 text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors"
                    title={`View ${L.salesOrders.toLowerCase()}`}
                    aria-label={`View ${L.salesOrders.toLowerCase()} for ${row.name}`}
                  >
                    <Eye size={18} />
                  </button>
                ) : null}
              </td>
            </tr>
          );
        }}
      />

      <CustomModal
        open={Boolean(ordersModal)}
        onClose={() => setOrdersModal(null)}
        title={ordersModal?.name || L.salesOrders}
        width="640px"
        showActions={false}
      >
        {ordersModal?.orders?.length ? (
          <>
            <div className="mb-6 rounded-lg bg-slate-50 border border-slate-100 px-3 py-3 text-xs text-slate-600 space-y-2">
              <div className="flex justify-between gap-4 py-0.5">
                <span>Invoiced (period)</span>
                <span className="font-medium tabular-nums">
                  {fmtMoney(ordersModal.invoiced)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <span>Collected (period)</span>
                <span className="font-medium tabular-nums">
                  {fmtMoney(ordersModal.collected)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <span>Commission base</span>
                <span className="font-medium tabular-nums">
                  {fmtMoney(ordersModal.commissionBase)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 mt-2">
                <span className="font-semibold text-slate-800">
                  Total commission
                  {ordersModal.ratePercent > 0
                    ? ` ${ordersModal.ratePercent}%`
                    : ""}
                </span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {fmtMoney(ordersModal.commissionEarned)}
                </span>
              </div>
            </div>
            <ModalPaginatedTable
              tableKey={`salesperson-so-${ordersModal.name}`}
              headers={[
                `${L.salesOrder} #`,
                "Date",
                "Invoice #",
                "Order total",
                "Invoiced",
                "Paid",
                "Commission base",
                "Commission",
              ]}
              rows={ordersModal.orders}
              renderRow={renderSalespersonOrderRow}
            />
          </>
        ) : (
          <p className="text-sm text-gray-500 py-4">
            No {L.salesOrders.toLowerCase()} in the selected period.
          </p>
        )}
      </CustomModal>
    </>
  );
}

function customerHasDetailRow(row) {
  return (
    Number(row.invoices) > 0 ||
    Number(row.invoiced) > 0 ||
    (row.linkedSalesOrders || []).length > 0 ||
    (row.linkedDirectInvoices || []).length > 0
  );
}

function renderInvoiceRefLinks(invoiceRefs, documentNav) {
  if (!invoiceRefs?.length) return "";
  const { canLinkInvoice, invoiceDetailPath } = documentNav || {};
  return (
    <div className="flex flex-wrap gap-1">
      {invoiceRefs.map((ref, refIdx) => (
        <ReportDocLink
          key={`${ref.invoiceId || ref.invoiceNumber}-${refIdx}`}
          enabled={canLinkInvoice && !!ref.invoiceId}
          href={invoiceDetailPath?.(ref.invoiceId)}
          className="text-xs"
        >
          {ref.invoiceNumber}
        </ReportDocLink>
      ))}
    </div>
  );
}

function CustomerPerformanceTab({ rows }) {
  const documentNav = useSalesReportDocumentNav();
  const [detailModal, setDetailModal] = useState(null);

  const openCustomerDetailModal = (row) => {
    const orders = (row.linkedSalesOrders || []).length
      ? row.linkedSalesOrders
      : (row.orderNumbers || []).map((num) => ({
          salesOrderId: null,
          salesOrderNumber: num,
        }));
    setDetailModal({
      name: row.customerName,
      orders,
      directInvoices: row.linkedDirectInvoices || [],
      invoiced: row.invoiced,
      collected: row.collected,
      salesOrderUnpaid: row.salesOrderUnpaid ?? row.unpaid,
      collectionPct: row.collectionPct,
      status: row.status,
      primaryCurrency: row.primaryCurrency,
      invoiceCount: row.invoices,
    });
  };

  const renderCustomerOrderRow = (order, idx) => {
    const label = order.salesOrderNumber || order.docNo || "";
    const soHref = documentNav.salesOrderDetailPath(order.salesOrderId);
    const canOpenSo =
      documentNav.canLinkSalesOrder && Boolean(order.salesOrderId) && soHref;
    const orderAmt = Number(order.amount) || 0;
    const invoicedAmt = Number(order.invoiced) || 0;
    const collectedAmt = Number(order.collected) || 0;
    const balanceAmt =
      Number(order.balanceDue) || Math.max(0, invoicedAmt - collectedAmt);
    const invoiceRefs =
      Array.isArray(order.invoiceRefs) && order.invoiceRefs.length > 0
        ? order.invoiceRefs
        : Array.isArray(order.invoiceNumbers)
          ? order.invoiceNumbers.map((n) => ({
              invoiceId: "",
              invoiceNumber: n,
            }))
          : [];

    return (
      <tr key={order.salesOrderId || `${label}-${idx}`}>
        <td className="px-3 py-2">
          <ReportDocLink
            enabled={canOpenSo}
            href={soHref}
            className="font-medium text-left text-sm"
          >
            {label}
          </ReportDocLink>
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-600">
          {order.salesOrderDate ? fmtDate(order.salesOrderDate) : ""}
        </td>
        <td className="px-3 py-2 text-gray-700 max-w-[220px]">
          {renderInvoiceRefLinks(invoiceRefs, documentNav)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {fmtMoney(orderAmt, order.currency)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {fmtMoney(invoicedAmt, order.currency)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
          {fmtMoney(collectedAmt, order.currency)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-red-700">
          {fmtMoney(balanceAmt, order.currency)}
        </td>
        <td className="px-3 py-2">
          <DocumentStatusBadge status={order.status} />
        </td>
      </tr>
    );
  };

  const renderDirectInvoiceRow = (inv, idx) => (
    <tr key={inv.invoiceId || `${inv.invoiceNumber}-${idx}`}>
      <td className="px-3 py-2">
        <ReportDocLink
          enabled={documentNav.canLinkInvoice && !!inv.invoiceId}
          href={documentNav.invoiceDetailPath(inv.invoiceId)}
          className="font-medium text-left text-sm"
        >
          {inv.invoiceNumber}
        </ReportDocLink>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-gray-600">
        {inv.invoiceDate ? fmtDate(inv.invoiceDate) : ""}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmtMoney(inv.invoiced, inv.currency)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
        {fmtMoney(inv.collected, inv.currency)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-red-700">
        {fmtMoney(inv.balanceDue, inv.currency)}
      </td>
      <td className="px-3 py-2">
        <DocumentStatusBadge status={inv.status} />
      </td>
    </tr>
  );

  return (
    <>
      <ReportTable
        title="Customer Collection Performance"
        icon={Users}
        headers={[
          L.customer,
          L.salesOrders,
          "Invoiced",
          "Collected",
          "Unpaid (SO)",
          "Collection %",
          "Status",
          "Actions",
        ]}
        tableNote=""
        rows={rows}
        renderRow={(row) => {
          const orderCount =
            row.orders ??
            (row.linkedSalesOrders || []).length ??
            (row.orderNumbers || []).length;
          const hasDetail = customerHasDetailRow(row);

          return (
            <tr key={row.customerId} className="border-b hover:bg-gray-50/60">
              <td className="px-4 py-3 text-sm align-top">
                <div className="font-semibold text-gray-900">
                  {row.customerName}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-center tabular-nums align-top">
                {Number(orderCount) || 0}
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums align-top">
                {fmtMoney(row.invoiced, row.primaryCurrency)}
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums align-top text-emerald-700">
                {fmtMoney(row.collected, row.primaryCurrency)}
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums align-top text-red-700">
                {fmtMoney(
                  row.salesOrderUnpaid ?? row.unpaid,
                  row.primaryCurrency,
                )}
              </td>
              <td className="px-4 py-3 text-sm text-center tabular-nums align-top">
                {fmtPercent(row.collectionPct)}
              </td>
              <td className="px-4 py-3 text-sm align-top">
                <PerformanceStatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3 text-sm align-top">
                {hasDetail ? (
                  <button
                    type="button"
                    onClick={() => openCustomerDetailModal(row)}
                    className="p-1.5 text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors"
                    title="View customer sales details"
                    aria-label={`View details for ${row.customerName}`}
                  >
                    <Eye size={18} />
                  </button>
                ) : null}
              </td>
            </tr>
          );
        }}
      />

      <CustomModal
        open={Boolean(detailModal)}
        onClose={() => setDetailModal(null)}
        title={detailModal?.name || L.customer}
        width="760px"
        showActions={false}
      >
        {detailModal?.orders?.length || detailModal?.directInvoices?.length ? (
          <>
            <div className="mb-6 rounded-lg bg-slate-50 border border-slate-100 px-3 py-3 text-xs text-slate-600 space-y-2">
              <div className="flex justify-between gap-4 py-0.5">
                <span>Invoiced (period)</span>
                <span className="font-medium tabular-nums">
                  {fmtMoney(detailModal.invoiced, detailModal.primaryCurrency)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <span>Collected (period)</span>
                <span className="font-medium tabular-nums text-emerald-700">
                  {fmtMoney(detailModal.collected, detailModal.primaryCurrency)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <span>Unpaid (SO)</span>
                <span className="font-medium tabular-nums text-red-700">
                  {fmtMoney(
                    detailModal.salesOrderUnpaid,
                    detailModal.primaryCurrency,
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <span>Collection %</span>
                <span className="font-medium tabular-nums">
                  {fmtPercent(detailModal.collectionPct)}
                </span>
              </div>
              {detailModal.invoiceCount != null && (
                <div className="flex justify-between gap-4 py-0.5">
                  <span>Invoices (period)</span>
                  <span className="font-medium tabular-nums">
                    {detailModal.invoiceCount}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center gap-4 border-t border-slate-200 pt-2 mt-2">
                <span className="font-semibold text-slate-800">Status</span>
                <PerformanceStatusBadge status={detailModal.status} />
              </div>
            </div>

            {detailModal.orders?.length > 0 && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">
                  {L.salesOrders}
                </h4>
                <ModalPaginatedTable
                  tableKey={`customer-so-${detailModal.name}`}
                  headers={[
                    `${L.salesOrder} #`,
                    "Date",
                    "Invoice #",
                    `${L.salesOrder} total`,
                    "Invoiced",
                    "Collected",
                    "Balance",
                    "Status",
                  ]}
                  rows={detailModal.orders}
                  renderRow={renderCustomerOrderRow}
                />
              </div>
            )}

            {detailModal.directInvoices?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">
                  Invoices
                </h4>
                <ModalPaginatedTable
                  tableKey={`customer-inv-${detailModal.name}`}
                  headers={[
                    "Invoice #",
                    "Date",
                    "Invoiced",
                    "Collected",
                    "Balance",
                    "Status",
                  ]}
                  rows={detailModal.directInvoices}
                  renderRow={renderDirectInvoiceRow}
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 py-4">
            No sales orders or invoices in the selected period.
          </p>
        )}
      </CustomModal>
    </>
  );
}

function ItemsTab({ rows }) {
  return (
    <ReportTable
      title="Items / Products"
      icon={Package}
      headers={["Item", "Qty invoiced", "Invoiced revenue"]}
      tableNote="Quantities and revenue are from invoice line items in the selected period (not sales order requests)."
      rows={rows}
      renderRow={(row) => (
        <tr key={row.itemKey} className="border-b">
          <td className="px-4 py-2 text-sm">{row.name}</td>
          <td className="px-4 py-2 text-sm text-right tabular-nums">
            {formatAmount(row.qty)}
          </td>
          <td className="px-4 py-2 text-sm text-right tabular-nums">
            {fmtMoney(row.revenue)}
          </td>
        </tr>
      )}
    />
  );
}

function InvoicesTab({ data }) {
  const documentNav = useSalesReportDocumentNav();

  return (
    <>
      <div className="mb-5">
        <StatusBreakdownDonutCard
          title="Invoices by status"
          data={data.summary?.statusBreakdown}
          unitLabel="invoices"
        />
      </div>
      <ReportTable
        title="Invoices"
        icon={FileText}
        headers={["Invoice", "Date", "Customer", "Status", "Amount"]}
        rows={data.rows || []}
        renderRow={(row) => (
          <tr key={row.invoiceId} className="border-b">
            <td className="px-4 py-2 text-sm">
              <ReportDocLink
                enabled={documentNav.canLinkInvoice && !!row.invoiceId}
                href={documentNav.invoiceDetailPath(row.invoiceId)}
                className="font-medium"
              >
                {row.invoiceNumber}
              </ReportDocLink>
            </td>
            <td className="px-4 py-2 text-sm">{fmtDate(row.invoiceDate)}</td>
            <td className="px-4 py-2 text-sm">{row.customerName}</td>
            <td className="px-4 py-2 text-sm">
              <DocumentStatusBadge status={row.status} />
            </td>
            <td className="px-4 py-2 text-sm text-right tabular-nums">
              {fmtMoney(row.amount, row.currency)}
            </td>
          </tr>
        )}
      />
    </>
  );
}

function SalesOrdersTab({ data, trend, trendGrain, trendBucketHint, base }) {
  return (
    <>
      <div className="mb-5 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <StatusBreakdownDonutCard
          title="Sales orders by status"
          data={data.summary?.statusBreakdown}
          unitLabel="orders"
        />
        <SalesOrdersTrendChart
          trend={trend}
          grain={trendGrain}
          trendBucketHint={trendBucketHint}
          base={base}
        />
      </div>
      <SalesOrderDetailTable title="Sales Orders" rows={data.rows || []} />
    </>
  );
}

function SalesOrderDetailTable({ title, rows }) {
  const documentNav = useSalesReportDocumentNav();

  return (
    <ReportTable
      title={title}
      icon={ShoppingCart}
      headers={[
        `${L.salesOrder} #`,
        "Date",
        L.customer,
        "Items (qty)",
        L.salesPerson,
        `${L.salesOrder} total`,
        "Status",
      ]}
      rows={rows}
      renderRow={(row) => (
        <tr key={row.salesOrderId} className="border-b hover:bg-gray-50/50">
          <td className="px-4 py-2 text-sm font-medium text-gray-900">
            <ReportDocLink
              enabled={documentNav.canLinkSalesOrder && !!row.salesOrderId}
              href={documentNav.salesOrderDetailPath(row.salesOrderId)}
            >
              {row.salesOrderNumber || ""}
            </ReportDocLink>
          </td>
          <td className="px-4 py-2 text-sm whitespace-nowrap">
            {fmtDate(row.salesOrderDate)}
          </td>
          <td className="px-4 py-2 text-sm">{row.customerName || ""}</td>
          <td
            className="px-4 py-2 text-sm text-gray-700 max-w-xs truncate"
            title={row.itemsSummary || ""}
          >
            {row.itemsSummary || ""}
          </td>
          <td className="px-4 py-2 text-sm">
            {row.salespersonName || "Unassigned"}
          </td>
          <td className="px-4 py-2 text-sm text-right tabular-nums font-medium">
            {fmtMoney(row.total, row.currency)}
          </td>
          <td className="px-4 py-2 text-sm">
            <DocumentStatusBadge status={row.status} />
          </td>
        </tr>
      )}
    />
  );
}

function PaymentStatusBadge({ status }) {
  const key = String(status || "paid").toLowerCase();
  const styles = {
    paid: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    partial: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
    unpaid: "bg-red-100 text-red-800 ring-1 ring-red-200",
  };
  const labels = {
    paid: "Paid",
    partial: "Partial",
    unpaid: "Unpaid",
  };
  const cls = styles[key] || "bg-gray-100 text-gray-800 ring-1 ring-gray-200";
  const label = labels[key] || status || "Paid";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function PaymentsTab({ data }) {
  return (
    <ReportTable
      title="Payments"
      icon={CreditCard}
      headers={[
        "Date",
        "Invoice",
        "Customer",
        "Payment method",
        "Status",
        "Reference",
        "Amount",
      ]}
      rows={data.rows || []}
      renderRow={(row) => (
        <tr key={row.paymentId} className="border-b">
          <td className="px-4 py-2 text-sm">{fmtDate(row.paymentDate)}</td>
          <td className="px-4 py-2 text-sm">{row.invoiceNumber}</td>
          <td className="px-4 py-2 text-sm">{row.customerName}</td>
          <td className="px-4 py-2 text-sm">{row.paymentMode || ""}</td>
          <td className="px-4 py-2 text-sm">
            <PaymentStatusBadge status={row.paymentStatus} />
          </td>
          <td className="px-4 py-2 text-sm">{row.reference || ""}</td>
          <td className="px-4 py-2 text-sm text-right tabular-nums">
            {fmtMoney(row.amount, row.currency)}
          </td>
        </tr>
      )}
    />
  );
}

function PaginatedDataTable({ headers, rows, renderRow, tableKey }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(DEFAULT_PAGE_SIZE);

  const allRows = rows || [];
  const totalRecords = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage) || 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [totalRecords, tableKey]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return allRows.slice(start, start + recordsPerPage);
  }, [allRows, currentPage, recordsPerPage]);

  return (
    <DataTable
      headers={headers}
      data={paginatedRows}
      renderRow={renderRow}
      currentPage={currentPage}
      totalPages={totalPages}
      totalRecords={totalRecords}
      onPageChange={setCurrentPage}
      recordsPerPage={recordsPerPage}
      onRecordsPerPageChange={(n) => {
        setRecordsPerPage(n);
        setCurrentPage(1);
      }}
      containerClassName="rounded-xl p-0 mb-0"
      wideTable
    />
  );
}

const MODAL_TABLE_HIDE_SCROLLBAR =
  "overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const MODAL_TABLE_PAGE_SIZES = [5, 10, 25, 50];

function ModalPaginatedTable({
  headers,
  rows,
  renderRow,
  tableKey,
  defaultPageSize = 5,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(defaultPageSize);

  const allRows = rows || [];
  const totalRecords = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage) || 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [totalRecords, tableKey]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return allRows.slice(start, start + recordsPerPage);
  }, [allRows, currentPage, recordsPerPage]);

  if (!totalRecords) return null;

  const navBtnClass =
    "min-w-[28px] h-7 px-1.5 rounded border border-gray-200 bg-white text-gray-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50";

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className={MODAL_TABLE_HIDE_SCROLLBAR}>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRows.map((row, idx) =>
              renderRow(row, (currentPage - 1) * recordsPerPage + idx),
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-100 bg-gray-50/90 text-xs text-gray-600">
        <div className="flex flex-wrap items-center gap-2 font-semibold">
          <span>Show</span>
          <select
            value={recordsPerPage}
            onChange={(e) => {
              setRecordsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs outline-none"
          >
            {MODAL_TABLE_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            entries of {totalRecords}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 font-semibold">
          <button
            type="button"
            className={navBtnClass}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
            aria-label="First page"
          >
            «
          </button>
          <button
            type="button"
            className={navBtnClass}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="px-2 tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className={navBtnClass}
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className={navBtnClass}
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            aria-label="Last page"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportTable({
  title,
  icon: Icon,
  headers,
  rows,
  renderRow,
  side,
  tableNote,
}) {
  return (
    <div className="w-full space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden w-full">
        <div className="px-4 pt-4 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            {Icon ? (
              <span className="rounded-lg bg-gray-100 p-2 text-gray-700">
                <Icon size={18} strokeWidth={2.25} />
              </span>
            ) : null}
            {title}
          </div>
          {tableNote ? (
            <p className="text-xs text-slate-500 mt-2">{tableNote}</p>
          ) : null}
        </div>
        {rows?.length ? (
          <PaginatedDataTable
            headers={headers}
            rows={rows}
            renderRow={renderRow}
            tableKey={title}
          />
        ) : (
          <div className="p-4">
            <EmptyBanner />
          </div>
        )}
      </div>
      {side ? <div className="w-full max-w-sm">{side}</div> : null}
    </div>
  );
}

function KpiCard({ title, value, sub, icon: Icon, accent }) {
  const a = accent || KPI_ACCENTS[0];
  return (
    <div
      className={`rounded-xl border border-gray-100 shadow-sm overflow-hidden ${a.border} border-l-[5px] ${a.bg}`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`text-[11px] font-bold uppercase tracking-wide ${a.label}`}
          >
            {title}
          </div>
          {Icon ? (
            <span className={`rounded-lg p-2 ${a.iconBg}`}>
              <Icon size={18} strokeWidth={2.25} />
            </span>
          ) : null}
        </div>
        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 tabular-nums">
          {value}
        </div>
        {sub ? <div className="text-xs text-slate-600 mt-2">{sub}</div> : null}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm w-full min-w-0 ${className}`}
    >
      <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-gray-400" />
        {title}
      </div>
      {subtitle ? (
        <p className="text-xs text-slate-500 mt-1.5 mb-3 leading-snug">
          {subtitle}
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </div>
  );
}

function TopBarPanel({ title, subtitle, data, color }) {
  const rows = (data || []).slice(0, 8);
  const chartH = Math.min(320, 120 + rows.length * 22);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {rows.length ? (
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart
            data={rows}
            margin={{ left: 0, right: 8, bottom: 4, top: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="name"
              angle={-25}
              textAnchor="end"
              interval={0}
              height={58}
              tick={{ fontSize: 10 }}
            />
            <YAxis tick={{ fontSize: 11 }} width={44} />
            <Tooltip formatter={(v) => fmtMoney(v)} />
            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyBanner />
      )}
    </ChartCard>
  );
}

function EmptyBanner() {
  return (
    <div className="py-10 text-center text-slate-400 text-sm rounded-xl bg-slate-50/80 border border-dashed border-slate-200">
      No data found.
    </div>
  );
}

export default CustomerReports;
