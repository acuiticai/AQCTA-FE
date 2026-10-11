import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  RefreshCw,
  CircleDollarSign,
  ShoppingCart,
  Receipt,
  Utensils,
  ChefHat,
  Store,
  Clock,
  TrendingUp,
  Percent,
  CalendarDays,
  AlertCircle,
  Download,
  Eye,
  X,
  MessageSquare,
  StickyNote,
  Users,
  Phone,
  LayoutGrid,
  History,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import PosServices from "@/services/PosServices";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { notifyError } from "@/utils/toast";
import { getPaymentMethodIcon } from "./utils/paymentIcons";
import { posFilterBarSelectStyles } from "./utils/posFilterBarStyles";
import { DataTable } from "@/page-layouts";
import { formatDate } from "@/components/formatAmount";
import ReceiptPreview from "./components/ReceiptPreview";
import ShiftsTab from "./components/ShiftsTab";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "mtd", label: "Month to date" },
];

export const formatMoney = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatInt = (v) => Number(v || 0).toLocaleString();

const formatSec = (v) => {
  const s = Math.max(0, Math.round(Number(v || 0)));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

export const StatCard = ({ icon: Icon, label, value, accent, caption }) => (
  <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-150">
    <div className="flex items-center justify-between">
      <span className={`h-9 w-9 inline-flex items-center justify-center rounded-xl ${accent}`}>
        <Icon size={17} />
      </span>
      {caption && (
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {caption}
        </span>
      )}
    </div>
    <div>
      <div className="text-[22px] font-extrabold text-gray-900 leading-none tabular-nums tracking-tight">
        {value}
      </div>
      <div className="text-[11px] text-gray-500 mt-1.5 font-medium">{label}</div>
    </div>
  </div>
);

export const Section = ({ title, right, children, className = "" }) => (
  <div
    className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {right}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// Horizontal bar chart helper (no external deps)
const HBar = ({ value, max, color = "bg-indigo-500" }) => (
  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
    <div
      className={`h-full ${color} rounded-full transition-all`}
      style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }}
    />
  </div>
);

const PosReports = () => {
  const {
    state: { adminInfo },
  } = useContext(AdminContext);
  const token = adminInfo?.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const businesses = useMemo(
    () => adminInfo?.businesses || [],
    [adminInfo?.businesses],
  );
  const [businessId, setBusinessId] = useState(() => {
    const fromQuery =
      new URLSearchParams(window.location.search).get("selectedOrg") || "";
    return fromQuery || localStorage.getItem("pos.selectedBusiness") || "";
  });
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  const [summary, setSummary] = useState(null);
  const [topItems, setTopItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [kitchen, setKitchen] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit, setOrdersLimit] = useState(10);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("all");
  const [ordersServiceTypeFilter, setOrdersServiceTypeFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptBusiness, setReceiptBusiness] = useState(null);

  useEffect(() => {
    if (!businesses.length) return;
    const valid = new Set(businesses.map((b) => b._id));
    if (!businessId || !valid.has(businessId)) {
      setBusinessId(businesses[0]._id);
    }
  }, [businesses, businessId]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!businessId) return;
      silent ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const params = { businessId, range };
        const [s, t, tb, k, o] = await Promise.all([
          PosServices.getSalesSummary(params, headers),
          PosServices.getTopItemsReport({ ...params, limit: 10 }, headers),
          PosServices.getTablesReport(params, headers),
          PosServices.getKitchenReport(params, headers),
          PosServices.getOrders(
            {
              business: businessId,
              page: ordersPage,
              limit: ordersLimit,
              search: ordersSearch || undefined,
              status:
                ordersStatusFilter && ordersStatusFilter !== "all"
                  ? ordersStatusFilter
                  : undefined,
              serviceType:
                ordersServiceTypeFilter && ordersServiceTypeFilter !== "all"
                  ? ordersServiceTypeFilter
                  : undefined,
            },
            headers,
          ),
        ]);
        if (s.data?.success) setSummary(s.data.data);
        if (t.data?.success) setTopItems(t.data.data.items || []);
        if (tb.data?.success) setTables(tb.data.data.rows || []);
        if (k.data?.success) setKitchen(k.data.data);
        if (o.data?.success) {
          setOrders(o.data.data || []);
          setOrdersTotal(Number(o.data.total || 0));
          setOrdersTotalPages(Number(o.data.totalPages || 1));
          setOrdersPage(Number(o.data.page || ordersPage));
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load reports");
        notifyError("Could not load POS reports");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      businessId,
      range,
      ordersPage,
      ordersLimit,
      ordersSearch,
      ordersStatusFilter,
      ordersServiceTypeFilter,
    ],
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadShifts = useCallback(
    async ({ silent = false } = {}) => {
      if (!businessId) return;
      silent ? setRefreshing(true) : setShiftsLoading(true);
      try {
        const res = await PosServices.getShiftHistory(
          { business: businessId, range },
          headers,
        );
        if (res.data?.success) setShifts(res.data.data || []);
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to load shift history",
        );
      } finally {
        setShiftsLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessId, range],
  );

  useEffect(() => {
    if (activeTab === "shifts") loadShifts();
  }, [activeTab, loadShifts]);

  useEffect(() => {
    setOrdersPage(1);
  }, [
    businessId,
    range,
    ordersSearch,
    ordersStatusFilter,
    ordersServiceTypeFilter,
  ]);

  const topItemsMax = useMemo(
    () => topItems.reduce((m, r) => Math.max(m, Number(r.quantity || 0)), 0),
    [topItems],
  );
  const tablesMax = useMemo(
    () => tables.reduce((m, r) => Math.max(m, Number(r.revenue || 0)), 0),
    [tables],
  );
  const hourlyMax = useMemo(
    () =>
      (summary?.hourly || []).reduce(
        (m, r) => Math.max(m, Number(r.revenue || 0)),
        0,
      ),
    [summary?.hourly],
  );

  const selectedBiz = useMemo(
    () => businesses.find((b) => b._id === businessId),
    [businesses, businessId],
  );

  const handleExportCsv = useCallback(() => {
    if (!orders.length) return;
    const rows = [
      [
        "Order #",
        "Date",
        "Status",
        "Table",
        "Floor",
        "Cashier",
        "Sales Channel",
        "Items",
        "Subtotal",
        "Discount",
        "Tax",
        "Total",
        "Payments",
      ],
      ...orders.map((o) => {
        const itemsCount = (o.items || []).reduce(
          (sum, i) => sum + Number(i.quantity || 0),
          0,
        );
        const cashier =
          o?.cashier?.name ||
          [o?.cashier?.firstName, o?.cashier?.lastName]
            .filter(Boolean)
            .join(" ") ||
          o?.cashier?.email ||
          "";
        const payments = (o.payments || [])
          .map(
            (p) =>
              `${p.paymentMethodName || p.method || ""}:${Number(
                p.amount || 0,
              ).toFixed(2)}`,
          )
          .join(" | ");
        const dt = o.completedAt || o.createdAt;
        return [
          o.orderNumber || "",
          dt ? new Date(dt).toISOString() : "",
          o.status || "",
          o?.table ? o.table.label || o.table.tableNumber : "Walk-in",
          o?.table?.floor || "",
          cashier,
          itemsCount,
          Number(o.subtotal || 0).toFixed(2),
          Number(o.discountAmount || 0).toFixed(2),
          Number(o.taxAmount || 0).toFixed(2),
          Number(o.total || 0).toFixed(2),
          payments,
          o?.salesChannelName || o?.salesChannel?.name || "POS / Walk-in",
        ];
      }),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname =
      `pos-orders-${selectedBiz?.name || "report"}-${range}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`.replace(/\s+/g, "_");
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  }, [orders, range, selectedBiz?.name]);

  const clearOrdersFilters = useCallback(() => {
    setOrdersSearch("");
    setOrdersStatusFilter("all");
    setOrdersServiceTypeFilter("all");
    setOrdersPage(1);
  }, []);

  const handleOpenReceipt = useCallback(
    async (order) => {
      if (!order?._id) return;
      try {
        const res = await PosServices.getReceipt(order._id, headers);
        if (res.data?.success && res.data?.data) {
          const payload = res.data.data;
          setReceiptOrder({
            ...payload,
            cashierName:
              payload.cashierName ||
              payload?.cashier?.name ||
              adminInfo?.name ||
              adminInfo?.email?.split("@")[0] ||
              "",
          });
          setReceiptBusiness(payload.business || selectedBiz || null);
          return;
        }
      } catch (_) {
        // fallback to row data
      }
      setReceiptOrder({
        ...order,
        cashierName:
          order.cashierName ||
          order?.cashier?.name ||
          [order?.cashier?.firstName, order?.cashier?.lastName]
            .filter(Boolean)
            .join(" ") ||
          order?.cashier?.email ||
          adminInfo?.name ||
          adminInfo?.email?.split("@")[0] ||
          "",
      });
      setReceiptBusiness(selectedBiz || null);
    },
    [headers, adminInfo?.name, adminInfo?.email, selectedBiz],
  );

  const ordersTableHeaders = [
    "Order #",
    "Date",
    "Table",
    "Cashier",
    "Channel",
    "Status",
    "Items",
    "Discount",
    "Tax",
    "Total",
    "Void Reason",
    "Action",
  ];

  const orderFilters = [
    {
      isClearButton: true,
      tooltip: "Clear filters",
      buttonProps: { onClick: clearOrdersFilters },
    },
    {
      label: "Status",
      value: ordersStatusFilter,
      onChange: (value) => {
        setOrdersStatusFilter(value || "all");
        setOrdersPage(1);
      },
      options: [
        { value: "all", label: "All statuses" },
        { value: "completed", label: "Completed" },
        { value: "voided", label: "Voided" },
      ],
      placeholder: "Status",
    },
    {
      label: "Order type",
      value: ordersServiceTypeFilter,
      onChange: (value) => {
        setOrdersServiceTypeFilter(value || "all");
        setOrdersPage(1);
      },
      options: [
        { value: "all", label: "All orders" },
        { value: "table", label: "Table orders" },
        { value: "walkin", label: "Walk-in orders" },
      ],
      placeholder: "Order type",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-[var(--p-blue)]/10 inline-flex items-center justify-center">
                <TrendingUp size={14} className="text-[var(--p-blue)]" />
              </span>
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">POS Reports</h1>
            </div>
            {selectedBiz?.name && (
              <p className="text-[11px] text-gray-500 mt-0.5 pl-9 font-medium">
                {selectedBiz.name}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Business */}
            {businesses.length > 1 && (
              <div className="min-w-[180px] h-9 shrink-0">
                <DropdownBasic
                  placeholder="Select business"
                  options={businesses.map((b) => ({
                    value: b._id,
                    label: b.name,
                  }))}
                  value={businessId}
                  onChange={(v) => setBusinessId(v)}
                  width="100%"
                  appearance="filterPill"
                  isClearable={false}
                  styles={posFilterBarSelectStyles}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                activeTab === "shifts"
                  ? loadShifts({ silent: true })
                  : load({ silent: true })
              }
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            {/* Range chips */}
            <div className="flex h-9 items-stretch p-0.5 bg-gray-100 rounded-lg shrink-0">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={`px-3 flex items-center text-[11px] font-semibold rounded-md transition-all ${
                    range === r.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`inline-flex items-center gap-1.5 h-9 px-3 text-[12px] font-semibold rounded-lg transition-colors ${
              activeTab === "overview"
                ? "bg-[var(--p-blue)]/10 text-[var(--p-blue)]"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <LayoutGrid size={13} />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("shifts")}
            className={`inline-flex items-center gap-1.5 h-9 px-3 text-[12px] font-semibold rounded-lg transition-colors ${
              activeTab === "shifts"
                ? "bg-[var(--p-blue)]/10 text-[var(--p-blue)]"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <History size={13} />
            Shifts &amp; Analytics
          </button>
        </div>
      </div>

      {activeTab === "shifts" && (
        <ShiftsTab shifts={shifts} loading={shiftsLoading} range={range} />
      )}

      {activeTab === "overview" && (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={CircleDollarSign}
            label="Revenue"
            value={formatMoney(summary?.totals?.revenue)}
            accent="bg-emerald-100 text-emerald-700"
            caption="Total"
          />
          <StatCard
            icon={ShoppingCart}
            label="Orders"
            value={formatInt(summary?.totals?.orders)}
            accent="bg-blue-100 text-blue-700"
          />
          <StatCard
            icon={Receipt}
            label="Avg Order Value"
            value={formatMoney(summary?.totals?.avgOrderValue)}
            accent="bg-indigo-100 text-indigo-700"
          />
          <StatCard
            icon={Utensils}
            label="Items Sold"
            value={formatInt(summary?.totals?.totalItems)}
            accent="bg-amber-100 text-amber-700"
          />
          <StatCard
            icon={Percent}
            label="Discounts"
            value={formatMoney(summary?.totals?.discount)}
            accent="bg-rose-100 text-rose-700"
          />
          <StatCard
            icon={ChefHat}
            label="Kitchen Tickets"
            value={formatInt(kitchen?.overall?.total)}
            accent="bg-purple-100 text-purple-700"
          />
        </div>

        {/* Hourly / Daily */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section
            title={range === "today" ? "Hourly revenue" : "Daily revenue"}
            className="lg:col-span-2"
          >
            {(range === "today" ? summary?.hourly || [] : summary?.daily || [])
              .length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No sales in this period
              </div>
            ) : (
              <div className="space-y-1.5">
                {(range === "today"
                  ? summary?.hourly || []
                  : summary?.daily || []
                ).map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-16 text-[11px] font-mono text-gray-500 shrink-0">
                      {range === "today"
                        ? `${String(row.hour).padStart(2, "0")}:00`
                        : row.date?.slice(5)}
                    </div>
                    <div className="flex-1">
                      <HBar value={Number(row.revenue || 0)} max={hourlyMax} />
                    </div>
                    <div className="w-24 text-right text-[11px] font-semibold text-gray-800">
                      {formatMoney(row.revenue)}
                    </div>
                    <div className="w-10 text-right text-[10px] text-gray-400">
                      {formatInt(row.orders)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Payments">
            {summary?.payments?.length ? (
              <div className="space-y-2">
                {summary.payments.map((p, i) => {
                  const { Icon, classes } = getPaymentMethodIcon({
                    name: p.method,
                    type: p.type,
                  });
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-7 w-7 inline-flex items-center justify-center rounded-lg ${classes.iconBg} ${classes.iconText}`}
                        >
                          <Icon size={14} />
                        </span>
                        <div>
                          <div className="text-xs font-bold text-gray-900">
                            {p.method || p.type || "—"}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {formatInt(p.count)} transactions
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-gray-900">
                        {formatMoney(p.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs">
                No payments recorded
              </div>
            )}
          </Section>
        </div>

        {/* Top items & Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Top selling items">
            {topItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No items sold
              </div>
            ) : (
              <div className="space-y-2">
                {topItems.map((it, i) => (
                  <div key={it.itemId || i} className="flex items-center gap-3">
                    <div className="w-5 text-[10px] font-bold text-gray-400">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate">
                        {it.name}
                      </div>
                      <div className="mt-1">
                        <HBar
                          value={Number(it.quantity || 0)}
                          max={topItemsMax}
                          color="bg-amber-500"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-900">
                        {formatInt(it.quantity)} sold
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {formatMoney(it.revenue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Tables performance">
            {tables.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No table activity
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {tables.map((r, i) => (
                  <div
                    key={r.tableId || i}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    <div className="h-8 w-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                      <Store size={13} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-900 truncate">
                        {r.label || `Table ${r.tableNumber}`}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {r.floor ? `${r.floor} · ` : ""}
                        {formatInt(r.orders)} orders · {formatInt(r.items)}{" "}
                        items
                      </div>
                      <div className="mt-1">
                        <HBar
                          value={Number(r.revenue || 0)}
                          max={tablesMax}
                          color="bg-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-900">
                        {formatMoney(r.revenue)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        AOV {formatMoney(r.avgOrderValue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Kitchen ticket status breakdown */}
        {kitchen?.byStatus?.length > 0 && (
          <Section
            title="Kitchen ticket status"
            right={
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {formatInt(kitchen?.overall?.total)} total tickets
              </span>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {["new", "preparing", "ready", "served", "cancelled"].map(
                (key) => {
                  const row = kitchen.byStatus.find(
                    (x) => x.status === key,
                  ) || {
                    status: key,
                    count: 0,
                  };
                  const total = kitchen.overall?.total || 0;
                  const pct = total ? Math.round((row.count / total) * 100) : 0;
                  const color =
                    key === "new"
                      ? "bg-gray-400"
                      : key === "preparing"
                        ? "bg-amber-500"
                        : key === "ready"
                          ? "bg-emerald-500"
                          : key === "served"
                            ? "bg-blue-500"
                            : "bg-red-400";
                  return (
                    <div
                      key={key}
                      className="relative p-3 pl-4 rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden"
                    >
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${color}`} />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                          {key}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                          {pct}%
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-gray-900 mt-1 tabular-nums">
                        {formatInt(row.count)}
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </Section>
        )}

        {/* Kitchen performance */}
        <Section
          title="Kitchen performance"
          right={
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Clock size={10} />
              Avg times by section
            </span>
          }
        >
          {!kitchen?.bySection?.length ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No kitchen activity yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-gray-400">
                  <tr>
                    <th className="text-left py-2 pr-2">Section</th>
                    <th className="text-right py-2 px-2">Tickets</th>
                    <th className="text-right py-2 px-2">Avg prep</th>
                    <th className="text-right py-2 pl-2">Avg wait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kitchen.bySection.map((row) => (
                    <tr key={row.sectionId || row.sectionName}>
                      <td className="py-2 pr-2 font-semibold text-gray-800">
                        {row.sectionName || "—"}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        {formatInt(row.tickets)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        {formatSec(row.avgPrepSec)}
                      </td>
                      <td className="py-2 pl-2 text-right text-gray-700">
                        {formatSec(row.avgWaitSec)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Recent orders */}
        <Section
          title="Recent orders"
          right={
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <CalendarDays size={10} />
                {ordersTotal} total
              </span>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!orders.length}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg disabled:opacity-40"
              >
                <Download size={11} />
                Export CSV
              </button>
            </div>
          }
        >
          <DataTable
            title=""
            headers={ordersTableHeaders}
            data={orders}
            loading={loading}
            filters={orderFilters}
            searchValue={ordersSearch}
            onSearch={(v) => {
              setOrdersSearch(v || "");
              setOrdersPage(1);
            }}
            searchPlaceholder="Search order number"
            currentPage={ordersPage}
            totalPages={ordersTotalPages}
            totalRecords={ordersTotal}
            recordsPerPage={ordersLimit}
            onPageChange={(p) => setOrdersPage(p)}
            onRecordsPerPageChange={(l) => {
              setOrdersLimit(l);
              setOrdersPage(1);
            }}
            emptyMessage="No orders found"
            colWidths={{ Action: "190px" }}
            renderRow={(o) => {
              const itemsCount = (o.items || []).reduce(
                (sum, i) => sum + Number(i.quantity || 0),
                0,
              );
              const cashierName =
                o?.cashier?.name ||
                [o?.cashier?.firstName, o?.cashier?.lastName]
                  .filter(Boolean)
                  .join(" ") ||
                o?.cashier?.email ||
                "—";
              const dt = o.completedAt || o.createdAt;
              return (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-900">
                    {o.orderNumber || "—"}
                  </td>
                  <td className="py-2 px-3 text-gray-600">
                    {dt ? formatDate(dt, false, true) : "—"}
                  </td>
                  <td className="py-2 px-3 text-gray-600">
                    {o?.table
                      ? o.table.label || `Table ${o.table.tableNumber}`
                      : "Walk-in"}
                  </td>
                  <td className="py-2 px-3 text-gray-600">{cashierName}</td>
                  <td className="py-2 px-3 text-gray-600">
                    {o?.salesChannelName || o?.salesChannel?.name || "POS / Walk-in"}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        o.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${o.status === "completed" ? "bg-emerald-500" : "bg-red-500"}`} />
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700">
                    {formatInt(itemsCount)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700">
                    {formatMoney(o.discountAmount)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700">
                    {formatMoney(o.taxAmount)}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-gray-900">
                    {formatMoney(o.total)}
                  </td>
                  <td className="py-2 px-3 text-gray-600 max-w-[220px]">
                    {o.status === "voided" ? (
                      <span className="truncate block" title={o.voidReason || "—"}>
                        {o.voidReason || "—"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(o)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--p-blue)] border border-[var(--p-blue)]/30 rounded-md hover:bg-[var(--p-blue)]/5 transition-colors"
                      >
                        <Eye size={12} />
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReceipt(o)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50 transition-colors"
                      >
                        <Receipt size={12} />
                        Receipt
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        </Section>

        {loading && !summary && (
          <div className="text-center py-10 text-gray-400 text-xs">
            Loading reports…
          </div>
        )}
      </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Order details
                </h3>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                  {selectedOrder.orderNumber || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Status</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedOrder.status || "—"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Date</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedOrder.completedAt || selectedOrder.createdAt
                      ? formatDate(
                          selectedOrder.completedAt || selectedOrder.createdAt,
                          false,
                          true,
                        )
                      : "—"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Table</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedOrder?.table
                      ? selectedOrder.table.label ||
                        `Table ${selectedOrder.table.tableNumber}`
                      : "Walk-in"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Sales Channel</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedOrder?.salesChannelName ||
                      selectedOrder?.salesChannel?.name ||
                      "POS / Walk-in"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500 flex items-center gap-1">
                    <Users size={11} />
                    Guests
                  </div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedOrder?.guestCount || 1}
                    {selectedOrder?.guestName && (
                      <span className="ml-1.5 font-normal text-gray-500">
                        · {selectedOrder.guestName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500 flex items-center gap-1">
                    <Phone size={11} />
                    Customer Phone
                  </div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedOrder?.customer?.basicInformation?.customerPhone
                      ?.mobile ||
                      selectedOrder?.customer?.basicInformation?.customerPhone
                        ?.workPhone ||
                      (Array.isArray(selectedOrder?.guestPhones) &&
                        selectedOrder.guestPhones[0]) ||
                      "—"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Total</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    RM {formatMoney(selectedOrder.total)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Subtotal</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    RM {formatMoney(selectedOrder.subtotal)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Discount</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    RM {formatMoney(selectedOrder.discountAmount)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Service charge</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    RM {formatMoney(selectedOrder.serviceChargeAmount)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Tax</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    RM {formatMoney(selectedOrder.taxAmount)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Cashier</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedOrder?.cashier?.name ||
                      [
                        selectedOrder?.cashier?.firstName,
                        selectedOrder?.cashier?.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ") ||
                      selectedOrder?.cashier?.email ||
                      "—"}
                  </div>
                </div>
              </div>

              {(selectedOrder?.customerNotes || selectedOrder?.note) ? (
                <div className="mt-3 rounded-lg border border-amber-200 overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
                    <MessageSquare size={11} />
                    Order Note
                  </div>
                  <div className="px-3 py-2.5 text-xs text-amber-900 bg-amber-50/40 leading-relaxed">
                    {selectedOrder.customerNotes || selectedOrder.note}
                  </div>
                </div>
              ) : null}

              {selectedOrder?.status === "voided" && selectedOrder?.voidReason ? (
                <div className="mt-3 rounded-lg border border-rose-200 overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border-b border-rose-100">
                    Void Reason
                  </div>
                  <div className="px-3 py-2.5 text-xs text-rose-900 bg-rose-50/40 leading-relaxed">
                    {selectedOrder.voidReason}
                  </div>
                </div>
              ) : null}

              {(selectedOrder.payments || []).length > 0 ? (
                <div className="mt-4 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                    Payments
                  </div>
                  <div className="divide-y divide-gray-100">
                    {selectedOrder.payments.map((p, idx) => (
                      <div
                        key={`${selectedOrder._id}-p-${idx}`}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="text-gray-700">
                          {p.paymentMethodName || p.method || "Payment"}
                          {p.reference ? (
                            <span className="text-gray-400">
                              {" "}
                              ({p.reference})
                            </span>
                          ) : null}
                        </div>
                        <div className="font-semibold text-gray-900">
                          RM {formatMoney(p.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                  Items
                </div>
                <div className="divide-y divide-gray-100">
                  {(selectedOrder.items || []).length ? (
                    (selectedOrder.items || []).map((it, idx) => (
                      <div
                        key={`${selectedOrder._id}-${idx}`}
                        className="px-3 py-2 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900">
                            {it.name || "Item"}
                          </div>
                          {it.note ? (
                            <div className="mt-1 flex items-start gap-1 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 leading-snug">
                              <StickyNote size={10} className="mt-px shrink-0 text-slate-400" />
                              <span className="italic">{it.note}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-gray-700">
                            x{Number(it.quantity || 0)}
                          </div>
                          <div className="font-semibold text-gray-900">
                            RM {formatMoney(it.amount)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center text-xs text-gray-400">
                      No items
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {receiptOrder && (
        <ReceiptPreview
          isOpen={!!receiptOrder}
          order={receiptOrder}
          business={receiptBusiness}
          businessName={
            receiptBusiness?.name || selectedBiz?.name || "Your Business"
          }
          onClose={() => {
            setReceiptOrder(null);
            setReceiptBusiness(null);
          }}
        />
      )}
    </div>
  );
};

export default PosReports;
