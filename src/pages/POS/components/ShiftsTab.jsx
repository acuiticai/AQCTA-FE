import React, { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CircleDollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Banknote,
  Wallet,
  PieChart as PieChartIcon,
} from "lucide-react";
import { formatMoney, formatInt, StatCard, Section } from "../PosReports";
import { formatDate } from "@/components/formatAmount";
import { getPaymentMethodIcon } from "../utils/paymentIcons";

const PAL = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

const SERVICE_TYPE_LABELS = {
  dine_in: "Dine-in",
  walkin: "Walk-in",
  pickup: "Pickup",
  delivery: "Delivery",
  qr_table: "QR Table",
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[150px]">
      {label && <p className="text-xs font-bold text-gray-800 mb-1.5">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="text-[11px] font-semibold text-gray-900">
            {entry.dataKey === "guests"
              ? formatInt(entry.value)
              : `RM ${formatMoney(entry.value)}`}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[150px]">
      <p className="text-xs font-bold text-gray-800 mb-1">{row.name}</p>
      <p className="text-[11px] text-gray-600">
        <span className="font-semibold text-gray-900">RM {formatMoney(row.value)}</span>
        {row.payload?.count != null && (
          <span className="text-gray-400"> · {formatInt(row.payload.count)} txns</span>
        )}
      </p>
    </div>
  );
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
      status === "closed"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700"
    }`}
  >
    <span
      className={`h-1.5 w-1.5 rounded-full ${
        status === "closed" ? "bg-emerald-500" : "bg-amber-500"
      }`}
    />
    {status}
  </span>
);

const personName = (p) =>
  p?.name ||
  [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
  p?.email ||
  "—";

const ShiftsTab = ({ shifts = [], loading, range }) => {
  const totals = useMemo(
    () =>
      shifts.reduce(
        (acc, s) => {
          const ss = s.salesSummary || {};
          acc.netSales += ss.netSales || 0;
          acc.grossSales += ss.grossSales || 0;
          acc.orders += ss.totalOrders || 0;
          acc.guests += ss.totalGuests || 0;
          acc.cashSales += ss.cashSales || 0;
          acc.onlineSales += ss.onlineSales || 0;
          acc.discount += ss.discountTotal || 0;
          return acc;
        },
        {
          netSales: 0,
          grossSales: 0,
          orders: 0,
          guests: 0,
          cashSales: 0,
          onlineSales: 0,
          discount: 0,
        },
      ),
    [shifts],
  );

  const avgSpendPerGuest = totals.guests ? totals.netSales / totals.guests : 0;

  // Per-day aggregation for multi-day ranges; per-shift for "today" so the
  // chart shows shift-by-shift movement instead of a single point.
  const chartData = useMemo(() => {
    if (range === "today") {
      return [...shifts]
        .sort((a, b) => (a.shiftNo || 0) - (b.shiftNo || 0))
        .map((s) => ({
          label: s.shiftSnapshot?.name || s.shiftId?.name || `Shift ${s.shiftNo}`,
          netSales: s.salesSummary?.netSales || 0,
          guests: s.salesSummary?.totalGuests || 0,
        }));
    }
    const map = new Map();
    for (const s of shifts) {
      const d = s.businessDate;
      const cur = map.get(d) || { label: d?.slice(5), netSales: 0, guests: 0 };
      cur.netSales += s.salesSummary?.netSales || 0;
      cur.guests += s.salesSummary?.totalGuests || 0;
      map.set(d, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [shifts, range]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      for (const p of s.salesSummary?.byPaymentMethod || []) {
        const key = p.method || p.type || "Other";
        const cur = map.get(key) || { name: key, type: p.type, value: 0, count: 0 };
        cur.value += p.amount || 0;
        cur.count += p.count || 0;
        map.set(key, cur);
      }
    }
    return Array.from(map.values())
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [shifts]);

  const serviceTypeBreakdown = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      for (const st of s.salesSummary?.byServiceType || []) {
        const key = st.serviceType || "other";
        const cur = map.get(key) || {
          name: SERVICE_TYPE_LABELS[key] || key,
          value: 0,
          count: 0,
        };
        cur.value += st.amount || 0;
        cur.count += st.count || 0;
        map.set(key, cur);
      }
    }
    return Array.from(map.values())
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [shifts]);

  const closedShiftsWithVariance = useMemo(
    () => shifts.filter((s) => s.status === "closed" && s.variance != null),
    [shifts],
  );

  const varianceData = useMemo(
    () =>
      [...closedShiftsWithVariance]
        .sort((a, b) => (a.businessDate || "").localeCompare(b.businessDate || ""))
        .map((s) => ({
          label: `${s.businessDate?.slice(5)} · ${
            s.shiftSnapshot?.name || s.shiftId?.name || `Shift ${s.shiftNo}`
          }`,
          variance: s.variance || 0,
        })),
    [closedShiftsWithVariance],
  );

  if (loading && !shifts.length) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-center text-gray-400 text-xs">
        Loading shift analytics…
      </div>
    );
  }

  if (!shifts.length) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center py-12 text-gray-400 text-xs">
          No shift sessions found for this period.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={CircleDollarSign}
          label="Net Sales"
          value={formatMoney(totals.netSales)}
          accent="bg-emerald-100 text-emerald-700"
          caption="Total"
        />
        <StatCard
          icon={ShoppingCart}
          label="Orders"
          value={formatInt(totals.orders)}
          accent="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon={Users}
          label="Guests Served"
          value={formatInt(totals.guests)}
          accent="bg-indigo-100 text-indigo-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Spend / Guest"
          value={formatMoney(avgSpendPerGuest)}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={Banknote}
          label="Cash Sales"
          value={formatMoney(totals.cashSales)}
          accent="bg-teal-100 text-teal-700"
        />
        <StatCard
          icon={Wallet}
          label="Online Sales"
          value={formatMoney(totals.onlineSales)}
          accent="bg-purple-100 text-purple-700"
        />
      </div>

      {/* Sales / guests trend */}
      <Section title={range === "today" ? "Sales by shift" : "Daily sales trend"}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatMoney(v)}
              width={70}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Bar
              yAxisId="left"
              dataKey="netSales"
              name="Net Sales (RM)"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="guests"
              name="Guests"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Section>

      {/* Payment method & service type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Payment method breakdown">
          {paymentBreakdown.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No payments recorded
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220} className="sm:w-1/2">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {paymentBreakdown.map((entry, i) => (
                      <Cell key={entry.name} fill={PAL[i % PAL.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 w-full space-y-2">
                {paymentBreakdown.map((p, i) => {
                  const { Icon, classes } = getPaymentMethodIcon({
                    name: p.name,
                    type: p.type,
                  });
                  return (
                    <div
                      key={p.name}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-7 w-7 inline-flex items-center justify-center rounded-lg shrink-0 ${classes.iconBg} ${classes.iconText}`}
                        >
                          <Icon size={14} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {formatInt(p.count)} transactions
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-gray-900 shrink-0">
                        {formatMoney(p.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <Section title="Sales by service type">
          {serviceTypeBreakdown.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No service type data
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220} className="sm:w-1/2">
                <PieChart>
                  <Pie
                    data={serviceTypeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {serviceTypeBreakdown.map((entry, i) => (
                      <Cell key={entry.name} fill={PAL[(i + 2) % PAL.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 w-full space-y-2">
                {serviceTypeBreakdown.map((s, i) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PAL[(i + 2) % PAL.length] }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">
                          {s.name}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {formatInt(s.count)} orders
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900 shrink-0">
                      {formatMoney(s.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Cash variance */}
      {varianceData.length > 0 && (
        <Section
          title="Cash variance by shift"
          right={
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <PieChartIcon size={10} />
              Closed shifts only
            </span>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={varianceData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 10 }} />
              <YAxis
                stroke="#9ca3af"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatMoney(v)}
                width={70}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="variance" name="Variance (RM)" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {varianceData.map((entry, i) => (
                  <Cell key={i} fill={entry.variance < 0 ? "#ef4444" : "#10b981"} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Shift history table */}
      <Section title="Shift history">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-gray-400">
              <tr>
                <th className="text-left py-2 pr-2">Date</th>
                <th className="text-left py-2 px-2">Shift</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Opened by</th>
                <th className="text-left py-2 px-2">Closed by</th>
                <th className="text-right py-2 px-2">Net Sales</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Guests</th>
                <th className="text-right py-2 px-2">Avg/Guest</th>
                <th className="text-right py-2 pl-2">Cash Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map((s) => {
                const ss = s.salesSummary || {};
                return (
                  <tr key={s._id}>
                    <td className="py-2 pr-2 font-semibold text-gray-800">
                      {s.businessDate || "—"}
                    </td>
                    <td className="py-2 px-2 text-gray-700">
                      {s.shiftSnapshot?.name || s.shiftId?.name || `Shift ${s.shiftNo}`}
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-2 px-2 text-gray-600">
                      {personName(s.openedBy)}
                      {s.openedAt && (
                        <div className="text-[10px] text-gray-400">
                          {formatDate(s.openedAt, false, true)}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-600">
                      {s.status === "closed" ? (
                        <>
                          {personName(s.closedBy)}
                          {s.closedAt && (
                            <div className="text-[10px] text-gray-400">
                              {formatDate(s.closedAt, false, true)}
                            </div>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-gray-900">
                      {formatMoney(ss.netSales)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {formatInt(ss.totalOrders)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {formatInt(ss.totalGuests)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {formatMoney(ss.averageSpendPerGuest)}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      {s.status === "closed" && s.variance != null ? (
                        <span
                          className={`font-bold ${
                            s.variance < 0
                              ? "text-red-600"
                              : s.variance > 0
                                ? "text-emerald-600"
                                : "text-gray-700"
                          }`}
                        >
                          {s.variance > 0 ? "+" : ""}
                          {formatMoney(s.variance)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

export default ShiftsTab;
