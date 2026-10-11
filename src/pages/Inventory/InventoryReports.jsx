import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import {
  Package,
  History,
  DollarSign,
  Hourglass,
  AlertTriangle,
  TrendingUp,
  Hash,
  Warehouse,
  ChevronRight,
  RefreshCw,
  X,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { AdminContext } from "@/context/AdminContext";
import { Page, SummaryCards, Loader } from "@/page-layouts/index";
import { formatDate, formatMoney, formatQty } from "./reports/reportShared";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import SummarySvg from "@/assets/img/summary.svg";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CHART_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

const AGING_COLORS = ["#22c55e", "#84cc16", "#f59e0b", "#ef4444"];

const REPORTS = [
  {
    title: "Current Stock Report",
    subtitle: "On-hand by warehouse, location & lot",
    icon: Package,
    link: "/inventory-reports/current-stock",
  },
  {
    title: "Product Movement History",
    subtitle: "Inbound & outbound ledger",
    icon: History,
    link: "/inventory-reports/movements",
  },
  {
    title: "Inventory Valuation",
    subtitle: "Qty x unit cost valuation",
    icon: DollarSign,
    link: "/inventory-valuation",
  },
  {
    title: "Stock Aging",
    subtitle: "0-30 / 31-60 / 61-90 / 90+ days",
    icon: Hourglass,
    link: "/inventory-reports/aging",
  },
  {
    title: "Low Stock Report",
    subtitle: "Below reorder — replenish now",
    icon: AlertTriangle,
    link: "/inventory-reports/low-stock",
  },
  {
    title: "Inventory Forecast",
    subtitle: "Demand from consumption velocity",
    icon: TrendingUp,
    link: "/inventory-reports/forecast",
  },
  {
    title: "Lot / Serial Tracking",
    subtitle: "Lots & serials registry",
    icon: Hash,
    link: "/inventory-reports/lots",
  },
  {
    title: "Warehouse Performance",
    subtitle: "Throughput & turnover by warehouse",
    icon: Warehouse,
    link: "/inventory-reports/warehouse-performance",
  },
];

const ChartTooltip = ({ active, payload, label, money = false }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
      {label && <p className="font-semibold text-gray-900 mb-2">{label}</p>}
      {payload.map((p) => (
        <p
          key={p.dataKey || p.name}
          className="text-sm"
          style={{ color: p.color || p.fill }}
        >
          {`${p.name}: ${money ? formatMoney(p.value) : formatQty(p.value)}`}
        </p>
      ))}
    </div>
  );
};

const EmptyChart = ({ icon: Icon = BarChart3, label = "No data available" }) => (
  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
    <Icon className="w-12 h-12 text-gray-300 mb-2" />
    <p className="text-sm">{label}</p>
  </div>
);

const InventoryReports = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const adminId = adminInfo?.id || adminInfo?._id;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [movementView, setMovementView] = useState("weekly");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [assignedBusinessIds, setAssignedBusinessIds] = useState([]);

  const loadDashboard = async (soft = false) => {
    const ids =
      selectedBusiness && String(selectedBusiness).trim()
        ? [selectedBusiness]
        : assignedBusinessIds.filter(Boolean);
    if (!ids.length) {
      setSummary(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const params =
        selectedBusiness && String(selectedBusiness).trim()
          ? { business: selectedBusiness }
          : { businessIds: ids.join(",") };
      const res = await axios.get(`${Base_URL}/inventory-reports/dashboard`, {
        headers,
        params,
      });
      setSummary(res.data?.data || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!selectedBusiness && assignedBusinessIds.length === 0) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, selectedBusiness, assignedBusinessIds.join(",")]);

  const charts = summary?.charts || {};
  const healthData = charts.stockHealth || [];
  const agingData = charts.aging || [];
  const movementTrend = charts.movementTrend || [];
  const warehouseValue = charts.warehouseValue || [];
  const topItems = charts.topItemsByValue || [];

  const movementStats = useMemo(() => {
    const inbound = movementTrend.reduce(
      (s, d) => s + (Number(d.inbound) || 0),
      0,
    );
    const outbound = movementTrend.reduce(
      (s, d) => s + (Number(d.outbound) || 0),
      0,
    );
    return {
      inbound: Number(inbound.toFixed(2)),
      outbound: Number(outbound.toFixed(2)),
      net: Number((inbound - outbound).toFixed(2)),
    };
  }, [movementTrend]);

  const shortDate = (d) => formatDate(d) || "";

  const movementChartData = useMemo(() => {
    if (!movementTrend.length) return [];

    if (movementView === "daily") {
      return movementTrend.map((d) => ({
        ...d,
        label: shortDate(d.date),
        net: Number(((d.inbound || 0) - (d.outbound || 0)).toFixed(2)),
      }));
    }

    const chunks = [];
    for (let i = 0; i < movementTrend.length; i += 7) {
      const slice = movementTrend.slice(i, i + 7);
      if (!slice.length) continue;
      const inbound = slice.reduce((s, d) => s + (Number(d.inbound) || 0), 0);
      const outbound = slice.reduce((s, d) => s + (Number(d.outbound) || 0), 0);
      const start = slice[0]?.date || "";
      const end = slice[slice.length - 1]?.date || "";
      chunks.push({
        date: end,
        label: `${shortDate(start)}-${shortDate(end)}`,
        inbound: Number(inbound.toFixed(2)),
        outbound: Number(outbound.toFixed(2)),
        net: Number((inbound - outbound).toFixed(2)),
      });
    }
    return chunks;
  }, [movementTrend, movementView]);

  const summaryCardsData = [
    {
      title: "Inventory Value",
      value: loading ? "..." : formatMoney(summary?.totalValue),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "On-hand Qty",
      value: loading ? "..." : formatQty(summary?.totalOnHandQty),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Low Stock",
      value: loading ? "..." : (summary?.lowStockCount ?? 0),
      backgroundColor: "pending-light",
      iconColor: "pending-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: "Expiring Soon",
      value: loading ? "..." : (summary?.expirySoon ?? 0),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: DelayedSvg,
    },
  ];

  const compactMetrics = [
    {
      title: "SKUs in stock",
      value: loading ? "..." : (summary?.itemCount ?? 0),
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Expired lots",
      value: loading ? "..." : (summary?.expiryExpired ?? 0),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: DelayedSvg,
    },
    {
      title: "Warehouses",
      value: loading ? "..." : (summary?.warehouseCount ?? 0),
      backgroundColor: "pending-light",
      iconColor: "pending-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: "Active lots",
      value: loading ? "..." : (summary?.activeLotCount ?? 0),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
  ];

  const showAlerts =
    (summary?.lowStockCount || 0) > 0 ||
    (summary?.expirySoon || 0) > 0 ||
    (summary?.expiryExpired || 0) > 0;

  return (
    <RoutePermissionGate>
      <Page
        header={{
          variant: "large",
          title: "Inventory Reports",
          description:
            "Track stock health, movements, aging, and warehouse value — then open detailed reports.",
          filters: adminId
            ? [
                {
                  name: "business",
                  type: "select",
                  isBusinessDropdown: true,
                  businessDropdownProps: {
                    adminId,
                    selectedBusiness: selectedBusiness || "",
                    onChange: (value) => setSelectedBusiness(value || ""),
                    setAssignedBusinesses: setAssignedBusinessIds,
                    placeholder: "All Businesses",
                    style: { width: "270px" },
                  },
                },
              ]
            : [],
          renderActions: [
            selectedBusiness ? (
              <button
                key="clear-filters"
                type="button"
                onClick={() => setSelectedBusiness("")}
                title="Clear Filters"
                className="inline-flex items-center gap-2 h-[40px] px-4 py-2 text-sm rounded-xl bg-white text-red-600 border border-red-300 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            ) : null,
            <button
              key="refresh"
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 h-[40px] px-4 py-2 text-sm rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>,
          ].filter(Boolean),
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader color="var(--p-blue)" />
            <p className="text-sm text-slate-500">Loading dashboard…</p>
          </div>
        ) : (
          <>
            {showAlerts ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-amber-950">
                  <span className="font-semibold inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    Inventory alerts
                  </span>
                  {(summary?.lowStockCount || 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => history.push("/inventory-reports/low-stock")}
                      className="hover:underline"
                    >
                      {summary.lowStockCount} low stock
                    </button>
                  ) : null}
                  {(summary?.expirySoon || 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => history.push("/expiry-alerts")}
                      className="hover:underline"
                    >
                      {summary.expirySoon} expiring soon
                    </button>
                  ) : null}
                  {(summary?.expiryExpired || 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => history.push("/expiry-alerts")}
                      className="hover:underline"
                    >
                      {summary.expiryExpired} expired
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <SummaryCards cards={summaryCardsData} columnsCount={4} />
            <SummaryCards cards={compactMetrics} columnsCount={4} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white rounded-lg border shadow-sm p-6 lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <h3 className="text-base font-semibold text-gray-800">
                    Stock Movements
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                      {[
                        { id: "weekly", label: "Weekly" },
                        { id: "daily", label: "Daily" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setMovementView(opt.id)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            movementView === opt.id
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-sm text-[var(--p-blue)] hover:underline font-medium"
                      onClick={() => history.push("/inventory-reports/movements")}
                    >
                      View All
                    </button>
                    <TrendingUp className="w-5 h-5 text-gray-400 hidden sm:block" />
                  </div>
                </div>

                {movementTrend.some((d) => d.inbound || d.outbound) && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <ArrowDownRight className="w-3.5 h-3.5 text-green-600" />
                        Inbound
                      </div>
                      <p className="text-base font-semibold text-green-600 mt-1">
                        {formatQty(movementStats.inbound)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                        Outbound
                      </div>
                      <p className="text-base font-semibold text-red-600 mt-1">
                        {formatQty(movementStats.outbound)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs text-gray-500">Net flow</div>
                      <p
                        className={`text-base font-semibold mt-1 ${
                          movementStats.net >= 0
                            ? "text-blue-600"
                            : "text-amber-600"
                        }`}
                      >
                        {movementStats.net >= 0 ? "+" : ""}
                        {formatQty(movementStats.net)}
                      </p>
                    </div>
                  </div>
                )}

                {movementChartData.some((d) => d.inbound || d.outbound) ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={movementChartData}>
                        <defs>
                          <linearGradient
                            id="colorInbound"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10B981"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10B981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorOutbound"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#EF4444"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#EF4444"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="label"
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                          interval={
                            movementView === "daily" ? "preserveStartEnd" : 0
                          }
                        />
                        <YAxis
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <ReferenceLine y={0} stroke="#e5e7eb" />
                        <Area
                          type="monotone"
                          dataKey="inbound"
                          name="Inbound"
                          stroke="#10B981"
                          fill="url(#colorInbound)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="outbound"
                          name="Outbound"
                          stroke="#EF4444"
                          fill="url(#colorOutbound)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="net"
                          name="Net Flow"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          dot={{ fill: "#3B82F6", r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No movements in the last 30 days" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white rounded-lg border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-800">
                    Stock Health
                  </h3>
                  <PieChartIcon className="w-5 h-5 text-gray-400" />
                </div>
                {healthData.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={healthData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={3}
                        >
                          {healthData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [formatQty(v), n]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart
                    icon={PieChartIcon}
                    label="No stock health data"
                  />
                )}
              </div>

              <div className="bg-white rounded-lg border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-800">
                    Stock Aging
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-sm text-[var(--p-blue)] hover:underline font-medium"
                      onClick={() => history.push("/inventory-reports/aging")}
                    >
                      View All
                    </button>
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                {agingData.some((d) => d.value > 0 || d.qty > 0) ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agingData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="bucket"
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                          tickFormatter={(value) => formatMoney(value)}
                        />
                        <Tooltip content={<ChartTooltip money />} />
                        <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
                          {agingData.map((entry, idx) => (
                            <Cell
                              key={entry.bucket}
                              fill={AGING_COLORS[idx % AGING_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No aging data available" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white rounded-lg border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-800">
                    Warehouse Value
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-sm text-[var(--p-blue)] hover:underline font-medium"
                      onClick={() =>
                        history.push("/inventory-reports/warehouse-performance")
                      }
                    >
                      View All
                    </button>
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                {warehouseValue.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={warehouseValue} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          type="number"
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                          tickFormatter={(value) => formatMoney(value)}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                        />
                        <Tooltip content={<ChartTooltip money />} />
                        <Bar
                          dataKey="value"
                          name="Value"
                          radius={[0, 4, 4, 0]}
                        >
                          {warehouseValue.map((entry, idx) => (
                            <Cell
                              key={entry.name}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No warehouse stock yet" />
                )}
              </div>

              <div className="bg-white rounded-lg border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-800">
                    Top Products by Value
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-sm text-[var(--p-blue)] hover:underline font-medium"
                      onClick={() => history.push("/inventory-valuation")}
                    >
                      View All
                    </button>
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                {topItems.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topItems}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          stroke="#6b7280"
                          style={{ fontSize: "10px" }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                          tickFormatter={(value) => formatMoney(value)}
                        />
                        <Tooltip content={<ChartTooltip money />} />
                        <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
                          {topItems.map((entry, idx) => (
                            <Cell
                              key={entry.name || idx}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No valued stock yet" />
                )}
              </div>
            </div>

            <div className="mt-8 mb-4">
              <h3 className="text-base font-semibold text-gray-800">
                Detailed Reports
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Open the full tables behind the dashboard charts
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {REPORTS.map((report) => {
                const Icon = report.icon;
                return (
                  <div
                    key={report.link}
                    role="button"
                    tabIndex={0}
                    className="group relative flex min-h-[160px] cursor-pointer flex-col items-start justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-[var(--p-blue)] hover:bg-[rgba(var(--p-blue-rgb),0.08)] hover:shadow-md"
                    onClick={() => history.push(report.link)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        history.push(report.link);
                      }
                    }}
                  >
                    <div className="flex flex-1 flex-col">
                      <div className="mb-3">
                        <Icon className="h-10 w-10 text-gray-600 transition-colors duration-200 group-hover:text-[var(--p-blue)]" />
                      </div>
                      <h3 className="mb-2 text-base font-medium leading-tight text-gray-900 transition-colors duration-200 group-hover:text-[var(--p-blue)] pr-6">
                        {report.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-500">
                        {report.subtitle}
                      </p>
                    </div>
                    <div className="absolute right-2 top-3">
                      <ChevronRight className="h-5 w-5 text-gray-400 transition-colors duration-200 group-hover:text-[var(--p-blue)]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Page>
    </RoutePermissionGate>
  );
};

export default InventoryReports;
