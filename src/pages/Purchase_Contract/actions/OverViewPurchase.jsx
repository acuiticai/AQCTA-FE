import { useState, useEffect, useContext, useMemo, useCallback } from "react";
import PurchaseAnalyticsChart from "./PurchaseAnalyticsChart";
import SalesContractServices from "@/services/SalesContractServices";
import VendorServices from "@/services/VendorServices";
import ItemsServices from "@/services/ItemsServices";
import worldPorts from "@/data/world-ports";

import { FormInput } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import CustomerServices from "@/services/CustomerServices";
import axios from "axios";
import PurchaseContractServices from "@/services/PurchaseContractServices";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatAmount, formatDate } from "@/components/formatAmount";
import Loading from "@/components/preloader/Loading";
import RegionMap from "@/components/RegionMap";

export default function OverViewSales() {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [analyticsData, setAnalyticsData] = useState({});
  const [loading, setLoading] = useState(true); // Initial page load only
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [countryLoading, setCountryLoading] = useState(false);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [assignedBusinesses, setAssignedBusinesses] = useState([]);
  const [item, setItem] = useState("");
  const [itemOptions, setItemOptions] = useState([]);
  const [vendor, setVendor] = useState("");
  const [vendorOptions, setVendorOptions] = useState([]);
  const [origin, setOrigin] = useState("");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [gradeOptions, setGradeOptions] = useState([]);

  // Status options for purchase contracts
  const statusOptions = [
    { value: "Draft", label: "Draft" },
    {
      value: "Waiting Management Approval",
      label: "Waiting Management Approval",
    },
    { value: "Pending Management Review", label: "Pending Management Review" },
    { value: "Pending Accounts Review", label: "Pending Accounts Review" },
    {
      value: "Amendments Requested (Management)",
      label: "Amendments Requested (Management)",
    },
    {
      value: "Amendments Requested (Accounts)",
      label: "Amendments Requested (Accounts)",
    },
    { value: "Rejected (Management)", label: "Rejected (Management)" },
    { value: "Rejected (Accounts)", label: "Rejected (Accounts)" },
    { value: "Preparing Contract", label: "Preparing Contract" },
    { value: "Waiting Vendor Approval", label: "Waiting Vendor Approval" },
    { value: "Pending", label: "Pending" },
    { value: "Processing", label: "Processing" },
    { value: "On-hold", label: "On-hold" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "Completed", label: "Completed" },
  ];
  const [overviewStats, setOverviewStats] = useState({
    totalPurchases: 0,
    totalContracts: 0,
    last7DaysContracts: 0,
    unassigned: 0,
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

  // --- Add state for country and vendor analytics ---
  const [countryData, setCountryData] = useState([]);
  const [top20Countries, setTop20Countries] = useState([]);
  const [newContracts, setNewContracts] = useState([]);
  const [vendorCountryData, setVendorCountryData] = useState([]);
  const [topVendorCountries, setTopVendorCountries] = useState([]);
  const [newVendors, setNewVendors] = useState([]);
  const [vendorsWithRegions, setVendorsWithRegions] = useState([]);
  const [originCountryData, setOriginCountryData] = useState([]);
  const [topOriginCountries, setTopOriginCountries] = useState([]);
  // --- Activity Section State ---
  const [contractActivity, setContractActivity] = useState({
    value: 0,
    trend: "up",
    data: [],
  });
  const [activityTimeFrame, setActivityTimeFrame] = useState("Month");
  const [activityLoading, setActivityLoading] = useState(false);

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
        vendorId: vendor,
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
      const analyticsResponse =
        await PurchaseContractServices.getPurchaseAnalytics({ params });
      const analyticsData = analyticsResponse?.data || {};

      // Fetch contracts to convert totalPurchases to base currency
      let totalPurchasesBase = 0;
      try {
        // Fetch all contracts to calculate total purchases in base currency
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
            await PurchaseContractServices.getAllPurchaseContracts({
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
                totalPurchasesBase += convertToBase(amount, currency);
              }
            });
          }
        });
      } catch (error) {
        console.error("Error converting purchases to base currency:", error);
        // Fallback to original totalRevenue if conversion fails
        totalPurchasesBase = analyticsData.totalRevenue || 0;
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
      const last7DaysResponse =
        await PurchaseContractServices.getPurchaseAnalytics({
          params: last7DaysParams,
        });
      const last7DaysData = last7DaysResponse?.data || {};

      // Fetch contracts without sales assignments - using real data from database
      let unassignedParams = {
        salesFilter: "without_sales",
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
      if (params.vendorId) {
        unassignedParams.vendorId = params.vendorId;
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
        await PurchaseContractServices.getAllPurchaseContracts({
          params: unassignedParams,
        });
      const unassignedCount = unassignedResponse?.totalCount || 0;

      setOverviewStats({
        totalPurchases:
          totalPurchasesBase > 0
            ? totalPurchasesBase
            : analyticsData.totalRevenue || 0,
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
          vendorId: vendor,
          origin,
          status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
          grade: selectedGrades.length > 0 ? selectedGrades : undefined,
        };

        console.log("Fetching analytics with params:", params);
        const response = await PurchaseContractServices.getPurchaseAnalytics({
          params,
        });
        console.log("Full API response:", response);
        console.log("Response data:", response.data);

        // Handle the nested data structure properly
        if (response && response.data && response.data.data) {
          setAnalyticsData(response.data.data);
          console.log("Set analytics data:", response.data.data);
        } else if (response && response.data) {
          setAnalyticsData(response.data);
          console.log("Set analytics data (direct):", response.data);
        } else {
          console.warn("No data found in response");
          setAnalyticsData({});
        }
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setAnalyticsData({});
      } finally {
        setAnalyticsLoading(false);
      }
    };

    // On initial load, show full page loading
    if (isInitialLoad) {
      setLoading(true);
      Promise.all([fetchAnalytics(), fetchOverviewStats()]).finally(() => {
        setLoading(false);
        setIsInitialLoad(false);
      });
    } else {
      // On filter change, only reload individual components
      fetchAnalytics();
      fetchOverviewStats();
    }
  }, [
    selectedBusiness,
    dateRange,
    item,
    vendor,
    origin,
    selectedStatuses,
    selectedGrades,
    currencyReady,
  ]);

  // Fetch vendor options
  const fetchVendorOptions = async (businessId = null) => {
    try {
      let vendors = [];
      if (businessId) {
        const response = await VendorServices.getSuppliersByBusiness(
          businessId
        );
        vendors = response.data || [];
      } else {
        const response = await VendorServices.getAllVendorsByType("Supplier");
        vendors = response.data || [];
      }
      setVendorOptions(
        vendors.map((vendor) => ({
          value: vendor._id,
          label: vendor?.basicInformation?.vendorDisplayName,
        })) || []
      );
    } catch (err) {
      console.error("Error fetching vendors:", err);
      setVendorOptions([]);
    }
  };

  // Fetch item options
  const fetchItemOptions = async (businessId = null) => {
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
      fetchVendorOptions(selectedBusiness);
      fetchItemOptions(selectedBusiness);
    } else {
      fetchVendorOptions();
      fetchItemOptions();
    }
  }, [selectedBusiness]);

  useEffect(() => {
    fetchVendorOptions();
    fetchItemOptions();
  }, []);

  const filtersData = useMemo(() => {
    return {
      item: {
        value: item,
        label: item,
        options: itemOptions,
      },
      vendor: { value: vendor, label: vendor, options: vendorOptions },
      origin: { value: origin, label: origin, options: worldPortsOptions },
      business: {
        value: selectedBusiness,
        label: selectedBusiness,
        options: assignedBusinesses.map((business) => ({
          value: business,
          label: business,
        })),
      },
      startDate: { value: dateRange.startDate, label: dateRange.startDate },
      endDate: { value: dateRange.endDate, label: dateRange.endDate },
    };
  }, [
    item,
    vendor,
    origin,
    selectedBusiness,
    assignedBusinesses,
    dateRange,
    itemOptions,
    vendorOptions,
    worldPortsOptions,
  ]);

  // Debug effect to monitor data changes
  useEffect(() => {
    console.log("Analytics data updated:", analyticsData);
    console.log("Data keys:", Object.keys(analyticsData));
    if (analyticsData.byVendor) {
      console.log("Vendor data length:", analyticsData.byVendor.length);
    }
    if (analyticsData.byItem) {
      console.log("Item data length:", analyticsData.byItem.length);
    }
  }, [analyticsData]);

  // Prepare donut chart data with normalized values to ensure all segments show
  const donutData = [
    {
      name: "Total Purchases",
      value: Math.max(overviewStats.totalPurchases / 1000000, 1),
      color: "var(--p-blue)",
    },
    {
      name: "Total Purchase Contracts",
      value: Math.max(overviewStats.totalContracts, 50),
      color: "#3CD856",
    },
    {
      name: "Last 7 Days",
      value: Math.max(overviewStats.last7DaysContracts, 10),
      color: "#FF947A",
    },
    {
      name: "Without Sales",
      value: Math.max(overviewStats.unassigned, 5),
      color: "#A855F7",
    },
  ];

  const handleExport = () => {
    // Add export functionality here
    console.log("Export purchase overview data");
  };

  // --- Fetch purchase contracts by country (not vendors) ---
  const fetchContractsByCountry = async () => {
    if (!currencyReady) return; // Wait for currency rates to be ready

    setCountryLoading(true);
    try {
      // Use the SAME params structure as fetchOverviewStats to ensure consistency
      let params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        itemId: item,
        vendorId: vendor,
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

      // Get contracts data to analyze by countries
      // First get analytics to get the accurate total count
      let analyticsParams = {
        businessIds: params.businessIds
          ? Array.isArray(params.businessIds)
            ? params.businessIds
            : JSON.parse(params.businessIds)
          : [],
        startDate: params.startDate,
        endDate: params.endDate,
        itemId: params.itemId,
        vendorId: params.vendorId,
        origin: params.origin,
        status: params.status,
        grade: params.grade,
      };

      const analyticsResponse =
        await PurchaseContractServices.getPurchaseAnalytics({
          params: analyticsParams,
        });
      const analyticsData = analyticsResponse?.data || {};
      const totalContracts = analyticsData.totalContracts || 0;

      console.log("🌍 Purchase Analytics data:", {
        totalContracts,
        analyticsParams,
      });

      // Fetch ALL contracts by making multiple API calls if needed
      // IMPORTANT: Don't exclude internal purchase contracts (purchase_2) to match analytics
      let allContracts = [];
      let page = 1;
      const limit = 1000; // Fetch 1000 at a time
      let hasMorePages = true;
      let totalCountFromAPI = 0;
      let totalPagesFromAPI = 1;

      // Fetch until we get all contracts
      // Note: We don't set internalPurchaseFilter, so purchase_2 contracts will be excluded by default
      // But analytics includes them, so we need to fetch them separately if needed
      // For now, fetch with default filters and check if count matches
      while (hasMorePages) {
        const contractsResponse =
          await PurchaseContractServices.getAllPurchaseContracts({
            params: { ...params, limit, page },
          });

        const contracts = contractsResponse?.contracts || [];
        totalPagesFromAPI = contractsResponse?.totalPages || 1;
        totalCountFromAPI =
          contractsResponse?.totalCount ||
          contractsResponse?.totalContracts ||
          0;

        console.log(
          `🌍 Fetching purchase page ${page}/${totalPagesFromAPI}: Got ${
            contracts.length
          } contracts (Total: ${totalCountFromAPI}, Accumulated: ${
            allContracts.length + contracts.length
          })`
        );

        allContracts = [...allContracts, ...contracts];

        // Check if we've fetched all contracts
        if (
          page >= totalPagesFromAPI ||
          contracts.length === 0 ||
          allContracts.length >= totalCountFromAPI
        ) {
          hasMorePages = false;
        } else {
          page++;
        }
      }

      let contracts = allContracts;
      let finalTotalCount =
        totalCountFromAPI > 0 ? totalCountFromAPI : contracts.length;

      // Ensure we have all contracts - log warning if mismatch
      if (contracts.length !== totalContracts && totalContracts > 0) {
        console.warn(
          `⚠️ Purchase Contract count mismatch: Analytics says ${totalContracts}, but fetched ${contracts.length} contracts.`
        );
        console.warn(
          `   This might be due to purchase_2 (internal) contracts being excluded. Attempting to fetch internal contracts...`
        );

        // Try fetching internal purchase contracts separately
        try {
          const internalParams = {
            ...params,
            internalPurchaseFilter: "internal",
            limit: 1000,
            page: 1,
          };
          const internalResponse =
            await PurchaseContractServices.getAllPurchaseContracts({
              params: internalParams,
            });
          const internalContracts = internalResponse?.contracts || [];
          const internalCount =
            internalResponse?.totalCount ||
            internalResponse?.totalContracts ||
            0;

          console.log(
            `   Found ${internalCount} internal (purchase_2) contracts`
          );

          // Add internal contracts to the list
          if (internalContracts.length > 0) {
            allContracts = [...allContracts, ...internalContracts];
            contracts = allContracts;
            finalTotalCount = contracts.length;
            console.log(
              `   ✅ Added ${internalContracts.length} internal contracts. New total: ${contracts.length}`
            );
          }
        } catch (err) {
          console.warn(
            `   ⚠️ Could not fetch internal contracts:`,
            err.message
          );
        }
      }

      // Use final contracts array
      const finalContracts = contracts;
      const finalCount = finalContracts.length;

      console.log("🌍 Purchase Country Analysis - Final Results:", {
        totalContractsFromAnalytics: totalContracts,
        contractsFetched: finalContracts.length,
        totalCountFromAPI: finalTotalCount,
        match:
          finalContracts.length === totalContracts ? "✅ MATCH" : "⚠️ MISMATCH",
      });

      // Analyze contracts by country field
      // IMPORTANT: Count each contract ONCE, not per productInfo item
      const countryStats = {};
      let contractsWithCountry = 0;
      let contractsWithoutCountry = 0;
      const processedContractIds = new Set(); // Track processed contracts to avoid duplicates

      finalContracts.forEach((contract, index) => {
        // Skip if we've already processed this contract (shouldn't happen, but safety check)
        if (contract._id && processedContractIds.has(contract._id.toString())) {
          console.warn(
            `⚠️ Duplicate contract detected: ${contract.contractNo} (${contract._id})`
          );
          return;
        }

        if (contract._id) {
          processedContractIds.add(contract._id.toString());
        }

        // Get country from various possible fields
        // Priority: 1. productInfo[].origin_country, 2. basicInfo.origin_country
        let country = null;

        // Try productInfo origin_country first (check all products, use first found)
        if (contract.productInfo && contract.productInfo.length > 0) {
          for (let product of contract.productInfo) {
            if (product.origin_country) {
              country = product.origin_country;
              break;
            }
          }
        }
        // Try basicInfo.origin_country
        if (!country && contract.basicInfo?.origin_country) {
          country = contract.basicInfo.origin_country;
        }

        // Default to Unknown if no country found - THIS ENSURES ALL CONTRACTS ARE COUNTED
        if (
          !country ||
          country === "" ||
          country === null ||
          country === undefined
        ) {
          country = "Unknown";
        }

        // Log for debugging (only first few contracts to avoid spam)
        if (index < 5) {
          console.log(
            `🔍 Purchase Contract ${index + 1} (${
              contract.contractNo
            }) country data:`,
            {
              productInfo_origin_country:
                contract.productInfo?.[0]?.origin_country,
              basicInfo_origin_country: contract.basicInfo?.origin_country,
              detected: country,
              hasBasicInfo: !!contract.basicInfo,
              hasProductInfo: !!(
                contract.productInfo && contract.productInfo.length > 0
              ),
            }
          );
        }

        // Handle country codes and names - include ALL contracts, even those without country data
        let countryName = "Unknown";

        if (country && typeof country === "string" && country !== "Unknown") {
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
            `✅ Added purchase contract ${contract.contractNo} to ${countryName} (${country}), total count: ${countryStats[countryKey].count}`
          );
        }
      });

      // Calculate total contracts counted in countryStats
      const totalContractsInStats = Object.values(countryStats).reduce(
        (sum, country) => sum + country.count,
        0
      );

      // Use the actual processed count for percentage calculations to ensure accuracy
      // Prefer finalCount (which includes internal contracts if fetched), then fallback to contracts.length, then analytics total
      const actualTotalContracts =
        finalCount > 0
          ? finalCount
          : finalContracts.length > 0
          ? finalContracts.length
          : totalContracts;

      console.log("🌍 Purchase Country stats summary:", {
        totalContractsFromAnalytics: totalContracts,
        contractsFetched: contracts.length,
        contractsProcessed: processedContractIds.size,
        contractsCountedInStats: totalContractsInStats,
        contractsWithCountry,
        contractsWithoutCountry,
        countriesFound: Object.keys(countryStats).length,
        missingContracts: actualTotalContracts - totalContractsInStats,
        countryStatsBreakdown: Object.keys(countryStats).map((key) => ({
          name: countryStats[key].name,
          count: countryStats[key].count,
        })),
      });

      // Ensure all contracts are accounted for
      if (totalContractsInStats !== actualTotalContracts) {
        console.error(
          `❌ Purchase Contract count mismatch in stats! Expected ${actualTotalContracts}, but counted ${totalContractsInStats} contracts.`
        );
        // If there's a mismatch, add missing contracts to Unknown
        const missingCount = actualTotalContracts - totalContractsInStats;
        if (missingCount > 0) {
          if (!countryStats["unknown"]) {
            countryStats["unknown"] = {
              name: "Unknown",
              count: 0,
              totalValue: 0,
            };
          }
          countryStats["unknown"].count += missingCount;
          console.log(
            `✅ Added ${missingCount} missing contracts to Unknown category`
          );
        }
      }

      // Convert to arrays for top countries
      // Include ALL countries including "Unknown" - don't filter it out
      // Use actualTotalContracts for percentage calculation to ensure it adds up to 100%
      const allCountriesArray = Object.values(countryStats)
        .map((country) => ({
          name: country.name,
          value:
            actualTotalContracts > 0
              ? Math.round((country.count / actualTotalContracts) * 100)
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

      console.log("🌍 Purchase Final country array:", {
        totalCountries: allCountriesArray.length,
        countries: allCountriesArray.map((c) => `${c.name}: ${c.count}`),
        totalCount: allCountriesArray.reduce((sum, c) => sum + c.count, 0),
      });

      // Top 10 for sidebar
      const top10Countries = allCountriesArray.slice(0, 10);
      // Top 20 for main chart
      const top20Countries = allCountriesArray.slice(0, 20);

      console.log("Processed purchase country data:", {
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
      console.error("Error fetching purchase country data:", error);
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

  // --- Fetch new purchase contracts ---
  const fetchNewContracts = async () => {
    setContractsLoading(true);
    try {
      let params = {};
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
      if (selectedStatuses.length > 0) {
        params.status = selectedStatuses.join(",");
      }
      if (selectedGrades.length > 0) {
        params.grade = selectedGrades.join(",");
      }
      const response =
        await PurchaseContractServices.getRecentPurchaseContracts({ params });
      console.log("recent Contracts response:", response);
      const contractsData = response?.contracts || [];
      console.log("recent Contracts data:", contractsData);
      const transformedContracts = contractsData.map((contract, index) => {
        let totalQuantity = 0;
        let totalPrice = 0;
        let perMetricTon = 0;
        // Calculate total quantity and price from productInfo
        if (contract.productInfo && contract.productInfo.length > 0) {
          contract.productInfo.forEach((product) => {
            totalQuantity += parseFloat(
              product.quantity || product.quantityMTS || 0
            );
            totalPrice += parseFloat(product.totalValue || 0);
          });
          perMetricTon = totalQuantity > 0 ? totalPrice / totalQuantity : 0;
        }
        // Vendor name logic
        let vendorName =
          contract.basicInfo?.vendorCompanyName ||
          contract.basicInfo?.vendorName ||
          contract.basicInfo?.selectedVendorId?.basicInformation
            ?.vendorDisplayName ||
          contract.basicInfo?.selectedVendorId?.basicInformation?.companyName ||
          "";
        return {
          id: index + 1,
          contractNo:
            contract.contractNo || `PC-${contract._id?.toString().slice(-6)}`,
          vendorName,
          quantity: totalQuantity > 0 ? `${totalQuantity.toFixed(2)}MT` : "N/A",
          price: totalPrice,
          perMetricTon: perMetricTon,
          status: contract.status || "Draft",
          contractDate: contract.basicInfo?.contractDate || contract.createdAt,
        };
      });
      setNewContracts(transformedContracts);
    } catch (error) {
      setNewContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  // --- Fetch vendors by country ---
  const fetchVendorsByCountry = async () => {
    setVendorsLoading(true);
    try {
      const response = await PurchaseContractServices.getVendorsByCountry();
      const countries = response?.countries || [];
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
          vendors: country.vendors,
          color: "var(--p-blue)",
        }))
        .sort((a, b) => b.count - a.count);
      setVendorCountryData(allCountriesArray.slice(0, 10));
      setTopVendorCountries(allCountriesArray.slice(0, 20));
    } catch (error) {
      setVendorCountryData([]);
      setTopVendorCountries([]);
    } finally {
      setVendorsLoading(false);
    }
  };

  // --- Fetch most recent 10 vendors ---
  const fetchNewVendors = async () => {
    setVendorsLoading(true);
    try {
      const response = await PurchaseContractServices.getRecentVendors();
      setNewVendors(response?.vendors || []);
    } catch (error) {
      setNewVendors([]);
    } finally {
      setVendorsLoading(false);
    }
  };

  // Fetch vendors with regions for map
  const fetchVendorsWithRegions = async () => {
    try {
      // Build query params - vendor API uses businessId as query param
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
            // Vendor API might need business_id in params, let's try without filter first
            // If needed, we can filter client-side
          }
        }
      }

      console.log("🔍 Fetching vendors with params:", params);

      // Fetch vendors and regions in parallel
      const [vendorsResponse, regionsResponse] = await Promise.all([
        axios.get(`${Base_URL}/vendors`, { params }).catch((err) => {
          console.error("Error fetching vendors:", err);
          return { data: { data: [] } };
        }),
        axios.get(`${Base_URL}/regions`).catch(() => ({ data: { data: [] } })),
      ]);

      // Vendor API returns { data: vendors } not { vendors }
      let vendors =
        vendorsResponse?.data?.data || vendorsResponse?.data?.vendors || [];

      console.log("📦 Vendor API response structure:", {
        hasData: !!vendorsResponse?.data?.data,
        hasVendors: !!vendorsResponse?.data?.vendors,
        vendorsCount: vendors.length,
        responseKeys: Object.keys(vendorsResponse?.data || {}),
      });

      // Filter by business if multiple businesses and no businessId selected
      if (!selectedBusiness && vendors.length > 0) {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const businessesArr = JSON.parse(storedBusinesses);
          const businessIds = businessesArr.map((b) => b._id);
          if (businessIds.length > 0) {
            vendors = vendors.filter((v) => {
              const vendorBusinessId = v.business?._id || v.business;
              return businessIds.includes(vendorBusinessId?.toString());
            });
            console.log("🔍 Filtered vendors by business:", vendors.length);
          }
        }
      }

      const allRegions = regionsResponse?.data?.data || [];

      // Create a map of region IDs to region names for lookup
      const regionMap = new Map();
      allRegions.forEach((region) => {
        regionMap.set(region._id, region.name);
      });

      console.log("📊 Total vendors fetched:", vendors.length);
      console.log("🌍 Total regions available:", allRegions.length);

      // Filter vendors with region data and map to the format expected by RegionMap
      const vendorsWithRegionData = vendors
        .filter((v) => {
          const regionId = v.basicInformation?.region;
          const hasRegion = regionId && regionId.toString().trim() !== "";
          const hasCoordinates =
            v.basicInformation?.regionCoordinates?.lat != null &&
            v.basicInformation?.regionCoordinates?.lng != null &&
            !isNaN(parseFloat(v.basicInformation.regionCoordinates.lat)) &&
            !isNaN(parseFloat(v.basicInformation.regionCoordinates.lng));

          if (hasRegion && !hasCoordinates) {
            console.log("⚠️ Vendor has region ID but no coordinates:", {
              name:
                v.basicInformation?.vendorDisplayName ||
                v.basicInformation?.companyName,
              regionId: regionId,
              regionCoordinates: v.basicInformation?.regionCoordinates,
            });
          }

          if (!hasRegion) {
            console.log(
              "⚠️ Vendor has no region:",
              v.basicInformation?.vendorDisplayName ||
                v.basicInformation?.companyName
            );
          }

          return hasRegion && hasCoordinates;
        })
        .map((v) => {
          const lat = parseFloat(v.basicInformation.regionCoordinates.lat);
          const lng = parseFloat(v.basicInformation.regionCoordinates.lng);
          const regionId = v.basicInformation.region;
          const regionName = regionMap.get(regionId) || regionId || "Unknown";

          return {
            id: v._id,
            name:
              v.basicInformation?.vendorDisplayName ||
              v.basicInformation?.companyName ||
              "Unknown",
            region: regionName,
            email: v.basicInformation?.vendorEmail || "",
            phone:
              v.basicInformation?.vendorPhone?.mobile ||
              v.basicInformation?.vendorPhone?.workPhone ||
              "",
            type: v.basicInformation?.vendorType || "",
            coordinates: {
              lat: lat,
              lng: lng,
            },
          };
        });

      console.log("📍 Vendors with region data:", vendorsWithRegionData.length);
      if (vendorsWithRegionData.length > 0) {
        console.log("✅ Sample vendor with region:", vendorsWithRegionData[0]);
      } else {
        console.log(
          "⚠️ No vendors found with region data. Checking sample vendor..."
        );
        if (vendors.length > 0) {
          const sample = vendors[0];
          console.log("Sample vendor structure:", {
            hasBasicInfo: !!sample.basicInformation,
            region: sample.basicInformation?.region,
            regionCoordinates: sample.basicInformation?.regionCoordinates,
            fullBasicInfo: sample.basicInformation,
          });
        }
      }

      setVendorsWithRegions(vendorsWithRegionData);
    } catch (error) {
      console.error("❌ Error fetching vendors with regions:", error);
      console.error("Error details:", error.response?.data || error.message);
      setVendorsWithRegions([]);
    }
  };

  // --- Fetch purchase contracts by country of origin ---
  const fetchOriginCountryData = async () => {
    try {
      let params = {};
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
      const response =
        await PurchaseContractServices.getPurchaseContractsByOriginCountry({
          params,
        });
      const countries = response?.countries || [];
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
          color: "var(--p-blue)",
        }))
        .sort((a, b) => b.count - a.count);
      setOriginCountryData(allCountriesArray.slice(0, 10));
      setTopOriginCountries(allCountriesArray.slice(0, 20));
    } catch (error) {
      setOriginCountryData([]);
      setTopOriginCountries([]);
    }
  };

  // --- Add useEffect to fetch new sections data ---
  useEffect(() => {
    if (currencyReady) {
      fetchContractsByCountry();
      fetchNewContracts();
      fetchVendorsByCountry();
      fetchNewVendors();
      fetchVendorsWithRegions();
      fetchOriginCountryData();
      fetchContractActivity();
    }
  }, [selectedBusiness, selectedStatuses, selectedGrades, currencyReady]);

  // --- Fetch contract activity data (similar to OverViewSales) ---
  const fetchContractActivity = async () => {
    try {
      setActivityLoading(true);
      let params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        itemId: item,
        vendorId: vendor,
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
      // Override date filters based on the selected timeframe
      const now = new Date();
      let startDate, endDate;
      if (activityTimeFrame === "Day") {
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
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      }
      // Override date filters based on the selected timeframe
      if (startDate && endDate) {
        params.startDate = startDate.toISOString().split("T")[0];
        params.endDate = endDate.toISOString().split("T")[0];
      }

      // Fetch analytics first to get accurate totals with filters
      let analyticsParams = {
        businessIds: params.businessId
          ? [params.businessId]
          : params.businessIds
          ? typeof params.businessIds === "string"
            ? JSON.parse(params.businessIds)
            : params.businessIds
          : [],
        startDate: params.startDate,
        endDate: params.endDate,
        itemId: params.itemId,
        vendorId: params.vendorId,
        origin: params.origin,
        status: params.status,
        grade: params.grade,
      };
      const analyticsResponse =
        await PurchaseContractServices.getPurchaseAnalytics({
          params: analyticsParams,
        });

      // Fetch contracts for activity analysis (with date filters)
      const contractsResponse =
        (await PurchaseContractServices.getAllPurchaseContracts)
          ? await PurchaseContractServices.getAllPurchaseContracts({
              params: { ...params, limit: 1000 },
            })
          : { contracts: [] };
      const contracts = contractsResponse?.contracts || [];
      // Calculate total value in base currency
      let totalValue = 0;
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
                totalValue += convertToBase(amount, currency);
              }
            });
          }
        });
      }
      // Group contracts by time periods
      const activityData = [];
      let timeGroups = {};
      if (contracts.length > 0) {
        contracts.forEach((contract) => {
          // Use contractDate (agreement date) not createdAt
          const contractDate = new Date(
            contract.basicInfo?.contractDate || contract.createdAt
          );
          let timeKey, label;
          if (activityTimeFrame === "Day") {
            timeKey = contractDate.getHours();
            label = `${timeKey}:00`;
          } else if (activityTimeFrame === "Week") {
            const dayOfWeek = contractDate.getDay();
            timeKey = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            label = dayNames[timeKey];
          } else if (activityTimeFrame === "Month") {
            timeKey = contractDate.getDate();
            label = `${timeKey}`;
          } else {
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
        if (activityTimeFrame === "Day") {
          for (let i = 0; i < 24; i++) {
            const groupData = timeGroups[i] || { count: 0, value: 0 };
            activityData.push({
              name: `${i}:00`,
              value: groupData.value || 0,
              count: groupData.count || 0,
            });
          }
        } else if (activityTimeFrame === "Week") {
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
        if (activityTimeFrame === "Day") {
          for (let i = 0; i < 24; i++) {
            activityData.push({ name: `${i}:00`, value: 0, count: 0 });
          }
        } else if (activityTimeFrame === "Week") {
          const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          for (let i = 0; i < 7; i++) {
            activityData.push({ name: dayNames[i], value: 0, count: 0 });
          }
        } else if (activityTimeFrame === "Month") {
          const now = new Date();
          const daysInMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
          ).getDate();
          for (let i = 1; i <= daysInMonth; i++) {
            activityData.push({ name: `${i}`, value: 0, count: 0 });
          }
        } else {
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
            activityData.push({ name: monthNames[i], value: 0, count: 0 });
          }
        }
      }
      setContractActivity({
        value: Math.round(totalValue),
        trend: "up",
        data: activityData,
      });
      setActivityLoading(false);
    } catch (error) {
      setContractActivity({ value: 0, trend: "up", data: [] });
      setActivityLoading(false);
    }
  };
  // Fetch activity data when timeframe changes
  useEffect(() => {
    if (currencyReady) {
      fetchContractActivity();
    }
    // eslint-disable-next-line
  }, [activityTimeFrame, currencyReady]);

  return loading ? (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loading loading={loading} />
    </div>
  ) : (
    <div className="space-y-6">
      {/* Filters Section - Moved to Top */}
      <div className="bg-white rounded-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <FormInput
            type="select"
            label="Business"
            direction="column"
            isBusinessDropdown={true}
            businessDropdownProps={{
              adminId: adminInfo?.id,
              selectedBusiness,
              onChange: (value) => {
                setSelectedBusiness(value);
                // Clear all other filters when business filter is reset or changed
                setItem("");
                setVendor("");
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
            label="Item"
            direction="column"
            options={itemOptions}
            placeholder="Item"
            value={item}
            onChange={setItem}
            isClearable
          />
          <FormInput
            type="select"
            label="Vendor"
            direction="column"
            options={vendorOptions}
            placeholder="Vendor"
            value={vendor}
            onChange={setVendor}
            isClearable
          />
          <FormInput
            type="select"
            label="Origin"
            direction="column"
            options={worldPortsOptions}
            placeholder="Origin"
            value={origin}
            onChange={setOrigin}
            isClearable
          />
          <FormInput
            label="Date Range"
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
            label="Status"
            direction="column"
            options={statusOptions}
            placeholder="Select Statuses"
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
            label="Grade"
            direction="column"
            options={gradeOptions}
            placeholder="Select Grades"
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

      {/* Purchase Overview Section */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Purchase Overview
          </h2>
          {overviewLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
              <span>Updating...</span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 flex-1">
            {/* Total Purchases Card */}
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
                {formatAmount(overviewStats.totalPurchases)}{" "}
                {baseCurrency.toUpperCase()}
              </div>
              <div className="text-gray-600 text-xs">
                Total Purchases (Base Currency)
              </div>
            </div>

            {/* Total Purchase Contracts Card */}
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
              <div className="text-gray-600 text-xs">
                Total Purchase Contracts
              </div>
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
              <div className="text-gray-600 text-xs">Last 7 Days</div>
            </div>

            {/* Without Sales Card */}
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
              <div className="text-gray-600 text-xs">Without Sales</div>
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
                    {format_Amount(overviewStats.totalPurchases)}
                  </div>
                  <div className="text-xs text-gray-600">
                    Total Purchases ({baseCurrency.toUpperCase()})
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--p-blue)]"></div>
                  <span className="text-gray-700 text-xs">Total Purchases</span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {formatAmount(overviewStats.totalPurchases)}{" "}
                  {baseCurrency.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#3CD856]"></div>
                  <span className="text-gray-700 text-xs">
                    Total Purchase Contracts
                  </span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {overviewStats.totalContracts}
                </span>
              </div>
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF947A]"></div>
                  <span className="text-gray-700 text-xs">Last 7 Days</span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {overviewStats.last7DaysContracts}
                </span>
              </div>
              <div className="flex items-center justify-between min-w-[150px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#A855F7]"></div>
                  <span className="text-gray-700 text-xs">Without Sales</span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">
                  {overviewStats.unassigned}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Contracts by Country and New Contracts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Purchase Contracts by Country */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Purchase Contracts by Country
            </h3>
            {countryLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>Updating...</span>
              </div>
            )}
          </div>
          {/* Top 20 Countries Chart */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Top 20 Countries by Contracts
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
                    <p className="text-sm">No country data available</p>
                    <p className="text-xs mt-1">
                      Data will appear when contracts are created
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Top 10 Countries */}
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4">
              Top 10 Countries
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
                  <p className="text-sm">No country data available</p>
                  <p className="text-xs mt-1">
                    Data will appear when contracts are created
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* New Purchase Contracts */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              New Purchase Contracts
            </h3>
            {contractsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>Updating...</span>
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
                    Contract No
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Vendor
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Quantity
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Per MTS
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Price
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Status
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Contract Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {newContracts.length > 0 ? (
                  newContracts.map((contract, index) => (
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
                        {contract.vendorName || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {contract.quantity}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {formatAmount(contract.perMetricTon)}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {formatAmount(contract.price)}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {contract.status}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {formatDate(
                          contract.contractDate || contract.createdAt
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-gray-500">
                      <div>
                        <p className="text-sm">No contracts available</p>
                        <p className="text-xs mt-1">
                          New contracts will appear here when created
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
              {newContracts.length > 0
                ? `Showing ${newContracts.length} recent contracts`
                : "No contracts to display"}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Contracts Activity Section */}
      <div className="bg-white rounded-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Purchase Contracts Activity
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
                {timeFrame}
              </button>
            ))}
          </div>
        </div>
        {activityLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--p-blue)]"></div>
              <span className="text-gray-600 font-medium">
                Loading activity data...
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
                {/* TrendingUp icon can be added here if desired */}
                <span className="text-green-500 text-base font-bold">
                  Trending Up
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
                                {`Value: $${Math.round(
                                  payload[0].value
                                ).toLocaleString()}`}
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

      {/* Purchase Analytics Section */}
      <div>
        <PurchaseAnalyticsChart
          title="Purchase Analytics"
          data={analyticsData}
          loading={analyticsLoading}
          filtersData={filtersData}
        />
      </div>

      {/* Vendors Map Section */}
      <div className="bg-white rounded-lg p-6 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Vendors by Region
          </h3>
          <div className="text-sm text-gray-600">
            {vendorsWithRegions.length} vendor
            {vendorsWithRegions.length !== 1 ? "s" : ""} with location data
          </div>
        </div>
        <RegionMap
          data={vendorsWithRegions}
          height="650px"
          markerColor="#3B82F6"
          title="Vendors by Region"
        />
      </div>

      {/* Vendors by Country and New Vendors Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Vendors by Country */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Vendors by Country
            </h3>
            {vendorsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>Updating...</span>
              </div>
            )}
          </div>
          {/* Top 20 Countries Chart */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Top 20 Countries by Vendors
            </h4>
            <div className="w-full h-72 bg-gray-50 rounded-lg border border-gray-200 p-4">
              {topVendorCountries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={topVendorCountries}
                    margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  >
                    <defs>
                      <linearGradient
                        id="vendorCountryColorGradient"
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
                                Vendors: {data.count}
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
                      fill="url(#vendorCountryColorGradient)"
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
                    <p className="text-sm">No vendor data available</p>
                    <p className="text-xs mt-1">
                      Data will appear when vendors are created
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Top 10 Countries */}
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4">
              Top 10 Countries by Vendors
            </h4>
            <div className="space-y-3">
              {vendorCountryData.length > 0 ? (
                vendorCountryData.map((country, index) => (
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
                  <p className="text-sm">No country data available</p>
                  <p className="text-xs mt-1">
                    Data will appear when vendors are created
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* New Vendors */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">New Vendors</h3>
            {vendorsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                <span>Updating...</span>
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
                    Vendor
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Company
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Email
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Country
                  </th>
                  <th className="text-left py-4 px-3 text-gray-600 font-semibold text-sm">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {newVendors.length > 0 ? (
                  newVendors.map((vendor, index) => (
                    <tr
                      key={vendor._id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-3 text-gray-900 font-semibold text-sm">
                        {index + 1}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm font-medium">
                        {vendor.basicInformation?.vendorDisplayName || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {vendor.basicInformation?.companyName || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {vendor.basicInformation?.vendorEmail || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {vendor.companyInfo?.countryOfIncorporation || "-"}
                      </td>
                      <td className="py-4 px-3 text-gray-900 text-sm">
                        {formatDate(vendor.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500">
                      <div>
                        <p className="text-sm">No vendors available</p>
                        <p className="text-xs mt-1">
                          New vendors will appear here when created
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Show Vendors count */}
          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600 font-medium">
              {newVendors.length > 0
                ? `Showing ${newVendors.length} recent Vendors`
                : "No Vendors to display"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
