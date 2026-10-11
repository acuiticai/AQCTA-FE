import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
  Activity,
  Wallet,
  Receipt,
  Banknote,
} from "lucide-react";
import { formatAmount } from "@/components/formatAmount";

export const BRAND = "#0C2E5A";
export const PAL = [
  BRAND,
  "#1d9e6b",
  "#008080",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#6366F1",
];

const fmt = (v) => formatAmount(v || 0);
export const fmtRm = (v) => `RM ${fmt(v)}`;

export const CustomTooltip = ({ active, payload, label, title }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[160px]">
      {title && (
        <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
      )}
      {label && <p className="text-sm font-bold text-gray-800 mb-2">{label}</p>}
      {payload.map((entry, index) => (
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
            {fmtRm(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SectionHeader = ({ icon: Icon, children, badge }) => (
  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 flex items-center gap-2.5">
    {Icon && <Icon size={16} style={{ color: BRAND }} />}
    <h2 className="text-sm font-semibold text-gray-800 tracking-tight flex-1">
      {children}
    </h2>
    {badge && (
      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
        {badge}
      </span>
    )}
  </div>
);

const HBar = ({ value, max, color = BRAND }) => (
  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
    <div
      className="h-2 rounded-full transition-all duration-500 ease-out"
      style={{
        width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`,
        backgroundColor: color,
      }}
    />
  </div>
);

export const KpiHeroCard = ({ title, value, subtitle, icon: Icon, accent }) => (
  <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
    <div
      className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.08]"
      style={{ backgroundColor: accent }}
    />
    <div className="flex items-start justify-between gap-3 relative">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {title}
        </p>
        <p className="text-2xl font-bold text-gray-900 mt-1 truncate">
          {value}
        </p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        <Icon size={22} strokeWidth={2} />
      </div>
    </div>
  </div>
);

const renderActivePieShape = (props) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    value,
  } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 5}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="#1f2937"
        fontSize={12}
        fontWeight="bold"
      >
        {fmtRm(value)}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
        {payload.name?.length > 14
          ? `${payload.name.slice(0, 12)}…`
          : payload.name}
      </text>
    </g>
  );
};

export const EmptyChart = ({ icon: Icon, message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    <Icon className="w-10 h-10 text-gray-200 mb-3" />
    <p className="text-sm">{message}</p>
  </div>
);

const ChannelBarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[180px]">
      <p className="text-xs font-semibold text-gray-500 mb-1">Channel</p>
      <p className="text-sm font-bold text-gray-800 mb-1 break-words">{row.name}</p>
      <p className="text-xs text-gray-600">
        <span className="font-semibold text-gray-900">{fmtRm(row.value)}</span>
        {row.pct != null && <span className="text-gray-500"> · {row.pct}%</span>}
      </p>
    </div>
  );
};

export function CollectionsByChannel({ channels, totalAmount }) {
  if (!channels?.length) {
    return <EmptyChart icon={BarChart3} message="No collection data available" />;
  }

  const chartData = [...channels]
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .map((ch, i) => ({
      name: ch.name,
      value: ch.value || 0,
      fill: PAL[i % PAL.length],
      pct:
        totalAmount > 0
          ? (((ch.value || 0) / totalAmount) * 100).toFixed(1)
          : "0",
    }));

  const chartWidth = Math.max(360, chartData.length * 72);
  const chartHeight = 300;

  return (
    <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide pb-1">
      <div style={{ width: chartWidth, height: chartHeight, minWidth: "100%" }}>
        <BarChart
          width={chartWidth}
          height={chartHeight}
          data={chartData}
          margin={{ top: 12, right: 12, left: 4, bottom: 76 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#9ca3af"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-38}
            textAnchor="end"
            height={72}
            tickFormatter={(v) =>
              v?.length > 16 ? `${String(v).slice(0, 14)}…` : v
            }
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => fmt(v)}
            width={68}
          />
          <Tooltip content={<ChannelBarTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </div>
    </div>
  );
}

export function CollectionsTrendChart({ data }) {
  if (!data?.length) {
    return <EmptyChart icon={BarChart3} message="No trend data available" />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} />
        <YAxis
          stroke="#9ca3af"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => fmt(v)}
          width={72}
        />
        <Tooltip content={<CustomTooltip title="Daily trend" />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        <Line
          type="monotone"
          dataKey="collections"
          stroke="#1d9e6b"
          strokeWidth={2}
          name="Collections"
          dot={false}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="payouts"
          stroke="#e85555"
          strokeWidth={2}
          name="Payouts"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="netFlow"
          stroke={BRAND}
          strokeWidth={2}
          name="Net flow"
          dot={false}
          strokeDasharray="4 4"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ data }) {
  if (!data?.length) {
    return <EmptyChart icon={Activity} message="No cash flow data available" />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="drColorIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1d9e6b" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#1d9e6b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="drColorOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e85555" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#e85555" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="_id" stroke="#9ca3af" tick={{ fontSize: 11 }} />
        <YAxis
          stroke="#9ca3af"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => fmt(v)}
          width={72}
        />
        <Tooltip content={<CustomTooltip title="Cash flow" />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        <Area
          type="monotone"
          dataKey="totalCollected"
          stroke="#1d9e6b"
          fill="url(#drColorIn)"
          name="Collections"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="totalPaidOut"
          stroke="#e85555"
          fill="url(#drColorOut)"
          name="Payouts"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ShiftsPerformanceChart({ shiftsData, formatAmount: fmtLocal }) {
  if (!shiftsData?.length) {
    return <EmptyChart icon={BarChart3} message="No shifts data available" />;
  }
  const fa = fmtLocal || fmt;
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={shiftsData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis
            stroke="#9ca3af"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => fa(v)}
            width={72}
          />
          <Tooltip content={<CustomTooltip title="Shift" />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey="totalCollections"
            fill="#1d9e6b"
            name="Collections"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="totalPayouts"
            fill="#e85555"
            name="Payouts"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shiftsData.map((shift) => {
          const net =
            (shift.totalCollections || 0) -
            (shift.totalAdvances || 0) -
            (shift.totalPayouts || 0);
          return (
            <div
              key={shift.name}
              className="rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-800">
                  {shift.name}
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-medium">
                  {shift.count} reports
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <span className="text-gray-500">Collections</span>
                <span className="text-right font-semibold text-green-700">
                  {fa(shift.totalCollections)}
                </span>
                <span className="text-gray-500">Net flow</span>
                <span
                  className={`text-right font-semibold ${
                    net >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {fa(net)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export const chartIcons = {
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChartIcon,
  Layers,
  Activity,
  Wallet,
  Receipt,
  Banknote,
};
