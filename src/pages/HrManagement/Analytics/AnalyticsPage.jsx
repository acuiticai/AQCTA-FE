"use client";
import { useState, useEffect, useMemo, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  RefreshCw,
  Download,
  Filter,
  Clock,
  DollarSign,
  Calendar,
  Users,
  BarChart3,
  PieChartIcon,
  Activity,
} from "lucide-react";
import { CustomDatePicker, PageHeader } from "@/page-layouts/index";
import { HR_PAGE_INNER, HR_PAGE_SHELL } from "../components/hrPageHeaderStyles";
import { DropdownBasic, FormInput } from "@/page-layouts";
import { usePermissions } from "@/utils/permissionUtils";
import { notifyError, notifySuccess } from "@/utils/toast";
import SummaryCards from "@/page-layouts/components/SummaryCards";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";
import _ from "lodash";
import OpenClaims from "./OpenClaims";
import Leaves from "./Leaves";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const COLORS = {
  primary: "#C6E48B",
  secondary: "#C6E48B",
  accent: "#7BC8F6",
  danger: "#F87171",
  warning: "#FDBA74",
  info: "#60A5FA",
  success: "#C6E48B",
  purple: "#A78BFA",
  orange: "#FDBA74",
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
};

const colorMap = [
  "#C6E48B", // soft green
  "#5FD4B0", // soft teal
  "#F87171", // soft red
  "#FBBF24", // soft yellow
  "#A78BFA", // soft purple
  "#FDBA74", // soft orange
  "#60A5FA", // soft blue
  "#6EE7B7", // soft green
  "#C4B5FD", // soft violet
  "#38BDF8", // soft cyan
];

// Enhanced Custom Tooltip
const CustomTooltip = ({ active, payload, label, activeTab, yAxisKey }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    const fieldNameMap = {
      presentDays: "Present Days",
      absentDays: "Absent Days",
      lateDays: "Late Days",
      punctualDays: "Punctual Days",
      workingDays: "Working Days",
      totalHours: "Total Hours",
      attendanceRate: "Regular Rate",
      punctualityRate: "Punctuality Rate",
      totalAmount: "Total Amount (USD)",
      averageWorkingDays: "Avg Working Days",
      avgPresentDays: "Avg Present Days",
      avgAbsentDays: "Avg Absent Days",
      avgLateDays: "Avg Late Days",
      avgPunctualDays: "Avg Punctual Days",
      staffCount: "Staff Count",
    };

    const allowedDeptFields = [
      "staffCount",
      "workingDays",
      "avgPresentDays",
      "avgAbsentDays",
      "avgLateDays",
      "avgPunctualDays",
      "attendanceRate",
      "punctualityRate",
    ];

    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 text-sm max-w-xs">
        <div className="font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
          {label}
        </div>
        <div className="space-y-2">
          {Object.keys(data).map((key) => {
            const value = data[key];
            if (typeof value === "object" || key === "fill" || key === "name")
              return null;
            if (key === "totalDays") return null;
            if (key === "totalAmount" && activeTab !== "claims") return null;

            if (
              [
                "averageHoursPerDay",
                "type",
                "staffCount",
                "count",
                "id",
              ].includes(key)
            )
              return null;

            if (
              activeTab === "attendance" &&
              yAxisKey === "department" &&
              !allowedDeptFields.includes(key)
            )
              return null;

            const displayName = fieldNameMap[key] || _.capitalize(key);
            let displayValue = value;

            if (typeof value === "number") {
              if (key === "staffCount") {
                displayValue = value;
              } else {
                displayValue = value.toFixed(2);
              }
            }

            return (
              <div key={key} className="flex justify-between items-center">
                <span className="text-gray-600 text-xs">{displayName}:</span>
                <span className="font-medium text-gray-900 text-xs">
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

// Enhanced Pie Chart Tooltip
const PieTooltip = ({ active, payload, selectedMetric, activeTab }) => {
  if (active && payload && payload.length) {
    const data = payload[0];

    const fieldNameMap = {
      presentDays: "Present Days",
      absentDays: "Absent Days",
      lateDays: "Late Days",
      punctualDays: "Punctual Days",
      workingDays: "Working Days",
      totalHours: "Total Hours",
      attendanceRate: "Regular Rate",
      punctualityRate: "Punctuality Rate",
      totalAmount: "Total Amount (USD)",
      averageWorkingDays: "Avg Working Days",
      avgPresentDays: "Avg Present Days",
      avgAbsentDays: "Avg Absent Days",
      avgLateDays: "Avg Late Days",
      avgPunctualDays: "Avg Punctual Days",
      staffCount: "Staff Count",
    };

    if (selectedMetric === "totalDays") return null;
    if (selectedMetric === "totalAmount" && activeTab !== "claims") return null;

    const displayMetric =
      fieldNameMap[selectedMetric] || _.capitalize(selectedMetric);
    let displayValue = data.value;

    if (typeof displayValue === "number") {
      displayValue = displayValue.toFixed(2);
    }

    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 text-sm">
        <div className="font-semibold text-gray-900 mb-2">{data.name}</div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">{displayMetric}:</span>
          <span className="font-medium text-gray-900 ml-2">{displayValue}</span>
        </div>
      </div>
    );
  }
  return null;
};

const AnalyticsPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { hasPermission } = usePermissions();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const [claimsStats, setClaimsStats] = useState(null);
  const [leavesStats, setLeavesStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    department: "",
    type: "",
  });
  const [employees, setEmployees] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();
  const [activeTab, setActiveTab] = useState("attendance");
  const [departments, setDepartments] = useState([]);
  const [dateError, setDateError] = useState("");
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [attendanceOverview, setAttendanceOverview] = useState(null);
  const [attendanceDay, setAttendanceDay] = useState("yesterday");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  // Chart configuration states
  const [chartType, setChartType] = useState("bar");
  const [yAxisKey, setYAxisKey] = useState("department");
  const [xAxisKey, setXAxisKey] = useState("status");
  const [selectedMetrics, setSelectedMetrics] = useState(["count"]);
  const [pieMetric, setPieMetric] = useState("count");
  const [maxDataPoints, setMaxDataPoints] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Loading states
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  // Set default yAxisKey for attendance
  useEffect(() => {
    if (isSingleBusiness && singleBusinessId && !selectedBusiness) {
      setSelectedBusiness(singleBusinessId);
    }
  }, [isSingleBusiness, singleBusinessId, selectedBusiness]);

  useEffect(() => {
    if (activeTab === "attendance" && !yAxisKey) {
      setYAxisKey("staff");
    }
  }, [activeTab]);

  // Set default xAxisKey for attendance
  useEffect(() => {
    if (activeTab === "attendance" && xAxisKey === "status") {
      setXAxisKey("count");
    }
  }, [activeTab, xAxisKey]);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setClaimsLoading(true);
    setLeavesLoading(true);
    setAttendanceLoading(true);
    const params = { ...filters };
    if (selectedBusiness) params.business = selectedBusiness;

    // Claims
    axios
      .get(`${Base_URL}/claims/stats`, {
        params,
        headers: {
          Authorization: `Bearer ${
            JSON.parse(localStorage.getItem("adminInfo")).token
          }`,
        },
      })
      .then((res) => setClaimsStats(res.data?.data || res.data))
      .catch(() => notifyError("Failed to load claims"))
      .finally(() => setClaimsLoading(false));

    // Leaves
    axios
      .get(`${Base_URL}/leaves/stats`, {
        params,
        headers: {
          Authorization: `Bearer ${
            JSON.parse(localStorage.getItem("adminInfo")).token
          }`,
        },
      })
      .then((res) => setLeavesStats(res.data?.data || res.data))
      .catch(() => notifyError("Failed to load leaves"))
      .finally(() => setLeavesLoading(false));

    // Attendance
    axios
      .get(`${Base_URL}/attendance/analytics`, {
        params,
        headers: {
          Authorization: `Bearer ${
            JSON.parse(localStorage.getItem("adminInfo")).token
          }`,
        },
      })
      .then((res) => setAttendanceStats(res.data?.data || res.data))
      .catch(() => notifyError("Failed to load attendance"))
      .finally(() => setAttendanceLoading(false));
  };

  // Fetch employees for filters
  const fetchEmployees = async () => {
    try {
      const params = {};
      if (selectedBusiness) {
        params.business = selectedBusiness;
      }
      const empResponse = await axios.get(`${Base_URL}/employees`, { params });
      setEmployees(empResponse.data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Fetch departments for name mapping
  const fetchDepartments = async () => {
    try {
      const params = {};
      if (selectedBusiness) {
        params.business = selectedBusiness;
      }
      const deptResponse = await axios.get(`${Base_URL}/Departments/get`, {
        params,
        headers: {
          Authorization: `Bearer ${
            JSON.parse(localStorage.getItem("adminInfo")).token
          }`,
        },
      });
      setDepartments(deptResponse.data?.data || deptResponse.data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value };
      if (updated.startDate && !updated.endDate) {
        setDateError("Please provide the end date");
      } else if (updated.startDate && updated.endDate) {
        if (new Date(updated.endDate) < new Date(updated.startDate)) {
          setDateError("End date cannot be before start date");
        } else {
          setDateError("");
        }
      } else {
        setDateError("");
      }
      return updated;
    });
  };

  const handleBusinessChange = (businessId) => {
    setSelectedBusiness(businessId);
    setFilters({ startDate: "", endDate: "", department: "", type: "" });
  };

  const applyFilters = () => {
    fetchAnalytics();
  };

  const resetFilters = () => {
    setFilters({ startDate: "", endDate: "", department: "", type: "" });
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    notifySuccess("Data refreshed successfully");
  };

  const exportData = async (type) => {
    try {
      const params = { ...filters };
      if (selectedBusiness) {
        params.business = selectedBusiness;
      }
      const response = await axios.get(`${Base_URL}/${type}/export`, {
        params,
        responseType: "blob",
        headers: {
          Authorization: `Bearer ${
            JSON.parse(localStorage.getItem("adminInfo")).token
          }`,
        },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${type}_analytics_${format(new Date(), "yyyy-MM-dd")}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      notifySuccess(`${type} data exported successfully`);
    } catch (error) {
      console.error("Error exporting data:", error);
      notifyError("Failed to export data");
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchEmployees();
    fetchDepartments();
  }, [selectedBusiness]);

  // Auto-correct invalid chart combinations
  useEffect(() => {
    if (xAxisKey === "status" && yAxisKey === "monthly") {
      setXAxisKey("count");
    }

    if (
      yAxisKey === "monthly" &&
      selectedMetrics.some((metric) =>
        ["approved", "pending", "rejected"].includes(metric)
      )
    ) {
      const validMetrics = selectedMetrics.filter(
        (metric) => !["approved", "pending", "rejected"].includes(metric)
      );
      if (validMetrics.length === 0) {
        setSelectedMetrics(["count"]);
      } else {
        setSelectedMetrics(validMetrics);
      }
    }

    if (
      yAxisKey === "monthly" &&
      ["approved", "pending", "rejected"].includes(pieMetric)
    ) {
      setPieMetric("count");
    }
  }, [yAxisKey, xAxisKey, selectedMetrics, pieMetric]);

  // Helper function to get department name by ID
  const getDepartmentName = (departmentId) => {
    if (!departmentId) return "Unknown Department";
    if (!departments.length) return `Department ${departmentId}`;
    const dept = departments.find((d) => d._id === departmentId);
    return dept ? dept.name : `Department ${departmentId}`;
  };

  // Summary logic
  const summary = useMemo(() => {
    let currentData;
    if (activeTab === "claims") currentData = claimsStats;
    else if (activeTab === "leaves") currentData = leavesStats;
    else if (activeTab === "attendance") currentData = attendanceStats;

    if (!currentData) return {};

    if (activeTab === "attendance") {
      const s = currentData.summary || {};
      return {
        totalStaff: s.totalStaff || 0,
        totalWorkingDays: s.totalWorkingDays || 0,
        totalPresentDays: s.totalPresentDays || 0,
        totalAbsentDays: s.totalAbsentDays || 0,
        totalLateDays: s.totalLateDays || 0,
        totalPunctualDays: s.totalPunctualDays || 0,
        totalHours: s.totalHours || "0:00",
        averageAttendanceRate: s.averageAttendanceRate || "0%",
        averagePunctualityRate: s.averagePunctualityRate || "0%",
      };
    }

    const basicStats =
      currentData.basicStats || currentData.attendanceStats || {};
    return {
      total: basicStats.total || 0,
      approved: basicStats.approved || 0,
      pending: basicStats.pending || 0,
      rejected: basicStats.rejected || 0,
      totalAmount:
        activeTab === "claims"
          ? basicStats.totalAmountUSD?.toFixed(2) ||
            basicStats.totalAmount?.toFixed(2) ||
            0
          : undefined,
      totalDays: activeTab === "leaves" ? basicStats.totalDays || 0 : undefined,
    };
  }, [claimsStats, leavesStats, attendanceStats, activeTab]);

  // Attendance metrics
  const attendanceMetrics = [
    { label: "Present Days", value: "presentDays" },
    { label: "Absent Days", value: "absentDays" },
    { label: "Late Days", value: "lateDays" },
    { label: "Punctual Days", value: "punctualDays" },
    { label: "Working Days", value: "workingDays" },
    { label: "Total Hours", value: "totalHours" },
    { label: "Attendance Rate", value: "attendanceRate" },
    { label: "Punctuality Rate", value: "punctualityRate" },
    { label: "Staff Count", value: "staffCount" },
    { label: "Avg Working Days", value: "averageWorkingDays" },
    { label: "Avg Present Days", value: "avgPresentDays" },
    { label: "Avg Absent Days", value: "avgAbsentDays" },
    { label: "Avg Late Days", value: "avgLateDays" },
    { label: "Avg Punctual Days", value: "avgPunctualDays" },
  ];

  // Reset chart config on tab switch
  useEffect(() => {
    if (activeTab === "attendance") {
      setYAxisKey("staff");
      setXAxisKey("count");
      setSelectedMetrics(["presentDays"]);
      setPieMetric("presentDays");
    } else if (activeTab === "claims") {
      setYAxisKey("department");
      setXAxisKey("status");
      setSelectedMetrics(["count"]);
      setPieMetric("count");
    } else if (activeTab === "leaves") {
      setYAxisKey("department");
      setXAxisKey("status");
      setSelectedMetrics(["count"]);
      setPieMetric("count");
    }
    setCurrentPage(1);
  }, [activeTab]);

  // Department attendance metrics
  const departmentAttendanceMetrics = [
    { label: "Avg Present Days", value: "avgPresentDays" },
    { label: "Avg Absent Days", value: "avgAbsentDays" },
    { label: "Avg Late Days", value: "avgLateDays" },
    { label: "Avg Punctual Days", value: "avgPunctualDays" },
    { label: "Avg Working Days", value: "workingDays" },
    { label: "Attendance Rate (%)", value: "attendanceRate" },
    { label: "Punctuality Rate (%)", value: "punctualityRate" },
    { label: "Staff Count", value: "staffCount" },
  ];

  // Staff attendance metrics
  const staffAttendanceMetrics = [
    { label: "Present Days", value: "presentDays" },
    { label: "Absent Days", value: "absentDays" },
    { label: "Late Days", value: "lateDays" },
    { label: "Punctual Days", value: "punctualDays" },
    { label: "Working Days", value: "workingDays" },
    { label: "Attendance Rate (%)", value: "attendanceRate" },
    { label: "Punctuality Rate (%)", value: "punctualityRate" },
  ];

  // Processed attendance data
  const processedAttendanceData = useMemo(() => {
    if (activeTab !== "attendance" || !attendanceStats) return [];

    if (yAxisKey === "department") {
      return (attendanceStats.groupByDepartment || []).map((item) => {
        const staffCount = item.staffCount || 0;
        return {
          name: item.department || "Unknown",
          avgPresentDays: staffCount ? item.presentDays / staffCount : 0,
          avgAbsentDays: staffCount ? item.absentDays / staffCount : 0,
          avgLateDays: staffCount ? item.lateDays / staffCount : 0,
          avgPunctualDays: staffCount ? item.punctualDays / staffCount : 0,
          workingDays: staffCount ? item.workingDays : 0,
          attendanceRate: item.attendanceRate
            ? Number(item.attendanceRate.replace("%", ""))
            : 0,
          punctualityRate: item.punctualityRate
            ? Number(item.punctualityRate.replace("%", ""))
            : 0,
          staffCount: staffCount,
        };
      });
    } else if (yAxisKey === "staff") {
      return (attendanceStats.groupByStaff || []).map((item) => ({
        name: item.name || "Unknown",
        presentDays: item.presentDays || 0,
        absentDays: item.absentDays || 0,
        lateDays: item.lateDays || 0,
        punctualDays: item.punctualDays || 0,
        workingDays: item.workingDays || 0,
        attendanceRate: item.attendanceRate
          ? Number(item.attendanceRate.replace("%", ""))
          : 0,
        punctualityRate: item.punctualityRate
          ? Number(item.punctualityRate.replace("%", ""))
          : 0,
        totalHours: item.totalHours || "0:00",
      }));
    }
    return [];
  }, [attendanceStats, activeTab, yAxisKey]);

  // Attendance available metrics
  const attendanceAvailableMetrics = useMemo(() => {
    if (yAxisKey === "department") return departmentAttendanceMetrics;
    if (yAxisKey === "staff") return staffAttendanceMetrics;
    return [];
  }, [yAxisKey]);

  // Paginated attendance data
  const paginatedAttendanceData = useMemo(() => {
    if (maxDataPoints === "all") return processedAttendanceData;
    const startIndex = (currentPage - 1) * maxDataPoints;
    const endIndex = startIndex + maxDataPoints;
    return processedAttendanceData.slice(startIndex, endIndex);
  }, [processedAttendanceData, currentPage, maxDataPoints]);

  const attendanceTotalPages = useMemo(() => {
    if (maxDataPoints === "all") return 1;
    return Math.ceil(processedAttendanceData.length / maxDataPoints);
  }, [processedAttendanceData.length, maxDataPoints]);

  // Check if attendance has no data
  const isAttendanceNoData = useMemo(() => {
    if (activeTab !== "attendance" || processedAttendanceData.length === 0)
      return false;

    if (chartType === "pie") {
      return processedAttendanceData.every(
        (item) => Number(item[pieMetric]) === 0
      );
    } else if (chartType === "line") {
      return selectedMetrics.every((metric) =>
        processedAttendanceData.every((item) => Number(item[metric]) === 0)
      );
    } else if (chartType === "bar") {
      return selectedMetrics.every((metric) =>
        processedAttendanceData.every((item) => Number(item[metric]) === 0)
      );
    }
    return false;
  }, [
    activeTab,
    processedAttendanceData,
    chartType,
    selectedMetrics,
    pieMetric,
  ]);

  // Process data for claims/leaves
  const processedData = useMemo(() => {
    let currentData;
    if (activeTab === "claims") currentData = claimsStats;
    else if (activeTab === "leaves") currentData = leavesStats;
    if (!currentData) return [];

    let data = [];
    if (yAxisKey === "department") {
      const deptData =
        currentData.claimsByDepartment ||
        currentData.leavesByDepartment ||
        currentData.byDepartment ||
        [];
      data = deptData.map((item) => {
        const departmentName = getDepartmentName(item._id);
        return {
          name: departmentName,
          count: item.count || 0,
          approved: item.approved || 0,
          pending: item.pending || 0,
          rejected: item.rejected || 0,
          totalAmount:
            activeTab === "claims"
              ? item.totalAmountUSD?.toFixed(2) ||
                item.totalAmount?.toFixed(2) ||
                0
              : undefined,
          totalDays: activeTab === "leaves" ? item.totalDays || 0 : undefined,
        };
      });
    } else if (yAxisKey === "employee") {
      const empData =
        currentData.claimsByEmployee ||
        currentData.leavesByEmployee ||
        currentData.byEmployee ||
        [];
      data = empData.map((item) => {
        const employeeName = item._id?.employeeName || "Unknown";
        const departmentName = item._id?.department
          ? getDepartmentName(item._id.department)
          : "";
        return {
          name: employeeName,
          department: departmentName,
          count: item.count || 0,
          approved: item.approved || 0,
          pending: item.pending || 0,
          rejected: item.rejected || 0,
          totalAmount:
            activeTab === "claims"
              ? item.totalAmountUSD?.toFixed(2) ||
                item.totalAmount?.toFixed(2) ||
                0
              : undefined,
          totalDays: activeTab === "leaves" ? item.totalDays || 0 : undefined,
        };
      });
    } else if (yAxisKey === "type") {
      const typeData =
        currentData.claimsByType || currentData.leavesByType || [];
      data = typeData.map((item) => {
        let typeName = "Unknown";
        if (activeTab === "claims") {
          typeName = `${item._id?.claimTypeName || "Unknown"}`;
        } else {
          typeName = item._id?.leaveTypeName || "Unknown";
        }
        return {
          name: typeName,
          count: item.count || 0,
          approved: item.approved || 0,
          pending: item.pending || 0,
          rejected: item.rejected || 0,
          totalAmount:
            activeTab === "claims"
              ? item.totalAmountUSD?.toFixed(2) ||
                item.totalAmount?.toFixed(2) ||
                0
              : undefined,
          totalDays: activeTab === "leaves" ? item.totalDays || 0 : undefined,
        };
      });
    } else if (yAxisKey === "trend") {
      const trendData =
        currentData.claimsTrend || currentData.leavesTrend || [];
      data = trendData.map((item) => {
        return {
          name: item.period || "Unknown",
          count: item.count || 0,
          approved: item.approved || 0,
          pending: item.pending || 0,
          rejected: item.rejected || 0,
          totalAmount:
            activeTab === "claims"
              ? item.totalAmountUSD?.toFixed(2) ||
                item.totalAmount?.toFixed(2) ||
                0
              : undefined,
          totalDays: activeTab === "leaves" ? item.totalDays || 0 : undefined,
        };
      });
    } else if (yAxisKey === "monthly") {
      const monthlyData = currentData.monthlyDistribution || [];
      data = monthlyData.map((item) => {
        return {
          name: item.monthName || `Month ${item.month}`,
          count: item.count || 0,
          approved: item.approved || 0,
          pending: item.pending || 0,
          rejected: item.rejected || 0,
          totalAmount:
            activeTab === "claims"
              ? item.totalAmountUSD?.toFixed(2) ||
                item.totalAmount?.toFixed(2) ||
                0
              : undefined,
          totalDays: activeTab === "leaves" ? item.totalDays || 0 : undefined,
        };
      });
    }

    return data.sort((a, b) => a.name.localeCompare(b.name));
  }, [claimsStats, leavesStats, activeTab, yAxisKey]);

  const paginatedData = useMemo(() => {
    if (maxDataPoints === "all") return processedData;
    const startIndex = (currentPage - 1) * maxDataPoints;
    const endIndex = startIndex + maxDataPoints;
    return processedData.slice(startIndex, endIndex);
  }, [processedData, currentPage, maxDataPoints]);

  const totalPages = useMemo(() => {
    if (maxDataPoints === "all") return 1;
    return Math.ceil(processedData.length / maxDataPoints);
  }, [processedData.length, maxDataPoints]);

  // Format attendance tooltip
  const formatAttendanceTooltip = (key, value, yAxisKey) => {
    if (yAxisKey === "department") {
      if (["attendanceRate", "punctualityRate"].includes(key)) {
        return value.toFixed(2) + "%";
      }
      if (key.startsWith("avg")) {
        return value.toFixed(2);
      }
      if (key === "staffCount") {
        return value;
      }
    } else if (yAxisKey === "staff") {
      if (["attendanceRate", "punctualityRate"].includes(key)) {
        return value.toFixed(2) + "%";
      }
      if (
        [
          "presentDays",
          "absentDays",
          "lateDays",
          "punctualDays",
          "workingDays",
        ].includes(key)
      ) {
        return value;
      }
      if (key === "totalHours") {
        return value;
      }
    }
    return value;
  };

  // Custom Tooltip for attendance
  const AttendanceTooltip = ({ active, payload, label, yAxisKey }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 text-sm max-w-xs">
          <div className="font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
            {label}
          </div>
          <div className="space-y-2">
            {Object.keys(data).map((key) => {
              if (key === "name") return null;
              const value = data[key];
              return (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs">{key}:</span>
                  <span className="font-medium text-gray-900 text-xs">
                    {formatAttendanceTooltip(key, value, yAxisKey)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Pie Tooltip for attendance
  const AttendancePieTooltip = ({
    active,
    payload,
    selectedMetric,
    yAxisKey,
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 text-sm">
          <div className="font-semibold text-gray-900 mb-2">{data.name}</div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">{selectedMetric}:</span>
            <span className="font-medium text-gray-900 ml-2">
              {formatAttendanceTooltip(selectedMetric, data.value, yAxisKey)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Render attendance chart
  const renderAttendanceChart = () => {
    const baseHeight = Math.min(
      Math.max(paginatedAttendanceData.length * 25 + 100, 300),
      500
    );

    if (isAttendanceNoData) {
      return (
        <div className="flex flex-col justify-center items-center h-96 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg font-medium px-2 w-full">
            {t("hrAnalytics.noDataAvailable")}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {t("hrAnalytics.tryAdjustingFilters")}
          </p>
        </div>
      );
    }

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={baseHeight}>
          <BarChart
            layout="vertical"
            data={paginatedAttendanceData}
            margin={{ top: 20, right: 80, left: 0, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: COLORS.gray[600] }}
              axisLine={{ stroke: COLORS.gray[200] }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 12, fill: COLORS.gray[700] }}
              width={120}
              tickFormatter={(value) =>
                value && value.length > 12
                  ? value.substring(0, 12) + "..."
                  : value
              }
              allowDecimals={false}
            />
            <Tooltip content={<AttendanceTooltip yAxisKey={yAxisKey} />} />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "12px",
                paddingBottom: "10px",
              }}
              verticalAlign="bottom"
            />
            {attendanceAvailableMetrics
              .filter((m) => selectedMetrics.includes(m.value))
              .map((metric, idx) => (
                <Bar
                  key={metric.value}
                  dataKey={metric.value}
                  fill={colorMap[idx % colorMap.length]}
                  name={metric.label}
                  radius={[4, 4, 0, 0]}
                />
              ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={Math.min(baseHeight, 400)}>
          <AreaChart
            data={paginatedAttendanceData}
            margin={{ top: 15, right: 20, left: 15, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: COLORS.gray[600] }}
              axisLine={{ stroke: COLORS.gray[200] }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 12, fill: COLORS.gray[600] }}
              axisLine={{ stroke: COLORS.gray[200] }}
              tickLine={false}
            />
            <Tooltip content={<AttendanceTooltip yAxisKey={yAxisKey} />} />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "12px",
                paddingBottom: "10px",
              }}
            />
            <defs>
              {attendanceAvailableMetrics
                .filter((m) => selectedMetrics.includes(m.value))
                .map((metric, idx) => (
                  <linearGradient
                    key={`gradient-attendance-${metric.value}`}
                    id={`attendanceAreaGradient-${metric.value}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={colorMap[idx % colorMap.length]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={colorMap[idx % colorMap.length]}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                ))}
            </defs>
            {attendanceAvailableMetrics
              .filter((m) => selectedMetrics.includes(m.value))
              .map((metric, idx) => (
                <Area
                  key={metric.value}
                  type="monotone"
                  dataKey={metric.value}
                  stroke={colorMap[idx % colorMap.length]}
                  fill={`url(#attendanceAreaGradient-${metric.value})`}
                  fillOpacity={1}
                  dot={{ r: 4, fill: colorMap[idx % colorMap.length] }}
                  activeDot={{ r: 6, fill: colorMap[idx % colorMap.length] }}
                  name={metric.label}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "pie") {
      const pieData = paginatedAttendanceData
        .filter((item) => Number(item[pieMetric]) > 0)
        .map((item, idx) => ({
          name: item.name,
          value: Number(item[pieMetric]),
          fill: colorMap[idx % colorMap.length],
        }));

      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="4"
                  stdDeviation="6"
                  floodColor="#000"
                  floodOpacity="0.15"
                />
              </filter>
              {pieData.map((entry, idx) => (
                <linearGradient
                  id={`pieGrad${idx}`}
                  key={idx}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.9} />
                  <stop
                    offset="100%"
                    stopColor={entry.fill}
                    stopOpacity={0.7}
                  />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={130}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              labelLine={false}
              label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                const RADIAN = Math.PI / 180;
                const radius = outerRadius + 24;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                const label = `${name} (${(percent * 100).toFixed(1)}%)`;
                // Wrapping logic as before
                if (label.length > 12) {
                  const splitIndex = label.indexOf(" ", 10);
                  if (splitIndex > 0) {
                    const first = label.slice(0, splitIndex);
                    const second = label.slice(splitIndex + 1);
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor={x > cx ? "start" : "end"}
                        fill="#222"
                        fontSize={14}
                        fontWeight={500}
                        stroke="#fff"
                        strokeWidth={3}
                        paintOrder="stroke"
                      >
                        <tspan x={x} dy="0">
                          {first}
                        </tspan>
                        <tspan x={x} dy="1.2em">
                          {second}
                        </tspan>
                      </text>
                    );
                  }
                }
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={x > cx ? "start" : "end"}
                    fill="#222"
                    fontSize={14}
                    fontWeight={500}
                    stroke="#fff"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                );
              }}
            >
              {pieData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={`url(#pieGrad${idx})`} />
              ))}
            </Pie>
            <Tooltip
              content={
                <AttendancePieTooltip
                  selectedMetric={pieMetric}
                  yAxisKey={yAxisKey}
                />
              }
            />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.3px",
              }}
              iconType="circle"
              align="center"
              verticalAlign="bottom"
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  // Define available metrics based on activeTab
  const availableMetrics = useMemo(() => {
    if (activeTab === "claims") {
      return [
        { label: t("hrAnalytics.count"), value: "count" },
        { label: t("hrAnalytics.approved"), value: "approved" },
        { label: t("hrAnalytics.pending"), value: "pending" },
        { label: t("hrAnalytics.rejected"), value: "rejected" },
        { label: "Total Amount (USD)", value: "totalAmount" },
      ];
    } else if (activeTab === "leaves") {
      return [
        { label: t("hrAnalytics.count"), value: "count" },
        { label: t("hrAnalytics.approved"), value: "approved" },
        { label: t("hrAnalytics.pending"), value: "pending" },
        { label: t("hrAnalytics.rejected"), value: "rejected" },
        { label: "Total Days", value: "totalDays" },
      ];
    } else if (activeTab === "attendance") {
      if (yAxisKey === "department") return departmentAttendanceMetrics;
      if (yAxisKey === "staff") return staffAttendanceMetrics;
      return [];
    }
    return [];
  }, [activeTab, yAxisKey]);

  // Get current data and pagination info based on active tab
  const getCurrentDataInfo = () => {
    if (activeTab === "attendance") {
      return {
        currentData: processedAttendanceData,
        paginatedData: paginatedAttendanceData,
        totalPages: attendanceTotalPages,
      };
    } else {
      return {
        currentData: processedData,
        paginatedData: paginatedData,
        totalPages: totalPages,
      };
    }
  };

  const {
    currentData,
    paginatedData: currentPaginatedData,
    totalPages: currentTotalPages,
  } = getCurrentDataInfo();

  // Render chart
  const renderChart = () => {
    if (activeTab === "attendance") {
      return renderAttendanceChart();
    }

    const baseHeight = Math.min(
      Math.max(paginatedData.length * 25 + 100, 300),
      500
    );

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={baseHeight}>
          <BarChart
            layout="vertical"
            data={paginatedData}
            margin={{ top: 20, right: 80, left: 0, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: COLORS.gray[600] }}
              axisLine={{ stroke: COLORS.gray[200] }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 12, fill: COLORS.gray[700] }}
              width={120}
              tickFormatter={(value) => {
                if (value && value.length > 12) {
                  return value.substring(0, 12) + "...";
                }
                return value;
              }}
              allowDecimals={false}
            />
            <Tooltip
              content={
                <CustomTooltip activeTab={activeTab} yAxisKey={yAxisKey} />
              }
            />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "12px",
                paddingBottom: "10px",
              }}
              verticalAlign="bottom"
            />
            {xAxisKey === "status" && activeTab !== "attendance" && (
              <>
                <Bar
                  dataKey="approved"
                  stackId="a"
                  fill={COLORS.success}
                  name={t("hrAnalytics.approved")}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  stackId="a"
                  fill={COLORS.warning}
                  name={t("hrAnalytics.pending")}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="rejected"
                  stackId="a"
                  fill={COLORS.danger}
                  name={t("hrAnalytics.rejected")}
                  radius={[4, 4, 0, 0]}
                />
              </>
            )}
            {xAxisKey === "count" && (
              <Bar
                dataKey="count"
                fill={COLORS.primary}
                name={t("hrAnalytics.count")}
                radius={[4, 4, 0, 0]}
              />
            )}
            {xAxisKey === "amount" && (
              <Bar
                radius={[4, 4, 0, 0]}
                dataKey={
                  activeTab === "claims"
                    ? "totalAmount"
                    : activeTab === "leaves"
                    ? "totalDays"
                    : null
                }
                fill={COLORS.secondary}
                name={
                  activeTab === "claims"
                    ? "Total Amount (USD)"
                    : activeTab === "leaves"
                    ? "Total Days"
                    : "Total Hours"
                }
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={Math.min(baseHeight, 400)}>
          <AreaChart
            data={paginatedData}
            margin={{ top: 15, right: 20, left: 15, bottom: 60 }}
          >
            <defs>
              {selectedMetrics.map((metric, index) => (
                <linearGradient
                  key={`gradient-${metric}`}
                  id={`analyticsLineGradient-${metric}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={colorMap[index % colorMap.length]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={colorMap[index % colorMap.length]}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: COLORS.gray[600] }}
              axisLine={{ stroke: COLORS.gray[200] }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
              allowDecimals={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: COLORS.gray[600] }}
              axisLine={{ stroke: COLORS.gray[200] }}
              tickLine={false}
            />
            <Tooltip
              content={
                <CustomTooltip activeTab={activeTab} yAxisKey={yAxisKey} />
              }
            />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "12px",
                paddingBottom: "10px",
              }}
            />
            {selectedMetrics.map((metric, index) => (
              <Area
                key={`area-${metric}`}
                type="monotone"
                dataKey={metric}
                stroke={colorMap[index % colorMap.length]}
                fill={`url(#analyticsLineGradient-${metric})`}
                fillOpacity={1}
                dot={{ r: 4, fill: colorMap[index % colorMap.length] }}
                activeDot={{ r: 6, fill: colorMap[index % colorMap.length] }}
                name={
                  availableMetrics.find((m) => m.value === metric)?.label ||
                  _.capitalize(metric)
                }
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "pie") {
      const pieData = paginatedData
        .filter((item) => Number(item[pieMetric]) > 0)
        .map((item, index) => ({
          name: _.capitalize(item.name),
          value: Number(item[pieMetric]),
          fill: colorMap[index % colorMap.length],
        }));

      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="4"
                  stdDeviation="6"
                  floodColor="#000"
                  floodOpacity="0.15"
                />
              </filter>
              {pieData.map((entry, idx) => (
                <linearGradient
                  id={`pieGrad${idx}`}
                  key={idx}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.9} />
                  <stop
                    offset="100%"
                    stopColor={entry.fill}
                    stopOpacity={0.7}
                  />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={130}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              labelLine={false}
              label={({ name, percent, x, y }) => {
                const label = `${name} (${(percent * 100).toFixed(1)}%)`;
                // If label is longer than 12 chars, split into two lines
                if (label.length > 12) {
                  // Try to split at the first space after 10 chars
                  const splitIndex = label.indexOf(" ", 10);
                  if (splitIndex > 0) {
                    const first = label.slice(0, splitIndex);
                    const second = label.slice(splitIndex + 1);
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        fill="#888"
                        fontSize={14}
                        fontWeight={400}
                      >
                        <tspan x={x} dy="0">
                          {first}
                        </tspan>
                        <tspan x={x} dy="1.2em">
                          {second}
                        </tspan>
                      </text>
                    );
                  }
                }
                // Otherwise, show as single line
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fill="#888"
                    fontSize={14}
                    fontWeight={400}
                  >
                    {label}
                  </text>
                );
              }}
              filter="url(#shadow)"
              isAnimationActive={true}
            >
              {pieData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={`url(#pieGrad${idx})`} />
              ))}
            </Pie>
            <Tooltip
              content={
                <PieTooltip selectedMetric={pieMetric} activeTab={activeTab} />
              }
            />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.3px",
              }}
              iconType="circle"
              align="center"
              verticalAlign="bottom"
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  // Fetch attendance overview when Attendance tab is active or department changes
  useEffect(() => {
    if (activeTab === "attendance") {
      const fetchAttendanceOverview = async () => {
        try {
          const params = {};
          if (selectedBusiness) params.business = selectedBusiness;
          if (selectedDepartment) params.department = selectedDepartment;
          const res = await axios.get(`${Base_URL}/attendance/overview`, {
            params,
            headers: {
              Authorization: `Bearer ${
                JSON.parse(localStorage.getItem("adminInfo")).token
              }`,
            },
          });
          setAttendanceOverview(res.data.data);
        } catch (error) {
          setAttendanceOverview(null);
        }
      };

      fetchAttendanceOverview();
    }
  }, [activeTab, selectedBusiness, selectedDepartment]);

  // Donut chart data from attendanceOverview, based on attendanceDay
  const donutData =
    attendanceDay === "today"
      ? [
          {
            name: t("hrAnalytics.present"),
            value: attendanceOverview?.todaySummary?.present || 0,
            color: "var(--p-blue)",
          },
          {
            name: t("hrAnalytics.absent"),
            value: attendanceOverview?.todaySummary?.absent || 0,
            color: "#fc4a4a",
          },
          {
            name: t("hrAnalytics.leaves"),
            value: attendanceOverview?.todaySummary?.leaves || 0,
            color: "#9197a5",
          },
        ]
      : [
          {
            name: t("hrAnalytics.present"),
            value: attendanceOverview?.yesterdaySummary?.present || 0,
            color: "var(--p-blue)",
          },
          {
            name: t("hrAnalytics.absent"),
            value: attendanceOverview?.yesterdaySummary?.absent || 0,
            color: "#fc4a4a",
          },
          {
            name: t("hrAnalytics.leaves"),
            value: attendanceOverview?.yesterdaySummary?.leaves || 0,
            color: "#9197a5",
          },
        ];

  // Bar chart data from attendanceOverview
  const barData = useMemo(() => {
    if (
      !attendanceOverview?.last7Days ||
      !Array.isArray(attendanceOverview.last7Days)
    )
      return [];

    return attendanceOverview.last7Days.map((entry) => ({
      date: entry.date ? format(parseISO(entry.date), "dd MMM") : "-",
      [t("hrAnalytics.present")]: entry.present || 0,
      [t("hrAnalytics.absent")]: entry.absent || 0,
      [t("hrAnalytics.leaves")]: entry.leaves || 0,
    }));
  }, [attendanceOverview]);

  // Department dropdown options
  const departmentOptions = useMemo(
    () => [
      { value: "", label: "All Departments" },
      ...(departments || []).map((dept) => ({
        value: dept._id,
        label: dept.name,
      })),
    ],
    [departments]
  );

  return (
    <div className={HR_PAGE_SHELL}>
      <div className={HR_PAGE_INNER}>
        <PageHeader
          variant="large"
          title={t("hrAnalytics.title")}
          description={t("hrAnalytics.subtitle")}
          showAddButton={false}
          renderActions={[
            !isSingleBusiness ? (
            <div key="business" className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                {t("hrAnalytics.business")}
              </label>
              <div className="w-56 min-w-[14rem]">
                <DropdownBasic
                  name="business"
                  type="select"
                  isBusinessDropdown={true}
                  isClearable={true}
                  businessDropdownProps={{
                    selectedBusiness: selectedBusiness,
                    onChange: handleBusinessChange,
                    placeholder: t("hrAnalytics.selectBusiness"),
                  }}
                />
              </div>
            </div>
            ) : null,
          ]}
        />

        {/* Action Buttons */}
        {hasPermission("Add") && (
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              className="flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              onClick={refreshData}
              disabled={refreshing}
            >
              <RefreshCw
                className={`w-5 h-5 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? t("hrAnalytics.refreshing") : t("hrAnalytics.refreshData")}
            </button>

            <button
              className="flex items-center px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              onClick={() => exportData("claims")}
            >
              <Download className="w-5 h-5 mr-2" />
              Export Claims
            </button>

            <button
              className="flex items-center px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              onClick={() => exportData("leaves")}
            >
              <Download className="w-5 h-5 mr-2" />
              {t("hrAnalytics.exportLeaves")}
            </button>

            <button
              className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              onClick={() => exportData("attendance")}
            >
              <Download className="w-5 h-5 mr-2" />
              {t("hrAnalytics.exportAttendance")}
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-4 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
          {[
            { key: "attendance", label: t("hrAnalytics.attendanceAnalytics"), icon: Users },
            { key: "claims", label: t("hrAnalytics.claimsAnalytics"), icon: DollarSign },
            { key: "leaves", label: t("hrAnalytics.leaveAnalytics"), icon: Calendar },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === key
                  ? "bg-[var(--p-blue)] text-white shadow-lg"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="w-5 h-5 mr-2" />
              {label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {(activeTab === "claims" && claimsLoading) ||
        (activeTab === "leaves" && leavesLoading) ||
        (activeTab === "attendance" && attendanceLoading) ? (
          <div className="flex flex-col justify-center items-center py-16">
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
            </div>
            <p className="text-gray-600 text-lg font-medium">
              {t("hrAnalytics.loadingAnalyticsData")}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {t("hrAnalytics.pleaseWait")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Attendance Overview Charts */}
            {activeTab === "attendance" && (
              <>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  {/* Donut Chart Card */}
                  <div className="bg-[#eafff3] shadow-md rounded-2xl py-6 px-4 flex-1 max-w-xs flex flex-col items-center">
                    <div className="flex items-center justify-between mb-4 w-full">
                      <h3 className="font-bold text-lg">{t("hrAnalytics.attendance")}</h3>
                      <select
                        value={attendanceDay}
                        onChange={(e) => setAttendanceDay(e.target.value)}
                        className="rounded-xl border-none px-3 pr-0 py-2 text-gray-700 focus:outline-none bg-transparent cursor-pointer"
                        style={{ width: "auto" }}
                      >
                        <option value="yesterday">{t("hrAnalytics.yesterday")}</option>
                        <option value="today">{t("hrAnalytics.today")}</option>
                      </select>
                    </div>
                    <PieChart width={280} height={280}>
                      <Pie
                        data={donutData}
                        cornerRadius={5}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={2}
                        labelLine={false}
                        label={({
                          cx,
                          cy,
                          midAngle,
                          innerRadius,
                          outerRadius,
                          percent,
                          index,
                        }) => {
                          const RADIAN = Math.PI / 180;
                          // Center label in the middle of the donut ring
                          const radius = (innerRadius + outerRadius) / 2;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill="#333"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={14}
                              fontWeight={600}
                            >
                              {percent > 0
                                ? `${(percent * 100).toFixed(0)}%`
                                : ""}
                            </text>
                          );
                        }}
                      >
                        {donutData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                    {/* Custom Legend */}
                    <div className="flex justify-center gap-8 mt-6">
                      {donutData.map((entry, idx) => (
                        <div
                          key={entry.name}
                          className="flex items-center gap-2"
                        >
                          <span
                            className="inline-block w-4 h-4 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-gray-700 text-sm">
                            {entry.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Bar Chart Card */}
                  <div className="bg-white shadow-md rounded-2xl py-6 px-4 flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg">
                        {t("hrAnalytics.last7DaysAttendance")}
                      </h3>
                      <DropdownBasic
                        options={departmentOptions}
                        value={selectedDepartment}
                        onChange={setSelectedDepartment}
                        placeholder={t("hrAnalytics.selectDepartment")}
                        isClearable={true}
                        className=" rounded-xl border border-gray-200"
                      />
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={barData}
                        barSize={22}
                        barCategoryGap="30%"
                        barGap={8}
                      >
                        {/* <CartesianGrid stroke="#f0f0f0" vertical={false} /> */}
                        <XAxis dataKey="date" tick={{ fontSize: 14 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 14 }} />
                        <Tooltip />
                        <Bar
                          dataKey={t("hrAnalytics.present")}
                          fill="var(--p-blue)"
                          radius={[8, 8, 0, 0]}
                          cornerRadius={5}
                        />
                        <Bar
                          dataKey={t("hrAnalytics.absent")}
                          fill="#fc4a4a"
                          radius={[8, 8, 0, 0]}
                          cornerRadius={5}
                        />
                        <Bar
                          dataKey={t("hrAnalytics.leaves")}
                          fill="#9197a5"
                          radius={[8, 8, 0, 0]}
                          cornerRadius={5}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {/* Leaves Component */}
            {activeTab === "leaves" && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 px-6">
                <Leaves filters={filters} company={selectedBusiness} />
              </div>
            )}

            {/* Filters Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Filter className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {t("hrAnalytics.filtersAndDateRange")}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {t("hrAnalytics.startDate")}
                  </label>
                  <CustomDatePicker
                    value={filters.startDate}
                    onChange={(date) => handleFilterChange("startDate", date)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {t("hrAnalytics.endDate")}
                  </label>
                  <CustomDatePicker
                    value={filters.endDate}
                    onChange={(date) => handleFilterChange("endDate", date)}
                    className="w-full"
                    error={
                      dateError && filters.startDate && filters.endDate
                        ? dateError
                        : undefined
                    }
                  />
                  {dateError && filters.startDate && filters.endDate && (
                    <p className="text-red-500 text-xs mt-1">{dateError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {t("hrAnalytics.actions")}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={applyFilters}
                      className="flex-1 bg-[var(--p-blue)] text-white px-4 py-2 rounded-lg flex items-center justify-center font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                      disabled={!!dateError}
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      {t("hrAnalytics.apply")}
                    </button>
                    <button
                      onClick={resetFilters}
                      className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                    >
                      {t("hrAnalytics.reset")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Section */}
            {activeTab !== "attendance" && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Activity className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {t("hrAnalytics.summaryOverview")}
                  </h3>
                </div>

                <SummaryCards
                  cards={[
                    {
                      title: `${t("hrAnalytics.total")} ${
                        activeTab === "claims" ? t("hrAnalytics.claims") : t("hrAnalytics.leaves")
                      }`,
                      value: summary.total || 0,
                      backgroundColor: "summary-light",
                      iconColor: "summary-dark",
                    },
                    {
                      title: t("hrAnalytics.approved"),
                      value: summary.approved || 0,
                      isHighlighted: true,
                      backgroundColor: "completed-light",
                      iconColor: "completed-dark",
                    },
                    {
                      title: t("hrAnalytics.pending"),
                      value: summary.pending || 0,
                      isHighlighted: summary.pending > 0,
                      backgroundColor: "pending-light",
                      iconColor: "pending-dark",
                    },
                    {
                      title: t("hrAnalytics.rejected"),
                      value: summary.rejected || 0,
                      isHighlighted: summary.rejected > 0,
                      backgroundColor: "overdue-light",
                      iconColor: "overdue-dark",
                    },
                    ...(activeTab === "claims"
                      ? [
                          {
                            title: "Total Amount (USD)",
                            value: `$${summary.totalAmount || 0}`,
                            backgroundColor: "processing-light",
                            iconColor: "processing-dark",
                          },
                          {
                            title: "Avg Amount per Claim (USD)",
                            value: `$${
                              claimsStats?.claimAmountStats?.avgAmountUSD?.toFixed(
                                2
                              ) ||
                              claimsStats?.claimAmountStats?.avgAmount?.toFixed(
                                2
                              ) ||
                              0
                            }`,
                            backgroundColor: "planning-light",
                            iconColor: "planning-dark",
                          },
                        ]
                      : []),
                  ]}
                  columnsCount={activeTab === "claims" ? 6 : 4}
                  size="md"
                />
              </div>
            )}

            {/* Additional Analytics for Claims */}
            {activeTab === "claims" && claimsStats?.claimAmountStats && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Claim Amount Analysis
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium mb-1">
                          Average Amount (USD)
                        </p>
                        <p className="text-2xl font-bold text-blue-900">
                          $
                          {claimsStats.claimAmountStats.avgAmountUSD?.toFixed(
                            2
                          ) ||
                            claimsStats.claimAmountStats.avgAmount?.toFixed(
                              2
                            ) ||
                            0}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-200 rounded-lg">
                        <DollarSign className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium mb-1">
                          Small Claims (≤$100 USD)
                        </p>
                        <p className="text-2xl font-bold text-green-900">
                          {claimsStats.claimAmountStats.smallClaims || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-green-200 rounded-lg">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-600 font-medium mb-1">
                          Medium Claims ($101-$500 USD)
                        </p>
                        <p className="text-2xl font-bold text-yellow-900">
                          {claimsStats.claimAmountStats.mediumClaims || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-200 rounded-lg">
                        <DollarSign className="w-6 h-6 text-yellow-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600 font-medium mb-1">
                          Large Claims (&gt;$500 USD)
                        </p>
                        <p className="text-2xl font-bold text-red-900">
                          {claimsStats.claimAmountStats.largeClaims || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-red-200 rounded-lg">
                        <DollarSign className="w-6 h-6 text-red-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Analytics for Leaves */}
            {activeTab === "leaves" && leavesStats?.leaveDurationStats && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Leave Duration Analysis
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium mb-1">
                          Average Duration
                        </p>
                        <p className="text-2xl font-bold text-blue-900">
                          {leavesStats.leaveDurationStats.avgDuration?.toFixed(
                            1
                          ) || 0}{" "}
                          days
                        </p>
                      </div>
                      <div className="p-3 bg-blue-200 rounded-lg">
                        <Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium mb-1">
                          Short Leaves (≤3 days)
                        </p>
                        <p className="text-2xl font-bold text-green-900">
                          {leavesStats.leaveDurationStats.shortLeaves || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-green-200 rounded-lg">
                        <Clock className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-600 font-medium mb-1">
                          Medium Leaves (4-7 days)
                        </p>
                        <p className="text-2xl font-bold text-yellow-900">
                          {leavesStats.leaveDurationStats.mediumLeaves || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-200 rounded-lg">
                        <Calendar className="w-6 h-6 text-yellow-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600 font-medium mb-1">
                          Long Leaves (&gt;7 days)
                        </p>
                        <p className="text-2xl font-bold text-red-900">
                          {leavesStats.leaveDurationStats.longLeaves || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-red-200 rounded-lg">
                        <Calendar className="w-6 h-6 text-red-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Open Claims Component */}
            {activeTab === "claims" && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 px-6">
                <OpenClaims filters={filters} company={selectedBusiness} />
              </div>
            )}

            {/* Chart and Configuration */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
              {/* Left Column - Chart (3/4 width) */}
              <div className="xl:col-span-3 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {activeTab === "claims"
                        ? t("hrAnalytics.claims")
                        : activeTab === "leaves"
                        ? t("hrAnalytics.leaves")
                        : t("hrAnalytics.attendance")}{" "}
                      {t("hrAnalytics.attendanceAnalyticsVisualization")}
                    </h3>
                  </div>
                </div>

                {/* Pagination Controls */}
                {currentData.length > maxDataPoints &&
                  maxDataPoints !== "all" && (
                    <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                      <button
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm bg-white text-gray-700 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Previous
                      </button>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200">
                        <span>
                          Page {currentPage} of {currentTotalPages}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span>{currentData.length} total items</span>
                      </div>
                      <button
                        onClick={() =>
                          setCurrentPage(
                            Math.min(currentTotalPages, currentPage + 1)
                          )
                        }
                        disabled={currentPage === currentTotalPages}
                        className="px-4 py-2 text-sm bg-white text-gray-700 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Next
                      </button>
                    </div>
                  )}

                {/* Chart Display */}
                <div className="w-full">
                  <div className="min-h-[400px] flex items-center justify-center">
                    {currentData.length > 0 ? (
                      renderChart()
                    ) : (
                      <div className="flex flex-col justify-center items-center h-96 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg font-medium px-2 w-full">
                          No data available to display
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                          Try adjusting your filters or date range
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Chart Configuration (1/4 width) */}
              <div className="xl:col-span-2">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Activity className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {t("hrAnalytics.chartConfiguration")}
                    </h3>
                  </div>

                  <div className="space-y-6">
                    {/* Chart Type Selector */}
                    <div className="space-y-2">
                      <FormInput
                        type="select"
                        label={t("hrAnalytics.chartType")}
                        direction="column"
                        options={[
                          { label: t("hrAnalytics.barChart"), value: "bar" },
                          { label: "Line Chart", value: "line" },
                          { label: "Pie Chart", value: "pie" },
                        ]}
                        placeholder="Select"
                        isClearable={false}
                        value={chartType}
                        onChange={(value) => {
                          setChartType(value);
                          setCurrentPage(1);
                        }}
                        width="100%"
                      />
                    </div>

                    {/* Max Data Points Selector */}
                    <div className="space-y-2">
                      <FormInput
                        type="select"
                        label={t("hrAnalytics.itemsPerPage")}
                        direction="column"
                        options={[
                          { label: "2", value: 2 },
                          { label: "25", value: 25 },
                          { label: "50", value: 50 },
                          { label: "100", value: 100 },
                          { label: t("hrAnalytics.all"), value: "all" },
                        ]}
                        placeholder="Select"
                        value={maxDataPoints}
                        onChange={(value) => {
                          setMaxDataPoints(value);
                          setCurrentPage(1);
                        }}
                        isClearable={false}
                        width="100%"
                      />
                    </div>

                    {/* Conditional inputs based on chart type */}
                    {chartType === "bar" && (
                      <>
                        <div className="space-y-2">
                          <FormInput
                            type="select"
                            label={t("hrAnalytics.xAxis")}
                            direction="column"
                            options={[
                              ...(activeTab !== "attendance"
                                ? [
                                    { label: "Status", value: "status" },
                                    { label: t("hrAnalytics.count"), value: "count" },
                                    {
                                      label:
                                        activeTab === "claims"
                                          ? "Ocean Freight/FCL (USD)"
                                          : "Days",
                                      value: "amount",
                                    },
                                  ]
                                : [{ label: "Count", value: "count" }]),
                            ].filter((option) => {
                              if (
                                option.value === "status" &&
                                yAxisKey === "monthly"
                              ) {
                                return false;
                              }
                              return true;
                            })}
                            placeholder="Select"
                            value={xAxisKey}
                            onChange={setXAxisKey}
                            isClearable
                            width="100%"
                          />
                        </div>

                        <div className="space-y-2">
                          <FormInput
                            type="select"
                            label={t("hrAnalytics.yAxis")}
                            direction="column"
                            options={[
                              ...(activeTab !== "attendance"
                                ? [
                                    {
                                      label: "Department",
                                      value: "department",
                                    },
                                    { label: "Employee", value: "employee" },
                                    { label: "Type", value: "type" },
                                    { label: "Trend", value: "trend" },
                                    {
                                      label: "Monthly Distribution",
                                      value: "monthly",
                                    },
                                  ]
                                : [
                                    { label: t("hrAnalytics.staff"), value: "staff" },
                                    {
                                      label: "Department",
                                      value: "department",
                                    },
                                  ]),
                            ]}
                            placeholder="Select"
                            value={yAxisKey}
                            onChange={setYAxisKey}
                            isClearable
                            width="100%"
                          />
                        </div>
                      </>
                    )}

                    {chartType === "line" && (
                      <>
                        <div className="space-y-2">
                          <FormInput
                            type="select"
                            label="Group By"
                            direction="column"
                            options={[
                              ...(activeTab !== "attendance"
                                ? [
                                    {
                                      label: "Department",
                                      value: "department",
                                    },
                                    { label: "Employee", value: "employee" },
                                    { label: "Type", value: "type" },
                                    { label: "Trend", value: "trend" },
                                    {
                                      label: "Monthly Distribution",
                                      value: "monthly",
                                    },
                                  ]
                                : [
                                    { label: t("hrAnalytics.staff"), value: "staff" },
                                    {
                                      label: "Department",
                                      value: "department",
                                    },
                                  ]),
                            ]}
                            placeholder="Select"
                            value={yAxisKey}
                            onChange={setYAxisKey}
                            isClearable
                            width="100%"
                          />
                        </div>

                        <div className="space-y-2">
                          <FormInput
                            type="select"
                            label="Metrics"
                            direction="column"
                            options={availableMetrics}
                            placeholder="Select metrics"
                            value={selectedMetrics}
                            onChange={setSelectedMetrics}
                            isMulti
                            width="100%"
                          />
                        </div>
                      </>
                    )}

                    {chartType === "pie" && (
                      <>
                        <div className="space-y-2">
                          <FormInput
                            type="select"
                            label="Group By"
                            direction="column"
                            options={[
                              ...(activeTab !== "attendance"
                                ? [
                                    {
                                      label: "Department",
                                      value: "department",
                                    },
                                    { label: "Employee", value: "employee" },
                                    { label: "Type", value: "type" },
                                    {
                                      label: "Monthly Distribution",
                                      value: "monthly",
                                    },
                                  ]
                                : [
                                    { label: t("hrAnalytics.staff"), value: "staff" },
                                    {
                                      label: "Department",
                                      value: "department",
                                    },
                                  ]),
                            ]}
                            placeholder="Select"
                            value={yAxisKey}
                            onChange={setYAxisKey}
                            isClearable
                            width="100%"
                          />
                        </div>

                        <div className="space-y-2">
                          <FormInput
                            type="select"
                            label="Metric"
                            direction="column"
                            options={
                              activeTab === "attendance"
                                ? attendanceAvailableMetrics
                                : availableMetrics
                            }
                            placeholder="Select metric"
                            value={pieMetric}
                            onChange={(value) => {
                              console.log("Metric selector changed:", value);
                              setPieMetric(value);
                            }}
                            width="100%"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
