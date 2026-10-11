import React, { useState, useEffect, useContext } from "react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import {
  Plus,
  Eye,
  Edit,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  FileSpreadsheet as ExcelIcon,
  Users,
  Clock,
} from "lucide-react";
import * as XLSX from "xlsx";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import {
  PieChart,
  Pie,
  Cell,
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
import { AdminContext } from "@/context/AdminContext";
import { useDailyReportsPermissions } from "@/hooks/useDailyReportsPermissions";
import { SummaryCards, Page } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import DateRangePicker from "@/components/common/DateRangePicker";
import { notifyError, notifySuccess } from "@/utils/toast";
import DailyReportsService, {
  resolveDailyReportsScopeFromPath,
  setDailyReportsApiScope,
} from "@/services/dailyReportsService";
import { CollectionsByChannel } from "./DashboardCharts";

import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";

// Chart color palette
const CHART_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${formatAmount(entry.value || 0)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DailyReportsDashboard() {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const location = useLocation();
  const { canCreate, canView, canViewOwn, canUpdate } = useDailyReportsPermissions();
  const canOpenReport = canView || canViewOwn;

  // State
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  
  // Summary stats
  const [summary, setSummary] = useState({
    todayCollections: 0,
    weekCollections: 0,
    outstandingAdvances: 0,
    advancesCount: 0,
    totalCollections: 0,
    totalPayouts: 0,
    totalAdvances: 0,
    netCashFlow: 0,
    reportCount: 0,
  });
  
  // Chart data
  const [channelData, setChannelData] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [collectionsTrend, setCollectionsTrend] = useState([]);
  const [shiftsData, setShiftsData] = useState([]);

  useEffect(() => {
    setDailyReportsApiScope(resolveDailyReportsScopeFromPath(location.pathname));
  }, [location.pathname]);

  // Fetch assigned businesses only (not all businesses in the system)
  useEffect(() => {
    const adminId = adminInfo?.id || adminInfo?._id;
    if (!adminId) return;
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };
    const fetchAssigned = async () => {
      try {
        const res = await axios.get(`${Base_URL}/admin/assigned/${adminId}`, { headers });
        const list = res.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1) {
          setSelectedBusiness((prev) => prev || list[0]._id);
        }
      } catch (err) {
        console.error("Failed to fetch assigned businesses:", err);
        setBusinesses([]);
      }
    };
    fetchAssigned();
  }, [adminInfo?.id, adminInfo?._id]);

  // Fetch when business, date range, or assigned-business list is ready (avoid first fetch with no scope)
  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusiness, dateRangeStart, dateRangeEnd, businesses]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const params = {};
      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);

      if (selectedBusiness) {
        // Single-business view
        params.business = selectedBusiness;
      } else if (assignedIds.length > 0) {
        // Multi-business view: restrict to assigned businesses only
        params.businessIds = assignedIds.join(",");
      }
      if (dateRangeStart) params.startDate = dateRangeStart;
      if (dateRangeEnd) params.endDate = dateRangeEnd;

      const hasBusinessScope = Boolean(params.business || params.businessIds);

      if (!hasBusinessScope) {
        setSummary({
          todayCollections: 0,
          weekCollections: 0,
          outstandingAdvances: 0,
          advancesCount: 0,
          totalCollections: 0,
          totalPayouts: 0,
          totalAdvances: 0,
          netCashFlow: 0,
          reportCount: 0,
        });
        setChannelData([]);
        setCashFlowData([]);
        setCollectionsTrend([]);
        setRecentReports([]);
        setLoading(false);
        return;
      }

      // Fetch all data in parallel — only when business or businessIds is set
      const [
        summaryData,
        channelDataRes,
        cashFlowRes,
        reportsData,
        staffAdvancesRes,
        lateTransactionsRes,
        supplierPaymentsRes,
      ] = await Promise.all([
        DailyReportsService.getSummary(params),
        DailyReportsService.getCollectionsByChannel(params),
        DailyReportsService.getCashFlow(params),
        DailyReportsService.getAllShiftReports({ ...params, limit: 10 }),
        DailyReportsService.getAllStaffAdvances(params),
        DailyReportsService.getAllLateTransactions(params),
        DailyReportsService.getAllSupplierPayments(params).catch(() => ({ success: false, data: [] })),
      ]);

      if (summaryData?.success && summaryData.data) {
        setSummary({
          todayCollections: summaryData.data.todayCollections || 0,
          weekCollections: summaryData.data.weekCollections || 0,
          outstandingAdvances: summaryData.data.outstandingAdvances || 0,
          advancesCount: summaryData.data.advancesCount || 0,
          totalCollections: summaryData.data.totalCollections || 0,
          totalPayouts: summaryData.data.totalPayouts || 0,
          totalAdvances: summaryData.data.totalAdvances || 0,
          netCashFlow: summaryData.data.netCashFlow || 0,
          reportCount: summaryData.data.reportCount || 0,
        });
      } else {
        setSummary({
          todayCollections: 0,
          weekCollections: 0,
          outstandingAdvances: 0,
          advancesCount: 0,
          totalCollections: 0,
          totalPayouts: 0,
          totalAdvances: 0,
          netCashFlow: 0,
          reportCount: 0,
        });
      }

      if (channelDataRes?.success && channelDataRes.data) {
        setChannelData(Array.isArray(channelDataRes.data) ? channelDataRes.data : []);
      } else {
        setChannelData([]);
      }

      // Process staff advances and late transactions
      const staffAdvances = staffAdvancesRes?.success && staffAdvancesRes.data 
        ? Array.isArray(staffAdvancesRes.data) ? staffAdvancesRes.data : []
        : [];
      
      const lateTransactions = lateTransactionsRes?.success && lateTransactionsRes.data
        ? Array.isArray(lateTransactionsRes.data) ? lateTransactionsRes.data : []
        : [];

      // Get all reports to map advances and transactions to dates
      const reports = reportsData?.success 
        ? (reportsData.data?.reports || reportsData.data || [])
        : [];
      
      // Create a map of report IDs to business dates
      const reportDateMap = {};
      reports.forEach((report) => {
        if (report._id && report.businessDate) {
          reportDateMap[report._id.toString()] = report.businessDate;
        }
      });

      // Group late transactions by date and type
      const lateCollectionsByDate = {};
      const latePayoutsByDate = {};
      const lateAdvancesByDate = {};
      
      lateTransactions.forEach((txn) => {
        const date = txn.appliedBusinessDate || reportDateMap[txn.shiftReportId?.toString()] || (txn.createdAt ? new Date(txn.createdAt).toISOString().split("T")[0] : null);
        if (date) {
          const amount = parseFloat(txn.amount || 0);
          if (txn.transactionType === "COLLECTION") {
            if (!lateCollectionsByDate[date]) {
              lateCollectionsByDate[date] = 0;
            }
            lateCollectionsByDate[date] += amount;
          } else if (txn.transactionType === "SUPPLIER_PAYMENT") {
            if (!latePayoutsByDate[date]) {
              latePayoutsByDate[date] = 0;
            }
            latePayoutsByDate[date] += amount;
          } else if (txn.transactionType === "ADVANCE") {
            if (!lateAdvancesByDate[date]) {
              lateAdvancesByDate[date] = 0;
            }
            lateAdvancesByDate[date] += amount;
          }
        }
      });

      // Group advances by date
      const advancesByDate = {};
      staffAdvances.forEach((advance) => {
        const reportId = advance.shiftReportId?.toString();
        const date = reportDateMap[reportId] || (advance.createdAt ? new Date(advance.createdAt).toISOString().split("T")[0] : null);
        if (date) {
          if (!advancesByDate[date]) {
            advancesByDate[date] = 0;
          }
          advancesByDate[date] += advance.amount || 0;
        }
      });

      // Note: cashSummary.totalCollected and totalPaidOut already include late transactions
      // (they're added when the report is submitted), so we don't need to add them again
      if (cashFlowRes?.success && cashFlowRes.data) {
        const flowData = Array.isArray(cashFlowRes.data) ? cashFlowRes.data : [];
        setCashFlowData(flowData);
      } else {
        setCashFlowData([]);
        }

      // Prepare collections trend data with staff advances and late transactions
      // Note: cashSummary already includes late transactions, but we show them separately for trend analysis
      if (cashFlowRes?.success && cashFlowRes.data) {
        const flowData = Array.isArray(cashFlowRes.data) ? cashFlowRes.data : [];
        const trendData = flowData.map((item) => {
          const date = item._id || item.date || "N/A";
          // cashSummary already includes late transactions, so we use the values directly
          const totalCollections = item.totalCollected || 0;
          const totalPayouts = item.totalPaidOut || 0; // Already includes supplier payments + advances (including late)
          const totalAdvances = (advancesByDate[date] || 0) + (lateAdvancesByDate[date] || 0);
          
          return {
            date,
            collections: totalCollections,
            payouts: totalPayouts,
            staffAdvances: totalAdvances,
            lateCollections: lateCollectionsByDate[date] || 0,
            latePayouts: latePayoutsByDate[date] || 0,
            lateAdvances: lateAdvancesByDate[date] || 0,
            netFlow: totalCollections - totalPayouts,
          };
        });
        setCollectionsTrend(trendData);
      } else {
        setCollectionsTrend([]);
      }

      if (reportsData?.success) {
        const reports = reportsData.data?.reports || reportsData.data || [];
        setRecentReports(Array.isArray(reports) ? reports : []);
        
        // Process shifts data with detailed breakdown
        const shiftsMap = {};
        const staffAdvances = staffAdvancesRes?.success && staffAdvancesRes.data 
          ? Array.isArray(staffAdvancesRes.data) ? staffAdvancesRes.data : []
          : [];
        const payments = supplierPaymentsRes?.success && supplierPaymentsRes.data
          ? Array.isArray(supplierPaymentsRes.data) ? supplierPaymentsRes.data : []
          : [];

        // Group advances and payments by shift report
        const advancesByReport = {};
        staffAdvances.forEach((advance) => {
          const reportId = advance.shiftReportId?.toString();
          if (!advancesByReport[reportId]) {
            advancesByReport[reportId] = 0;
          }
          advancesByReport[reportId] += advance.amount || 0;
        });

        const paymentsByReport = {};
        payments.forEach((payment) => {
          const reportId = payment.shiftReportId?.toString();
          if (!paymentsByReport[reportId]) {
            paymentsByReport[reportId] = 0;
          }
          paymentsByReport[reportId] += payment.amountPaid || 0;
        });

        // Group late transactions by shift report and type
        const lateCollectionsByReport = {};
        const latePayoutsByReport = {};
        const lateAdvancesByReport = {};
        
        lateTransactions.forEach((txn) => {
          const reportId = txn.shiftReportId?.toString();
          if (reportId) {
            const amount = parseFloat(txn.amount || 0);
            if (txn.transactionType === "COLLECTION") {
              if (!lateCollectionsByReport[reportId]) {
                lateCollectionsByReport[reportId] = 0;
              }
              lateCollectionsByReport[reportId] += amount;
            } else if (txn.transactionType === "SUPPLIER_PAYMENT") {
              if (!latePayoutsByReport[reportId]) {
                latePayoutsByReport[reportId] = 0;
              }
              latePayoutsByReport[reportId] += amount;
            } else if (txn.transactionType === "ADVANCE") {
              if (!lateAdvancesByReport[reportId]) {
                lateAdvancesByReport[reportId] = 0;
              }
              lateAdvancesByReport[reportId] += amount;
            }
          }
        });

        reports.forEach((report) => {
          const shiftName =
            report.shiftSnapshot?.name ||
            report.shiftId?.name ||
            (report.shiftNo != null ? `Shift ${report.shiftNo}` : "Other");
          if (!shiftsMap[shiftName]) {
            shiftsMap[shiftName] = {
              name: shiftName,
              count: 0,
              totalCollections: 0,
              totalAdvances: 0,
              totalPayouts: 0,
              avgCollections: 0,
            };
          }
          const reportId = report._id?.toString();
          shiftsMap[shiftName].count += 1;
          // cashSummary.totalCollected already includes late transaction collections
          shiftsMap[shiftName].totalCollections += report.cashSummary?.totalCollected || 0;
          // Calculate advances separately (regular + late) for display
          shiftsMap[shiftName].totalAdvances += (advancesByReport[reportId] || 0) + (lateAdvancesByReport[reportId] || 0);
          // Calculate supplier payouts separately (regular + late, excluding advances) for display
          shiftsMap[shiftName].totalPayouts += (paymentsByReport[reportId] || 0) + (latePayoutsByReport[reportId] || 0);
        });

        // Calculate averages
        Object.keys(shiftsMap).forEach((shiftName) => {
          const shift = shiftsMap[shiftName];
          shift.avgCollections = shift.count > 0 ? shift.totalCollections / shift.count : 0;
        });

        setShiftsData(Object.values(shiftsMap));
      } else {
        setRecentReports([]);
        setShiftsData([]);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      notifyError("Failed to load dashboard data");
      setSummary({
        todayCollections: 0,
        weekCollections: 0,
        outstandingAdvances: 0,
        advancesCount: 0,
        totalCollections: 0,
        totalPayouts: 0,
        totalAdvances: 0,
        netCashFlow: 0,
        reportCount: 0,
      });
      setChannelData([]);
      setCashFlowData([]);
      setCollectionsTrend([]);
      setRecentReports([]);
      setShiftsData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate || "");
    setDateRangeEnd(endDate || "");
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
  };

  const handleExportExcel = () => {
    try {
      const exportData = [
        { Metric: "Today's Collections", Value: summary.todayCollections },
        { Metric: "Net Cash Flow", Value: summary.netCashFlow },
        { Metric: "Outstanding Advances", Value: summary.outstandingAdvances },
        { Metric: "Total Collections", Value: summary.totalCollections },
        { Metric: "Total Payouts", Value: summary.totalPayouts },
        { Metric: "Total Advances", Value: summary.totalAdvances },
        { Metric: "Report Count", Value: summary.reportCount },
      ];

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Reports Summary");
      const filename = `Daily_Reports_Summary_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      notifySuccess("Data exported successfully!");
    } catch (error) {
      console.error("Error exporting:", error);
      notifyError("Failed to export data");
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      DRAFT: "bg-gray-100 text-gray-700",
      SUBMITTED: "bg-blue-100 text-blue-700",
      APPROVED: "bg-green-100 text-green-700",
      LOCKED: "bg-purple-100 text-purple-700",
    };
    return statusColors[status] || "bg-gray-100 text-gray-700";
  };

  // Calculate total channel collections
  const totalChannelAmount = channelData.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

  // Prepare pie chart data
  const pieChartData = channelData.map((channel, index) => ({
    name: channel.channelName || channel._id || "Unknown",
    value: channel.totalAmount || 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  // Only 3 main summary cards (Cash Variance removed)
  const summaryCardsData = [
    {
      title: "Today's Collections",
      value: `${formatAmount(summary.todayCollections || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Net Cash Flow",
      value: `${formatAmount(summary.netCashFlow || 0)}`,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Outstanding Advances",
      value: `${formatAmount(summary.outstandingAdvances || 0)}`,
      backgroundColor: "pending-light",
      iconColor: "pending-dark",
      Icon: PendingApprovalSvg,
    },
  ];

  return (
    <Page
      header={{
        title: "Daily Reports",
        filters: adminInfo?.id || adminInfo?._id ? [
          {
            name: "business",
            type: "select",
            isBusinessDropdown: true,
            businessDropdownProps: {
              adminId: adminInfo?.id || adminInfo?._id,
              selectedBusiness: selectedBusiness || "",
              onChange: (value) => {
                setSelectedBusiness(value || "");
              },
              placeholder: "All Businesses",
              style: {
                width: "270px",
              },
            },
          },
        ] : [],
        showAddButton: canCreate,
        addButtonText: "Create Report",
        onAddNew: () =>
          history.push("/daily-reports/create", {
            returnTo: "/daily-reports/dashboard",
          }),
        renderActions: [
          <DateRangePicker
            key="date-range"
            startDate={dateRangeStart}
            endDate={dateRangeEnd}
            onApply={handleDateRangeApply}
            onClear={handleDateRangeClear}
            placeholder="Select date range"
          />,
          <button
            key="export"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-xl shadow-sm bg-green-600 hover:bg-green-700"
          >
            <ExcelIcon className="w-4 h-4" />
            Export
          </button>
        ],
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)]"></div>
        </div>
      ) : (
        <>
              {/* 3 Main Stats Cards */}
              <SummaryCards cards={summaryCardsData} columnsCount={3} />

              {/* Additional Metrics - Compact Info Cards */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Total Collections</p>
                  <p className="text-base font-semibold text-gray-800">{formatAmount(summary.totalCollections || 0)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Total Payouts (incl. Advances)</p>
                  <p className="text-base font-semibold text-gray-800">{formatAmount(summary.totalPayouts || 0)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Staff Advances</p>
                  <p className="text-base font-semibold text-gray-800">{formatAmount(summary.totalAdvances || 0)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Reports</p>
                  <p className="text-base font-semibold text-gray-800">{summary.reportCount || 0}</p>
                </div>
              </div>

              {/* Charts Section - Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Collections by Channel - Bar Chart */}
                <div className="bg-white rounded-lg border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold text-gray-800">Collections by Channel</h3>
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                  </div>

                  {channelData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      <DollarSign className="w-12 h-12 text-gray-300 mb-2" />
                      <p className="text-sm">No collection data available</p>
                    </div>
                  ) : (
                    <CollectionsByChannel
                      channels={pieChartData.map(({ name, value }) => ({ name, value }))}
                      totalAmount={totalChannelAmount}
                    />
                  )}
                </div>

                {/* Collections Trend - Line Chart */}
                <div className="bg-white rounded-lg border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold text-gray-800">Collections Trend</h3>
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                  </div>

                  {collectionsTrend.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
                      <p className="text-sm">No trend data available</p>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={collectionsTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: "12px" }} />
                          <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} tickFormatter={(value) => formatAmount(value)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Line type="monotone" dataKey="collections" stroke="#10B981" strokeWidth={2} name="Collections" dot={{ fill: "#10B981", r: 4 }} />
                          <Line type="monotone" dataKey="payouts" stroke="#EF4444" strokeWidth={2} name="Payouts (incl. Advances)" dot={{ fill: "#EF4444", r: 4 }} />
                          <Line type="monotone" dataKey="staffAdvances" stroke="#8B5CF6" strokeWidth={2} name="Staff Advances" dot={{ fill: "#8B5CF6", r: 4 }} />
                          <Line type="monotone" dataKey="lateTransactions" stroke="#F59E0B" strokeWidth={2} name="Late Transactions" dot={{ fill: "#F59E0B", r: 4 }} />
                          <Line type="monotone" dataKey="netFlow" stroke="#3B82F6" strokeWidth={2} name="Net Flow" dot={{ fill: "#3B82F6", r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Charts Section - Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Cash Flow Overview - Area Chart */}
                <div className="bg-white rounded-lg border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold text-gray-800">Cash Flow Overview</h3>
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                  </div>

                  {cashFlowData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
                      <p className="text-sm">No cash flow data available</p>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlowData}>
                          <defs>
                            <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorPayouts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="_id" stroke="#6b7280" style={{ fontSize: "12px" }} />
                          <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} tickFormatter={(value) => formatAmount(value)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Area type="monotone" dataKey="totalCollected" stroke="#10B981" fillOpacity={1} fill="url(#colorCollections)" name="Collections" />
                          <Area type="monotone" dataKey="totalPaidOut" stroke="#EF4444" fillOpacity={1} fill="url(#colorPayouts)" name="Payouts (incl. Advances)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Shifts Performance - Enhanced Bar Chart */}
                <div className="bg-white rounded-lg border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold text-gray-800">Shifts Performance</h3>
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                  </div>

                  {shiftsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
                      <p className="text-sm">No shifts data available</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={shiftsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: "12px" }} />
                            <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} tickFormatter={(value) => formatAmount(value)} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Bar dataKey="totalCollections" fill="#10B981" name="Collections" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="totalAdvances" fill="#8B5CF6" name="Staff Advances" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="totalPayouts" fill="#EF4444" name="Supplier Payouts (excl. Advances)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Shift Metrics Summary */}
                      {shiftsData.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-2 gap-3">
                            {shiftsData.map((shift, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-gray-700">{shift.name} Shift</p>
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                    {shift.count} Reports
                                  </span>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Collections:</span>
                                    <span className="font-semibold text-green-600">{formatAmount(shift.totalCollections || 0)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Avg/Report:</span>
                                    <span className="font-medium text-gray-700">{formatAmount(shift.avgCollections || 0)}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                                    <span className="text-gray-500">Advances:</span>
                                    <span className="font-medium text-purple-600">{formatAmount(shift.totalAdvances || 0)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Payouts (excl. Advances):</span>
                                    <span className="font-medium text-red-600">{formatAmount(shift.totalPayouts || 0)}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                                    <span className="text-gray-500">Net Flow:</span>
                                    <span className={`font-semibold ${
                                      (shift.totalCollections - shift.totalAdvances - shift.totalPayouts) >= 0 
                                        ? "text-green-600" 
                                        : "text-red-600"
                                    }`}>
                                      {formatAmount((shift.totalCollections || 0) - (shift.totalAdvances || 0) - (shift.totalPayouts || 0))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Recent Reports */}
              <div className="mt-6 bg-white rounded-lg border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-800">Recent Reports</h3>
                  <button
                    type="button"
                    onClick={() => history.push("/daily-reports-collection")}
                    className="text-sm text-[var(--p-blue)] hover:underline font-medium"
                  >
                    View All
                  </button>
                </div>

                {recentReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                    <Calendar className="w-12 h-12 text-gray-300 mb-2" />
                    <p className="text-sm">No reports yet</p>
                    {canCreate && (
                      <button
                        onClick={() =>
                          history.push("/daily-reports/create", {
                            returnTo: "/daily-reports/dashboard",
                          })
                        }
                        className="mt-3 text-sm text-[var(--p-blue)] hover:underline font-medium"
                      >
                        Create your first report
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentReports.slice(0, 5).map((report) => (
                      <div
                        key={report._id}
                        className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-100">
                            <Calendar className="w-5 h-5 text-[var(--p-blue)]" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-800">
                              {formatDate(report.businessDate)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {report.shiftSnapshot?.name || report.shiftId?.name
                                ? `${report.shiftSnapshot?.name || report.shiftId?.name} Shift`
                                : report.shiftNo === 1
                                  ? "Morning Shift"
                                  : report.shiftNo === 2
                                    ? "Evening Shift"
                                    : report.shiftNo != null
                                      ? `Shift ${report.shiftNo}`
                                      : "Shift"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(report.status)}`}>
                            {report.status}
                          </span>
                          <div className="flex items-center gap-1">
                            {canOpenReport && (
                              <button
                                onClick={() =>
                                  history.push(`/daily-reports/view/${report._id}`, {
                                    returnTo: "/daily-reports/dashboard",
                                  })
                                }
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {canUpdate && report.status === "DRAFT" && (
                              <button
                                onClick={() =>
                                  history.push(`/daily-reports/edit/${report._id}`, {
                                    returnTo: "/daily-reports/dashboard",
                                  })
                                }
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
        </>
      )}
    </Page>
  );
}
