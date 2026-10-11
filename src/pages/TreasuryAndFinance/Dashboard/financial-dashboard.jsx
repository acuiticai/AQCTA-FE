"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import {
  Download,
  TrendingUp,
  FileText,
  BarChart3,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import DateRangePicker from "@/components/common/DateRangePicker";
import { CustomBarChart } from "./components/custom-bar-chart";
import { MergedAnalyticsCharts } from "./components/MergedAnalyticsCharts";
import SearchableDropdown from "@/components/SearchableDropdown";
import "./financial-dashboard-styles.css";
import hug from "../../../assets/img/icons/hug.png";
import income from "../../../assets/img/icons/income.png";
import expenses from "../../../assets/img/icons/expenses.png";
import losses from "../../../assets/img/icons/losses.png";
import exportIcon from "../../../assets/img/icons/export.png";
import exportIcon2 from "../../../assets/img/icons/export2.png";
import FinancialService from "../../../services/financialService";

// Add custom styles for better mobile experience
const customStyles = `
  .export-dropdown {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    z-index: 50;
    min-width: 160px;
  }

  .export-dropdown.show,
  .group:hover .export-dropdown {
    opacity: 1;
    visibility: visible;
  }

  @media (max-width: 640px) {
    .export-dropdown {
      position: fixed;
      right: 10px;
      left: 10px;
      width: auto;
      min-width: auto;
    }
  }

  .financial-dashboard .group:hover .export-dropdown,
  .financial-dashboard .group:focus-within .export-dropdown {
    opacity: 1;
    visibility: visible;
  }
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.textContent = customStyles;
document.head.appendChild(styleSheet);

const FinancialDashboard = () => {
  // State management
  const [activityPeriod, setActivityPeriod] = useState("Month");
  const [analyticsPeriod, setAnalyticsPeriod] = useState("Week");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("All");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [availableCurrencies, setAvailableCurrencies] = useState([
    { code: "USD", name: "USD", symbol: "$" },
  ]);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activityError, setActivityError] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(null);

  // Data states
  const [realActivityData, setRealActivityData] = useState([]);
  const [realAnalyticsData, setRealAnalyticsData] = useState([]);
  const [realMetrics, setRealMetrics] = useState({
    totalProfit: 0,
    income: 0,
    expenses: 0,
    totalLoss: 0,
  });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [creditBalance, setCreditBalance] = useState(0);
  const [transactionStats, setTransactionStats] = useState({
    totalTransactions: 0,
    pendingTransactions: 0,
    paidTransactions: 0,
  });
  const [metricsPercentages, setMetricsPercentages] = useState({
    profitChange: 0,
    incomeChange: 0,
    expenseChange: 0,
    lossChange: 0,
  });

  // Force re-render state for pie chart when currency changes
  const [pieChartKey, setPieChartKey] = useState(0);

  // Success states for user feedback
  const [successMessage, setSuccessMessage] = useState("");

  // Refs for tracking component state
  const abortControllerRef = useRef(null);
  const lastDateRangeRef = useRef(null);
  const lastActivityPeriodRef = useRef(null);
  const lastAnalyticsPeriodRef = useRef(null);
  const lastBusinessRef = useRef(null);

  // Helper function to get current date range
  const getCurrentDateRange = useCallback(() => {
    return dateRangeStart && dateRangeEnd
      ? {
          from: new Date(dateRangeStart),
          to: new Date(dateRangeEnd),
        }
      : dateRange;
  }, [dateRangeStart, dateRangeEnd, dateRange]);

  // Helper function to show success message temporarily
  const showSuccessMessage = useCallback((message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
  }, []);

  // Enhanced error handling
  const handleError = useCallback((error, context) => {
    console.error(`Error in ${context}:`, error);
    const errorMessage = error?.message || "An unexpected error occurred";
    return `${context}: ${errorMessage}`;
  }, []);

  // Get current business for API calls
  const getCurrentBusiness = useCallback(() => {
    return selectedBusiness !== "All" ? selectedBusiness : null;
  }, [selectedBusiness]);

  // Load available currencies
  const loadCurrencies = useCallback(async () => {
    try {
      const business = getCurrentBusiness();
      console.log("Loading currencies for business:", business);
      const currencies = await FinancialService.getCurrencies(business);
      console.log("Loaded currencies:", currencies);
      setAvailableCurrencies(
        currencies || [{ code: "USD", name: "USD ($)", symbol: "$" }]
      );

      // Reset to USD if current currency is not available for this business
      const currentCurrencyExists = currencies.find(
        (c) => c.code === selectedCurrency
      );
      if (!currentCurrencyExists && selectedCurrency !== "USD") {
        setSelectedCurrency("USD");
        showSuccessMessage("Currency reset to USD for this business");
      }
    } catch (error) {
      console.error("Error loading currencies:", error);
      setAvailableCurrencies([{ code: "USD", name: "USD ($)", symbol: "$" }]);
    }
  }, [getCurrentBusiness, selectedCurrency, showSuccessMessage]);

  // Handle currency selection change
  const handleCurrencyChange = useCallback(
    (currencyCode) => {
      console.log(
        "Currency changing from",
        selectedCurrency,
        "to",
        currencyCode
      );

      // Clear current analytics data to prevent showing stale data
      setRealAnalyticsData([]);
      setIsAnalyticsLoading(true);

      setSelectedCurrency(currencyCode);
      showSuccessMessage(`Currency changed to ${currencyCode}`);
    },
    [selectedCurrency, showSuccessMessage]
  );

  // Load balance data from transactions (replaces bank account balance calculation)
  const loadBalanceData = useCallback(async () => {
    try {
      const apiDateRange = getCurrentDateRange();
      const business = getCurrentBusiness();

      // Get transaction stats for balance calculation
      const stats = await FinancialService.getTransactionStats(
        apiDateRange,
        business,
        selectedCurrency
      );

      // Calculate balance from actual transactions
      const totalBalance = stats.totalBalance || 0;
      const creditBalance = Math.abs(Math.min(0, totalBalance)); // Negative balance becomes credit
      const mainBalance = Math.max(0, totalBalance); // Positive balance

      setTotalBalance(totalBalance);
      setCreditBalance(creditBalance);

      return { totalBalance, mainBalance, creditBalance };
    } catch (error) {
      console.error("Error loading balance data:", error);
      setTotalBalance(0);
      setCreditBalance(0);
      return { totalBalance: 0, mainBalance: 0, creditBalance: 0 };
    }
  }, [getCurrentDateRange, getCurrentBusiness, selectedCurrency]);

  // Load all dashboard data with proper error handling and currency conversion
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Cancel any existing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const apiDateRange = getCurrentDateRange();
      const business = getCurrentBusiness();

      lastDateRangeRef.current = apiDateRange;
      lastBusinessRef.current = business;

      console.log(
        "Loading dashboard data with business filter:",
        business,
        "currency:",
        selectedCurrency
      );

      // Load all data in parallel with proper error handling
      const [balanceResult, transactionStatsResult, transactionsResult] =
        await Promise.allSettled([
          loadBalanceData(),
          FinancialService.getTransactionStats(
            apiDateRange,
            business,
            selectedCurrency
          ),
          FinancialService.getTransactions({
            limit: 1000,
            dateRange: FinancialService.formatDateRange(apiDateRange),
            business,
          }),
        ]);

      // Handle balance data (now from transactions)
      if (balanceResult.status === "fulfilled") {
        const balanceData = balanceResult.value;
        setTotalBalance(balanceData.totalBalance);
        setCreditBalance(balanceData.creditBalance);
      } else {
        console.error("Failed to load balance data:", balanceResult.reason);
        setTotalBalance(0);
        setCreditBalance(0);
      }

      // Handle transaction stats (already in selected currency)
      if (transactionStatsResult.status === "fulfilled") {
        const transactionStatsData = transactionStatsResult.value;
        setRealMetrics({
          totalProfit: Number(transactionStatsData.totalBalance) || 0,
          income: Number(transactionStatsData.totalIncome) || 0,
          expenses: Number(transactionStatsData.totalExpense) || 0,
          totalLoss: Math.max(
            0,
            (Number(transactionStatsData.totalExpense) || 0) -
              (Number(transactionStatsData.totalIncome) || 0)
          ),
        });
      } else {
        console.error(
          "Failed to load transaction stats:",
          transactionStatsResult.reason
        );
        setRealMetrics({
          totalProfit: 0,
          income: 0,
          expenses: 0,
          totalLoss: 0,
        });
      }

      // Handle transactions for counting with date filtering
      if (transactionsResult.status === "fulfilled") {
        const transactionData = transactionsResult.value;
        const transactions = transactionData.transactions || [];
        setTransactionStats({
          totalTransactions: transactions.length,
          pendingTransactions: transactions.filter(
            (t) => t.status === "Pending"
          ).length,
          paidTransactions: transactions.filter((t) => t.status === "Paid")
            .length,
        });
      } else {
        console.error(
          "Failed to load transactions:",
          transactionsResult.reason
        );
        setTransactionStats({
          totalTransactions: 0,
          pendingTransactions: 0,
          paidTransactions: 0,
        });
      }

      // Check for any failures and set appropriate error message
      const failures = [
        balanceResult.status === "rejected" ? "Balance Data" : null,
        transactionStatsResult.status === "rejected"
          ? "Transaction Stats"
          : null,
        transactionsResult.status === "rejected" ? "Transactions" : null,
      ].filter(Boolean);

      if (failures.length > 0) {
        setError(`Failed to load: ${failures.join(", ")}`);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setError(handleError(error, "dashboard data loading"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    getCurrentDateRange,
    getCurrentBusiness,
    selectedCurrency,
    handleError,
    loadBalanceData,
  ]);

  // Load activity data with enhanced error handling
  const loadActivityData = useCallback(async () => {
    try {
      setIsActivityLoading(true);
      setActivityError(null);

      const apiDateRange = getCurrentDateRange();
      const business = getCurrentBusiness();

      lastActivityPeriodRef.current = activityPeriod;

      console.log("Loading activity data with business filter:", business);

      const data = await FinancialService.getActivityData(
        activityPeriod,
        apiDateRange,
        business,
        selectedCurrency
      );
      setRealActivityData(data || []);
    } catch (error) {
      const errorMsg = handleError(error, "activity data loading");
      setActivityError(errorMsg);
      setRealActivityData([]);
    } finally {
      setIsActivityLoading(false);
    }
  }, [activityPeriod, getCurrentDateRange, getCurrentBusiness, handleError]);

  // Load analytics data with enhanced error handling
  const loadAnalyticsData = useCallback(async () => {
    try {
      setIsAnalyticsLoading(true);
      setAnalyticsError(null);

      const apiDateRange = getCurrentDateRange();
      const business = getCurrentBusiness();

      lastAnalyticsPeriodRef.current = analyticsPeriod;

      console.log(
        "Loading analytics data with business filter:",
        business,
        "currency:",
        selectedCurrency
      );

      // Clear any existing analytics cache for this business/currency combination
      const cacheKey = `analytics-${analyticsPeriod}-${business}-${selectedCurrency}`;
      FinancialService.cache?.delete(cacheKey);

      const data = await FinancialService.getAnalyticsData(
        analyticsPeriod,
        apiDateRange,
        business,
        selectedCurrency
      );

      console.log(
        "Analytics data loaded:",
        data?.length,
        "items in",
        selectedCurrency
      );
      setRealAnalyticsData(data || []);
    } catch (error) {
      const errorMsg = handleError(error, "analytics data loading");
      setAnalyticsError(errorMsg);
      setRealAnalyticsData([]);
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [
    analyticsPeriod,
    getCurrentDateRange,
    getCurrentBusiness,
    selectedCurrency,
    handleError,
  ]);

  // Calculate metrics percentages with proper error handling
  const calculateMetricsPercentages = useCallback(async () => {
    try {
      const currentDateRange = getCurrentDateRange();
      const business = getCurrentBusiness();

      // Calculate previous period dates
      const daysDiff = Math.ceil(
        (currentDateRange.to - currentDateRange.from) / (1000 * 60 * 60 * 24)
      );
      const prevFrom = new Date(currentDateRange.from);
      prevFrom.setDate(prevFrom.getDate() - daysDiff);
      const prevTo = new Date(currentDateRange.from);

      // Get previous period data
      const prevStatsData = await FinancialService.getTransactionStats(
        {
          from: prevFrom,
          to: prevTo,
        },
        business,
        selectedCurrency
      );

      // Calculate percentage changes
      const currentProfit = realMetrics.totalProfit || 0;
      const currentIncome = realMetrics.income || 0;
      const currentExpenses = realMetrics.expenses || 0;
      const currentLoss = realMetrics.totalLoss || 0;

      const prevProfit = Number(prevStatsData.totalBalance) || 0;
      const prevIncome = Number(prevStatsData.totalIncome) || 0;
      const prevExpenses = Number(prevStatsData.totalExpense) || 0;
      const prevLoss = Math.max(
        0,
        (Number(prevStatsData.totalExpense) || 0) -
          (Number(prevStatsData.totalIncome) || 0)
      );

      const calculatePercentageChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      setMetricsPercentages({
        profitChange: calculatePercentageChange(currentProfit, prevProfit),
        incomeChange: calculatePercentageChange(currentIncome, prevIncome),
        expenseChange: calculatePercentageChange(currentExpenses, prevExpenses),
        lossChange: calculatePercentageChange(currentLoss, prevLoss),
      });
    } catch (error) {
      console.error("Error calculating metrics percentages:", error);
      // Set default values on error
      setMetricsPercentages({
        profitChange: 0,
        incomeChange: 0,
        expenseChange: 0,
        lossChange: 0,
      });
    }
  }, [getCurrentDateRange, getCurrentBusiness, realMetrics]);

  // Enhanced refresh function
  const handleRefresh = useCallback(async () => {
    try {
      showSuccessMessage("Refreshing dashboard data...");
      await Promise.all([
        loadDashboardData(),
        loadActivityData(),
        loadAnalyticsData(),
      ]);
      showSuccessMessage("Dashboard refreshed successfully!");
    } catch (error) {
      setError(handleError(error, "dashboard refresh"));
    }
  }, [
    loadDashboardData,
    loadActivityData,
    loadAnalyticsData,
    showSuccessMessage,
    handleError,
  ]);

  // Handle business selection change with improved currency handling
  const handleBusinessChange = useCallback(
    (businessId) => {
      console.log("Business changed to:", businessId);
      setSelectedBusiness(businessId);

      // Show loading message
      showSuccessMessage("Switching business...");

      // Clear current data while loading
      setIsLoading(true);

      // Load currencies and data for new business
      setTimeout(() => {
        showSuccessMessage(
          businessId === "All"
            ? "Showing data for all businesses"
            : `Switched to business: ${
                businesses.find((b) => b._id === businessId)?.name || businessId
              }`
        );
      }, 500);
    },
    [businesses, showSuccessMessage]
  );

  // Handle date range changes with debouncing
  const handleDateRangeApply = useCallback(
    (startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setError("Invalid date format provided");
        return;
      }

      if (start > end) {
        setError("Start date cannot be after end date");
        return;
      }

      setDateRangeStart(startDate);
      setDateRangeEnd(endDate);
      setDateRange({
        from: start,
        to: end,
      });
      setError(null);
      showSuccessMessage("Date range updated!");
    },
    [showSuccessMessage]
  );

  const handleDateRangeClear = useCallback(() => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setDateRange({
      from: new Date(new Date().setDate(new Date().getDate() - 30)),
      to: new Date(),
    });
    setError(null);
    showSuccessMessage("Date range cleared!");
  }, [showSuccessMessage]);

  // Handle activity period change with validation
  const handleActivityPeriodChange = useCallback(
    (period) => {
      if (period !== activityPeriod) {
        setActivityPeriod(period);
        showSuccessMessage(`Activity period changed to ${period}`);
      }
    },
    [activityPeriod, showSuccessMessage]
  );

  // Handle analytics period change with validation
  const handleAnalyticsPeriodChange = useCallback(
    (period) => {
      if (period !== analyticsPeriod) {
        setAnalyticsPeriod(period);
        showSuccessMessage(`Analytics period changed to ${period}`);
      }
    },
    [analyticsPeriod, showSuccessMessage]
  );

  // Effect hooks with proper dependencies and cleanup
  useEffect(() => {
    loadDashboardData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Effect for date range changes
  useEffect(() => {
    const currentDateRange = getCurrentDateRange();
    if (
      !lastDateRangeRef.current ||
      lastDateRangeRef.current.from.getTime() !==
        currentDateRange.from.getTime() ||
      lastDateRangeRef.current.to.getTime() !== currentDateRange.to.getTime()
    ) {
      loadDashboardData();
    }
  }, [loadDashboardData, getCurrentDateRange]);

  useEffect(() => {
    if (lastActivityPeriodRef.current !== activityPeriod) {
      loadActivityData();
    }
  }, [loadActivityData, activityPeriod]);

  useEffect(() => {
    if (lastAnalyticsPeriodRef.current !== analyticsPeriod) {
      loadAnalyticsData();
    }
  }, [loadAnalyticsData, analyticsPeriod]);

  useEffect(() => {
    if (
      realMetrics.totalProfit !== 0 ||
      realMetrics.income !== 0 ||
      realMetrics.expenses !== 0
    ) {
      calculateMetricsPercentages();
    }
  }, [realMetrics, calculateMetricsPercentages]);

  // Fetch businesses and currencies on mount
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessList = JSON.parse(storedBusinesses);
          setBusinesses(businessList);
          console.log("Loaded businesses:", businessList);
        } else {
          // Optionally fetch from API if not in localStorage
          console.log("No businesses found in localStorage");
        }
      } catch (error) {
        console.error("Error loading businesses:", error);
        setBusinesses([]);
      }
    };

    fetchBusinesses();
    loadCurrencies();
  }, [loadCurrencies]);

  // Effect for currency changes - reload data when currency changes
  useEffect(() => {
    console.log("Currency changed, reloading data...", selectedCurrency);
    if (selectedCurrency) {
      // Increment pie chart key to force re-render
      setPieChartKey((prev) => prev + 1);

      // Force reload all data immediately when currency changes
      const reloadData = async () => {
        try {
          // Clear analytics cache to force fresh data
          FinancialService.clearCache();

          // Small delay to ensure currency state is updated
          await new Promise((resolve) => setTimeout(resolve, 100));

          await Promise.all([
            loadDashboardData(),
            loadActivityData(),
            loadAnalyticsData(), // This updates pie chart data
          ]);
          console.log("All data reloaded for currency:", selectedCurrency);

          // Force another pie chart key update after data loads
          setTimeout(() => setPieChartKey((prev) => prev + 1), 200);
        } catch (error) {
          console.error("Error reloading data for currency change:", error);
        }
      };

      reloadData();
    }
  }, [
    selectedCurrency,
    loadDashboardData,
    loadActivityData,
    loadAnalyticsData,
  ]);

  // Effect for business changes - reload currencies and data
  useEffect(() => {
    const currentBusiness = getCurrentBusiness();
    if (lastBusinessRef.current !== currentBusiness) {
      console.log("Business filter changed, reloading currencies and data...");

      // Clear cache for the previous business
      if (lastBusinessRef.current) {
        FinancialService.clearCacheForBusiness(lastBusinessRef.current);
      }

      // Load currencies first, then data
      loadCurrencies().then(() => {
        loadDashboardData();
        loadActivityData();
        loadAnalyticsData();
      });
    }
  }, [
    selectedBusiness,
    loadCurrencies,
    loadDashboardData,
    loadActivityData,
    loadAnalyticsData,
    getCurrentBusiness,
  ]);

  // Memoized computed values
  const activityData = useMemo(() => realActivityData, [realActivityData]);
  const analyticsData = useMemo(() => realAnalyticsData, [realAnalyticsData]);
  const currentMetrics = useMemo(() => realMetrics, [realMetrics]);

  // Get currency symbol for display
  const currencySymbol = useMemo(() => {
    const currency = availableCurrencies.find(
      (c) => c.code === selectedCurrency
    );
    return currency?.symbol || selectedCurrency;
  }, [selectedCurrency, availableCurrencies]);

  // Format currency display
  const formatCurrency = useCallback(
    (amount, showSymbol = true) => {
      const formattedAmount = Number(amount).toLocaleString();
      return showSymbol
        ? `${currencySymbol}${formattedAmount}`
        : formattedAmount;
    },
    [currencySymbol]
  );

  // Calculate pie chart data with forced recalculation when currency or analytics changes
  const pieData = useMemo(() => {
    console.log(
      "Recalculating pie data - Analytics:",
      analyticsData?.length,
      "Currency:",
      selectedCurrency
    );

    if (!analyticsData || analyticsData.length === 0) {
      console.log("No analytics data, returning zero values");
      return [
        { name: "Total Profit", value: 0, color: "var(--p-blue)" },
        { name: "Income", value: 0, color: "#a855f7" },
        { name: "Expenses", value: 0, color: "#1f2937" },
        { name: "Losses", value: 0, color: "#ec4899" },
      ];
    }

    const totalProfit = analyticsData.reduce(
      (sum, item) => sum + (Number(item.totalProfit) || 0),
      0
    );
    const totalIncome = analyticsData.reduce(
      (sum, item) => sum + (Number(item.income) || 0),
      0
    );
    const totalExpenses = analyticsData.reduce(
      (sum, item) => sum + (Number(item.expenses) || 0),
      0
    );
    const totalLosses = analyticsData.reduce(
      (sum, item) => sum + (Number(item.losses) || 0),
      0
    );

    // Ensure values are positive for pie chart
    const safeTotalProfit = Math.max(0, totalProfit);
    const safeTotalIncome = Math.max(0, totalIncome);
    const safeTotalExpenses = Math.max(0, totalExpenses);
    const safeTotalLosses = Math.max(0, totalLosses);

    console.log("Pie chart calculated values in", selectedCurrency, ":", {
      safeTotalProfit,
      safeTotalIncome,
      safeTotalExpenses,
      safeTotalLosses,
    });

    const result = [
      { name: "Total Profit", value: safeTotalProfit, color: "var(--p-blue)" },
      { name: "Income", value: safeTotalIncome, color: "#a855f7" },
      { name: "Expenses", value: safeTotalExpenses, color: "#1f2937" },
      { name: "Losses", value: safeTotalLosses, color: "#ec4899" },
    ];

    console.log("Final pie chart data:", result);
    return result;
  }, [analyticsData, selectedCurrency, analyticsPeriod]); // Added analyticsPeriod to ensure updates

  // Export functions with enhanced error handling
  const handleExportCSV = async () => {
    try {
      setIsLoading(true);
      showSuccessMessage("Preparing CSV export...");

      const apiDateRange = getCurrentDateRange();
      const business = getCurrentBusiness();

      const report = await FinancialService.getFinancialReport(
        apiDateRange,
        business,
        selectedCurrency
      );

      const exportData = [
        {
          type: "Summary",
          totalBalance: report.summary.totalBalance,
          totalIncome: report.summary.totalIncome,
          totalExpense: report.summary.totalExpense,
          business: report.business || "All",
          currency: selectedCurrency,
          generatedAt: report.generatedAt,
        },
        ...report.transactions.map((t) => ({
          type: "Transaction",
          reference: t.reference,
          transactionType: t.type,
          amount: t.amount,
          currency: t.currency || selectedCurrency,
          convertedAmount:
            selectedCurrency !== (t.currency || "USD") ? "Converted" : t.amount,
          date: t.date,
          description: t.description,
          category: t.category,
          status: t.status,
          business: t.business,
        })),
      ];

      const filename = `financial-report-${selectedCurrency}-${
        business ? `${business}-` : ""
      }${new Date().toISOString().split("T")[0]}.csv`;

      FinancialService.exportToCSV(exportData, filename);
      showSuccessMessage("CSV exported successfully!");
    } catch (error) {
      setError(handleError(error, "CSV export"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsLoading(true);
      showSuccessMessage("Preparing PDF export...");

      const apiDateRange = getCurrentDateRange();
      const business = getCurrentBusiness();

      const report = await FinancialService.getFinancialReport(
        apiDateRange,
        business,
        selectedCurrency
      );

      const filename = `financial-report-${selectedCurrency}-${
        business ? `${business}-` : ""
      }${new Date().toISOString().split("T")[0]}.pdf`;

      await FinancialService.exportToPDF(report, filename);
      showSuccessMessage("PDF exported successfully!");
    } catch (error) {
      setError(handleError(error, "PDF export"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="financial-dashboard min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header with enhanced feedback */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <h3 className="text-lg font-bold text-gray-900 flex-shrink-0">
              Financial Overview
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {isLoading && (
                <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
              )}
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm max-w-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate" title={error}>
                    {error}
                  </span>
                </div>
              )}
              {successMessage && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>

            {/* Business and Currency Filter Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              {/* Business Filter Dropdown */}
              <div className="w-full sm:w-auto min-w-[180px]">
                <SearchableDropdown
                  value={selectedBusiness}
                  onChange={(e) => handleBusinessChange(e.target.value)}
                  placeholder="All Businesses"
                  searchPlaceholder="Search businesses..."
                  options={[
                    { value: "All", label: "All Businesses" },
                    ...businesses.map((business) => ({
                      value: business._id,
                      label: business.name,
                    })),
                  ]}
                  disabled={isLoading}
                />
              </div>

              {/* Currency Filter Dropdown */}
              <div className="w-full sm:w-auto min-w-[120px]">
                <SearchableDropdown
                  value={selectedCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  placeholder="Select Currency"
                  searchPlaceholder="Search currencies..."
                  options={availableCurrencies.map((currency) => ({
                    value: currency.code,
                    label: currency.name,
                  }))}
                  disabled={isLoading}
                />
                {availableCurrencies.length === 1 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Only USD available
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
            <DateRangePicker
              startDate={dateRangeStart}
              endDate={dateRangeEnd}
              onApply={handleDateRangeApply}
              onClear={handleDateRangeClear}
              placeholder="Filter by date range"
              className="w-full sm:w-auto flex-shrink-0"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="text-gray-600 bg-white border-gray-200 hover:bg-gray-50 flex-1 sm:flex-none"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <div className="relative group flex-1 sm:flex-none">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-600 bg-white border-gray-200 hover:bg-gray-50 w-full sm:w-auto"
                  aria-label="Export data"
                >
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>

                {/* Export dropdown */}
                <div className="export-dropdown absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-[160px] sm:min-w-[140px]">
                  <button
                    onClick={handleExportCSV}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-3 h-3" />
                    Export CSV
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BarChart3 className="w-3 h-3" />
                    Export Report
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <div className="px-3 py-2 text-xs text-gray-500">
                    <div className="mb-1">Currency: {selectedCurrency}</div>
                    {selectedBusiness !== "All" && (
                      <div className="mb-1">
                        Business:{" "}
                        {businesses.find((b) => b._id === selectedBusiness)
                          ?.name || selectedBusiness}
                      </div>
                    )}
                    <div className="break-words">
                      {dateRangeStart && dateRangeEnd
                        ? `${new Date(
                            dateRangeStart
                          ).toLocaleDateString()} - ${new Date(
                            dateRangeEnd
                          ).toLocaleDateString()}`
                        : `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Balance Cards with enhanced loading states */}
          <div className="h-full flex flex-col">
            <Card className="card-enhanced shadow-sm border-gray-100 bg-[#F9F9FA] flex-1 flex flex-col">
              <CardContent className="p-4 sm:p-6 flex-1 flex flex-col">
                <div className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Net Balance ({selectedCurrency})
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                        {isLoading ? (
                          <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
                        ) : (
                          formatCurrency(totalBalance)
                        )}
                      </span>
                      {!isLoading && totalBalance !== 0 && (
                        <Badge
                          className={`${
                            totalBalance >= 0
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          } hover:bg-green-100 px-2 py-1`}
                        >
                          {totalBalance >= 0 ? (
                            <>
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Profit
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Loss
                            </>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Income</p>
                      <p className="text-base sm:text-lg font-semibold text-green-600">
                        {isLoading ? (
                          <div className="h-5 w-20 bg-gray-200 animate-pulse rounded"></div>
                        ) : (
                          formatCurrency(currentMetrics.income)
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Total Expenses
                      </p>
                      <p className="text-base sm:text-lg font-semibold text-red-600">
                        {isLoading ? (
                          <div className="h-5 w-16 bg-gray-200 animate-pulse rounded"></div>
                        ) : (
                          formatCurrency(currentMetrics.expenses)
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 flex-1 flex flex-col justify-end">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          Total Transactions
                        </span>
                        <span className="font-medium">
                          {isLoading ? (
                            <div className="h-4 w-8 bg-gray-200 animate-pulse rounded"></div>
                          ) : (
                            transactionStats.totalTransactions
                          )}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">
                          Pending Transactions
                        </span>
                        <span className="text-amber-600 font-medium">
                          {isLoading ? (
                            <div className="h-4 w-8 bg-gray-200 animate-pulse rounded"></div>
                          ) : (
                            transactionStats.pendingTransactions
                          )}
                        </span>
                      </div>
                      {!isLoading && (
                        <>
                          <Progress
                            value={
                              transactionStats.totalTransactions > 0
                                ? (transactionStats.pendingTransactions /
                                    transactionStats.totalTransactions) *
                                  100
                                : 0
                            }
                            className="h-2"
                          />
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-500">
                              {transactionStats.paidTransactions} completed
                            </span>
                            <span className="text-gray-500">
                              {transactionStats.totalTransactions > 0
                                ? Math.round(
                                    (transactionStats.pendingTransactions /
                                      transactionStats.totalTransactions) *
                                      100
                                  )
                                : 0}
                              % pending
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    {!isLoading && currentMetrics.totalLoss > 0 && (
                      <div className="pt-2 border-t border-red-100">
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600">Current Loss</span>
                          <span className="text-red-600 font-semibold">
                            {formatCurrency(currentMetrics.totalLoss)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Activity Chart with enhanced error handling */}
          <div className="lg:col-span-2 h-full flex flex-col">
            <Card className="card-enhanced bg-[#F9F9FA] shadow-sm border-gray-100 h-full flex-1 flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      Financial Activity
                    </CardTitle>
                    {isActivityLoading && (
                      <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
                    )}
                    {activityError && (
                      <div
                        className="flex items-center gap-1"
                        title={activityError}
                      >
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-red-500">Error</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 w-full sm:w-auto">
                    {["Day", "Week", "Month", "Year"].map((period) => (
                      <Button
                        key={period}
                        variant={
                          activityPeriod === period ? "default" : "ghost"
                        }
                        size="sm"
                        onClick={() => handleActivityPeriodChange(period)}
                        disabled={isActivityLoading}
                        className={
                          activityPeriod === period
                            ? "bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white flex-1 sm:flex-none"
                            : "text-gray-600 hover:bg-gray-100 flex-1 sm:flex-none"
                        }
                        aria-label={`Change activity period to ${period}`}
                      >
                        {period}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                {isActivityLoading ? (
                  <div className="h-64 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
                    <div className="text-gray-500 text-sm">
                      Loading activity data...
                    </div>
                  </div>
                ) : activityError ? (
                  <div className="h-64 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <div className="text-red-700 text-sm font-medium">
                        Failed to load activity data
                      </div>
                      <div className="text-red-600 text-xs mt-1">
                        {activityError}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadActivityData}
                        className="mt-2 text-red-600 border-red-300 hover:bg-red-50 bg-transparent"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CustomBarChart
                    data={activityData}
                    currency={selectedCurrency}
                    activeIndex={
                      activityData.length > 0
                        ? activityPeriod === "Week"
                          ? Math.min(2, activityData.length - 1)
                          : activityPeriod === "Month"
                          ? Math.min(5, activityData.length - 1)
                          : activityPeriod === "Day"
                          ? Math.min(3, activityData.length - 1)
                          : activityPeriod === "Year"
                          ? Math.min(2, activityData.length - 1)
                          : Math.min(3, activityData.length - 1)
                        : 0
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Metrics Cards with enhanced styling and validation */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="metric-card-profit card-enhanced shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <img
                  src={hug || "/placeholder.svg"}
                  alt="Total Profit"
                  className="w-12 h-12"
                />
                <div className="min-w-0 pb-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    Total Profit
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <img
                      src={
                        metricsPercentages.profitChange >= 0
                          ? exportIcon
                          : exportIcon2
                      }
                      alt="Profit Trend"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        metricsPercentages.profitChange >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {isLoading
                        ? "..."
                        : `${
                            metricsPercentages.profitChange >= 0 ? "+" : ""
                          }${Math.abs(metricsPercentages.profitChange).toFixed(
                            1
                          )}%`}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 border-t border-gray-100 pt-4">
                {formatCurrency(currentMetrics.totalProfit)}
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card-income card-enhanced shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <img
                  src={income || "/placeholder.svg"}
                  alt="Income"
                  className="w-12 h-12"
                />
                <div className="min-w-0 pb-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    Incomes
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <img
                      src={
                        metricsPercentages.incomeChange >= 0
                          ? exportIcon
                          : exportIcon2
                      }
                      alt="Income Trend"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        metricsPercentages.incomeChange >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {isLoading
                        ? "..."
                        : `${
                            metricsPercentages.incomeChange >= 0 ? "+" : ""
                          }${Math.abs(metricsPercentages.incomeChange).toFixed(
                            1
                          )}%`}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 border-t border-gray-100 pt-4">
                {formatCurrency(currentMetrics.income)}
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card-expense card-enhanced shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <img
                  src={expenses || "/placeholder.svg"}
                  alt="Expenses"
                  className="w-12 h-12"
                />
                <div className="min-w-0 pb-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    Expenses
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <img
                      src={
                        metricsPercentages.expenseChange >= 0
                          ? exportIcon2
                          : exportIcon
                      }
                      alt="Expense Trend"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        metricsPercentages.expenseChange >= 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {isLoading
                        ? "..."
                        : `${
                            metricsPercentages.expenseChange >= 0 ? "+" : ""
                          }${Math.abs(metricsPercentages.expenseChange).toFixed(
                            1
                          )}%`}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 border-t border-gray-100 pt-4">
                {formatCurrency(currentMetrics.expenses)}
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card-loss card-enhanced shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <img
                  src={losses || "/placeholder.svg"}
                  alt="Total Loss"
                  className="w-12 h-12"
                />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    Total Loss
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <img
                      src={
                        metricsPercentages.lossChange >= 0
                          ? exportIcon2
                          : exportIcon
                      }
                      alt="Loss Trend"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        metricsPercentages.lossChange >= 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {isLoading
                        ? "..."
                        : `${
                            metricsPercentages.lossChange >= 0 ? "+" : ""
                          }${Math.abs(metricsPercentages.lossChange).toFixed(
                            1
                          )}%`}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 border-t border-gray-100 pt-4">
                {formatCurrency(currentMetrics.totalLoss)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section with enhanced error handling */}
        <MergedAnalyticsCharts
          analyticsData={analyticsData}
          pieData={pieData}
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={handleAnalyticsPeriodChange}
          isLoading={isAnalyticsLoading}
          error={analyticsError}
          onRetry={loadAnalyticsData}
          currency={selectedCurrency}
          key={`analytics-${selectedCurrency}-${analyticsPeriod}-${pieChartKey}`} // Force re-render on currency/period change
        />
      </div>
    </div>
  );
};

export default FinancialDashboard;
