import React, { useState, useEffect, useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import {
  TrendingUp,
  Users,
  Building2,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  Shield,
  CalendarDays,
  Award,
  Layers,
  Activity,
  ArrowLeft,
  Info,
  Clock,
  Wallet,
  PieChart as PieChartIcon,
} from "lucide-react";
import { IoClose } from "react-icons/io5";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Sector,
  ComposedChart,
  Line,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { Page, SummaryCards } from "@/page-layouts/index";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { formatAmount } from "@/components/formatAmount";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import YearPicker from "./components/YearPicker";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const MN = [
  "",
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
const MF = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STATUS_META = {
  draft: { color: "#6d6e73", bg: "#F1F5F9", label: "Draft" },
  calculated: { color: "#008080", bg: "#F0FDFA", label: "Calculated" },
  reviewed: { color: "#e3b126", bg: "#FFFBEB", label: "Reviewed" },
  approved: { color: "#1d9e6b", bg: "#ECFDF5", label: "Approved" },
  posted: { color: "#8B5CF6", bg: "#F5F3FF", label: "Posted" },
  paid: { color: "#1d9e6b", bg: "#ECFDF5", label: "Paid" },
  finalized: { color: "#6366F1", bg: "#EEF2FF", label: "Finalized" },
};

const BRAND = "#0C2E5A";
const PAL = [
  BRAND,
  "#1d9e6b",
  "#008080",
  "#e3b126",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#06B6D4",
  "#84CC16",
];
const STAT_COLORS = {
  EPF: BRAND,
  SOCSO: "#1d9e6b",
  EIS: "#e3b126",
  "PCB (Tax)": "#e85555",
  HRDF: "#008080",
};

const fmt = (v) => `RM ${formatAmount(v || 0)}`;
const fmtK = (v) => {
  if (!v) return "RM 0";
  if (v >= 1000000) return `RM ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `RM ${(v / 1000).toFixed(1)}K`;
  return fmt(v);
};

/* ── Custom Tooltip ──────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, formatter, title }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[180px]">
      {title && (
        <p className="text-xs font-semibold text-gray-500 mb-1.5">{title}</p>
      )}
      {label && <p className="text-sm font-bold text-gray-800 mb-2">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="text-xs font-semibold text-gray-900">
            {formatter ? formatter(entry.value) : fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Info Tooltip ──────────────────────────────────── */
const InfoTip = ({ text }) => (
  <div className="group relative inline-flex">
    <Info
      size={14}
      className="text-gray-300 hover:text-gray-500 transition-colors cursor-help"
    />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-[11px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-[280px] text-wrap leading-relaxed">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-800 rotate-45" />
    </div>
  </div>
);

/* ── Reusable micro-components ──────────────────────────────────── */

const SectionHeader = ({ icon: Icon, children, badge, info }) => (
  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 flex items-center gap-2.5">
    {Icon && <Icon size={16} style={{ color: BRAND }} />}
    <h2 className="text-sm font-semibold text-gray-800 tracking-tight flex-1">
      {children}
    </h2>
    {info && <InfoTip text={info} />}
    {badge && (
      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
        {badge}
      </span>
    )}
  </div>
);

const Change = ({ pct }) => {
  if (!pct || pct === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400">
        <Minus size={10} /> 0%
      </span>
    );
  if (pct > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-green-700">
        <ArrowUpRight size={10} /> +{pct}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-600">
      <ArrowDownRight size={10} /> {pct}%
    </span>
  );
};

const HBar = ({ value, max, color = BRAND, h = "h-2" }) => (
  <div className={`w-full bg-gray-100 rounded-full ${h} overflow-hidden`}>
    <div
      className={`${h} rounded-full transition-all duration-700 ease-out`}
      style={{
        width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`,
        backgroundColor: color,
      }}
    />
  </div>
);

/* ── Active Pie Sector (hover effect) ──────────────────────────── */
const renderActiveShape = (props) => {
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
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill="#1f2937"
        fontSize={13}
        fontWeight="bold"
      >
        {fmtK(value)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
        {payload.name}
      </text>
    </g>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const PayrollAnalytics = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [year, setYear] = useState(() => {
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const dMonth = now.getMonth();
    return String(dMonth === 0 ? 12 : dMonth);
  });
  const [department, setDepartment] = useState("");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [activePieIndex, setActivePieIndex] = useState(0);

  // Fetch businesses using the same API as PayrollDashboard
  useEffect(() => {
    const adminId = adminInfo?.id || adminInfo?._id;
    if (!adminId) return;
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };
    axios
      .get(`${Base_URL}/admin/assigned/${adminId}`, { headers })
      .then(({ data }) => {
        const list = data?.businesses || [];
        if (list.length > 0) setSelectedBusiness((prev) => prev || list[0]._id);
      })
      .catch(() => {});
  }, [adminInfo?.id, adminInfo?._id, adminInfo?.token]);

  useEffect(() => {
    if (!selectedBusiness) return;
    setIsLoading(true);
    setError("");
    const params = { business: selectedBusiness };
    if (year) params.year = year;
    if (month) params.month = month;
    if (department) params.department = department;
    axios
      .get(`${Base_URL}/payroll/analytics/dashboard`, { params })
      .then(({ data }) => setData(data))
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to fetch analytics"),
      )
      .finally(() => setIsLoading(false));
  }, [selectedBusiness, year, month, department]);

  const monthly = data?.monthlyTrend || [];
  const annual = data?.annualTotals || {};
  const depts = data?.departmentBreakdown || [];
  const topEarners = data?.topEarners || [];
  const statutory = data?.statutoryBreakdown || {};
  const costDist = data?.costDistribution || {};
  const yoy = data?.yearOverYear || {};
  const statusSum = data?.statusSummary || {};
  const avg = data?.avgMetrics || {};
  const salaryDist = data?.salaryDistribution || {};
  const otData = data?.otAnalytics || {};
  const earningsBreak = data?.earningsBreakdown || [];
  const headcountTrend = data?.headcountTrend || [];
  const activeMonths = useMemo(
    () => monthly.filter((m) => m.grossPay > 0),
    [monthly],
  );
  const totalStatusRuns = useMemo(
    () => Object.values(statusSum).reduce((a, b) => a + b, 0),
    [statusSum],
  );
  const hasActiveFilters =
    selectedBusiness || year || month || department;

  // Prepare chart data
  const trendChartData = useMemo(
    () =>
      activeMonths.map((m) => ({
        name: MN[m.month],
        "Gross Pay": m.grossPay,
        "Net Pay": m.netPay,
        "Employer Cost": m.employerCost,
        Deductions: m.totalDeductions,
        Employees: m.employeeCount,
      })),
    [activeMonths],
  );

  const statutoryPieData = useMemo(
    () =>
      [
        { name: "EPF", value: statutory.epf?.total || 0 },
        { name: "SOCSO", value: statutory.socso?.total || 0 },
        { name: "EIS", value: statutory.eis?.total || 0 },
        { name: "PCB (Tax)", value: statutory.pcb?.total || 0 },
        { name: "HRDF", value: statutory.hrdf?.total || 0 },
      ].filter((s) => s.value > 0),
    [statutory],
  );

  const monthlyStatutoryChartData = useMemo(
    () =>
      activeMonths.map((m) => ({
        name: MN[m.month],
        "EPF (EE)": m.epfEmployee,
        "EPF (ER)": m.epfEmployer,
        "SOCSO (EE)": m.socsoEmployee,
        "SOCSO (ER)": m.socsoEmployer,
        "EIS (EE)": m.eisEmployee,
        "EIS (ER)": m.eisEmployer,
        PCB: m.pcb,
        HRDF: m.hrdf,
      })),
    [activeMonths],
  );

  const headcountChartData = useMemo(
    () =>
      (headcountTrend || [])
        .filter((h) => h.count > 0)
        .map((h) => ({ name: MN[h.month], Employees: h.count })),
    [headcountTrend],
  );

  const salaryRangeData = useMemo(
    () => (salaryDist.ranges || []).filter((r) => r.count > 0),
    [salaryDist],
  );

  const earningsTopN = useMemo(
    () => earningsBreak.slice(0, 8),
    [earningsBreak],
  );

  const summaryCardsData = [
    {
      title: "Total Gross Pay",
      value: fmt(annual.grossPay),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Total Net Pay",
      value: fmt(annual.netPay),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Employer Cost",
      value: fmt(annual.employerCost),
      backgroundColor: "pending-light",
      iconColor: "pending-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: "Active Employees",
      value: avg.totalUniqueEmployees || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
  ];

  const TABS = [
    { id: "overview", label: "Overview", icon: Layers },
    { id: "statutory", label: "Statutory", icon: Shield },
    { id: "people", label: "People & Pay", icon: Users },
    { id: "trends", label: "Trends & OT", icon: Activity },
  ];

  return (
    <Page
      header={{
        title: "Payroll Analytics",
        filters:
          adminInfo?.id || adminInfo?._id
            ? [
                {
                  name: "business",
                  type: "select",
                  isBusinessDropdown: true,
                  businessDropdownProps: {
                    adminId: adminInfo?.id || adminInfo?._id,
                    selectedBusiness: selectedBusiness || "",
                    onChange: (value) => setSelectedBusiness(value || ""),
                    placeholder: "All Businesses",
                    style: { width: "220px" },
                    appearance: "filterPill",
                  },
                },
              ]
            : [],
        renderActions: [
          <div
            key="year"
            className="!p-0 !bg-transparent !shadow-none !rounded-none"
          >
            <YearPicker
              value={year}
              onChange={(yr) => setYear(yr ? Number(yr) : "")}
              placeholder="All Years"
            />
          </div>,
          <div key="month" className="w-full sm:w-[145px] min-w-0">
            <DropdownBasic
              value={month}
              onChange={(value) => setMonth(value)}
              options={MF.slice(1).map((m, i) => ({
                value: String(i + 1),
                label: m,
              }))}
              placeholder="All Months"
              width="145px"
              isClearable={true}
              appearance="filterPill"
              sortOptions={false}
            />
          </div>,
          <div key="department" className="w-full sm:w-[210px] min-w-0">
            <DropdownBasic
              value={department}
              onChange={(value) => setDepartment(value)}
              options={depts.map((d) => ({
                value: d.department,
                label: d.department,
              }))}
              placeholder="All Departments"
              width="210px"
              isClearable={true}
              appearance="filterPill"
            />
          </div>,
          hasActiveFilters ? (
            <div
              key="clear"
              className="!p-0 !bg-transparent !shadow-none !rounded-none"
            >
              <IoClose
                onClick={() => {
                  setSelectedBusiness("");
                  setYear("");
                  setMonth("");
                  setDepartment("");
                }}
                title="Clear Filters"
                className="w-5 h-5 cursor-pointer bg-transparent rounded-full p-[2px] text-red-500 border border-red-500 font-bold hover:bg-red-500 hover:border-none hover:text-white"
              />
            </div>
          ) : null,
          <button
            key="reports"
            onClick={() => history.push("/payroll/reports")}
            className="!h-[40px] !px-3 !w-full sm:!w-auto flex items-center justify-center gap-2 text-white text-sm rounded-xl shadow-sm"
            style={{ backgroundColor: "#008080" }}
          >
            <FileText className="w-4 h-4" />
            Reports
          </button>,
          <button
            key="back"
            onClick={() => history.push("/payroll")}
            className="!h-[40px] !px-3 !w-full sm:!w-auto flex items-center justify-center gap-2 text-white text-sm rounded-xl shadow-sm"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>,
        ],
      }}
    >
      <div className="mt-8">
        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        {/* Loading / Error states */}
        {isLoading && (
          <div className="rounded-xl border border-gray-200/80 shadow-md bg-white p-12 text-center mb-6">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3"
              style={{ borderColor: "var(--p-blue)" }}
            />
            <p className="text-gray-500 text-sm">Loading analytics...</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {data && !isLoading && (
          <>
            {/* ── Tab Navigation ─────────────────────────────────── */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200/80 shadow-md p-1.5 mb-6 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                  style={
                    activeTab === tab.id
                      ? { backgroundColor: "var(--p-blue)" }
                      : {}
                  }
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ════════ OVERVIEW TAB ════════ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Months Processed",
                      value: avg.processedMonths || 0,
                      tip: "Number of payroll runs completed this year",
                    },
                    {
                      label: "Total Payslips",
                      value: avg.totalPayslips || 0,
                      tip: "Total individual payslips generated across all months",
                    },
                    {
                      label: "Avg Gross/Payslip",
                      value: fmt(avg.averageGrossPay),
                      tip: "Average gross pay per payslip across the year",
                    },
                    {
                      label: "Deduction Ratio",
                      value:
                        annual.grossPay > 0
                          ? `${((annual.totalDeductions / annual.grossPay) * 100).toFixed(1)}%`
                          : "0%",
                      tip: "Percentage of gross pay going to deductions (statutory + others)",
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                          {m.label}
                        </p>
                        <InfoTip text={m.tip} />
                      </div>
                      <p className="text-base font-bold text-gray-800">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Monthly Payroll Trend — Area Chart */}
                <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                  <SectionHeader
                    icon={TrendingUp}
                    badge={`${activeMonths.length} active months`}
                    info="Monthly breakdown of Gross Pay, Net Pay and Employer Cost across the selected year"
                  >
                    Monthly Payroll Trend — {year}
                  </SectionHeader>
                  <div className="p-6">
                    {trendChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart
                          data={trendChartData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="gradGross"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={BRAND}
                                stopOpacity={0.25}
                              />
                              <stop
                                offset="95%"
                                stopColor={BRAND}
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                            <linearGradient
                              id="gradNet"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#1d9e6b"
                                stopOpacity={0.25}
                              />
                              <stop
                                offset="95%"
                                stopColor="#1d9e6b"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                            <linearGradient
                              id="gradEC"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#008080"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="95%"
                                stopColor="#008080"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => fmtK(v)}
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            axisLine={false}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip
                            content={<CustomTooltip title="Monthly Payroll" />}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Gross Pay"
                            stroke={BRAND}
                            strokeWidth={2.5}
                            fill="url(#gradGross)"
                            dot={{ r: 3, fill: BRAND }}
                            activeDot={{
                              r: 5,
                              stroke: BRAND,
                              strokeWidth: 2,
                              fill: "#fff",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Net Pay"
                            stroke="#1d9e6b"
                            strokeWidth={2}
                            fill="url(#gradNet)"
                            dot={{ r: 3, fill: "#1d9e6b" }}
                            activeDot={{ r: 5 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Employer Cost"
                            stroke="#008080"
                            strokeWidth={1.5}
                            fill="url(#gradEC)"
                            dot={{ r: 2, fill: "#008080" }}
                            activeDot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        No payroll data for {year}
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly Detail Table */}
                {activeMonths.length > 0 && (
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={CalendarDays}
                      info="Detailed month-by-month breakdown of all payroll figures"
                    >
                      Monthly Breakdown
                    </SectionHeader>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            {[
                              "Month",
                              "Employees",
                              "Gross Pay",
                              "Net Pay",
                              "Deductions",
                              "Employer Cost",
                            ].map((h, i) => (
                              <th
                                key={h}
                                className={`py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeMonths.map((m, idx) => (
                            <tr
                              key={m.month}
                              className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}
                            >
                              <td className="py-3 px-4 font-semibold text-gray-800">
                                {MF[m.month]}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-600">
                                {m.employeeCount}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-800">
                                {fmt(m.grossPay)}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-700">
                                {fmt(m.netPay)}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-500">
                                {fmt(m.totalDeductions)}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-800">
                                {fmt(m.employerCost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {activeMonths.length > 1 && (
                          <tfoot>
                            <tr className="bg-gray-50 border-t-2 border-gray-200">
                              <td className="py-3 px-4 font-bold text-gray-900">
                                Total
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-gray-600">
                                {avg.totalUniqueEmployees}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-gray-900">
                                {fmt(annual.grossPay)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-gray-900">
                                {fmt(annual.netPay)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-gray-700">
                                {fmt(annual.totalDeductions)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-gray-900">
                                {fmt(annual.employerCost)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}

                {/* Cost Distribution & Earnings Breakdown + Run Status */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Cost Distribution Pie Chart */}
                  <div className="lg:col-span-3 rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={PieChartIcon}
                      info="How total employer cost is distributed between take-home pay, employee statutory deductions, and employer statutory contributions"
                    >
                      Cost Distribution
                    </SectionHeader>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: "Net Pay",
                                  value: costDist.basicSalary?.amount || 0,
                                  fill: "#1d9e6b",
                                },
                                {
                                  name: "EE Statutory",
                                  value:
                                    costDist.statutoryEmployee?.amount || 0,
                                  fill: "#e3b126",
                                },
                                {
                                  name: "ER Statutory",
                                  value:
                                    costDist.statutoryEmployer?.amount || 0,
                                  fill: "#008080",
                                },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              <Cell fill="#1d9e6b" />
                              <Cell fill="#e3b126" />
                              <Cell fill="#008080" />
                            </Pie>
                            <Tooltip
                              content={
                                <CustomTooltip title="Cost Distribution" />
                              }
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-4">
                          {[
                            {
                              label: "Net Pay (Take-home)",
                              data: costDist.basicSalary,
                              color: "#1d9e6b",
                            },
                            {
                              label: "Employee Statutory",
                              data: costDist.statutoryEmployee,
                              color: "#e3b126",
                            },
                            {
                              label: "Employer Statutory",
                              data: costDist.statutoryEmployer,
                              color: "#008080",
                            },
                          ].map((item) => (
                            <div key={item.label}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                                  <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: item.color }}
                                  />
                                  {item.label}
                                </span>
                                <span className="text-sm font-bold text-gray-900">
                                  {item.data?.percentage || 0}%
                                </span>
                              </div>
                              <HBar
                                value={Number(item.data?.percentage || 0)}
                                max={100}
                                color={item.color}
                                h="h-2"
                              />
                              <p className="text-xs text-gray-400 mt-1">
                                {fmt(item.data?.amount || 0)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* YoY Comparison */}
                      {yoy.previousYear && yoy.previousYear.runsCount > 0 && (
                        <div className="mt-6 pt-5 border-t border-gray-100">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                            Year-over-Year ({year - 1} → {year})
                          </p>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              {
                                label: "Gross Pay",
                                prev: yoy.previousYear.grossPay,
                                curr: annual.grossPay,
                                change: yoy.grossPay,
                              },
                              {
                                label: "Net Pay",
                                prev: yoy.previousYear.netPay,
                                curr: annual.netPay,
                                change: yoy.netPay,
                              },
                              {
                                label: "Employer Cost",
                                prev: yoy.previousYear.employerCost,
                                curr: annual.employerCost,
                                change: yoy.employerCost,
                              },
                            ].map((row) => (
                              <div
                                key={row.label}
                                className="bg-gray-50 rounded-lg p-3 text-center"
                              >
                                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
                                  {row.label}
                                </p>
                                <p className="text-sm font-bold text-gray-900">
                                  {fmtK(row.curr)}
                                </p>
                                <p className="text-[10px] text-gray-400 mb-1">
                                  was {fmtK(row.prev)}
                                </p>
                                <Change pct={row.change?.percentage} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Run Status */}
                  <div className="lg:col-span-2 rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={FileText}
                      badge={`${totalStatusRuns} runs`}
                      info="Status of all payroll runs for the year — from draft to finalized"
                    >
                      Run Status — {year}
                    </SectionHeader>
                    <div className="p-5 space-y-2.5">
                      {Object.entries(statusSum).map(([status, count]) => {
                        const meta = STATUS_META[status] || {
                          color: "#6d6e73",
                          bg: "#F3F4F6",
                          label: status,
                        };
                        return (
                          <div
                            key={status}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: meta.bg }}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: meta.color }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-gray-700">
                                  {meta.label}
                                </span>
                                <span className="text-sm font-bold text-gray-900">
                                  {count}
                                </span>
                              </div>
                              <HBar
                                value={count}
                                max={Math.max(...Object.values(statusSum), 1)}
                                color={meta.color}
                                h="h-1.5"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════ STATUTORY TAB ════════ */}
            {activeTab === "statutory" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Interactive Pie Chart */}
                  <div className="lg:col-span-2 rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={PieChartIcon}
                      info="Total annual statutory contributions — hover on segments to see amounts. EPF, SOCSO, EIS are shared between employee & employer. PCB is employee only, HRDF is employer only."
                    >
                      Statutory Breakdown
                    </SectionHeader>
                    <div className="p-6 flex flex-col items-center gap-4">
                      {statutoryPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              activeIndex={activePieIndex}
                              activeShape={renderActiveShape}
                              data={statutoryPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              dataKey="value"
                              onMouseEnter={(_, idx) => setActivePieIndex(idx)}
                              paddingAngle={3}
                              strokeWidth={0}
                            >
                              {statutoryPieData.map((entry) => (
                                <Cell
                                  key={entry.name}
                                  fill={STAT_COLORS[entry.name] || "#999"}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              content={
                                <CustomTooltip title="Statutory Contribution" />
                              }
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="py-10 text-sm text-gray-400">
                          No statutory data
                        </div>
                      )}
                      <div className="w-full space-y-2">
                        {[
                          {
                            label: "EPF",
                            color: BRAND,
                            total: statutory.epf?.total,
                          },
                          {
                            label: "SOCSO",
                            color: "#1d9e6b",
                            total: statutory.socso?.total,
                          },
                          {
                            label: "EIS",
                            color: "#e3b126",
                            total: statutory.eis?.total,
                          },
                          {
                            label: "PCB (Tax)",
                            color: "#e85555",
                            total: statutory.pcb?.total,
                          },
                          {
                            label: "HRDF",
                            color: "#008080",
                            total: statutory.hrdf?.total,
                          },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <span className="flex items-center gap-2 text-sm text-gray-700">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.label}
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {fmt(s.total || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* EE vs ER Split — Grouped Bar Chart */}
                  <div className="lg:col-span-3 rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={Shield}
                      info="Comparison of employee vs employer portion for each statutory contribution type. EPF, SOCSO, EIS have both sides; PCB is employee-only, HRDF is employer-only."
                    >
                      Employee vs Employer Split
                    </SectionHeader>
                    <div className="p-6">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart
                          data={[
                            {
                              name: "EPF",
                              Employee: statutory.epf?.employee || 0,
                              Employer: statutory.epf?.employer || 0,
                            },
                            {
                              name: "SOCSO",
                              Employee: statutory.socso?.employee || 0,
                              Employer: statutory.socso?.employer || 0,
                            },
                            {
                              name: "EIS",
                              Employee: statutory.eis?.employee || 0,
                              Employer: statutory.eis?.employer || 0,
                            },
                            {
                              name: "PCB",
                              Employee: statutory.pcb?.total || 0,
                              Employer: 0,
                            },
                            {
                              name: "HRDF",
                              Employee: 0,
                              Employer: statutory.hrdf?.total || 0,
                            },
                          ]}
                          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                          barGap={4}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#6B7280" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => fmtK(v)}
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            axisLine={false}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip
                            content={
                              <CustomTooltip title="Employee vs Employer" />
                            }
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                          />
                          <Bar
                            dataKey="Employee"
                            fill={BRAND}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                          <Bar
                            dataKey="Employer"
                            fill="#008080"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="grid grid-cols-2 gap-4 mt-5">
                        <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                          <p className="text-[10px] font-bold text-red-400 uppercase mb-1">
                            PCB (Income Tax)
                          </p>
                          <p className="text-lg font-bold text-red-600">
                            {fmt(statutory.pcb?.total || 0)}
                          </p>
                          <p className="text-[10px] text-red-400">
                            Employee only
                          </p>
                        </div>
                        <div className="bg-teal-50 rounded-xl p-4 text-center border border-teal-100">
                          <p className="text-[10px] font-bold text-teal-500 uppercase mb-1">
                            HRDF Levy
                          </p>
                          <p className="text-lg font-bold text-teal-700">
                            {fmt(statutory.hrdf?.total || 0)}
                          </p>
                          <p className="text-[10px] text-teal-500">
                            Employer only
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Statutory Trend — Stacked Area Chart */}
                {monthlyStatutoryChartData.length > 0 && (
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={BarChart3}
                      info="Monthly statutory contributions stacked by type — shows how EPF, SOCSO, EIS, PCB and HRDF change month-to-month"
                    >
                      Monthly Statutory Contributions
                    </SectionHeader>
                    <div className="p-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart
                          data={monthlyStatutoryChartData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => fmtK(v)}
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            axisLine={false}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip
                            content={
                              <CustomTooltip title="Statutory Contributions" />
                            }
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                          />
                          <Bar
                            dataKey="EPF (EE)"
                            stackId="epf"
                            fill={BRAND}
                            maxBarSize={30}
                          />
                          <Bar
                            dataKey="EPF (ER)"
                            stackId="epf"
                            fill="#F5A84A"
                            maxBarSize={30}
                          />
                          <Bar
                            dataKey="SOCSO (EE)"
                            stackId="socso"
                            fill="#1d9e6b"
                            maxBarSize={30}
                          />
                          <Bar
                            dataKey="SOCSO (ER)"
                            stackId="socso"
                            fill="#5ac8a0"
                            maxBarSize={30}
                          />
                          <Line
                            type="monotone"
                            dataKey="PCB"
                            stroke="#e85555"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="HRDF"
                            stroke="#008080"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            strokeDasharray="5 5"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Monthly Statutory Table */}
                {activeMonths.length > 0 && (
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={CalendarDays}
                      info="Detailed month-by-month statutory contribution amounts"
                    >
                      Statutory Detail Table
                    </SectionHeader>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="py-3 px-3 text-left text-[11px] font-semibold text-gray-400 uppercase">
                              Month
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              EPF (EE)
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              EPF (ER)
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              SOCSO (EE)
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              SOCSO (ER)
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              EIS (EE)
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              EIS (ER)
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              PCB
                            </th>
                            <th className="py-3 px-3 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              HRDF
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeMonths.map((m, i) => (
                            <tr
                              key={m.month}
                              className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                            >
                              <td className="py-3 px-3 font-semibold text-gray-800">
                                {MF[m.month]}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.epfEmployee)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.epfEmployer)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.socsoEmployee)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.socsoEmployer)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.eisEmployee)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.eisEmployer)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.pcb)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {fmt(m.hrdf)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {activeMonths.length > 1 && (
                          <tfoot>
                            <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                              <td className="py-3 px-3 text-gray-900">Total</td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.epfEmployee)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.epfEmployer)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.socsoEmployee)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.socsoEmployer)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.eisEmployee)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.eisEmployer)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.pcb)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                {fmt(annual.hrdf)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════════ PEOPLE & PAY TAB ════════ */}
            {activeTab === "people" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Department Breakdown — Horizontal Bar Chart */}
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={Building2}
                      badge={`${depts.length} depts`}
                      info="Gross pay breakdown by department — sorted by highest cost. Hover bars for details including net pay and employer cost."
                    >
                      Department Cost Breakdown
                    </SectionHeader>
                    <div className="p-6">
                      {depts.length === 0 ? (
                        <div className="text-center py-10">
                          <Building2
                            size={32}
                            className="mx-auto text-gray-300 mb-3"
                          />
                          <p className="text-gray-400 text-sm">
                            No department data available
                          </p>
                        </div>
                      ) : (
                        <ResponsiveContainer
                          width="100%"
                          height={Math.max(depts.length * 50, 180)}
                        >
                          <BarChart
                            data={depts.map((d) => ({
                              name: d.department,
                              "Gross Pay": d.grossPay,
                              "Net Pay": d.netPay,
                              "Employer Cost": d.employerCost,
                              Headcount: d.headcount,
                            }))}
                            layout="vertical"
                            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f0f0f0"
                              horizontal={false}
                            />
                            <XAxis
                              type="number"
                              tickFormatter={(v) => fmtK(v)}
                              tick={{ fontSize: 10, fill: "#9CA3AF" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: 11, fill: "#374151" }}
                              axisLine={false}
                              tickLine={false}
                              width={100}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                  <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[200px]">
                                    <p className="text-sm font-bold text-gray-800 mb-2">
                                      {label}
                                    </p>
                                    <p className="text-xs text-gray-500 mb-1">
                                      {d?.Headcount} employees
                                    </p>
                                    {payload.map((entry, i) => (
                                      <div
                                        key={i}
                                        className="flex justify-between gap-4 py-0.5"
                                      >
                                        <span className="text-xs text-gray-600 flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-2 rounded-full"
                                            style={{
                                              backgroundColor: entry.color,
                                            }}
                                          />
                                          {entry.name}
                                        </span>
                                        <span className="text-xs font-semibold">
                                          {fmt(entry.value)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Bar
                              dataKey="Gross Pay"
                              fill={BRAND}
                              radius={[0, 4, 4, 0]}
                              maxBarSize={28}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Top Earners — Horizontal Bar */}
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={Award}
                      badge="Annual Gross"
                      info="Top 10 highest-paid employees by total annual gross pay. Hover for detailed breakdown."
                    >
                      Top Earners
                    </SectionHeader>
                    {topEarners.length === 0 ? (
                      <div className="p-6 text-center py-10">
                        <Users
                          size={32}
                          className="mx-auto text-gray-300 mb-3"
                        />
                        <p className="text-gray-400 text-sm">
                          No employee data available
                        </p>
                      </div>
                    ) : (
                      <div className="p-6">
                        <ResponsiveContainer
                          width="100%"
                          height={Math.max(topEarners.length * 46, 180)}
                        >
                          <BarChart
                            data={topEarners.map((e) => ({
                              name: e.fullName
                                ?.split(" ")
                                .slice(0, 2)
                                .join(" "),
                              "Total Gross": e.totalGross,
                              "Total Net": e.totalNet,
                              Months: e.months,
                            }))}
                            layout="vertical"
                            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f0f0f0"
                              horizontal={false}
                            />
                            <XAxis
                              type="number"
                              tickFormatter={(v) => fmtK(v)}
                              tick={{ fontSize: 10, fill: "#9CA3AF" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: 11, fill: "#374151" }}
                              axisLine={false}
                              tickLine={false}
                              width={100}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                  <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3 min-w-[180px]">
                                    <p className="text-sm font-bold text-gray-800 mb-1">
                                      {d?.name}
                                    </p>
                                    <p className="text-xs text-gray-400 mb-2">
                                      {d?.Months} months active
                                    </p>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-xs text-gray-600">
                                        Total Gross
                                      </span>
                                      <span className="text-xs font-semibold">
                                        {fmt(d?.["Total Gross"])}
                                      </span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-xs text-gray-600">
                                        Total Net
                                      </span>
                                      <span className="text-xs font-semibold">
                                        {fmt(d?.["Total Net"])}
                                      </span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-xs text-gray-600">
                                        Avg/Month
                                      </span>
                                      <span className="text-xs font-semibold">
                                        {fmt(
                                          d?.Months > 0
                                            ? d?.["Total Gross"] / d?.Months
                                            : 0,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Bar
                              dataKey="Total Gross"
                              fill="#1d9e6b"
                              radius={[0, 4, 4, 0]}
                              maxBarSize={24}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Salary Distribution + Earnings Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Salary Distribution */}
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={Wallet}
                      info="Distribution of individual payslip gross pay amounts across salary ranges. Shows how many payslips fall in each bracket. Quartile stats (Q1, Median, Q3) provide a statistical overview."
                    >
                      Salary Distribution
                    </SectionHeader>
                    <div className="p-6">
                      {salaryRangeData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart
                              data={salaryRangeData}
                              margin={{
                                top: 10,
                                right: 10,
                                left: 10,
                                bottom: 0,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f0f0f0"
                              />
                              <XAxis
                                dataKey="range"
                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={50}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  return (
                                    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3">
                                      <p className="text-sm font-bold text-gray-800">
                                        {payload[0]?.payload?.range}
                                      </p>
                                      <p className="text-xs text-gray-600 mt-1">
                                        {payload[0]?.value} payslips
                                      </p>
                                    </div>
                                  );
                                }}
                              />
                              <Bar
                                dataKey="count"
                                fill="#8B5CF6"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={50}
                                name="Payslips"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                            {[
                              { label: "Min", value: fmt(salaryDist.min) },
                              { label: "Q1", value: fmt(salaryDist.q1) },
                              {
                                label: "Median",
                                value: fmt(salaryDist.median),
                              },
                              { label: "Q3", value: fmt(salaryDist.q3) },
                              { label: "Max", value: fmt(salaryDist.max) },
                            ].map((q) => (
                              <div
                                key={q.label}
                                className="bg-gray-50 rounded-lg p-2 text-center"
                              >
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">
                                  {q.label}
                                </p>
                                <p className="text-xs font-bold text-gray-800 mt-0.5">
                                  {q.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-10 text-sm text-gray-400">
                          No salary data available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Earnings Breakdown — Pie */}
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={PieChartIcon}
                      info="Breakdown of all earnings categories — Basic Salary, Allowances, Overtime, and other pay elements. Shows the top 8 categories by amount."
                    >
                      Earnings Breakdown
                    </SectionHeader>
                    <div className="p-6">
                      {earningsTopN.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={earningsTopN}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                dataKey="amount"
                                nameKey="name"
                                paddingAngle={2}
                                strokeWidth={0}
                              >
                                {earningsTopN.map((_, i) => (
                                  <Cell key={i} fill={PAL[i % PAL.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                content={<CustomTooltip title="Earnings" />}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-2">
                            {earningsTopN.map((e, i) => (
                              <div
                                key={e.name}
                                className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50"
                              >
                                <span className="flex items-center gap-2 text-xs text-gray-700 truncate">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: PAL[i % PAL.length],
                                    }}
                                  />
                                  {e.name}
                                </span>
                                <span className="text-xs font-semibold text-gray-900 ml-2 flex-shrink-0">
                                  {fmt(e.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-sm text-gray-400">
                          No earnings data available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════ TRENDS & OT TAB ════════ */}
            {activeTab === "trends" && (
              <div className="space-y-6">
                {/* Net Pay vs Deductions — Stacked Bar */}
                <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                  <SectionHeader
                    icon={TrendingUp}
                    info="Stacked comparison showing how gross pay splits between net take-home (green) and total deductions (amber) each month. The line shows employer cost trend."
                  >
                    Monthly Comparison — Net Pay vs Deductions
                  </SectionHeader>
                  <div className="p-6">
                    {trendChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart
                          data={trendChartData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => fmtK(v)}
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            axisLine={false}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip
                            content={<CustomTooltip title="Payroll Split" />}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                          />
                          <Bar
                            dataKey="Net Pay"
                            stackId="payroll"
                            fill="#1d9e6b"
                            radius={[0, 0, 0, 0]}
                            maxBarSize={36}
                          />
                          <Bar
                            dataKey="Deductions"
                            stackId="payroll"
                            fill="#e3b126"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={36}
                          />
                          <Line
                            type="monotone"
                            dataKey="Employer Cost"
                            stroke="#008080"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "#008080" }}
                            activeDot={{ r: 6 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-12 text-sm text-gray-400">
                        No trend data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Headcount Trend + OT Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Headcount Trend */}
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={Users}
                      info="Number of unique employees paid each month — shows workforce growth or reduction over the year"
                    >
                      Headcount Trend
                    </SectionHeader>
                    <div className="p-6">
                      {headcountChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart
                            data={headcountChartData}
                            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id="gradHC"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#8B5CF6"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#8B5CF6"
                                  stopOpacity={0.02}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f0f0f0"
                            />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 11, fill: "#9CA3AF" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "#9CA3AF" }}
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3">
                                    <p className="text-sm font-bold text-gray-800">
                                      {label}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {payload[0]?.value} employees
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="Employees"
                              stroke="#8B5CF6"
                              strokeWidth={2.5}
                              fill="url(#gradHC)"
                              dot={{ r: 4, fill: "#8B5CF6" }}
                              activeDot={{
                                r: 6,
                                stroke: "#8B5CF6",
                                strokeWidth: 2,
                                fill: "#fff",
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-10 text-sm text-gray-400">
                          No headcount data
                        </div>
                      )}
                    </div>
                  </div>

                  {/* OT Summary */}
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={Clock}
                      info="Overtime summary — total OT hours and spend across all employees. Shows breakdown by OT slot type if available."
                    >
                      Overtime Analytics
                    </SectionHeader>
                    <div className="p-6">
                      {otData.totalAmount > 0 ? (
                        <>
                          <div className="grid grid-cols-2 gap-3 mb-5">
                            <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
                              <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">
                                Total OT Hours
                              </p>
                              <p className="text-xl font-bold text-orange-600">
                                {(otData.totalHours || 0).toFixed(1)}
                              </p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
                              <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">
                                Total OT Amount
                              </p>
                              <p className="text-xl font-bold text-orange-600">
                                {fmt(otData.totalAmount)}
                              </p>
                            </div>
                          </div>
                          {otData.bySlot?.length > 0 && (
                            <ResponsiveContainer width="100%" height={160}>
                              <BarChart
                                data={otData.bySlot}
                                margin={{
                                  top: 0,
                                  right: 10,
                                  left: 10,
                                  bottom: 0,
                                }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#f0f0f0"
                                />
                                <XAxis
                                  dataKey="label"
                                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis
                                  tickFormatter={(v) => fmtK(v)}
                                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                  axisLine={false}
                                  tickLine={false}
                                  width={60}
                                />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.length)
                                      return null;
                                    const d = payload[0]?.payload;
                                    return (
                                      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-3">
                                        <p className="text-sm font-bold text-gray-800">
                                          {d?.label}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                          {(d?.hours || 0).toFixed(1)} hours
                                        </p>
                                        <p className="text-xs font-semibold text-gray-800">
                                          {fmt(d?.amount)}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          {d?.employeeCount} employees
                                        </p>
                                      </div>
                                    );
                                  }}
                                />
                                <Bar
                                  dataKey="amount"
                                  fill={BRAND}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={40}
                                  name="OT Amount"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                          {otData.topOTEmployees?.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-gray-100">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                Top OT Employees
                              </p>
                              <div className="space-y-2">
                                {otData.topOTEmployees.map((e, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50"
                                  >
                                    <span className="text-sm text-gray-700">
                                      {e.fullName}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900">
                                      {fmt(e.totalOT)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-10">
                          <Clock
                            size={32}
                            className="mx-auto text-gray-300 mb-3"
                          />
                          <p className="text-gray-400 text-sm">
                            No overtime data available
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Month-over-Month changes */}
                {activeMonths.length > 1 && (
                  <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                    <SectionHeader
                      icon={Activity}
                      info="Shows how gross pay, employee count, and average pay per employee change month-to-month. Green arrows indicate increases, red indicates decreases."
                    >
                      Month-over-Month Changes
                    </SectionHeader>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            {[
                              "Month",
                              "Gross Pay",
                              "Change",
                              "Employees",
                              "Avg Gross/Emp",
                            ].map((h, i) => (
                              <th
                                key={h}
                                className={`py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase ${i === 0 ? "text-left" : "text-right"}`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeMonths.map((m, i) => {
                            const prev = i > 0 ? activeMonths[i - 1] : null;
                            const change = prev
                              ? m.grossPay - prev.grossPay
                              : 0;
                            const changePct =
                              prev && prev.grossPay > 0
                                ? ((change / prev.grossPay) * 100).toFixed(1)
                                : 0;
                            const avgPerEmp =
                              m.employeeCount > 0
                                ? m.grossPay / m.employeeCount
                                : 0;
                            return (
                              <tr
                                key={m.month}
                                className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                              >
                                <td className="py-3 px-4 font-semibold text-gray-800">
                                  {MF[m.month]}
                                </td>
                                <td className="py-3 px-4 text-right font-semibold text-gray-800">
                                  {fmt(m.grossPay)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {i > 0 ? (
                                    <Change pct={Number(changePct)} />
                                  ) : (
                                    <span className="text-gray-300 text-xs">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-700">
                                  {m.employeeCount}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-700">
                                  {fmt(avgPerEmp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
};

export default PayrollAnalytics;
