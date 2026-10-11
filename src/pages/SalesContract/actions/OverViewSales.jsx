import { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SalesAnalyticsChart from "@/pages/SalesContract/actions/Sales_Analytics_Chart";
import SalesContractServices from "@/services/SalesContractServices";
import VendorServices from "@/services/VendorServices";
import ItemsServices from "@/services/ItemsServices";
import worldPorts from "@/data/world-ports";
import { FormInput } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import CustomerServices from "@/services/CustomerServices";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import { Download, Eye, TrendingUp } from "lucide-react";
import { formatAmount, formatDate } from "@/components/formatAmount";
import Loading from "@/components/preloader/Loading";
import { useHistory } from "react-router-dom";
import RegionMap from "@/components/RegionMap";

export default function OverViewSales() {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const history = useHistory();
  const { adminInfo } = state;
  const [analyticsData, setAnalyticsData] = useState({});
  const [loading, setLoading] = useState(true); // Initial page load only
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [countryLoading, setCountryLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [assignedBusinesses, setAssignedBusinesses] = useState([]);
  const [item, setItem] = useState("");
  const [itemOptions, setItemOptions] = useState([]);
  const [customer, setCustomer] = useState("");
  const [customerOptions, setCustomerOptions] = useState([]);
  const [origin, setOrigin] = useState("");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [gradeOptions, setGradeOptions] = useState([]);

  // Status options for sales contracts
  const statusOptions = [
    { value: "Draft", label: t("salesContract.status.draft", { defaultValue: "Draft" }) },
    {
      value: "Waiting Management Approval",
      label: t("salesContract.status.waitingManagementApproval", {
        defaultValue: "Waiting Management Approval",
      }),
    },
    {
      value: "Amendments Requested (Management)",
      label: t("salesContract.status.amendmentsRequestedManagement", {
        defaultValue: "Amendments Requested (Management)",
      }),
    },
    {
      value: "Amendments Requested (Accounts)",
      label: t("salesContract.status.amendmentsRequestedAccounts", {
        defaultValue: "Amendments Requested (Accounts)",
      }),
    },
    { value: "Rejected (Management)", label: t("salesContract.status.rejectedManagement", { defaultValue: "Rejected (Management)" }) },
    { value: "Rejected (Accounts)", label: t("salesContract.status.rejectedAccounts", { defaultValue: "Rejected (Accounts)" }) },
    { value: "Preparing Contract", label: t("salesContract.status.preparingContract", { defaultValue: "Preparing Contract" }) },
    { value: "Waiting Customer Approval", label: t("salesContract.status.waitingCustomerApproval", { defaultValue: "Waiting Customer Approval" }) },
    { value: "Pending", label: t("salesContract.status.pending", { defaultValue: "Pending" }) },
    { value: "Processing", label: t("salesContract.status.processing", { defaultValue: "Processing" }) },
    { value: "On-hold", label: t("salesContract.status.onHold", { defaultValue: "On-hold" }) },
    { value: "Cancelled", label: t("salesContract.status.cancelled", { defaultValue: "Cancelled" }) },
    { value: "Completed", label: t("salesContract.status.completed", { defaultValue: "Completed" }) },
  ];
  const [overviewStats, setOverviewStats] = useState({
    totalSales: 0,
    totalContracts: 0,
    last7DaysContracts: 0,
    unassigned: 0,
  });
  const [newContracts, setNewContracts] = useState([]);
  const [contractActivity, setContractActivity] = useState({
    value: 0,
    trend: "up",
    data: [],
  });
  const [activityTimeFrame, setActivityTimeFrame] = useState("Month");
  const [activityLoading, setActivityLoading] = useState(false);
  const [countryData, setCountryData] = useState([]);
  const [top20Countries, setTop20Countries] = useState([]);
  const [customerCountryData, setCustomerCountryData] = useState([]);
  const [topCustomerCountries, setTopCustomerCountries] = useState([]);
  const [newCustomers, setNewCustomers] = useState([]);
  const [customersWithRegions, setCustomersWithRegions] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Currency conversion state
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [currencyRates, setCurrencyRates] = useState({ USD: 1 });
  const [currencyReady, setCurrencyReady] = useState(false);

  const worldPortsOptions = worldPorts.map((port) => ({
    label: `${port.name} (${port.country})`,
    value: port.id,
    key: port.id,
  }));

  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  // Currency normalization and conversion functions
  const normalizeCurrencySymbol = useCallback(
    (currency) => {
      const fallback = (baseCurrency || "USD").toUpperCase();
      if (!currency) return fallback;
      if (typeof currency === "string") return currency.toUpperCase();
      if (typeof currency === "object") {
        const value =
          currency.symbol ||
          currency.code ||
          currency.currency ||
          currency.abbreviation ||
          "";
        if (value) return value.toUpperCase();
      }
      return fallback;
    },
    [baseCurrency]
  );

  const convertToBase = useCallback(
    (amount, currencySymbol) => {
      if (!amount) return 0;
      const symbol = normalizeCurrencySymbol(currencySymbol);
      const rate = currencyRates[symbol];
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount)) {
        return 0;
      }
      if (rate === undefined || rate === null) {
        return numericAmount;
      }
      return numericAmount * rate;
    },
    [currencyRates, normalizeCurrencySymbol]
  );

  // Fetch currency rates
  useEffect(() => {
    const resolveBusinessId = () => {
      if (selectedBusiness) return selectedBusiness;
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const businessesArr = JSON.parse(storedBusinesses);
        if (businessesArr.length > 0) {
          return businessesArr[0]._id;
        }
      }
      return null;
    };

    const fetchCurrencies = async () => {
      const businessId = resolveBusinessId();
      if (!businessId || !adminInfo?.token) {
        setBaseCurrency("USD");
        setCurrencyRates({ USD: 1 });
        setCurrencyReady(true);
        return;
      }

      setCurrencyReady(false);
      try {
        const headers = {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo?.token}`,
        };

        const response = await axios.get(`${Base_URL}/finance/currencies`, {
          params: { business_id: businessId },
          headers,
        });

        const currencyData = response.data?.data || [];
        if (!Array.isArray(currencyData) || currencyData.length === 0) {
          setBaseCurrency("USD");
          setCurrencyRates({ USD: 1 });
          setCurrencyReady(true);
          return;
        }

        const rateMap = {};
        let detectedBase = "USD";

        currencyData.forEach((currency) => {
          const symbol = (currency.symbol || currency.code || "").toUpperCase();
          if (!symbol) return;
          const rawRate =
            currency.conversion_rate_to_base ?? currency.conversionRate ?? 1;
          const rate = Number(rawRate);
          rateMap[symbol] = Number.isFinite(rate) ? rate : 1;
          const isBaseFlag =
            currency.isBase ??
            currency.is_base ??
            currency.baseCurrency ??
            false;
          if (isBaseFlag) {
            detectedBase = symbol;
          }
        });

        if (!rateMap[detectedBase]) {
          rateMap[detectedBase] = 1;
        }

        setCurrencyRates(rateMap);
        setBaseCurrency(detectedBase.toUpperCase());
      } catch (error) {
        console.error("❌ Error fetching currency rates:", error);
        setCurrencyRates({ USD: 1 });
        setBaseCurrency("USD");
      } finally {
        setCurrencyReady(true);
      }
    };

    fetchCurrencies();
  }, [selectedBusiness, adminInfo?.token]);

  // Fetch overview statistics
  const fetchOverviewStats = async () => {
    if (!currencyReady) return; // Wait for currency rates to be ready

    setOverviewLoading(true);
    try {
      const params = {
        businessIds: selectedBusiness ? [selectedBusiness] : [],
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        itemId: item,
        customerId: customer,
        origin,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        grade: selectedGrades.length > 0 ? selectedGrades : undefined,
      };

      // Get all assigned businesses if no specific business selected
      if (!selectedBusiness) {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          const businessIds = businessesArr.map((b) => b._id);
          if (businessIds.length > 0) {
            params.businessIds = businessIds;
          }
        }
      }

      // Fetch analytics data for totals
      const analyticsResponse = await SalesContractServices.getSalesAnalytics({
        params,
      });
      const analyticsData = analyticsResponse?.data || {};

      // Fetch contracts to convert totalSales to base currency
      let totalSalesBase = 0;
      try {
        // Fetch all contracts to calculate total sales in base currency
        let allContracts = [];
        let page = 1;
        const limit = 1000;
        let hasMorePages = true;

        while (hasMorePages) {
          const contractsParams = {
            ...params,
            page,
            limit,
          };

          // Convert businessIds array to JSON string if needed
          if (
            contractsParams.businessIds &&
            Array.isArray(contractsParams.businessIds)
          ) {
            contractsParams.businessIds = JSON.stringify(
              contractsParams.businessIds
            );
          }

          const contractsResponse =
            await SalesContractServices.getAllSalesContracts({
              params: contractsParams,
            });

          const contracts = contractsResponse?.contracts || [];
          allContracts = [...allContracts, ...contracts];

          const totalPages = contractsResponse?.totalPages || 1;
          if (page >= totalPages || contracts.length === 0) {
            hasMorePages = false;
          } else {
            page++;
          }
        }

        // Convert each contract's value to base currency
        allContracts.forEach((contract) => {
          if (contract.productInfo && contract.productInfo.length > 0) {
            contract.productInfo.forEach((product) => {
              const currency = normalizeCurrencySymbol(
                product.selectedCurrency || product.currency
              );
              const amount = Number(
                product.totalValue || product.amountInSelectedCurrency || 0
              );
              if (amount > 0) {
                totalSalesBase += convertToBase(amount, currency);
              }
            });
          }
        });
      } catch (error) {
        console.error("Error converting sales to base currency:", error);
        // Fallback to original totalRevenue if conversion fails
        totalSalesBase = analyticsData.totalRevenue || 0;
      }

      // Fetch today's contracts
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const last7DaysParams = {
        ...params,
        startDate: sevenDaysAgo.toISOString().split("T")[0],
        endDate: today.toISOString().split("T")[0],
      };
      const last7DaysResponse = await SalesContractServices.getSalesAnalytics({
        params: last7DaysParams,
      });
      const last7DaysData = last7DaysResponse?.data || {};

      // Fetch contracts without purchase assignments - using real data from database
      let unassignedParams = {
        purchaseFilter: "without_purchase",
        page: 1,
        limit: 1, // We only need the count
      };

      // Apply same filters as analytics
      if (params.businessIds && params.businessIds.length > 0) {
        unassignedParams.businessIds = JSON.stringify(params.businessIds);
      }
      if (params.startDate) {
        unassignedParams.startDate = params.startDate;
      }
      if (params.endDate) {
        unassignedParams.endDate = params.endDate;
      }
      if (params.itemId) {
        unassignedParams.itemId = params.itemId;
      }
      if (params.customerId) {
        unassignedParams.customerId = params.customerId;
      }
      if (params.origin) {
        unassignedParams.origin = params.origin;
      }
      if (
        params.status &&
        Array.isArray(params.status) &&
        params.status.length > 0
      ) {
        unassignedParams.status = params.status.join(",");
      }
      if (
        params.grade &&
        Array.isArray(params.grade) &&
        params.grade.length > 0
      ) {
        unassignedParams.grade = params.grade.join(",");
      }

      // Fetch unassigned contracts count
      const unassignedResponse =
        await SalesContractServices.getAllSalesContracts({
          params: unassignedParams,
        });
      const unassignedCount = unassignedResponse?.totalCount || 0;

      setOverviewStats({
        totalSales:
          totalSalesBase > 0 ? totalSalesBase : analyticsData.totalRevenue || 0,
        totalContracts: analyticsData.totalContracts || 0,
        last7DaysContracts: last7DaysData.totalContracts || 0,
        unassigned: unassignedCount,
      });
    } catch (error) {
      console.error("Error fetching overview stats:", error);
    } finally {
      setOverviewLoading(false);
    }
  };

  // Fetch new contracts
  const fetchNewContracts = async () => {
    setContractsLoading(true);
    try {
      let params = {
        limit: 10,
        page: 1,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        itemId: item,
        customerId: customer,
        origin,
        status:
          selectedStatuses.length > 0 ? selectedStatuses.join(",") : undefined,
        grade: selectedGrades.length > 0 ? selectedGrades.join(",") : undefined,
      };

      if (selectedBusiness) {
        params.businessId = selectedBusiness;
      } else {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          const businessIds = businessesArr.map((b) => b._id);
          if (businessIds.length > 0) {
            params.businessIds = JSON.stringify(businessIds);
          }
        }
      }

      console.log("📋 Final params for new contracts:", params);

      console.log("Fetching new contracts with params:", params);

      // Fetch real data from API
      const response = await SalesContractServices.getRecentSalesContracts({
        params,
      });
      console.log("🔍 Raw API Response:", response);

      const contractsData = response?.contracts || [];
      console.log("📋 Extracted contracts data:", contractsData);
      console.log("📊 Response data structure:", response);

      // Transform API data to match UI expectations
      const transformedContracts = contractsData.map((contract, index) => {
        // Calculate total quantityMTS and price from productInfo
        let totalQuantityMTS = 0;
        let totalPrice = 0;
        let perMetricTon = 0;

        if (contract.productInfo && contract.productInfo.length > 0) {
          contract.productInfo.forEach((product) => {
            totalQuantityMTS += parseFloat(
              product.quantityMTS || product.quantity || 0
            );
            totalPrice += parseFloat(product.totalValue || 0);
          });
          perMetricTon =
            totalQuantityMTS > 0 ? totalPrice / totalQuantityMTS : 0;
        }

        return {
          id: index + 1,
          _id: contract._id,
          contractNo:
            contract.contractNo || `SC-${contract._id?.toString().slice(-6)}`,
          buyerName:
            contract.basicInfo?.buyerCompanyName ||
            contract.basicInfo?.customerName ||
            "Unknown Buyer",
          quantity: totalQuantityMTS > 0 ? totalQuantityMTS : "N/A",
          price: totalPrice,
          perMetricTon: perMetricTon,
          status: contract.status || "Draft",
          contractDate: contract.basicInfo?.contractDate || contract.createdAt,
        };
      });

      setNewContracts(transformedContracts);

      console.log("Transformed contracts:", transformedContracts);
    } catch (error) {
      console.error("Error fetching new contracts:", error);

      // Show empty contracts list if API fails
      setNewContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  // Fetch contract activity data
  const fetchContractActivity = async () => {
    try {
      setActivityLoading(true);

      let params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        itemId: item,
        customerId: customer,
        origin,
        status:
          selectedStatuses.length > 0 ? selectedStatuses.join(",") : undefined,
        grade: selectedGrades.length > 0 ? selectedGrades.join(",") : undefined,
      };

      if (selectedBusiness) {
        params.businessId = selectedBusiness;
      } else {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          const businessIds = businessesArr.map((b) => b._id);
          if (businessIds.length > 0) {
            params.businessIds = JSON.stringify(businessIds);
          }
        }
      }

      // Add date filters based on the selected timeframe (will override if timeframe is set)
      const now = new Date();
      let startDate, endDate;

      if (activityTimeFrame === "Day") {
        // Current day: from start of today to end of today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59
        );
      } else if (activityTimeFrame === "Week") {
        // Current week: from Monday to Sunday
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        startDate = monday;
        endDate = sunday;
      } else if (activityTimeFrame === "Month") {
        // Current month: from 1st to last day of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        );
      } else if (activityTimeFrame === "Year") {
        // Current year: from Jan 1st to Dec 31st
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      }

      // Add date filters to params
      if (startDate && endDate) {
        params.startDate = startDate.toISOString().split("T")[0]; // YYYY-MM-DD format
        params.endDate = endDate.toISOString().split("T")[0];
      }

      console.log("📈 Final params for activity data:", params);
      console.log("📅 Date range:", {
        timeFrame: activityTimeFrame,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      console.log("Fetching contract activity data with params:", params);

      // Fetch analytics data for activity trends
      const analyticsResponse = await SalesContractServices.getSalesAnalytics({
        params,
      });
      console.log("📈 Activity Analytics - Raw Response:", analyticsResponse);
      const analyticsData = analyticsResponse?.data || {};

      // Fetch contracts for activity analysis (with date filters)
      const contractsResponse =
        await SalesContractServices.getAllSalesContracts({
          params: { ...params, limit: 1000 }, // Increase limit to get all contracts in date range
        });
      console.log("📈 Activity Contracts - Raw Response:", contractsResponse);
      const contracts = contractsResponse?.contracts || [];

      console.log("📈 Analytics data:", analyticsData);
      console.log("📈 Contracts for activity:", contracts);
      console.log("📈 Analytics response structure:", analyticsResponse?.data);
      console.log("📈 Contracts response structure:", contractsResponse);

      // Calculate total revenue in base currency
      let totalRevenue = 0;
      if (contracts.length > 0 && currencyReady) {
        contracts.forEach((contract) => {
          if (contract.productInfo && contract.productInfo.length > 0) {
            contract.productInfo.forEach((product) => {
              const currency = normalizeCurrencySymbol(
                product.selectedCurrency || product.currency
              );
              const amount = parseFloat(
                product.totalValue || product.amountInSelectedCurrency || 0
              );
              if (amount > 0) {
                totalRevenue += convertToBase(amount, currency);
              }
            });
          }
        });
      }

      // Generate activity data based on time frame
      const activityData = [];
      let timeGroups = {};

      console.log(
        "🔍 Total contracts for activity analysis:",
        contracts.length
      );
      console.log(
        "🔍 Sample contracts:",
        contracts.slice(0, 3).map((c) => ({
          id: c._id,
          contractDate: c.basicInfo?.contractDate || c.createdAt,
          date: new Date(
            c.basicInfo?.contractDate || c.createdAt
          ).toLocaleDateString(),
        }))
      );

      // Create activity pattern based on real data if available
      if (contracts.length > 0) {
        // Group contracts by time periods - use contractDate (agreement date) not createdAt
        contracts.forEach((contract, index) => {
          const contractDate = new Date(
            contract.basicInfo?.contractDate || contract.createdAt
          );
          let timeKey, label;

          console.log(
            `🔍 Contract ${
              index + 1
            }: Date=${contractDate.toLocaleDateString()}, ContractDate=${
              contract.basicInfo?.contractDate || contract.createdAt
            }`
          );

          if (activityTimeFrame === "Day") {
            // Group by hour (0-23)
            timeKey = contractDate.getHours();
            label = `${timeKey}:00`;
          } else if (activityTimeFrame === "Week") {
            // Group by day of week (0-6, Monday to Sunday)
            const dayOfWeek = contractDate.getDay();
            timeKey = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0, Sunday=6
            const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            label = dayNames[timeKey];
          } else if (activityTimeFrame === "Month") {
            // Group by day of month (1-31)
            timeKey = contractDate.getDate();
            label = `${timeKey}`;
            console.log(
              `🔍 Month grouping: Contract date=${contractDate.toLocaleDateString()}, Day=${timeKey}`
            );
          } else {
            // Year
            // Group by month (0-11)
            timeKey = contractDate.getMonth();
            const monthNames = [
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
            label = monthNames[timeKey];
          }

          if (!timeGroups[timeKey]) {
            timeGroups[timeKey] = { count: 0, value: 0, label: label };
          }
          timeGroups[timeKey].count += 1;

          if (
            contract.productInfo &&
            contract.productInfo.length > 0 &&
            currencyReady
          ) {
            contract.productInfo.forEach((product) => {
              const currency = normalizeCurrencySymbol(
                product.selectedCurrency || product.currency
              );
              const amount = parseFloat(
                product.totalValue || product.amountInSelectedCurrency || 0
              );
              if (amount > 0) {
                timeGroups[timeKey].value += convertToBase(amount, currency);
              }
            });
          }
        });

        // Create data points for the current time period
        if (activityTimeFrame === "Day") {
          // 24 hours (0-23)
          for (let i = 0; i < 24; i++) {
            const groupData = timeGroups[i] || { count: 0, value: 0 };
            activityData.push({
              name: `${i}:00`,
              value: groupData.value || 0,
              count: groupData.count || 0,
            });
          }
        } else if (activityTimeFrame === "Week") {
          // 7 days (Monday to Sunday)
          const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          for (let i = 0; i < 7; i++) {
            const groupData = timeGroups[i] || { count: 0, value: 0 };
            activityData.push({
              name: dayNames[i],
              value: groupData.value || 0,
              count: groupData.count || 0,
            });
          }
        } else if (activityTimeFrame === "Month") {
          // Days in current month
          const now = new Date();
          const daysInMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
          ).getDate();
          for (let i = 1; i <= daysInMonth; i++) {
            const groupData = timeGroups[i] || { count: 0, value: 0 };
            activityData.push({
              name: `${i}`,
              value: groupData.value || 0,
              count: groupData.count || 0,
            });
          }
        } else {
          // Year
          // 12 months
          const monthNames = [
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
          for (let i = 0; i < 12; i++) {
            const groupData = timeGroups[i] || { count: 0, value: 0 };
            activityData.push({
              name: monthNames[i],
              value: groupData.value || 0,
              count: groupData.count || 0,
            });
          }
        }
      } else {
        // No contracts found - show empty data points
        console.log("⚠️ No contracts found, showing empty chart");

        if (activityTimeFrame === "Day") {
          // 24 hours with no data
          for (let i = 0; i < 24; i++) {
            activityData.push({
              name: `${i}:00`,
              value: 0,
              count: 0,
            });
          }
        } else if (activityTimeFrame === "Week") {
          // 7 days with no data
          const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          for (let i = 0; i < 7; i++) {
            activityData.push({
              name: dayNames[i],
              value: 0,
              count: 0,
            });
          }
        } else if (activityTimeFrame === "Month") {
          // Days in current month with no data
          const now = new Date();
          const daysInMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
          ).getDate();

          for (let i = 1; i <= daysInMonth; i++) {
            activityData.push({
              name: `${i}`,
              value: 0,
              count: 0,
            });
          }
        } else {
          // Year
          // 12 months with no data
          const monthNames = [
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
          for (let i = 0; i < 12; i++) {
            activityData.push({
              name: monthNames[i],
              value: 0,
              count: 0,
            });
          }
        }
      }

      // Set contract activity data
      const currentValue = totalRevenue > 0 ? totalRevenue : 0;

      setContractActivity({
        value: Math.round(currentValue),
        trend: "up",
        data: activityData,
      });

      console.log("📊 Contract activity set:", {
        timeFrame: activityTimeFrame,
        value: Math.round(currentValue),
        dataPoints: activityData.length,
        firstFivePoints: activityData.slice(0, 5),
        dataWithValues: activityData
          .filter((d) => d.value > 0)
          .map((d) => ({ name: d.name, value: d.value })),
      });

      setActivityLoading(false);
    } catch (error) {
      console.error("Error fetching contract activity:", error);

      // Error occurred - show empty data
      console.log("❌ Error occurred, showing empty chart");
      const emptyData = [];

      if (activityTimeFrame === "Day") {
        // 24 hours with no data
        for (let i = 0; i < 24; i++) {
          emptyData.push({
            name: `${i}:00`,
            value: 0,
            count: 0,
          });
        }
      } else if (activityTimeFrame === "Week") {
        // 7 days with no data
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        for (let i = 0; i < 7; i++) {
          emptyData.push({
            name: dayNames[i],
            value: 0,
            count: 0,
          });
        }
      } else if (activityTimeFrame === "Month") {
        // Current month days with no data
        const now = new Date();
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
          emptyData.push({
            name: `${i}`,
            value: 0,
            count: 0,
          });
        }
      } else {
        // Year
        // 12 months with no data
        const monthNames = [
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
        for (let i = 0; i < 12; i++) {
          emptyData.push({
            name: monthNames[i],
            value: 0,
            count: 0,
          });
        }
      }

      setContractActivity({
        value: 0,
        trend: "up",
        data: emptyData,
      });
    } finally {
      setActivityLoading(false);
    }
  };

  // Fetch country sales data
  const fetchCountryData = async () => {
    if (!currencyReady) return; // Wait for currency rates to be ready

    setCountryLoading(true);
    try {
      // Use the SAME params structure as fetchOverviewStats to ensure consistency
      let params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        itemId: item,
        customerId: customer,
        origin,
        status:
          selectedStatuses.length > 0 ? selectedStatuses.join(",") : undefined,
        grade: selectedGrades.length > 0 ? selectedGrades.join(",") : undefined,
      };

      // Apply business filter - same logic as fetchOverviewStats
      if (selectedBusiness) {
        params.businessIds = [selectedBusiness];
      } else {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          const businessIds = businessesArr.map((b) => b._id);
          if (businessIds.length > 0) {
            params.businessIds = businessIds;
          }
        }
      }

      // Convert businessIds array to JSON string for API call
      if (params.businessIds && Array.isArray(params.businessIds)) {
        params.businessIds = JSON.stringify(params.businessIds);
      }

      console.log("🌍 Final params for country data:", params);

      console.log("Fetching country data with params:", params);

      // Get contracts data to analyze by countries
      // First get analytics to get the accurate total count - use same params format as fetchOverviewStats
      let analyticsParams = {
        startDate: params.startDate,
        endDate: params.endDate,
        itemId: params.itemId,
        customerId: params.customerId,
        origin: params.origin,
        status: params.status,
        grade: params.grade,
      };

      // Handle businessIds - convert to array format for analytics
      if (params.businessIds) {
        if (typeof params.businessIds === "string") {
          try {
            analyticsParams.businessIds = JSON.parse(params.businessIds);
          } catch (e) {
            analyticsParams.businessIds = [params.businessIds];
          }
        } else if (Array.isArray(params.businessIds)) {
          analyticsParams.businessIds = params.businessIds;
        }
      } else if (params.businessId) {
        analyticsParams.businessIds = [params.businessId];
      }

      const analyticsResponse = await SalesContractServices.getSalesAnalytics({
        params: analyticsParams,
      });
      const analyticsData = analyticsResponse?.data || {};
      const totalContracts = analyticsData.totalContracts || 0;

      console.log("🌍 Analytics data:", {
        totalContracts,
        analyticsParams,
      });

      // Fetch ALL contracts by making multiple API calls if needed
      // Use the same params format for getAllSalesContracts (businessIds as JSON string)
      let allContracts = [];
      let page = 1;
      const limit = 1000; // Fetch 1000 at a time
      let hasMorePages = true;
      let totalCountFromAPI = 0;

      while (hasMorePages && allContracts.length < totalContracts) {
        const contractsResponse =
          await SalesContractServices.getAllSalesContracts({
            params: { ...params, limit, page },
          });

        const contracts = contractsResponse?.contracts || [];
        const totalPages = contractsResponse?.totalPages || 1;
        totalCountFromAPI = contractsResponse?.totalCount || 0;

        console.log(
          `🌍 Fetching page ${page}/${totalPages}: Got ${contracts.length} contracts (Total: ${totalCountFromAPI})`
        );

        allContracts = [...allContracts, ...contracts];

        // Check if we've fetched all contracts
        if (
          page >= totalPages ||
          contracts.length === 0 ||
          allContracts.length >= totalCountFromAPI
        ) {
          hasMorePages = false;
        } else {
          page++;
        }
      }

      const contracts = allContracts;
      // Use the totalCountFromAPI from the last API response, or fallback to contracts.length
      const finalTotalCount =
        totalCountFromAPI > 0 ? totalCountFromAPI : contracts.length;

      console.log("🌍 Country Analysis - Final Results:", {
        totalContractsFromAnalytics: totalContracts,
        contractsFetched: contracts.length,
        totalCountFromAPI: finalTotalCount,
        match: contracts.length === totalContracts ? "✅ MATCH" : "⚠️ MISMATCH",
      });

      // If we didn't get all contracts, log a warning
      if (finalTotalCount < totalContracts) {
        console.warn(
          `⚠️ Only fetched ${finalTotalCount} contracts but total is ${totalContracts}. Missing ${
            totalContracts - finalTotalCount
          } contracts from country analysis.`
        );
      }

      // Log sample contracts to debug country data
      console.log("🌍 Contracts for country analysis:", {
        contractsReturned: contracts.length,
        totalCountFromAPI: finalTotalCount,
        totalContractsFromAnalytics: analyticsData.totalContracts,
        totalContractsUsed: totalContracts,
        sampleContracts: contracts.slice(0, 5).map((c) => ({
          id: c._id,
          contractNo: c.contractNo,
          origin_country: c.basicInfo?.origin_country,
          productInfo_origin_country: c.productInfo?.[0]?.origin_country,
          customer_country:
            c.basicInfo?.customer_id?.companyInfo?.countryOfIncorporation ||
            c.customer_id?.companyInfo?.countryOfIncorporation,
          hasBasicInfo: !!c.basicInfo,
          hasProductInfo: !!(c.productInfo && c.productInfo.length > 0),
          hasCustomer: !!(c.basicInfo?.customer_id || c.customer_id),
          customerIdType: c.basicInfo?.customer_id
            ? typeof c.basicInfo.customer_id
            : "none",
        })),
      });

      // Analyze contracts by country field
      const countryStats = {};
      let contractsWithCountry = 0;
      let contractsWithoutCountry = 0;

      contracts.forEach((contract, index) => {
        // Get country from various possible fields (based on your actual contract structure)
        // Priority: 1. basicInfo.origin_country, 2. productInfo[].origin_country, 3. customer countryOfIncorporation
        let country = null;

        // Try basicInfo.origin_country first
        if (contract.basicInfo?.origin_country) {
          country = contract.basicInfo.origin_country;
        }
        // Try productInfo origin_country
        else if (contract.productInfo && contract.productInfo.length > 0) {
          for (let product of contract.productInfo) {
            if (product.origin_country) {
              country = product.origin_country;
              break;
            }
          }
        }
        // Try customer's countryOfIncorporation (check both possible paths)
        else if (
          contract.basicInfo?.customer_id?.companyInfo?.countryOfIncorporation
        ) {
          country =
            contract.basicInfo.customer_id.companyInfo.countryOfIncorporation;
        } else if (contract.customer_id?.companyInfo?.countryOfIncorporation) {
          country = contract.customer_id.companyInfo.countryOfIncorporation;
        }

        // Default to Unknown if no country found
        if (!country) {
          country = "Unknown";
        }

        // Log for debugging (only first few contracts to avoid spam)
        if (index < 5) {
          console.log(
            `🔍 Contract ${index + 1} (${contract.contractNo}) country data:`,
            {
              origin_country: contract.basicInfo?.origin_country,
              productInfo_origin_country:
                contract.productInfo?.[0]?.origin_country,
              customer_country:
                contract.basicInfo?.customer_id?.companyInfo
                  ?.countryOfIncorporation ||
                contract.customer_id?.companyInfo?.countryOfIncorporation,
              detected: country,
              hasBasicInfo: !!contract.basicInfo,
              hasProductInfo: !!(
                contract.productInfo && contract.productInfo.length > 0
              ),
              hasCustomer: !!(
                contract.basicInfo?.customer_id || contract.customer_id
              ),
              customerId:
                contract.basicInfo?.customer_id?._id ||
                contract.customer_id?._id,
            }
          );
        }

        // Handle country codes and names - include ALL contracts, even those without country data
        let countryName = "Unknown";

        if (country && typeof country === "string") {
          country = country.trim();

          // Only process if country is not empty
          if (country && country !== "") {
            // Convert country code to readable name if it's a 2-letter code
            if (country.length === 2) {
              // Map common country codes to names
              const countryCodeMap = {
                AF: "Afghanistan",
                AE: "UAE",
                US: "United States",
                GB: "United Kingdom",
                IN: "India",
                PK: "Pakistan",
                BD: "Bangladesh",
                CN: "China",
                JP: "Japan",
                KR: "South Korea",
                TH: "Thailand",
                MY: "Malaysia",
                SG: "Singapore",
                ID: "Indonesia",
                PH: "Philippines",
                VN: "Vietnam",
                SA: "Saudi Arabia",
                TR: "Turkey",
                EG: "Egypt",
                NG: "Nigeria",
                ZA: "South Africa",
                BR: "Brazil",
                AR: "Argentina",
                MX: "Mexico",
                CA: "Canada",
                DE: "Germany",
                FR: "France",
                IT: "Italy",
                ES: "Spain",
                RU: "Russia",
                AU: "Australia",
                NZ: "New Zealand",
                AX: "Aland Islands",
              };
              countryName =
                countryCodeMap[country.toUpperCase()] || country.toUpperCase();
            } else {
              // If it's already a name, capitalize first letter
              countryName =
                country.charAt(0).toUpperCase() +
                country.slice(1).toLowerCase();
            }
          }
        }

        const countryKey = countryName.toLowerCase();

        if (!countryStats[countryKey]) {
          countryStats[countryKey] = {
            name: countryName,
            count: 0,
            totalValue: 0,
          };
        }

        countryStats[countryKey].count += 1;

        if (countryName === "Unknown") {
          contractsWithoutCountry++;
        } else {
          contractsWithCountry++;
        }

        // Calculate total value from productInfo in base currency
        if (
          contract.productInfo &&
          contract.productInfo.length > 0 &&
          currencyReady
        ) {
          contract.productInfo.forEach((product) => {
            const currency = normalizeCurrencySymbol(
              product.selectedCurrency || product.currency
            );
            const amount = parseFloat(
              product.totalValue || product.amountInSelectedCurrency || 0
            );
            if (amount > 0) {
              countryStats[countryKey].totalValue += convertToBase(
                amount,
                currency
              );
            }
          });
        }

        // Log only for first few contracts to avoid spam
        if (index < 5) {
          console.log(
            `✅ Added contract ${contract.contractNo} to ${countryName} (${country}), total count: ${countryStats[countryKey].count}`
          );
        }
      });

      // Calculate total contracts counted in countryStats
      const totalContractsInStats = Object.values(countryStats).reduce(
        (sum, country) => sum + country.count,
        0
      );

      console.log("🌍 Country stats summary:", {
        totalContractsFromAnalytics: totalContracts,
        contractsProcessed: contracts.length,
        contractsCountedInStats: totalContractsInStats,
        contractsWithCountry,
        contractsWithoutCountry,
        countriesFound: Object.keys(countryStats).length,
        missingContracts: totalContracts - totalContractsInStats,
        countryStatsBreakdown: Object.keys(countryStats).map((key) => ({
          name: countryStats[key].name,
          count: countryStats[key].count,
        })),
      });

      // Convert to arrays for top countries
      // Include ALL countries including "Unknown" - don't filter it out
      const allCountriesArray = Object.values(countryStats)
        .map((country) => ({
          name: country.name,
          value:
            totalContracts > 0
              ? Math.round((country.count / totalContracts) * 100)
              : 0,
          count: country.count,
          totalValue: country.totalValue,
          color: country.name === "Unknown" ? "#9CA3AF" : "var(--p-blue)", // Gray for Unknown
        }))
        .sort((a, b) => {
          // Sort Unknown to the end, then by count descending
          if (a.name === "Unknown") return 1;
          if (b.name === "Unknown") return -1;
          return b.count - a.count;
        });

      console.log("🌍 Final country array:", {
        totalCountries: allCountriesArray.length,
        countries: allCountriesArray.map((c) => `${c.name}: ${c.count}`),
        totalCount: allCountriesArray.reduce((sum, c) => sum + c.count, 0),
      });

      // Top 10 for sidebar
      const top10Countries = allCountriesArray.slice(0, 10);
      // Top 20 for main chart
      const top20Countries = allCountriesArray.slice(0, 20);

      console.log("Processed country data:", {
        total: allCountriesArray.length,
        top5: top10Countries,
        top20: top20Countries.length,
      });

      if (allCountriesArray.length > 0) {
        setCountryData(top10Countries);
        setTop20Countries(top20Countries);
      } else {
        setCountryData([]);
        setTop20Countries([]);
      }
    } catch (error) {
      console.error("Error fetching country data:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Show empty country data if API fails
      setCountryData([]);
      setTop20Countries([]);
    } finally {
      setCountryLoading(false);
    }
  };

  const format_Amount = (amount) => {
    if (!amount || isNaN(amount)) return "0";
    const numAmount = parseFloat(amount);
    if (numAmount >= 1000000) {
      return `${(numAmount / 1000000).toFixed(1)}M`;
    } else if (numAmount >= 1000) {
      return `${(numAmount / 1000).toFixed(1)}k`;
    }
    return numAmount.toString();
  };

  // Fetch customers by country
  const fetchCustomersByCountry = async () => {
    setCustomersLoading(true);
    try {
      const response = await CustomerServices.getCustomersByCountry();
      const countries = response?.countries || [];
      // Map to chart format
      const allCountriesArray = countries
        .map((country) => ({
          name: country._id || "Unknown",
          value:
            countries.length > 0
              ? Math.round(
                  (country.count /
                    countries.reduce((acc, c) => acc + c.count, 0)) *
                    100
                )
              : 0,
          count: country.count,
          customers: country.customers,
          color: "var(--p-blue)",
        }))
        .sort((a, b) => b.count - a.count);
      setCustomerCountryData(allCountriesArray.slice(0, 10));
      setTopCustomerCountries(allCountriesArray.slice(0, 20));
    } catch (error) {
      setCustomerCountryData([]);
      setTopCustomerCountries([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  // Fetch most recent 10 customers
  const fetchNewCustomers = async () => {
    setCustomersLoading(true);
    try {
      const response = await CustomerServices.getRecentCustomers();
      setNewCustomers(response?.customers || []);
    } catch (error) {
      setNewCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  // Fetch customers with regions for map
  const fetchCustomersWithRegions = async () => {
    try {
      // Build query params
      let params = {};
      if (selectedBusiness) {
        params.businessId = selectedBusiness;
      } else {
        // Get all assigned businesses from localStorage
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          const businessIds = businessesArr.map((b) => b._id);
          if (businessIds.length > 0) {
            params.businessIds = JSON.stringify(businessIds);
          }
        }
      }

      // Fetch customers and regions in parallel
      const [customersResponse, regionsResponse] = await Promise.all([
        axios.get(`${Base_URL}/customers`, { params }),
        axios.get(`${Base_URL}/regions`).catch(() => ({ data: { data: [] } })),
      ]);

      const customers = customersResponse?.data?.customers || [];
      const allRegions = regionsResponse?.data?.data || [];

      // Create a map of region IDs to region names for lookup
      const regionMap = new Map();
      allRegions.forEach((region) => {
        regionMap.set(region._id, region.name);
      });

      console.log("📊 Total customers fetched:", customers.length);
      console.log("🌍 Total regions available:", allRegions.length);

      // Filter customers with region data and map to the format expected by RegionMap
      const customersWithRegionData = customers
        .filter((c) => {
          const regionId = c.basicInformation?.region;
          const hasRegion = regionId && regionId.trim() !== "";
          const hasCoordinates =
            c.basicInformation?.regionCoordinates?.lat != null &&
            c.basicInformation?.regionCoordinates?.lng != null &&
            !isNaN(parseFloat(c.basicInformation.regionCoordinates.lat)) &&
            !isNaN(parseFloat(c.basicInformation.regionCoordinates.lng));

          if (hasRegion && !hasCoordinates) {
            console.log("⚠️ Customer has region ID but no coordinates:", {
              name:
                c.basicInformation?.customerDisplayName ||
                c.basicInformation?.companyName,
              regionId: regionId,
              regionCoordinates: c.basicInformation?.regionCoordinates,
            });
          }

          if (!hasRegion) {
            console.log(
              "⚠️ Customer has no region:",
              c.basicInformation?.customerDisplayName ||
                c.basicInformation?.companyName
            );
          }

          return hasRegion && hasCoordinates;
        })
        .map((c) => {
          const lat = parseFloat(c.basicInformation.regionCoordinates.lat);
          const lng = parseFloat(c.basicInformation.regionCoordinates.lng);
          const regionId = c.basicInformation.region;
          const regionName = regionMap.get(regionId) || regionId || "Unknown";

          return {
            id: c._id,
            name:
              c.basicInformation?.customerDisplayName ||
              c.basicInformation?.companyName ||
              "Unknown",
            region: regionName,
            email: c.basicInformation?.customerEmail || "",
            phone:
              c.basicInformation?.customerPhone?.mobile ||
              c.basicInformation?.customerPhone?.workPhone ||
              "",
            type: c.basicInformation?.client_type || "",
            coordinates: {
              lat: lat,
              lng: lng,
            },
          };
        });

      console.log(
        "📍 Customers with region data:",
        customersWithRegionData.length
      );
      if (customersWithRegionData.length > 0) {
        console.log(
          "✅ Sample customer with region:",
          customersWithRegionData[0]
        );
      } else {
        console.log(
          "⚠️ No customers found with region data. Checking sample customer..."
        );
        if (customers.length > 0) {
          const sample = customers[0];
          console.log("Sample customer structure:", {
            hasBasicInfo: !!sample.basicInformation,
            region: sample.basicInformation?.region,
            regionCoordinates: sample.basicInformation?.regionCoordinates,
            fullBasicInfo: sample.basicInformation,
          });
        }
      }

      setCustomersWithRegions(customersWithRegionData);
    } catch (error) {
      console.error("❌ Error fetching customers with regions:", error);
      console.error("Error details:", error.response?.data || error.message);
      setCustomersWithRegions([]);
    }
  };

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const params = {
          businessIds: selectedBusiness ? [selectedBusiness] : [],
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          itemId: item,
          customerId: customer,
          origin,
          status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
          grade: selectedGrades.length > 0 ? selectedGrades : undefined,
        };

        console.log("Fetching analytics with params:", params);

        if (!selectedBusiness) {
          // Get all assigned businesses from localStorage
          const storedBusinesses = localStorage.getItem("businesses");
          if (storedBusinesses) {
            const businessesArr = JSON.parse(storedBusinesses);
            const businessIds = businessesArr.map((b) => b._id);
            if (businessIds.length > 0) {
              params.businessIds = businessIds;
            }
          }
        }

        const response = await SalesContractServices.getSalesAnalytics({
          params,
        });
        console.log("Full API response:", response);
        console.log("Response data:", response?.data);

        if (response && response.data) {
          setAnalyticsData(response.data);
        } else {
          console.warn("No data received from API");
          setAnalyticsData({});
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
        console.error("Full API response:", error.response);
        setAnalyticsData({});
      } finally {
        setAnalyticsLoading(false);
      }
    };

    console.log("🔄 Starting data fetch for OverViewSales...");
    console.log("📊 Filters:", {
      selectedBusiness,
      dateRange,
      item,
      customer,
      origin,
      selectedStatuses,
      selectedGrades,
    });

    // On initial load, show full page loading
    if (isInitialLoad) {
      setLoading(true);
      Promise.all([
        fetchAnalytics(),
        fetchOverviewStats(),
        fetchNewContracts(),
        fetchContractActivity(),
        fetchCountryData(),
        fetchCustomersByCountry(),
        fetchNewCustomers(),
        fetchCustomersWithRegions(),
      ]).finally(() => {
        setLoading(false);
        setIsInitialLoad(false);
      });
    } else {
      // On filter change, only reload individual components
      fetchAnalytics();
      fetchOverviewStats();
      fetchNewContracts();
      fetchContractActivity();
      fetchCountryData();
      fetchCustomersByCountry();
      fetchNewCustomers();
      fetchCustomersWithRegions();
    }
  }, [
    selectedBusiness,
    dateRange,
    item,
    customer,
    origin,
    selectedStatuses,
    selectedGrades,
    currencyReady,
  ]);

  // Fetch activity data when timeframe changes
  useEffect(() => {
    if (currencyReady) {
      console.log("⏰ Activity timeframe changed to:", activityTimeFrame);
      fetchContractActivity();
    }
  }, [activityTimeFrame, currencyReady]);

  // Fetch customer options
  const fetchCustomerOptions = async (businessId) => {
    try {
      let customers = [];
      if (businessId) {
        const response = await axios.get(
          `${Base_URL}/customers?businessId=${businessId}&active=true`
        );
        customers = response.data.customers || [];
      } else {
        // Get all assigned businesses from localStorage
        let businessIds = [];
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          businessIds = businessesArr.map((b) => b._id);
        }
        let params = {};
        if (businessIds.length > 0) {
          params.businessIds = businessIds;
        }
        const response = await axios.get(`${Base_URL}/customers`, { params });
        customers = response.data.customers || response.data || [];
      }
      setCustomerOptions(
        customers.map((customer) => ({
          value: customer._id,
          label:
            customer?.basicInformation?.companyName ||
            customer?.basicInformation?.vendorDisplayName ||
            "Unknown Customer",
        })) || []
      );
    } catch (err) {
      console.error("Error fetching customers:", err);
      setCustomerOptions([]);
    }
  };

  // Fetch item options
  const fetchItemOptions = async (businessId) => {
    try {
      let items = [];
      if (businessId) {
        const response = await axios.get(
          `${Base_URL}/items?businessId=${businessId}&active=true`
        );
        items = response.data || [];
      } else {
        // Get all assigned businesses from localStorage
        let businessIds = [];
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          businessIds = businessesArr.map((b) => b._id);
        }
        let params = {};
        if (businessIds.length > 0) {
          params.businessIds = businessIds;
        }
        const response = await axios.get(`${Base_URL}/items`, { params });
        items = response.data.items || response.data || [];
      }
      setItemOptions(
        items.map((item) => ({
          value: item._id,
          label: `${item.name} (${item.grade || "-"}) ${item.packing || "-"} ${
            item.remarks || ""
          }`,
        })) || []
      );

      // Extract unique grades from items
      const uniqueGrades = [
        ...new Set(
          items
            .map((item) => item.grade)
            .filter((grade) => grade && grade.trim() !== "")
        ),
      ];
      setGradeOptions(
        uniqueGrades
          .map((grade) => ({
            value: grade,
            label: grade,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
    } catch (err) {
      console.error("Error fetching items:", err);
      setItemOptions([]);
      setGradeOptions([]);
    }
  };

  useEffect(() => {
    if (selectedBusiness) {
      fetchCustomerOptions(selectedBusiness);
      fetchItemOptions(selectedBusiness);
    } else {
      fetchCustomerOptions();
      fetchItemOptions();
    }
  }, [selectedBusiness]);

  useEffect(() => {
    fetchCustomerOptions();
    fetchItemOptions();
  }, []);

  const filtersData = useMemo(() => {
    return {
      item: {
        value: item,
        options: itemOptions,
      },
      customer: {
        value: customer,
        options: customerOptions,
      },
      origin: {
        value: origin,
        options: worldPortsOptions,
      },
      dateRange,
    };
  }, [
    item,
    customer,
    origin,
    dateRange,
    itemOptions,
    customerOptions,
    worldPortsOptions,
  ]);

  // Debug effect to monitor data changes
  useEffect(() => {
    console.log("Analytics data updated:", analyticsData);
    console.log("Data keys:", Object.keys(analyticsData));
    if (analyticsData.byCustomer) {
      console.log("Customer data length:", analyticsData.byCustomer.length);
    }
    if (analyticsData.byItem) {
      console.log("Item data length:", analyticsData.byItem.length);
    }
  }, [analyticsData]);

  // Prepare donut chart data with real values only
  const donutData = [
    {
      name: t("sales.totalSales"),
      value: overviewStats.totalSales / 1000000 || 0,
      color: "var(--p-blue)",
    },
    {
      name: t("sales.totalSalesContracts"),
      value: overviewStats.totalContracts || 0,
      color: "#3CD856",
    },
    {
      name: t("sales.last7Days"),
      value: overviewStats.last7DaysContracts || 0,
      color: "#FF947A",
    },
    {
      name: t("sales.withoutPurchases"),
      value: overviewStats.unassigned || 0,
      color: "#A855F7",
    },
  ];

  // Format price for display in tables
  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "0.00";
    return parseFloat(price).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleExport = () => {
    // Add export functionality here
    console.log("Export sales overview data");
  };

  // Show first 10 contracts only
  const displayedContracts = useMemo(() => {
    return newContracts.slice(0, 10);
  }, [newContracts]);

  // Removed handleCountryClick - no longer needed without WorldMap

  return loading ? (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loading loading={loading} />
    </div>
  ) : (
    <div className="space-y-6">
      {/* Filters Section - Moved to Top */}
      <div className="bg-white rounded-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">{t("common.filters")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <FormInput
            type="select"
            label={t("Business")}
            direction="column"
            isBusinessDropdown={true}
            businessDropdownProps={{
              adminId: adminInfo?.id,
              selectedBusiness,
              onChange: (value) => {
                setSelectedBusiness(value);
                // Clear all other filters when business filter is reset or changed
                setItem("");
                setCustomer("");
                setOrigin("");
                setDateRange({ startDate: "", endDate: "" });
                setSelectedStatuses([]);
                setSelectedGrades([]);
              },
              setAssignedBusinesses: setAssignedBusinesses,
            }}
          />
          <FormInput
            type="select"
            label={t("item.title")}
            direction="column"
            options={itemOptions}
            placeholder={t("item.title")}
            value={item}
            onChange={setItem}
            isClearable
          />
          <FormInput
            type="select"
            label={t("common.customer")}
            direction="column"
            options={customerOptions}
            placeholder={t("common.customer")}
            value={customer}
            onChange={setCustomer}
            isClearable
          />
          <FormInput
            type="select"
            label={t("common.origin")}
            direction="column"
            options={worldPortsOptions}
            placeholder={t("common.origin")}
            value={origin}
            onChange={setOrigin}
            isClearable
          />
          <FormInput
            label={t("common.dateRange")}
            direction="column"
            type="date-range"
            initialStartDate={dateRange.startDate}
            initialEndDate={dateRange.endDate}
            onChange={(value) => {
              setDateRange({
                startDate: value.startDate,
                endDate: value.endDate,
              });
            }}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            type="select"
            label={t("Status")}
            direction="column"
            options={statusOptions}
            placeholder={t("common.selectStatuses")}
            value={selectedStatuses}
            onChange={(value) => {
              // Handle multi-select - value can be array or single value
              const statusArray = Array.isArray(value)
                ? value
                : value
                ? [value]
                : [];
              setSelectedStatuses(statusArray);
            }}
            isMulti={true}
            isClearable
          />
          <FormInput
            type="select"
            label={t("item.grade")}
            direction="column"
            options={gradeOptions}
            placeholder={t("common.selectGrades")}
            value={selectedGrades}
            onChange={(value) => {
              // Handle multi-select - value can be array or single value
              const gradeArray = Array.isArray(value)
                ? value
                : value
                ? [value]
                : [];
              setSelectedGrades(gradeArray);
            }}
            isMulti={true}
            isClearable
          />
        </div>
      </div>

      {/* Sales Overview Section */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">
            {t("sales.overview")}
          </h2>
          {overviewLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
              <span>{t("common.updating")}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 flex-1">
            {/* Total Sales Card */}
            <div className="bg-[#f8f8e1] rounded-lg p-3">
              <div className="bg-[var(--p-blue)] w-10 h-10 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"></path>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
              <div className="text-lg font-bold text-gray-800 mb-1">
                {formatAmount(overviewStats.totalSales)}{" "}
                {baseCurrency.toUpperCase()}
              </div>
              <div className="text-gray-600 text-xs">
                {t("sales.totalSalesBaseCurrency")}
              </div>
            </div>

            {/* Total Sales Contracts Card */}
            <div className="bg-[#DCFCE7] rounded-lg p-3">
              <div className="bg-[#3CD856] w-10 h-10 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-6a1 1 0 00-1-1H9a1 1 0 00-1 1v6a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
              <div className="text-lg font-bold text-gray-800 mb-1">
                {overviewStats.totalContracts}
              </div>
              <div className="text-gray-600 text-xs">{t("sales.totalSalesContracts")}</div>
            </div>

            {/* Last 7 Days Contracts Card */}
            <div className="bg-[#FFF4DE] rounded-lg p-3">
              <div className="bg-[#FF947A] w-10 h-10 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
              <div className="text-lg font-bold text-gray-800 mb-1">
                {overviewStats.last7DaysContracts}
              </div>
              <div className="text-gray-600 text-xs">{t("sales.last7Days")}</div>
            </div>

            {/* Unassigned Card */}
            <div className="bg-[#F3E8FF] rounded-lg p-3">
              <div className="bg-[#A855F7] w-10 h-10 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
              <div className="text-lg font-bold text-gray-800 mb-1">
                {overviewStats.unassigned}
              </div>
              <div className="text-gray-600 text-xs">{t("sales.unassigned")}</div>
            </div>
          </div>

          {/* Donut Chart with Legend */}
          <div className="flex items-center gap-3 bg-white rounded-lg p-3">
            {/* Donut Chart */}
            <div className="relative flex items-center justify-center">
              <div className="w-44 h-44 flex items-center justify-center">
                <ResponsiveContainer width={176} height={176}>
                  <PieChart width={176} height={176}>
                    <Pie
                      data={donutData}
                      cx={88}
                      cy={88}
                      innerRadius={65}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={450}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-lg font-bold text-gray-800">
                    {format_Amount(overviewStats.totalSales)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {t("sales.totalSales")} ({baseCurrency.toUpperCase()})
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--p-blue)]"></div>
                  <span className="text-gray-700 text-xs">{t("sales.totalSales")}</span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {formatAmount(overviewStats.totalSales)}{" "}
                  {baseCurrency.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#3CD856]"></div>
                  <span className="text-gray-700 text-xs">
                    {t("sales.totalSalesContracts")}
                  </span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {overviewStats.totalContracts}
                </span>
              </div>
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF947A]"></div>
                  <span className="text-gray-700 text-xs">{t("sales.last7Days")}</span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {overviewStats.last7DaysContracts}
                </span>
              </div>
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#A855F7]"></div>
                  <span className="text-gray-700 text-xs">
                    {t("sales.withoutPurchases")}
                  </span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {overviewStats.unassigned}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Contracts by Country and New Contracts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Contracts by Country */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {t("sales.contractsByCountry")}
            </h3>
            {countryLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>{t("common.updating")}</span>
              </div>
            )}
          </div>

          {/* Top 20 Countries Chart */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {t("sales.top20CountriesByContracts")}
            </h4>
            <div className="w-full h-72 bg-gray-50 rounded-lg border border-gray-200 p-4">
              {top20Countries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={top20Countries}
                    margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  >
                    <defs>
                      <linearGradient
                        id="countryColorGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--p-blue)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--p-blue)"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{
                        fontSize: 11,
                        fill: "#6B7280",
                        angle: -30,
                        textAnchor: "end",
                      }}
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="text-sm font-medium text-gray-900">
                                {label}
                              </p>
                              <p className="text-sm text-[var(--p-blue)]">
                                Contracts: {data.count}
                              </p>
                              <p className="text-sm text-gray-600">
                                Percentage: {data.value}%
                              </p>
                              <p className="text-sm text-gray-600">
                                Total Value: {formatAmount(data.totalValue)}{" "}
                                {baseCurrency.toUpperCase()}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--p-blue)"
                      strokeWidth={3}
                      fill="url(#countryColorGradient)"
                      dot={{ fill: "var(--p-blue)", strokeWidth: 0, r: 4 }}
                      activeDot={{
                        r: 6,
                        stroke: "var(--p-blue)",
                        strokeWidth: 2,
                        fill: "var(--p-blue)",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <p className="text-sm">{t("sales.noCountryDataAvailable")}</p>
                    <p className="text-xs mt-1">
                      {t("sales.dataWillAppearWhenContractsCreated")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top 10 Countries */}
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4">
              {t("sales.top10Countries")}
            </h4>
            <div className="space-y-3">
              {countryData.length > 0 ? (
                countryData.map((country, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className={`px-4 py-2 rounded-full text-white text-sm font-semibold min-w-[100px] text-center ${
                        country.count >= 5
                          ? "bg-[var(--p-blue)]"
                          : "bg-gray-800"
                      }`}
                    >
                      {country.name}
                    </div>
                    <div className="flex-1 mx-2">
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                          className="h-4 rounded-full transition-all duration-500"
                          style={{
                            width: `${country.value}%`,
                            backgroundColor:
                              country.count >= 5 ? "var(--p-blue)" : "#1F2937",
                          }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 min-w-[60px] text-right">
                      {country.count} ({country.value}%)
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">{t("sales.noCountryDataAvailable")}</p>
                  <p className="text-xs mt-1">
                    {t("sales.dataWillAppearWhenContractsCreated")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Contracts */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {t("sales.newContracts")}
            </h3>
            {contractsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>{t("common.updating")}</span>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    #
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.contractNo")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.buyer")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.quantity")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.price")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.perMTS")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedContracts.length > 0 ? (
                  displayedContracts.map((contract, index) => (
                    <tr
                      key={contract.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-3 text-gray-900 font-semibold text-sm">
                        {contract.id}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm font-medium">
                        {contract.contractNo}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {contract.buyerName}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {contract.quantity !== "N/A"
                          ? formatAmount(contract.quantity)
                          : "N/A"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {formatAmount(contract.price)}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {formatAmount(contract.perMetricTon)}
                      </td>
                      <td className="py-4 px-3">
                        <button
                          className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                          onClick={() =>
                            history.push({
                              pathname: "/view-sales-contract",
                              state: { contractId: contract._id },
                            })
                          }
                          title="View Contract Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-500">
                      <div>
                        <p className="text-sm">{t("sales.noContractsAvailable")}</p>
                        <p className="text-xs mt-1">
                          {t("sales.newContractsWillAppearHere")}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Show contract count */}
          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600 font-medium">
              {displayedContracts.length > 0
                ? t("sales.showingRecentContracts", { count: displayedContracts.length })
                : t("sales.noContractsToDisplay")}
            </div>
          </div>
        </div>
      </div>

      {/* Contracts Activity */}
      <div className="bg-white rounded-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {t("sales.contractsActivity")}
          </h3>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {["Day", "Week", "Month", "Year"].map((timeFrame) => (
              <button
                key={timeFrame}
                onClick={() => setActivityTimeFrame(timeFrame)}
                className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                  activityTimeFrame === timeFrame
                    ? "bg-[var(--p-blue)] text-white"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-200"
                }`}
              >
                {timeFrame === "Day" ? t("common.day") : timeFrame === "Week" ? t("common.week") : timeFrame === "Month" ? t("common.month") : t("common.year")}
              </button>
            ))}
          </div>
        </div>

        {activityLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--p-blue)]"></div>
                <span className="text-gray-600 font-medium">
                {t("sales.loadingActivityData")}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-6">
            {/* Value Only */}
            <div className="flex-shrink-0">
              <div className="text-6xl font-black text-gray-900 mb-2 tracking-tight">
                {formatAmount(contractActivity.value)}{" "}
                {baseCurrency.toUpperCase()}
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-green-500 text-base font-bold">
                  {t("common.trendingUp")}
                </span>
              </div>
            </div>

            {/* Area Chart */}
            <div className="flex-1">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={contractActivity.data}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--p-blue)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--p-blue)"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    />
                    <YAxis hide />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="text-sm text-gray-600">{`Point: ${label}`}</p>
                              <p className="text-sm font-medium text-[var(--p-blue)]">
                                {`Value: ${formatAmount(
                                  Math.round(payload[0].value)
                                )} ${baseCurrency.toUpperCase()}`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--p-blue)"
                      strokeWidth={3}
                      fill="url(#colorGradient)"
                      dot={{ fill: "var(--p-blue)", strokeWidth: 0, r: 4 }}
                      activeDot={{
                        r: 6,
                        stroke: "var(--p-blue)",
                        strokeWidth: 2,
                        fill: "var(--p-blue)",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Section */}
      <div>
        <SalesAnalyticsChart
          title={t("sales.analytics")}
          data={analyticsData}
          loading={analyticsLoading}
          filtersData={filtersData}
        />
      </div>

      {/* Customers Map Section */}
      <div className="bg-white rounded-lg p-6 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {t("sales.customersByRegion")}
          </h3>
          <div className="text-sm text-gray-600">
            {customersWithRegions.length} {t("sales.customersWithLocationData")}
          </div>
        </div>
        <RegionMap
          data={customersWithRegions}
          height="650px"
          markerColor="var(--p-blue)"
          title={t("sales.customersByRegion")}
        />
      </div>

      {/* Customers by Country and New Customers Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customers by Country */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {t("sales.customersByCountry")}
            </h3>
            {customersLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>{t("common.updating")}</span>
              </div>
            )}
          </div>

          {/* Top 20 Countries Chart */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {t("sales.top20CountriesByCustomers")}
            </h4>
            <div className="w-full h-72 bg-gray-50 rounded-lg border border-gray-200 p-4">
              {topCustomerCountries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={topCustomerCountries}
                    margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  >
                    <defs>
                      <linearGradient
                        id="countryColorGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--p-blue)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--p-blue)"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{
                        fontSize: 11,
                        fill: "#6B7280",
                        angle: -30,
                        textAnchor: "end",
                      }}
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="text-sm font-medium text-gray-900">
                                {label}
                              </p>
                              <p className="text-sm text-[var(--p-blue)]">
                                Customers: {data.count}
                              </p>
                              <p className="text-sm text-gray-600">
                                Percentage: {data.value}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--p-blue)"
                      strokeWidth={3}
                      fill="url(#countryColorGradient)"
                      dot={{ fill: "var(--p-blue)", strokeWidth: 0, r: 4 }}
                      activeDot={{
                        r: 6,
                        stroke: "var(--p-blue)",
                        strokeWidth: 2,
                        fill: "var(--p-blue)",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <p className="text-sm">{t("sales.noCustomerDataAvailable")}</p>
                    <p className="text-xs mt-1">
                      {t("sales.dataWillAppearWhenCustomersCreated")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top 10 Countries */}
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4">
              {t("sales.top10CountriesByCustomers")}
            </h4>
            <div className="space-y-3">
              {customerCountryData.length > 0 ? (
                customerCountryData.map((country, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className={`px-4 py-2 rounded-full text-white text-sm font-semibold min-w-[100px] text-center ${
                        country.count >= 5
                          ? "bg-[var(--p-blue)]"
                          : "bg-gray-800"
                      }`}
                    >
                      {country.name}
                    </div>
                    <div className="flex-1 mx-2">
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                          className="h-4 rounded-full transition-all duration-500"
                          style={{
                            width: `${country.value}%`,
                            backgroundColor:
                              country.count >= 5 ? "var(--p-blue)" : "#1F2937",
                          }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 min-w-[60px] text-right">
                      {country.count} ({country.value}%)
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">{t("sales.noCountryDataAvailable")}</p>
                  <p className="text-xs mt-1">
                    {t("sales.dataWillAppearWhenCustomersCreated")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Customers */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {t("sales.newCustomers")}
            </h3>
            {customersLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>{t("common.updating")}</span>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    #
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.customer")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.company")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.email")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.country")}
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    {t("common.createdAt")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {newCustomers.length > 0 ? (
                  newCustomers.map((customer, index) => (
                    <tr
                      key={customer._id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-3 text-gray-900 font-semibold text-sm">
                        {index + 1}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm font-medium">
                        {customer.basicInformation?.customerDisplayName || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {customer.basicInformation?.companyName || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {customer.basicInformation?.customerEmail || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {customer.companyInfo?.countryOfIncorporation || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {formatDate(customer.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500">
                      <div>
                        <p className="text-sm">{t("sales.noCustomersAvailable")}</p>
                        <p className="text-xs mt-1">
                          {t("sales.newCustomersWillAppearHere")}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Show Customers count */}
          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600 font-medium">
              {newCustomers.length > 0
                ? t("sales.showingRecentCustomers", { count: newCustomers.length })
                : t("sales.noCustomersToDisplay")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
