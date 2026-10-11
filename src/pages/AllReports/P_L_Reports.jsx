import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Download, Search, RefreshCw, Loader, Info, X } from "lucide-react";
import {
  InputField,
  DropdownBasic,
  Loader as LoaderComponent,
  DateRangeComponent,
} from "@/page-layouts/index";
import { DataTable } from "@/page-layouts/index";
import { toast } from "react-toastify";
import { AdminContext } from "@/context/AdminContext";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const P_L_Reports = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const adminId = adminInfo?.id || adminInfo?._id;

  // Simplified Filters - Business, Year, Type, Sales Contract, and Date Range
  // Year defaults to current year
  const currentYear = new Date().getFullYear();
  const [searchParams, setSearchParams] = useState({
    business: "",
    year: currentYear.toString(), // Default to current year
    type: "", // BARENA, BEHMAN, or empty for both
    salesContracts: [], // Array of selected sales contract IDs
    startDate: "", // Date range start date (YYYY-MM-DD)
    endDate: "", // Date range end date (YYYY-MM-DD)
    status: "all", // "ongoing", "completed", or "all"
  });

  // Sales Contract options for dropdown
  const [salesContractOptions, setSalesContractOptions] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Data for tables
  const [table1Data, setTable1Data] = useState([]); // Counts and quantities
  const [table2Data, setTable2Data] = useState([]); // Amounts
  const [purchaseTableData, setPurchaseTableData] = useState([]); // Purchase pivot
  const [purchaseTable2Data, setPurchaseTable2Data] = useState([]); // Purchase amounts
  const [table3Data, setTable3Data] = useState([]); // Sales Adjustments
  const [table4Data, setTable4Data] = useState([]); // Purchase Adjustments
  const [costOfGoodsData, setCostOfGoodsData] = useState([]); // Cost of Goods (COGS)
  const [otherIncomeData, setOtherIncomeData] = useState([]); // Other Income (non sales/purchase)
  const [otherExpensesData, setOtherExpensesData] = useState([]); // Expenses (non sales/purchase)
  const [table1WithoutPurchaseData, setTable1WithoutPurchaseData] = useState(
    []
  ); // Sales WITHOUT purchase - counts and quantities
  const [table2WithoutPurchaseData, setTable2WithoutPurchaseData] = useState(
    []
  ); // Sales WITHOUT purchase - amounts
  const [table3WithoutPurchaseData, setTable3WithoutPurchaseData] = useState(
    []
  ); // Sales Adjustments for Sales WITHOUT purchase
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD"); // Base currency from API

  // Breakdown modal state
  const [breakdownModal, setBreakdownModal] = useState({
    isOpen: false,
    type: null, // 'expenses' or 'cogs'
    data: null,
    loading: false,
  });

  // Pagination state for items in each category
  const [itemsPagination, setItemsPagination] = useState({});

  const ITEMS_PER_PAGE = 20;

  // Dropdown Options - Dynamic year generation (current year to last 10 years)
  const yearOptions = [
    ...Array.from({ length: 11 }, (_, i) => {
      const year = currentYear - i;
      return { value: year.toString(), label: year.toString() };
    }),
  ];

  // Type filter options
  const typeOptions = [
    { value: "", label: "Both" },
    { value: "BARENA", label: "BARENA" },
    { value: "BEHMAN", label: "BEHMAN" },
  ];

  // Status filter options
  const statusOptions = [
    { value: "all", label: "All" },
    { value: "ongoing", label: "Ongoing" },
    { value: "completed", label: "Completed" },
  ];

  // Month names for display
  const monthNames = [
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

  // Fetch sales contracts based on business and year
  const fetchSalesContracts = async () => {
    if (!searchParams.year) {
      setSalesContractOptions([]);
      return;
    }

    setLoadingContracts(true);
    try {
      const queryParams = new URLSearchParams();

      // If business is selected, filter by that business
      // Otherwise, get all businesses from localStorage and fetch contracts for all
      if (searchParams.business) {
        queryParams.append("businessId", searchParams.business);
      } else {
        // Get all businesses assigned to the user from localStorage
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          try {
            const businesses = JSON.parse(storedBusinesses);
            if (businesses && businesses.length > 0) {
              const businessIds = businesses
                .map((b) => b._id || b.id)
                .filter(Boolean);
              if (businessIds.length > 0) {
                // Backend expects JSON string format
                queryParams.append("businessIds", JSON.stringify(businessIds));
              } else {
                // No valid business IDs found, clear options
                setSalesContractOptions([]);
                setLoadingContracts(false);
                return;
              }
            } else {
              // Empty businesses array, clear options
              setSalesContractOptions([]);
              setLoadingContracts(false);
              return;
            }
          } catch (e) {
            console.error("Error parsing businesses from localStorage:", e);
            setSalesContractOptions([]);
            setLoadingContracts(false);
            return;
          }
        } else {
          // No businesses in localStorage, clear options
          setSalesContractOptions([]);
          setLoadingContracts(false);
          return;
        }
      }

      // Use lightweight endpoint that only returns _id and contractNo
      const response = await axios.get(
        `${Base_URL}/sales-contracts/list?${queryParams.toString()}`,
        {
          headers: {
            authorization: `Bearer ${adminInfo?.token}`,
          },
        }
      );

      const contracts = response.data?.data || [];

      // Map to dropdown options (already filtered by backend)
      const options = contracts.map((contract) => ({
        value: contract._id,
        label: contract.contractNo || "N/A",
      }));

      setSalesContractOptions(options);
    } catch (err) {
      console.error("❌ Error fetching sales contracts:", err);
      setSalesContractOptions([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  // Fetch sales contracts when business or year changes
  useEffect(() => {
    fetchSalesContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.business, searchParams.year]);

  // Fetch P&L data grouped by item and month
  const fetchPLData = async () => {
    if (!searchParams.year) {
      setTable1Data([]);
      setTable2Data([]);
      setPurchaseTableData([]);
      setPurchaseTable2Data([]);
      setTable3Data([]);
      setTable4Data([]);
      setCostOfGoodsData([]);
      setOtherIncomeData([]);
      setOtherExpensesData([]);
      return;
    }

    setLoading(true);
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(searchParams).filter(([_, v]) => {
          // Filter out empty arrays and empty strings
          if (Array.isArray(v)) {
            return v.length > 0;
          }
          return v !== "" && v !== null && v !== undefined && v !== "undefined";
        })
      );

      // Convert salesContracts array to comma-separated string for API
      if (
        cleanParams.salesContracts &&
        Array.isArray(cleanParams.salesContracts)
      ) {
        cleanParams.salesContracts = cleanParams.salesContracts.join(",");
      }

      // Add date range params if provided
      if (searchParams.startDate) {
        cleanParams.startDate = searchParams.startDate;
      }
      if (searchParams.endDate) {
        cleanParams.endDate = searchParams.endDate;
      }

      console.log("📤 Fetching P&L data with params:", cleanParams);

      const res = await axios.get(`${Base_URL}/sales-reports/pl-summary`, {
        params: cleanParams,
      });

      console.log("📥 Received P&L summary response:", res.data);

      if (res.data.success) {
        setTable1Data(res.data.data?.table1 || []);
        setTable2Data(res.data.data?.table2 || []);
        setPurchaseTableData(res.data.data?.purchaseTable || []);
        setPurchaseTable2Data(res.data.data?.purchaseTable2 || []);
        setTable3Data(res.data.data?.table3 || []);
        setTable4Data(res.data.data?.table4 || []);
        setCostOfGoodsData(res.data.data?.costOfGoods || []);
        setOtherIncomeData(res.data.data?.otherIncome || []);
        setOtherExpensesData(res.data.data?.otherExpenses || []);
        setTable1WithoutPurchaseData(
          res.data.data?.table1WithoutPurchase || []
        );
        setTable2WithoutPurchaseData(
          res.data.data?.table2WithoutPurchase || []
        );
        setTable3WithoutPurchaseData(
          res.data.data?.table3WithoutPurchase || []
        );
        setBaseCurrency(res.data.data?.baseCurrency || "USD");
      } else {
        toast.error(res.data.message || "Failed to fetch P&L data");
        setTable1Data([]);
        setTable2Data([]);
        setPurchaseTableData([]);
        setPurchaseTable2Data([]);
        setTable3Data([]);
        setTable4Data([]);
      }
    } catch (err) {
      console.error("❌ API Error:", err);
      toast.error("Failed to fetch P&L data");
      setTable1Data([]);
      setTable2Data([]);
      setPurchaseTableData([]);
      setPurchaseTable2Data([]);
      setTable3Data([]);
      setTable4Data([]);
      setCostOfGoodsData([]);
      setOtherIncomeData([]);
      setOtherExpensesData([]);
      setTable1WithoutPurchaseData([]);
      setTable2WithoutPurchaseData([]);
      setTable3WithoutPurchaseData([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch data when page loads or year changes
  useEffect(() => {
    if (searchParams.year) {
      fetchPLData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.year]);

  const handleReset = () => {
    const resetParams = {
      business: "",
      year: currentYear.toString(), // Reset to current year
      type: "", // Reset type filter
      salesContracts: [], // Reset sales contracts
      startDate: "", // Reset date range
      endDate: "", // Reset date range
      status: "all", // Reset status filter
    };
    setSearchParams(resetParams);
    // Clear data immediately
    setTable1Data([]);
    setTable2Data([]);
    setPurchaseTableData([]);
    setPurchaseTable2Data([]);
    setTable3Data([]);
    setTable4Data([]);
    setCostOfGoodsData([]);
    setOtherIncomeData([]);
    setOtherExpensesData([]);
    setTable1WithoutPurchaseData([]);
    setTable2WithoutPurchaseData([]);
    setTable3WithoutPurchaseData([]);
    // Fetch data with reset params after state update
    setTimeout(() => {
      fetchPLData();
    }, 100);
  };

  const handleDownloadExcel = async () => {
    if (!searchParams.year) {
      toast.error("Please select a year before exporting");
      return;
    }

    setExportLoading(true);
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(searchParams).filter(([_, v]) => {
          // Filter out empty arrays and empty strings
          if (Array.isArray(v)) {
            return v.length > 0;
          }
          return v !== "" && v !== null && v !== undefined && v !== "undefined";
        })
      );

      // Convert salesContracts array to comma-separated string for API
      if (
        cleanParams.salesContracts &&
        Array.isArray(cleanParams.salesContracts)
      ) {
        cleanParams.salesContracts = cleanParams.salesContracts.join(",");
      }

      const response = await axios.get(
        `${Base_URL}/sales-reports/export/pl-summary`,
        {
          params: cleanParams,
          responseType: "blob", // Important for file downloads
        }
      );

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `PL-Summary-${searchParams.year}-${
          new Date().toISOString().split("T")[0]
        }.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Excel file downloaded successfully");
    } catch (err) {
      console.error("❌ Error downloading Excel:", err);
      toast.error(
        err.response?.data?.message || "Failed to download Excel file"
      );
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: baseCurrency || "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatCurrencyWithCode = (
    value,
    currencyCode = baseCurrency || "USD"
  ) => {
    if (!value && value !== 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calculate filtered months based on date range
  const getFilteredMonths = () => {
    if (searchParams.startDate && searchParams.endDate) {
      const startDate = new Date(searchParams.startDate);
      const endDate = new Date(searchParams.endDate);
      const startMonth = startDate.getMonth() + 1; // 1-12
      const endMonth = endDate.getMonth() + 1; // 1-12
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const selectedYear =
        parseInt(searchParams.year) || new Date().getFullYear();

      // Only include months if they fall within the selected year
      const months = [];
      if (startYear === selectedYear && endYear === selectedYear) {
        for (let month = startMonth; month <= endMonth; month++) {
          months.push(month);
        }
      } else if (startYear === selectedYear) {
        for (let month = startMonth; month <= 12; month++) {
          months.push(month);
        }
      } else if (endYear === selectedYear) {
        for (let month = 1; month <= endMonth; month++) {
          months.push(month);
        }
      } else if (selectedYear > startYear && selectedYear < endYear) {
        // Year is between start and end, include all months
        for (let month = 1; month <= 12; month++) {
          months.push(month);
        }
      }

      return months.length > 0
        ? months
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    // If no date range, show all 12 months
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  };

  const filteredMonths = getFilteredMonths();

  // Helper to determine which status columns to show
  const showOngoing = () =>
    searchParams.status === "all" || searchParams.status === "ongoing";
  const showCompleted = () =>
    searchParams.status === "all" || searchParams.status === "completed";

  // Normalize item title - group similar items (e.g., "Carbon Black N330", "Carbon Black N550" -> "Carbon Black")
  const normalizeItemTitle = (title) => {
    if (!title) return "Unknown";
    const normalized = title.trim();

    // Group Carbon Black variants
    if (normalized.toUpperCase().includes("CARBON BLACK")) {
      return "CARBON BLACK";
    }

    // Group Natural Rubber variants
    if (
      normalized.toUpperCase().includes("NATURAL RUBBER") ||
      (normalized.toUpperCase().includes("NATURAL") &&
        normalized.toUpperCase().includes("RUBBER"))
    ) {
      return "NATURAL RUBBER";
    }

    // Group Synthetic Rubber variants
    if (
      normalized.toUpperCase().includes("SYNTHETIC RUBBER") ||
      (normalized.toUpperCase().includes("SYNTHETIC") &&
        normalized.toUpperCase().includes("RUBBER"))
    ) {
      return "SYNTHETIC RUBBER";
    }

    // Group Latex variants
    if (normalized.toUpperCase().includes("LATEX")) {
      return "LATEX";
    }

    // Group Misc variants
    if (
      normalized.toUpperCase().includes("MISC") ||
      normalized.toUpperCase().includes("OTHER")
    ) {
      return "MISC";
    }

    return normalized;
  };

  // Prepare Table 1 data structure (Pivot format - items as rows, months as columns)
  const prepareTable1Data = () => {
    const itemsMap = {}; // itemTitle -> { month -> { ongoing, completed, qtyFCL, qtyMT } }

    table1Data.forEach((item) => {
      const rawItemName = item.itemName || "Unknown";
      const itemTitle = normalizeItemTitle(rawItemName); // Normalize to group similar items
      const month = item.month || 0;

      if (!itemsMap[itemTitle]) {
        itemsMap[itemTitle] = {
          itemName: itemTitle,
          months: {},
        };
      }

      if (!itemsMap[itemTitle].months[month]) {
        itemsMap[itemTitle].months[month] = {
          ongoingCount: 0,
          completedCount: 0,
          ongoingQuantityFCL: 0,
          completedQuantityFCL: 0,
          totalQuantityFCL: 0,
          ongoingQuantityMT: 0,
          completedQuantityMT: 0,
          totalQuantityMT: 0,
        };
      }

      itemsMap[itemTitle].months[month].ongoingCount += item.ongoingCount || 0;
      itemsMap[itemTitle].months[month].completedCount +=
        item.completedCount || 0;
      itemsMap[itemTitle].months[month].ongoingQuantityFCL +=
        item.ongoingQuantityFCL || 0;
      itemsMap[itemTitle].months[month].completedQuantityFCL +=
        item.completedQuantityFCL || 0;
      itemsMap[itemTitle].months[month].totalQuantityFCL +=
        item.totalQuantityFCL || 0;
      itemsMap[itemTitle].months[month].ongoingQuantityMT +=
        item.ongoingQuantityMT || 0;
      itemsMap[itemTitle].months[month].completedQuantityMT +=
        item.completedQuantityMT || 0;
      itemsMap[itemTitle].months[month].totalQuantityMT +=
        item.totalQuantityMT || 0;
    });

    // Convert to array of item rows with filtered months only
    const rows = [];
    Object.keys(itemsMap)
      .sort()
      .forEach((itemTitle) => {
        const item = itemsMap[itemTitle];

        // Initialize only filtered months + YTD
        const monthData = {};
        filteredMonths.forEach((month) => {
          monthData[month] = item.months[month] || {
            ongoingCount: 0,
            completedCount: 0,
            ongoingQuantityFCL: 0,
            completedQuantityFCL: 0,
            totalQuantityFCL: 0,
            ongoingQuantityMT: 0,
            completedQuantityMT: 0,
            totalQuantityMT: 0,
          };
        });

        // Calculate YTD (sum of filtered months only)
        const ytd = {
          ongoingCount: 0,
          completedCount: 0,
          ongoingQuantityFCL: 0,
          completedQuantityFCL: 0,
          totalQuantityFCL: 0,
          ongoingQuantityMT: 0,
          completedQuantityMT: 0,
          totalQuantityMT: 0,
        };
        Object.values(monthData).forEach((month) => {
          ytd.ongoingCount += month.ongoingCount || 0;
          ytd.completedCount += month.completedCount || 0;
          ytd.ongoingQuantityFCL += month.ongoingQuantityFCL || 0;
          ytd.completedQuantityFCL += month.completedQuantityFCL || 0;
          ytd.totalQuantityFCL += month.totalQuantityFCL || 0;
          ytd.ongoingQuantityMT += month.ongoingQuantityMT || 0;
          ytd.completedQuantityMT += month.completedQuantityMT || 0;
          ytd.totalQuantityMT += month.totalQuantityMT || 0;
        });

        rows.push({
          itemName: itemTitle,
          ytd,
          months: monthData,
        });
      });

    return rows;
  };

  // Prepare Table 2 data structure (Pivot format - items as rows, months as columns with amounts)
  const prepareTable2Data = () => {
    const itemsMap = {}; // itemTitle -> { month -> { ongoing, completed, total } }

    table2Data.forEach((item) => {
      const rawItemName = item.itemName || "Unknown";
      const itemTitle = normalizeItemTitle(rawItemName); // Normalize to group similar items
      const month = item.month || 0;

      if (!itemsMap[itemTitle]) {
        itemsMap[itemTitle] = {
          itemName: itemTitle,
          months: {},
        };
      }

      if (!itemsMap[itemTitle].months[month]) {
        itemsMap[itemTitle].months[month] = {
          ongoingAmount: 0,
          completedAmount: 0,
          totalAmount: 0,
        };
      }

      itemsMap[itemTitle].months[month].ongoingAmount +=
        item.ongoingAmount || 0;
      itemsMap[itemTitle].months[month].completedAmount +=
        item.completedAmount || 0;
      itemsMap[itemTitle].months[month].totalAmount += item.totalAmount || 0;
    });

    // Convert to array of item rows with filtered months only
    const rows = [];
    Object.keys(itemsMap)
      .sort()
      .forEach((itemTitle) => {
        const item = itemsMap[itemTitle];

        // Initialize only filtered months + YTD
        const monthData = {};
        filteredMonths.forEach((month) => {
          monthData[month] = item.months[month] || {
            ongoingAmount: 0,
            completedAmount: 0,
            totalAmount: 0,
          };
        });

        // Calculate YTD (sum of filtered months only)
        const ytd = {
          ongoingAmount: 0,
          completedAmount: 0,
          totalAmount: 0,
        };
        Object.values(monthData).forEach((month) => {
          ytd.ongoingAmount += month.ongoingAmount || 0;
          ytd.completedAmount += month.completedAmount || 0;
          ytd.totalAmount += month.totalAmount || 0;
        });

        rows.push({
          itemName: itemTitle,
          ytd,
          months: monthData,
        });
      });

    return rows;
  };

  // Prepare Purchase Table data structure (Pivot format)
  const preparePurchaseTableData = () => {
    const itemsMap = {};

    purchaseTableData.forEach((item) => {
      const month = item.month || 0;
      if (!month || month < 1 || month > 12) {
        return;
      }
      const itemTitle = item.itemName || "UNKNOWN";
      if (!itemsMap[itemTitle]) {
        itemsMap[itemTitle] = { itemName: itemTitle, months: {} };
      }

      if (!itemsMap[itemTitle].months[month]) {
        itemsMap[itemTitle].months[month] = {
          ongoingCount: 0,
          completedCount: 0,
          ongoingQuantityFCL: 0,
          completedQuantityFCL: 0,
          totalQuantityFCL: 0,
          ongoingQuantityMT: 0,
          completedQuantityMT: 0,
          totalQuantityMT: 0,
        };
      }

      itemsMap[itemTitle].months[month].ongoingCount += item.ongoingCount || 0;
      itemsMap[itemTitle].months[month].completedCount +=
        item.completedCount || 0;
      itemsMap[itemTitle].months[month].ongoingQuantityFCL +=
        item.ongoingQuantityFCL || 0;
      itemsMap[itemTitle].months[month].completedQuantityFCL +=
        item.completedQuantityFCL || 0;
      itemsMap[itemTitle].months[month].totalQuantityFCL +=
        item.totalQuantityFCL || 0;
      itemsMap[itemTitle].months[month].ongoingQuantityMT +=
        item.ongoingQuantityMT || 0;
      itemsMap[itemTitle].months[month].completedQuantityMT +=
        item.completedQuantityMT || 0;
      itemsMap[itemTitle].months[month].totalQuantityMT +=
        item.totalQuantityMT || 0;
    });

    const rows = [];
    Object.keys(itemsMap)
      .sort()
      .forEach((itemTitle) => {
        const item = itemsMap[itemTitle];

        const monthData = {};
        filteredMonths.forEach((month) => {
          monthData[month] = item.months[month] || {
            ongoingCount: 0,
            completedCount: 0,
            ongoingQuantityFCL: 0,
            completedQuantityFCL: 0,
            totalQuantityFCL: 0,
            ongoingQuantityMT: 0,
            completedQuantityMT: 0,
            totalQuantityMT: 0,
          };
        });

        const ytd = {
          ongoingCount: 0,
          completedCount: 0,
          ongoingQuantityFCL: 0,
          completedQuantityFCL: 0,
          totalQuantityFCL: 0,
          ongoingQuantityMT: 0,
          completedQuantityMT: 0,
          totalQuantityMT: 0,
        };

        Object.values(monthData).forEach((month) => {
          ytd.ongoingCount += month.ongoingCount || 0;
          ytd.completedCount += month.completedCount || 0;
          ytd.ongoingQuantityFCL += month.ongoingQuantityFCL || 0;
          ytd.completedQuantityFCL += month.completedQuantityFCL || 0;
          ytd.totalQuantityFCL += month.totalQuantityFCL || 0;
          ytd.ongoingQuantityMT += month.ongoingQuantityMT || 0;
          ytd.completedQuantityMT += month.completedQuantityMT || 0;
          ytd.totalQuantityMT += month.totalQuantityMT || 0;
        });

        rows.push({
          itemName: itemTitle,
          ytd,
          months: monthData,
        });
      });

    return rows;
  };

  const table1Rows = prepareTable1Data();
  const table2Rows = prepareTable2Data();
  const purchaseTableRows = preparePurchaseTableData();

  // Prepare Purchase Table 2 data structure (Amounts - Pivot format)
  const preparePurchaseTable2Data = () => {
    const itemsMap = {}; // itemTitle -> { month -> { ongoing, completed, total } }

    purchaseTable2Data.forEach((item) => {
      const rawItemName = item.itemName || "Unknown";
      const itemTitle = normalizeItemTitle(rawItemName); // Normalize to group similar items
      const month = item.month || 0;

      if (!itemsMap[itemTitle]) {
        itemsMap[itemTitle] = {
          itemName: itemTitle,
          months: {},
        };
      }

      if (!itemsMap[itemTitle].months[month]) {
        itemsMap[itemTitle].months[month] = {
          ongoingAmount: 0,
          completedAmount: 0,
          totalAmount: 0,
        };
      }

      itemsMap[itemTitle].months[month].ongoingAmount +=
        item.ongoingAmount || 0;
      itemsMap[itemTitle].months[month].completedAmount +=
        item.completedAmount || 0;
      itemsMap[itemTitle].months[month].totalAmount += item.totalAmount || 0;
    });

    // Convert to array of item rows with filtered months only
    const rows = [];
    Object.keys(itemsMap)
      .sort()
      .forEach((itemTitle) => {
        const item = itemsMap[itemTitle];

        // Initialize only filtered months + YTD
        const monthData = {};
        filteredMonths.forEach((month) => {
          monthData[month] = item.months[month] || {
            ongoingAmount: 0,
            completedAmount: 0,
            totalAmount: 0,
          };
        });

        // Calculate YTD (sum of filtered months only)
        const ytd = {
          ongoingAmount: 0,
          completedAmount: 0,
          totalAmount: 0,
        };
        Object.values(monthData).forEach((month) => {
          ytd.ongoingAmount += month.ongoingAmount || 0;
          ytd.completedAmount += month.completedAmount || 0;
          ytd.totalAmount += month.totalAmount || 0;
        });

        rows.push({
          itemName: itemTitle,
          ytd,
          months: monthData,
        });
      });

    return rows;
  };

  const purchaseTable2Rows = preparePurchaseTable2Data();

  // Prepare Sales WITHOUT Purchase data structure (Amounts - Pivot format)
  const prepareSalesWithoutPurchaseData = () => {
    const itemsMap = {}; // itemTitle -> { month -> { ongoing, completed, total } }

    table2WithoutPurchaseData.forEach((item) => {
      const rawItemName = item.itemName || "Unknown";
      const itemTitle = normalizeItemTitle(rawItemName); // Normalize to group similar items
      const month = item.month || 0;

      if (!itemsMap[itemTitle]) {
        itemsMap[itemTitle] = {
          itemName: itemTitle,
          months: {},
        };
      }

      if (!itemsMap[itemTitle].months[month]) {
        itemsMap[itemTitle].months[month] = {
          ongoingAmount: 0,
          completedAmount: 0,
          totalAmount: 0,
        };
      }

      itemsMap[itemTitle].months[month].ongoingAmount +=
        item.ongoingAmount || 0;
      itemsMap[itemTitle].months[month].completedAmount +=
        item.completedAmount || 0;
      itemsMap[itemTitle].months[month].totalAmount += item.totalAmount || 0;
    });

    // Convert to array of item rows with all months
    const rows = [];
    Object.keys(itemsMap)
      .sort()
      .forEach((itemTitle) => {
        const item = itemsMap[itemTitle];

        // Initialize only filtered months + YTD
        const monthData = {};
        filteredMonths.forEach((month) => {
          monthData[month] = item.months[month] || {
            ongoingAmount: 0,
            completedAmount: 0,
            totalAmount: 0,
          };
        });

        // Calculate YTD (sum of filtered months only)
        const ytd = {
          ongoingAmount: 0,
          completedAmount: 0,
          totalAmount: 0,
        };
        Object.values(monthData).forEach((month) => {
          ytd.ongoingAmount += month.ongoingAmount || 0;
          ytd.completedAmount += month.completedAmount || 0;
          ytd.totalAmount += month.totalAmount || 0;
        });

        rows.push({
          itemName: itemTitle,
          ytd,
          months: monthData,
        });
      });

    return rows;
  };

  const salesWithoutPurchaseRows = prepareSalesWithoutPurchaseData();

  // Prepare Sales Adjustments WITHOUT Purchase data structure
  const prepareSalesAdjustmentsWithoutPurchaseData = () => {
    const adjustmentsMap = {}; // month -> { additionalCharges, debitNotes, creditNotes, totalAdjustment }

    table3WithoutPurchaseData.forEach((item) => {
      const month = item.month || 0;

      if (!adjustmentsMap[month]) {
        adjustmentsMap[month] = {
          additionalCharges: 0,
          debitNotes: 0,
          creditNotes: 0,
          totalAdjustment: 0,
        };
      }

      adjustmentsMap[month].additionalCharges += item.additionalCharges || 0;
      adjustmentsMap[month].debitNotes += item.debitNotes || 0;
      adjustmentsMap[month].creditNotes += item.creditNotes || 0;
      adjustmentsMap[month].totalAdjustment += item.totalAdjustment || 0;
    });

    // Initialize only filtered months + YTD
    const monthData = {};
    filteredMonths.forEach((month) => {
      monthData[month] = adjustmentsMap[month] || {
        additionalCharges: 0,
        debitNotes: 0,
        creditNotes: 0,
        totalAdjustment: 0,
      };
    });

    // Calculate YTD (sum of filtered months only)
    const ytd = {
      additionalCharges: 0,
      debitNotes: 0,
      creditNotes: 0,
      totalAdjustment: 0,
    };
    Object.values(monthData).forEach((month) => {
      ytd.additionalCharges += month.additionalCharges || 0;
      ytd.debitNotes += month.debitNotes || 0;
      ytd.creditNotes += month.creditNotes || 0;
      ytd.totalAdjustment += month.totalAdjustment || 0;
    });

    return {
      ytd,
      months: monthData,
    };
  };

  const salesAdjustmentsWithoutPurchasePrepared =
    prepareSalesAdjustmentsWithoutPurchaseData();

  // Prepare Table 3 data structure (Sales Adjustments - Additional Charges, Debit Notes, Credit Notes)
  const prepareTable3Data = () => {
    const adjustmentsMap = {}; // month -> { additionalCharges, debitNotes, creditNotes, totalAdjustment }

    table3Data.forEach((item) => {
      const month = item.month || 0;

      if (!adjustmentsMap[month]) {
        adjustmentsMap[month] = {
          additionalCharges: 0,
          debitNotes: 0,
          creditNotes: 0,
          totalAdjustment: 0,
        };
      }

      adjustmentsMap[month].additionalCharges += item.additionalCharges || 0;
      adjustmentsMap[month].debitNotes += item.debitNotes || 0;
      adjustmentsMap[month].creditNotes += item.creditNotes || 0;
      adjustmentsMap[month].totalAdjustment += item.totalAdjustment || 0;
    });

    // Initialize only filtered months + YTD
    const monthData = {};
    filteredMonths.forEach((month) => {
      monthData[month] = adjustmentsMap[month] || {
        additionalCharges: 0,
        debitNotes: 0,
        creditNotes: 0,
        totalAdjustment: 0,
      };
    });

    // Calculate YTD (sum of filtered months only)
    const ytd = {
      additionalCharges: 0,
      debitNotes: 0,
      creditNotes: 0,
      totalAdjustment: 0,
    };
    Object.values(monthData).forEach((month) => {
      ytd.additionalCharges += month.additionalCharges || 0;
      ytd.debitNotes += month.debitNotes || 0;
      ytd.creditNotes += month.creditNotes || 0;
      ytd.totalAdjustment += month.totalAdjustment || 0;
    });

    return {
      ytd,
      months: monthData,
    };
  };

  const table3DataPrepared = prepareTable3Data();

  // Prepare Table 4 data structure (Purchase Adjustments - Additional Charges, Debit Notes, Credit Notes)
  const prepareTable4Data = () => {
    const adjustmentsMap = {}; // month -> { additionalCharges, debitNotes, creditNotes, totalAdjustment }

    table4Data.forEach((item) => {
      const month = item.month || 0;

      if (!adjustmentsMap[month]) {
        adjustmentsMap[month] = {
          additionalCharges: 0,
          debitNotes: 0,
          creditNotes: 0,
          totalAdjustment: 0,
        };
      }

      adjustmentsMap[month].additionalCharges += item.additionalCharges || 0;
      adjustmentsMap[month].debitNotes += item.debitNotes || 0;
      adjustmentsMap[month].creditNotes += item.creditNotes || 0;
      adjustmentsMap[month].totalAdjustment += item.totalAdjustment || 0;
    });

    // Initialize only filtered months + YTD
    const monthData = {};
    filteredMonths.forEach((month) => {
      monthData[month] = adjustmentsMap[month] || {
        additionalCharges: 0,
        debitNotes: 0,
        creditNotes: 0,
        totalAdjustment: 0,
      };
    });

    // Calculate YTD (sum of filtered months only)
    const ytd = {
      additionalCharges: 0,
      debitNotes: 0,
      creditNotes: 0,
      totalAdjustment: 0,
    };
    Object.values(monthData).forEach((month) => {
      ytd.additionalCharges += month.additionalCharges || 0;
      ytd.debitNotes += month.debitNotes || 0;
      ytd.creditNotes += month.creditNotes || 0;
      ytd.totalAdjustment += month.totalAdjustment || 0;
    });

    return {
      ytd,
      months: monthData,
    };
  };

  const table4DataPrepared = prepareTable4Data();

  // Prepare Cost of Goods data (COGS) by month with YTD totals
  const prepareCostOfGoodsData = () => {
    const monthMap = {};

    costOfGoodsData.forEach((item) => {
      const month = item.month || 0;
      if (!month || month < 1 || month > 12) return;

      if (!monthMap[month]) {
        monthMap[month] = {
          forecastBalance: 0,
          actualFreight: 0,
          handlingCharges: 0,
          demurrageDetention: 0,
          transportation: 0,
          warehouseCharges: 0,
          insurance: 0,
          commission: 0,
          courierCharges: 0,
          totalCOGS: 0,
        };
      }

      monthMap[month].forecastBalance += item.forecastBalance || 0;
      monthMap[month].actualFreight += item.actualFreight || 0;
      monthMap[month].handlingCharges += item.handlingCharges || 0;
      monthMap[month].demurrageDetention += item.demurrageDetention || 0;
      monthMap[month].transportation += item.transportation || 0;
      monthMap[month].warehouseCharges += item.warehouseCharges || 0;
      monthMap[month].insurance += item.insurance || 0;
      monthMap[month].commission += item.commission || 0;
      monthMap[month].courierCharges += item.courierCharges || 0;
      monthMap[month].totalCOGS += item.totalCOGS || 0;
    });

    // Initialize only filtered months
    const months = {};
    filteredMonths.forEach((month) => {
      months[month] = monthMap[month] || {
        forecastBalance: 0,
        actualFreight: 0,
        handlingCharges: 0,
        demurrageDetention: 0,
        transportation: 0,
        warehouseCharges: 0,
        insurance: 0,
        commission: 0,
        courierCharges: 0,
        totalCOGS: 0,
      };
    });

    // YTD totals
    const ytd = {
      forecastBalance: 0,
      actualFreight: 0,
      handlingCharges: 0,
      demurrageDetention: 0,
      transportation: 0,
      warehouseCharges: 0,
      insurance: 0,
      commission: 0,
      courierCharges: 0,
      totalCOGS: 0,
    };

    Object.values(months).forEach((m) => {
      ytd.forecastBalance += m.forecastBalance || 0;
      ytd.actualFreight += m.actualFreight || 0;
      ytd.handlingCharges += m.handlingCharges || 0;
      ytd.demurrageDetention += m.demurrageDetention || 0;
      ytd.transportation += m.transportation || 0;
      ytd.warehouseCharges += m.warehouseCharges || 0;
      ytd.insurance += m.insurance || 0;
      ytd.commission += m.commission || 0;
      ytd.courierCharges += m.courierCharges || 0;
      ytd.totalCOGS += m.totalCOGS || 0;
    });

    return { ytd, months };
  };

  const costOfGoodsPrepared = prepareCostOfGoodsData();

  // Prepare OTHER INCOME data (simple monthly + YTD totals)
  const prepareOtherIncomeData = () => {
    const months = {};
    for (let m = 1; m <= 12; m++) {
      months[m] = { amount: 0 };
    }

    otherIncomeData.forEach((item) => {
      const month = item.month || 0;
      if (!month || month < 1 || month > 12) return;
      months[month].amount += item.amount || 0;
    });

    const ytd = { amount: 0 };
    Object.values(months).forEach((m) => {
      ytd.amount += m.amount || 0;
    });

    return { ytd, months };
  };

  const otherIncomePrepared = prepareOtherIncomeData();

  // Prepare EXPENSES (non sales/purchase) data (simple monthly + YTD totals)
  const prepareOtherExpensesData = () => {
    const months = {};
    for (let m = 1; m <= 12; m++) {
      months[m] = { amount: 0 };
    }

    otherExpensesData.forEach((item) => {
      const month = item.month || 0;
      if (!month || month < 1 || month > 12) return;
      months[month].amount += item.amount || 0;
    });

    const ytd = { amount: 0 };
    Object.values(months).forEach((m) => {
      ytd.amount += m.amount || 0;
    });

    return { ytd, months };
  };

  const otherExpensesPrepared = prepareOtherExpensesData();

  // Calculate totals for Table 1 (Counts)
  const calculateTable1Totals = () => {
    const totals = {
      ytd: {
        ongoingCount: 0,
        completedCount: 0,
        ongoingQuantityFCL: 0,
        completedQuantityFCL: 0,
        totalQuantityFCL: 0,
        ongoingQuantityMT: 0,
        completedQuantityMT: 0,
        totalQuantityMT: 0,
      },
      months: {},
    };

    // Initialize only filtered months
    filteredMonths.forEach((month) => {
      totals.months[month] = {
        ongoingCount: 0,
        completedCount: 0,
        ongoingQuantityFCL: 0,
        completedQuantityFCL: 0,
        totalQuantityFCL: 0,
        ongoingQuantityMT: 0,
        completedQuantityMT: 0,
        totalQuantityMT: 0,
      };
    });

    // Sum all rows
    table1Rows.forEach((row) => {
      totals.ytd.ongoingCount += row.ytd.ongoingCount || 0;
      totals.ytd.completedCount += row.ytd.completedCount || 0;
      totals.ytd.ongoingQuantityFCL += row.ytd.ongoingQuantityFCL || 0;
      totals.ytd.completedQuantityFCL += row.ytd.completedQuantityFCL || 0;
      totals.ytd.totalQuantityFCL += row.ytd.totalQuantityFCL || 0;
      totals.ytd.ongoingQuantityMT += row.ytd.ongoingQuantityMT || 0;
      totals.ytd.completedQuantityMT += row.ytd.completedQuantityMT || 0;
      totals.ytd.totalQuantityMT += row.ytd.totalQuantityMT || 0;

      filteredMonths.forEach((month) => {
        const monthData = row.months[month] || {};
        totals.months[month].ongoingCount += monthData.ongoingCount || 0;
        totals.months[month].completedCount += monthData.completedCount || 0;
        totals.months[month].ongoingQuantityFCL +=
          monthData.ongoingQuantityFCL || 0;
        totals.months[month].completedQuantityFCL +=
          monthData.completedQuantityFCL || 0;
        totals.months[month].totalQuantityFCL +=
          monthData.totalQuantityFCL || 0;
        totals.months[month].ongoingQuantityMT +=
          monthData.ongoingQuantityMT || 0;
        totals.months[month].completedQuantityMT +=
          monthData.completedQuantityMT || 0;
        totals.months[month].totalQuantityMT += monthData.totalQuantityMT || 0;
      });
    });

    return totals;
  };

  // Calculate totals for Table 2 (Amounts)
  const calculateTable2Totals = () => {
    const totals = {
      ytd: { ongoingAmount: 0, completedAmount: 0, totalAmount: 0 },
      months: {},
    };

    // Initialize only filtered months
    filteredMonths.forEach((month) => {
      totals.months[month] = {
        ongoingAmount: 0,
        completedAmount: 0,
        totalAmount: 0,
      };
    });

    // Sum all rows
    table2Rows.forEach((row) => {
      totals.ytd.ongoingAmount += row.ytd.ongoingAmount || 0;
      totals.ytd.completedAmount += row.ytd.completedAmount || 0;
      totals.ytd.totalAmount += row.ytd.totalAmount || 0;

      filteredMonths.forEach((month) => {
        const monthData = row.months[month] || {};
        totals.months[month].ongoingAmount += monthData.ongoingAmount || 0;
        totals.months[month].completedAmount += monthData.completedAmount || 0;
        totals.months[month].totalAmount += monthData.totalAmount || 0;
      });
    });

    return totals;
  };

  const table1Totals = calculateTable1Totals();
  const table2Totals = calculateTable2Totals();

  const calculatePurchaseTableTotals = () => {
    const totals = {
      ytd: {
        ongoingCount: 0,
        completedCount: 0,
        ongoingQuantityFCL: 0,
        completedQuantityFCL: 0,
        totalQuantityFCL: 0,
        ongoingQuantityMT: 0,
        completedQuantityMT: 0,
        totalQuantityMT: 0,
      },
      months: {},
    };

    filteredMonths.forEach((month) => {
      totals.months[month] = {
        ongoingCount: 0,
        completedCount: 0,
        ongoingQuantityFCL: 0,
        completedQuantityFCL: 0,
        totalQuantityFCL: 0,
        ongoingQuantityMT: 0,
        completedQuantityMT: 0,
        totalQuantityMT: 0,
      };
    });

    purchaseTableRows.forEach((row) => {
      totals.ytd.ongoingCount += row.ytd.ongoingCount || 0;
      totals.ytd.completedCount += row.ytd.completedCount || 0;
      totals.ytd.ongoingQuantityFCL += row.ytd.ongoingQuantityFCL || 0;
      totals.ytd.completedQuantityFCL += row.ytd.completedQuantityFCL || 0;
      totals.ytd.totalQuantityFCL += row.ytd.totalQuantityFCL || 0;
      totals.ytd.ongoingQuantityMT += row.ytd.ongoingQuantityMT || 0;
      totals.ytd.completedQuantityMT += row.ytd.completedQuantityMT || 0;
      totals.ytd.totalQuantityMT += row.ytd.totalQuantityMT || 0;

      filteredMonths.forEach((month) => {
        const monthData = row.months[month] || {};
        totals.months[month].ongoingCount += monthData.ongoingCount || 0;
        totals.months[month].completedCount += monthData.completedCount || 0;
        totals.months[month].ongoingQuantityFCL +=
          monthData.ongoingQuantityFCL || 0;
        totals.months[month].completedQuantityFCL +=
          monthData.completedQuantityFCL || 0;
        totals.months[month].totalQuantityFCL +=
          monthData.totalQuantityFCL || 0;
        totals.months[month].ongoingQuantityMT +=
          monthData.ongoingQuantityMT || 0;
        totals.months[month].completedQuantityMT +=
          monthData.completedQuantityMT || 0;
        totals.months[month].totalQuantityMT += monthData.totalQuantityMT || 0;
      });
    });

    return totals;
  };

  const purchaseTableTotals = calculatePurchaseTableTotals();

  // Calculate totals for Purchase Table 2 (Amounts)
  const calculatePurchaseTable2Totals = () => {
    const totals = {
      ytd: { ongoingAmount: 0, completedAmount: 0, totalAmount: 0 },
      months: {},
    };

    // Initialize only filtered months
    filteredMonths.forEach((month) => {
      totals.months[month] = {
        ongoingAmount: 0,
        completedAmount: 0,
        totalAmount: 0,
      };
    });

    // Sum all rows
    purchaseTable2Rows.forEach((row) => {
      totals.ytd.ongoingAmount += row.ytd.ongoingAmount || 0;
      totals.ytd.completedAmount += row.ytd.completedAmount || 0;
      totals.ytd.totalAmount += row.ytd.totalAmount || 0;

      filteredMonths.forEach((month) => {
        const monthData = row.months[month] || {};
        totals.months[month].ongoingAmount += monthData.ongoingAmount || 0;
        totals.months[month].completedAmount += monthData.completedAmount || 0;
        totals.months[month].totalAmount += monthData.totalAmount || 0;
      });
    });

    return totals;
  };

  const purchaseTable2Totals = calculatePurchaseTable2Totals();

  // Calculate Actual Total Sales = Total Sales (from Table 2) + Total Adjustment (from Table 3)
  const calculateActualTotalSales = () => {
    // Calculate actual total sales: Total Sales + Total Adjustment
    const actualTotalSales = {
      ytd: 0,
      months: {},
    };

    // Calculate for YTD
    actualTotalSales.ytd =
      (table2Totals.ytd.totalAmount || 0) +
      (table3DataPrepared.ytd.totalAdjustment || 0);

    // Calculate for each filtered month
    filteredMonths.forEach((month) => {
      const monthSales = table2Totals.months[month]?.totalAmount || 0;
      const monthAdjustment =
        table3DataPrepared.months[month]?.totalAdjustment || 0;
      actualTotalSales.months[month] = monthSales + monthAdjustment;
    });

    return actualTotalSales;
  };

  const actualTotalSales = calculateActualTotalSales();

  // Calculate Actual Total Purchase = Total Purchase (from Purchase Table 2) - Purchase Adjustment (from Table 4)
  const calculateActualTotalPurchase = () => {
    const actualTotalPurchase = {
      ytd: 0,
      months: {},
    };

    // YTD
    actualTotalPurchase.ytd =
      (purchaseTable2Totals.ytd.totalAmount || 0) -
      (table4DataPrepared.ytd.totalAdjustment || 0);

    // Monthly
    filteredMonths.forEach((month) => {
      const monthPurchase =
        purchaseTable2Totals.months[month]?.totalAmount || 0;
      const monthAdjustment =
        table4DataPrepared.months[month]?.totalAdjustment || 0;
      actualTotalPurchase.months[month] = monthPurchase - monthAdjustment;
    });

    return actualTotalPurchase;
  };

  const actualTotalPurchase = calculateActualTotalPurchase();

  // Calculate Gross Profit & (Loss) = ACTUAL TOTAL SALES - ACTUAL TOTAL PURCHASE
  const calculateGrossProfit = () => {
    const grossProfit = {
      ytd: 0,
      months: {},
    };

    grossProfit.ytd =
      (actualTotalSales.ytd || 0) - (actualTotalPurchase.ytd || 0);

    filteredMonths.forEach((month) => {
      const monthSales = actualTotalSales.months[month] || 0;
      const monthPurchase = actualTotalPurchase.months[month] || 0;
      grossProfit.months[month] = monthSales - monthPurchase;
    });

    return grossProfit;
  };

  const grossProfit = calculateGrossProfit();

  // Calculate Gross Profit & (Loss) = Gross Profit - TOTAL COST OF GOODS
  const calculateNetProfit = () => {
    const netProfit = {
      ytd: 0,
      months: {},
    };

    netProfit.ytd =
      (grossProfit.ytd || 0) - (costOfGoodsPrepared.ytd.totalCOGS || 0);

    filteredMonths.forEach((month) => {
      const monthGross = grossProfit.months[month] || 0;
      const monthCOGS = costOfGoodsPrepared.months[month]?.totalCOGS || 0;
      netProfit.months[month] = monthGross - monthCOGS;
    });

    return netProfit;
  };

  const netProfit = calculateNetProfit();

  // Calculate Profit/Loss Percentage based on Actual Total Sales
  const calculateProfitPercentage = () => {
    const percentage = {
      ytd: 0,
      months: {},
    };

    const ytdSales = actualTotalSales.ytd || 0;
    percentage.ytd = ytdSales !== 0 ? (netProfit.ytd / ytdSales) * 100 : 0;

    filteredMonths.forEach((month) => {
      const monthSales = actualTotalSales.months[month] || 0;
      const monthNet = netProfit.months[month] || 0;
      percentage.months[month] =
        monthSales !== 0 ? (monthNet / monthSales) * 100 : 0;
    });

    return percentage;
  };

  const profitPercentage = calculateProfitPercentage();

  const getProfitStatus = (amount) => {
    if (amount > 0) return "PROFIT";
    if (amount < 0) return "LOSS";
    return "BREAK EVEN";
  };

  // Fetch breakdown data (optimized - only fetch when needed)
  const fetchBreakdown = async (type) => {
    setBreakdownModal({ isOpen: true, type, data: null, loading: true });
    setItemsPagination({}); // Reset pagination when opening modal

    // For calculated values, show formula breakdown without API call
    if (
      type === "sales" ||
      type === "purchase" ||
      type === "grossProfit" ||
      type === "netProfit" ||
      type === "salesAdjustments" ||
      type === "purchaseAdjustments" ||
      type === "otherIncome"
    ) {
      let breakdownData = null;

      if (type === "sales") {
        breakdownData = {
          source: "Calculated Value",
          description:
            "ACTUAL TOTAL SALES = Total Sales (from Sales Amounts Table) + Total Adjustment (from Sales Adjustments)",
          formula: `ACTUAL TOTAL SALES = ${formatCurrency(
            table2Totals.ytd.totalAmount
          )} + ${formatCurrency(
            table3DataPrepared.ytd.totalAdjustment
          )} = ${formatCurrency(actualTotalSales.ytd)}`,
          components: [
            {
              name: "Total Sales (Table 2)",
              amount: table2Totals.ytd.totalAmount,
              source: "Sales Amounts Table",
            },
            {
              name: "Total Sales Adjustments (Table 3)",
              amount: table3DataPrepared.ytd.totalAdjustment,
              source:
                "Sales Adjustments (Additional Charges + Debit Notes - Credit Notes)",
            },
          ],
          total: actualTotalSales.ytd,
        };
      } else if (type === "purchase") {
        breakdownData = {
          source: "Calculated Value",
          description:
            "ACTUAL TOTAL PURCHASE = Total Purchase (from Purchase Amounts Table) - Total Adjustment (from Purchase Adjustments)",
          formula: `ACTUAL TOTAL PURCHASE = ${formatCurrency(
            purchaseTable2Totals.ytd.totalAmount
          )} - ${formatCurrency(
            table4DataPrepared.ytd.totalAdjustment
          )} = ${formatCurrency(actualTotalPurchase.ytd)}`,
          components: [
            {
              name: "Total Purchase (Purchase Table 2)",
              amount: purchaseTable2Totals.ytd.totalAmount,
              source: "Purchase Amounts Table",
            },
            {
              name: "Total Purchase Adjustments (Table 4)",
              amount: table4DataPrepared.ytd.totalAdjustment,
              source:
                "Purchase Adjustments (Additional Charges + Debit Notes - Credit Notes)",
            },
          ],
          total: actualTotalPurchase.ytd,
        };
      } else if (type === "grossProfit") {
        breakdownData = {
          source: "Calculated Value",
          description:
            "GROSS PROFIT & (LOSS) = ACTUAL TOTAL SALES - ACTUAL TOTAL PURCHASE",
          formula: `GROSS PROFIT = ${formatCurrency(
            actualTotalSales.ytd
          )} - ${formatCurrency(actualTotalPurchase.ytd)} = ${formatCurrency(
            grossProfit.ytd
          )}`,
          components: [
            {
              name: "Actual Total Sales",
              amount: actualTotalSales.ytd,
              source: "Calculated from Sales + Adjustments",
            },
            {
              name: "Actual Total Purchase",
              amount: actualTotalPurchase.ytd,
              source: "Calculated from Purchase - Adjustments",
            },
          ],
          total: grossProfit.ytd,
        };
      } else if (type === "netProfit") {
        breakdownData = {
          source: "Calculated Value",
          description:
            "NET PROFIT & (LOSS) = GROSS PROFIT - TOTAL COST OF GOODS",
          formula: `NET PROFIT = ${formatCurrency(
            grossProfit.ytd
          )} - ${formatCurrency(
            costOfGoodsPrepared.ytd.totalCOGS
          )} = ${formatCurrency(netProfit.ytd)}`,
          components: [
            {
              name: "Gross Profit",
              amount: grossProfit.ytd,
              source: "Calculated from Sales - Purchase",
            },
            {
              name: "Total Cost of Goods",
              amount: costOfGoodsPrepared.ytd.totalCOGS,
              source: "Cost of Goods (COGS) - See breakdown for details",
            },
          ],
          total: netProfit.ytd,
        };
      } else if (type === "salesAdjustments") {
        breakdownData = {
          source: "Sales Adjustments",
          description:
            "Total Sales Adjustments = Additional Charges + Debit Notes - Credit Notes",
          formula: `TOTAL ADJUSTMENT = ${formatCurrency(
            table3DataPrepared.ytd.additionalCharges
          )} + ${formatCurrency(
            table3DataPrepared.ytd.debitNotes
          )} - ${formatCurrency(
            table3DataPrepared.ytd.creditNotes
          )} = ${formatCurrency(table3DataPrepared.ytd.totalAdjustment)}`,
          components: [
            {
              name: "Additional Charges",
              amount: table3DataPrepared.ytd.additionalCharges,
              source:
                "Shipments, Vendor Invoices, Expenses linked to sales contracts",
            },
            {
              name: "Debit Notes",
              amount: table3DataPrepared.ytd.debitNotes,
              source: "Customer Debit Notes",
            },
            {
              name: "Credit Notes",
              amount: -table3DataPrepared.ytd.creditNotes,
              source: "Customer Credit Notes (subtracted)",
            },
          ],
          total: table3DataPrepared.ytd.totalAdjustment,
        };
      } else if (type === "purchaseAdjustments") {
        breakdownData = {
          source: "Purchase Adjustments",
          description:
            "Total Purchase Adjustments = Additional Charges + Debit Notes - Credit Notes",
          formula: `TOTAL ADJUSTMENT = ${formatCurrency(
            table4DataPrepared.ytd.additionalCharges
          )} + ${formatCurrency(
            table4DataPrepared.ytd.debitNotes
          )} - ${formatCurrency(
            table4DataPrepared.ytd.creditNotes
          )} = ${formatCurrency(table4DataPrepared.ytd.totalAdjustment)}`,
          components: [
            {
              name: "Additional Charges",
              amount: table4DataPrepared.ytd.additionalCharges,
              source:
                "Shipments, Vendor Invoices, Expenses linked to purchase contracts",
            },
            {
              name: "Debit Notes",
              amount: table4DataPrepared.ytd.debitNotes,
              source: "Vendor Debit Notes",
            },
            {
              name: "Credit Notes",
              amount: -table4DataPrepared.ytd.creditNotes,
              source: "Vendor Credit Notes (subtracted)",
            },
          ],
          total: table4DataPrepared.ytd.totalAdjustment,
        };
      } else if (type === "otherIncome") {
        breakdownData = {
          source: "Transaction Collection",
          description:
            "Other Income from bank/cash transactions of type 'Income' (non sales/purchase related)",
          components: [],
          total: otherIncomePrepared.ytd.amount,
        };
      }

      setBreakdownModal({
        isOpen: true,
        type,
        data: breakdownData,
        loading: false,
      });
      return;
    }

    // For expenses and cogs, fetch from API
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(searchParams).filter(([_, v]) => {
          if (Array.isArray(v)) {
            return v.length > 0;
          }
          return v !== "" && v !== null && v !== undefined && v !== "undefined";
        })
      );

      if (
        cleanParams.salesContracts &&
        Array.isArray(cleanParams.salesContracts)
      ) {
        cleanParams.salesContracts = cleanParams.salesContracts.join(",");
      }

      const response = await axios.get(
        `${Base_URL}/sales-reports/pl-breakdown`,
        {
          params: cleanParams,
          headers: {
            authorization: `Bearer ${adminInfo?.token}`,
          },
        }
      );

      if (response.data.success) {
        setBreakdownModal({
          isOpen: true,
          type,
          data:
            type === "expenses"
              ? response.data.data.expenses
              : response.data.data.costOfGoods,
          loading: false,
        });
      } else {
        toast.error("Failed to fetch breakdown data");
        setBreakdownModal({
          isOpen: false,
          type: null,
          data: null,
          loading: false,
        });
      }
    } catch (err) {
      console.error("Error fetching breakdown:", err);
      toast.error("Failed to fetch breakdown data");
      setBreakdownModal({
        isOpen: false,
        type: null,
        data: null,
        loading: false,
      });
    }
  };

  return (
    <div
      className="p-6 bg-gray-50 min-h-screen"
      style={{ overflowX: "hidden" }}
    >
      <style>{`
        /* Custom scrollbar for table containers */
        .table-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        
        .table-scroll-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .table-scroll-container::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        
        .table-scroll-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        
        .table-scroll-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              P & L Master Reports
            </h2>
            {baseCurrency && baseCurrency !== "USD" && (
              <p className="text-sm text-gray-600 mt-1">
                Base Currency:{" "}
                <span className="font-semibold">{baseCurrency}</span>
              </p>
            )}
          </div>
        </div>

        {/* Simplified Filters - Business, Year, Type, Sales Contract, and Date Range */}
        <div className="space-y-4">
          {/* First Row: Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {adminId ? (
              <BusinessDropdown
                adminId={adminId}
                selectedBusiness={searchParams.business || ""}
                onChange={(val) => {
                  setSearchParams((prev) => ({
                    ...prev,
                    business: val,
                    salesContracts: [],
                  }));
                }}
                placeholder="Business"
                className="text-sm"
              />
            ) : (
              <InputField
                type="text"
                name="business"
                value=""
                placeholder="Business (Loading...)"
                className="text-sm"
                disabled
              />
            )}

            <DropdownBasic
              placeholder="Year"
              name="year"
              value={searchParams.year || ""}
              onChange={(val) =>
                setSearchParams((prev) => ({
                  ...prev,
                  year: val,
                  salesContracts: [],
                }))
              }
              options={yearOptions}
              className="text-sm"
            />

            <DropdownBasic
              placeholder="Type"
              name="type"
              value={searchParams.type || ""}
              onChange={(val) =>
                setSearchParams((prev) => ({ ...prev, type: val }))
              }
              options={typeOptions}
              className="text-sm"
            />

            <DropdownBasic
              placeholder="Status"
              name="status"
              value={searchParams.status || "all"}
              onChange={(val) =>
                setSearchParams((prev) => ({ ...prev, status: val || "all" }))
              }
              options={statusOptions}
              className="text-sm"
            />

            <DateRangeComponent
              initialStartDate={
                searchParams.startDate
                  ? new Date(searchParams.startDate)
                  : undefined
              }
              initialEndDate={
                searchParams.endDate
                  ? new Date(searchParams.endDate)
                  : undefined
              }
              startDate={
                searchParams.startDate
                  ? new Date(searchParams.startDate)
                  : undefined
              }
              endDate={
                searchParams.endDate
                  ? new Date(searchParams.endDate)
                  : undefined
              }
              onApply={(startDate, endDate) => {
                setSearchParams((prev) => ({
                  ...prev,
                  startDate: startDate || "",
                  endDate: endDate || "",
                }));
              }}
              onChange={({ startDate, endDate }) => {
                // This handles real-time updates if needed
              }}
              onClear={() => {
                setSearchParams((prev) => ({
                  ...prev,
                  startDate: "",
                  endDate: "",
                }));
              }}
              width="auto"
              className="text-sm"
            />
          </div>

          {/* Second Row: Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <DropdownBasic
              placeholder={
                loadingContracts
                  ? "Loading contracts..."
                  : !searchParams.year
                  ? "Select year first"
                  : "Sales Contract (All)"
              }
              name="salesContracts"
              value={searchParams.salesContracts || []}
              onChange={(val) =>
                setSearchParams((prev) => ({
                  ...prev,
                  salesContracts: Array.isArray(val) ? val : [],
                }))
              }
              options={salesContractOptions}
              isMulti={true}
              className="text-sm min-w-[250px]"
              isDisabled={loadingContracts || !searchParams.year}
            />
            <button
              onClick={fetchPLData}
              disabled={!searchParams.year || loading}
              className="bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white flex items-center justify-center px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="mr-2" size={16} />
              Search
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={!searchParams.year || loading || exportLoading}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center justify-center px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? (
                <>
                  <Loader className="mr-2 animate-spin" size={16} />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2" size={16} />
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-8">
          <LoaderComponent />
        </div>
      )}

      {/* Table 1: Item Counts and Quantities - Pivot Format */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            TOTAL Quantity (FCL)
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows item name with contract counts by status (Ongoing/Completed)
            for each month
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-100 z-30">
                  Item Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200">
                  YTD
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showCompleted() ? "flex-1 border-r" : ""
                        }`}
                      >
                        Ongoing
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                </th>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <th
                      key={month}
                      className="px-2 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200 min-w-[120px]"
                    >
                      {month.toUpperCase()}
                      <div className="flex mt-1">
                        {showOngoing() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showCompleted()
                                ? "flex-1 border-r border-gray-300"
                                : ""
                            }`}
                          >
                            Ongoing
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table1Rows.map((row) => (
                <tr key={row.itemName} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                    {row.itemName}
                  </td>
                  {/* YTD Column */}
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex">
                      {showOngoing() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showCompleted()
                              ? "flex-1 border-r border-gray-200"
                              : ""
                          }`}
                        >
                          {row.ytd.ongoingCount}
                        </span>
                      )}
                      {showCompleted() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showOngoing() ? "flex-1" : ""
                          }`}
                        >
                          {row.ytd.completedCount}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Monthly Columns */}
                  {filteredMonths.map((monthNum) => {
                    const month = monthNames[monthNum - 1];
                    const monthData = row.months[monthNum] || {
                      ongoingCount: 0,
                      completedCount: 0,
                    };
                    return (
                      <td
                        key={month}
                        className="px-2 py-2 border-r border-gray-300"
                      >
                        <div className="flex">
                          {showOngoing() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showCompleted()
                                  ? "flex-1 border-r border-gray-200"
                                  : ""
                              }`}
                            >
                              {monthData.ongoingCount || 0}
                            </span>
                          )}
                          {showCompleted() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showOngoing() ? "flex-1" : ""
                              }`}
                            >
                              {monthData.completedCount || 0}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-gray-700 z-20">
                  TOTAL Quantity (FCL)
                </td>
                {/* YTD Total */}
                <td className="px-2 py-3 border-r border-gray-600">
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                          showCompleted() ? "flex-1" : ""
                        }`}
                      >
                        {table1Totals.ytd.ongoingCount}
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-sm text-right px-1 py-1 font-bold ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        {table1Totals.ytd.completedCount}
                      </span>
                    )}
                  </div>
                </td>
                {/* Monthly Totals */}
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthTotal = table1Totals.months[monthNum] || {
                    ongoingCount: 0,
                    completedCount: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 border-r border-gray-600"
                    >
                      <div className="flex">
                        {showOngoing() && (
                          <span
                            className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                              showCompleted() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.ongoingCount}
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-sm text-right px-1 py-1 font-bold ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.completedCount}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 1b: TOTAL Quantity (MT) */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            {" "}
            TOTAL Quantity (MT)
          </h3>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-100 z-30">
                  Item Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200">
                  YTD
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showCompleted() ? "flex-1 border-r" : ""
                        }`}
                      >
                        Ongoing
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                </th>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <th
                      key={month}
                      className="px-2 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200 min-w-[120px]"
                    >
                      {month.toUpperCase()}
                      <div className="flex mt-1">
                        {showOngoing() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showCompleted()
                                ? "flex-1 border-r border-gray-300"
                                : ""
                            }`}
                          >
                            Ongoing
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table1Rows.map((row) => (
                <tr key={row.itemName} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                    {row.itemName}
                  </td>
                  {/* YTD Column */}
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex">
                      {showOngoing() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showCompleted()
                              ? "flex-1 border-r border-gray-200"
                              : ""
                          }`}
                        >
                          {row.ytd.ongoingQuantityMT?.toFixed(2) || "0.00"}
                        </span>
                      )}
                      {showCompleted() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showOngoing() ? "flex-1" : ""
                          }`}
                        >
                          {row.ytd.completedQuantityMT?.toFixed(2) || "0.00"}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Monthly Columns */}
                  {filteredMonths.map((monthNum) => {
                    const month = monthNames[monthNum - 1];
                    const monthData = row.months[monthNum] || {
                      ongoingQuantityMT: 0,
                      completedQuantityMT: 0,
                    };
                    return (
                      <td
                        key={month}
                        className="px-2 py-2 border-r border-gray-300"
                      >
                        <div className="flex">
                          {showOngoing() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showCompleted()
                                  ? "flex-1 border-r border-gray-200"
                                  : ""
                              }`}
                            >
                              {monthData.ongoingQuantityMT?.toFixed(2) ||
                                "0.00"}
                            </span>
                          )}
                          {showCompleted() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showOngoing() ? "flex-1" : ""
                              }`}
                            >
                              {monthData.completedQuantityMT?.toFixed(2) ||
                                "0.00"}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-gray-700 z-20">
                  TOTAL Quantity (MT)
                </td>
                {/* YTD Total */}
                <td className="px-2 py-3 border-r border-gray-600">
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                          showCompleted() ? "flex-1" : ""
                        }`}
                      >
                        {table1Totals.ytd.ongoingQuantityMT?.toFixed(2) ||
                          "0.00"}
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-sm text-right px-1 py-1 font-bold ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        {table1Totals.ytd.completedQuantityMT?.toFixed(2) ||
                          "0.00"}
                      </span>
                    )}
                  </div>
                </td>
                {/* Monthly Totals */}
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthTotal = table1Totals.months[monthNum] || {
                    ongoingQuantityMT: 0,
                    completedQuantityMT: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 border-r border-gray-600"
                    >
                      <div className="flex">
                        {showOngoing() && (
                          <span
                            className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                              showCompleted() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.ongoingQuantityMT?.toFixed(2) || "0.00"}
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-sm text-right px-1 py-1 font-bold ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.completedQuantityMT?.toFixed(2) ||
                              "0.00"}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Item Amounts - Pivot Format */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            {" "}
            SALES - Item Sales Amounts by Month
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows item name and sales amounts by status (Ongoing/Completed) for
            each month
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-100 z-30">
                  Item Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200">
                  YTD
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showCompleted() ? "flex-1 border-r" : ""
                        }`}
                      >
                        Ongoing
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                </th>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <th
                      key={month}
                      className="px-2 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200 min-w-[140px]"
                    >
                      {month.toUpperCase()}
                      <div className="flex mt-1">
                        {showOngoing() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showCompleted()
                                ? "flex-1 border-r border-gray-300"
                                : ""
                            }`}
                          >
                            Ongoing
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table2Rows.map((row) => (
                <tr key={row.itemName} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                    {row.itemName}
                  </td>
                  {/* YTD Column */}
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex">
                      {showOngoing() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showCompleted()
                              ? "flex-1 border-r border-gray-200"
                              : ""
                          }`}
                        >
                          {formatCurrency(row.ytd.ongoingAmount)}
                        </span>
                      )}
                      {showCompleted() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showOngoing() ? "flex-1" : ""
                          }`}
                        >
                          {formatCurrency(row.ytd.completedAmount)}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Monthly Columns */}
                  {filteredMonths.map((monthNum) => {
                    const month = monthNames[monthNum - 1];
                    const monthData = row.months[monthNum] || {
                      ongoingAmount: 0,
                      completedAmount: 0,
                    };
                    return (
                      <td
                        key={month}
                        className="px-2 py-2 border-r border-gray-300"
                      >
                        <div className="flex">
                          {showOngoing() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showCompleted()
                                  ? "flex-1 border-r border-gray-200"
                                  : ""
                              }`}
                            >
                              {formatCurrency(monthData.ongoingAmount)}
                            </span>
                          )}
                          {showCompleted() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showOngoing() ? "flex-1" : ""
                              }`}
                            >
                              {formatCurrency(monthData.completedAmount)}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-gray-700 z-20">
                  TOTAL SALES
                </td>
                {/* YTD Total */}
                <td className="px-2 py-3 border-r border-gray-600">
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                          showCompleted() ? "flex-1" : ""
                        }`}
                      >
                        {formatCurrency(table2Totals.ytd.ongoingAmount)}
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-sm text-right px-1 py-1 font-bold ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        {formatCurrency(table2Totals.ytd.completedAmount)}
                      </span>
                    )}
                  </div>
                </td>
                {/* Monthly Totals */}
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthTotal = table2Totals.months[monthNum] || {
                    ongoingAmount: 0,
                    completedAmount: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 border-r border-gray-600"
                    >
                      <div className="flex">
                        {showOngoing() && (
                          <span
                            className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                              showCompleted() ? "flex-1" : ""
                            }`}
                          >
                            {formatCurrency(monthTotal.ongoingAmount)}
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-sm text-right px-1 py-1 font-bold ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            {formatCurrency(monthTotal.completedAmount)}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 3: Sales Adjustment */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">SALES ADJUSTMENT</h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows additional charges, debit notes, and credit notes for each
            month
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-blue-600 text-white border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold border-r border-gray-400 sticky left-0 bg-blue-600 z-30 min-w-[200px]">
                  Adjustment Type
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]">
                  YTD
                </th>
                {monthNames.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]"
                  >
                    {month.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Additional Charges Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  ADDITIONAL CHARGES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(table3DataPrepared.ytd.additionalCharges)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table3DataPrepared.months[monthNum] || {
                    additionalCharges: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.additionalCharges)}
                    </td>
                  );
                })}
              </tr>

              {/* Debit Notes Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  DEBIT NOTES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(table3DataPrepared.ytd.debitNotes)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table3DataPrepared.months[monthNum] || {
                    debitNotes: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.debitNotes)}
                    </td>
                  );
                })}
              </tr>

              {/* Credit Notes Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  CREDIT NOTES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(table3DataPrepared.ytd.creditNotes)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table3DataPrepared.months[monthNum] || {
                    creditNotes: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.creditNotes)}
                    </td>
                  );
                })}
              </tr>

              {/* Total Adjustment Row */}
              <tr className="bg-green-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-green-700 z-20">
                  <div className="flex items-center gap-2">
                    TOTAL ADJUSTMENT
                    <button
                      onClick={() => fetchBreakdown("salesAdjustments")}
                      className="text-white hover:text-gray-200 cursor-pointer"
                      title="View calculation breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold">
                  {formatCurrency(table3DataPrepared.ytd.totalAdjustment)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table3DataPrepared.months[monthNum] || {
                    totalAdjustment: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold"
                    >
                      {formatCurrency(monthData.totalAdjustment)}
                    </td>
                  );
                })}
              </tr>

              {/* Actual Total Sales Row */}
              <tr className="bg-green-800 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-green-800 z-20">
                  <div className="flex items-center gap-2">
                    ACTUAL TOTAL SALES
                    <button
                      onClick={() => fetchBreakdown("sales")}
                      className="text-white hover:text-gray-200 cursor-pointer"
                      title="View calculation breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold">
                  {formatCurrency(actualTotalSales.ytd)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthActualTotal =
                    actualTotalSales.months[monthNum] || 0;
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold"
                    >
                      {formatCurrency(monthActualTotal)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Table: Item Counts and Quantities */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            PURCHASE Quantity (FCL)
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows purchase items with contract counts by status
            (Ongoing/Completed) for each month
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-100 z-30">
                  Item Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200">
                  YTD
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showCompleted() ? "flex-1 border-r" : ""
                        }`}
                      >
                        Ongoing
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                </th>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <th
                      key={month}
                      className="px-2 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200 min-w-[120px]"
                    >
                      {month.toUpperCase()}
                      <div className="flex mt-1">
                        {showOngoing() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showCompleted()
                                ? "flex-1 border-r border-gray-300"
                                : ""
                            }`}
                          >
                            Ongoing
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {purchaseTableRows.map((row) => (
                <tr
                  key={`purchase-${row.itemName}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                    {row.itemName}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex">
                      {showOngoing() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showCompleted()
                              ? "flex-1 border-r border-gray-200"
                              : ""
                          }`}
                        >
                          {row.ytd.ongoingCount}
                        </span>
                      )}
                      {showCompleted() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showOngoing() ? "flex-1" : ""
                          }`}
                        >
                          {row.ytd.completedCount}
                        </span>
                      )}
                    </div>
                  </td>
                  {filteredMonths.map((monthNum) => {
                    const month = monthNames[monthNum - 1];
                    const monthData = row.months[monthNum] || {
                      ongoingCount: 0,
                      completedCount: 0,
                    };
                    return (
                      <td
                        key={month}
                        className="px-2 py-2 border-r border-gray-300"
                      >
                        <div className="flex">
                          {showOngoing() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showCompleted()
                                  ? "flex-1 border-r border-gray-200"
                                  : ""
                              }`}
                            >
                              {monthData.ongoingCount || 0}
                            </span>
                          )}
                          {showCompleted() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showOngoing() ? "flex-1" : ""
                              }`}
                            >
                              {monthData.completedCount || 0}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-gray-700 z-20">
                  TOTAL PURCHASE Quantity (FCL)
                </td>
                <td className="px-2 py-3 border-r border-gray-600">
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                          showCompleted() ? "flex-1" : ""
                        }`}
                      >
                        {purchaseTableTotals.ytd.ongoingCount}
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-sm text-right px-1 py-1 font-bold ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        {purchaseTableTotals.ytd.completedCount}
                      </span>
                    )}
                  </div>
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthTotal = purchaseTableTotals.months[monthNum] || {
                    ongoingCount: 0,
                    completedCount: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 border-r border-gray-600"
                    >
                      <div className="flex">
                        {showOngoing() && (
                          <span
                            className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                              showCompleted() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.ongoingCount}
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-sm text-right px-1 py-1 font-bold ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.completedCount}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Table: Quantity (MT) */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            PURCHASE Quantity (MT)
          </h3>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-100 z-30">
                  Item Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200">
                  YTD
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showCompleted() ? "flex-1 border-r" : ""
                        }`}
                      >
                        Ongoing
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                </th>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <th
                      key={month}
                      className="px-2 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200 min-w-[120px]"
                    >
                      {month.toUpperCase()}
                      <div className="flex mt-1">
                        {showOngoing() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showCompleted()
                                ? "flex-1 border-r border-gray-300"
                                : ""
                            }`}
                          >
                            Ongoing
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {purchaseTableRows.map((row) => (
                <tr
                  key={`purchase-mt-${row.itemName}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                    {row.itemName}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex">
                      {showOngoing() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showCompleted()
                              ? "flex-1 border-r border-gray-200"
                              : ""
                          }`}
                        >
                          {row.ytd.ongoingQuantityMT?.toFixed(2) || "0.00"}
                        </span>
                      )}
                      {showCompleted() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showOngoing() ? "flex-1" : ""
                          }`}
                        >
                          {row.ytd.completedQuantityMT?.toFixed(2) || "0.00"}
                        </span>
                      )}
                    </div>
                  </td>
                  {filteredMonths.map((monthNum) => {
                    const month = monthNames[monthNum - 1];
                    const monthData = row.months[monthNum] || {
                      ongoingQuantityMT: 0,
                      completedQuantityMT: 0,
                    };
                    return (
                      <td
                        key={month}
                        className="px-2 py-2 border-r border-gray-300"
                      >
                        <div className="flex">
                          {showOngoing() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showCompleted()
                                  ? "flex-1 border-r border-gray-200"
                                  : ""
                              }`}
                            >
                              {monthData.ongoingQuantityMT?.toFixed(2) ||
                                "0.00"}
                            </span>
                          )}
                          {showCompleted() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showOngoing() ? "flex-1" : ""
                              }`}
                            >
                              {monthData.completedQuantityMT?.toFixed(2) ||
                                "0.00"}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-gray-700 z-20">
                  TOTAL PURCHASE Quantity (MT)
                </td>
                <td className="px-2 py-3 border-r border-gray-600">
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                          showCompleted() ? "flex-1" : ""
                        }`}
                      >
                        {purchaseTableTotals.ytd.ongoingQuantityMT?.toFixed(
                          2
                        ) || "0.00"}
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-sm text-right px-1 py-1 font-bold ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        {purchaseTableTotals.ytd.completedQuantityMT?.toFixed(
                          2
                        ) || "0.00"}
                      </span>
                    )}
                  </div>
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthTotal = purchaseTableTotals.months[monthNum] || {
                    ongoingQuantityMT: 0,
                    completedQuantityMT: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 border-r border-gray-600"
                    >
                      <div className="flex">
                        {showOngoing() && (
                          <span
                            className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                              showCompleted() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.ongoingQuantityMT?.toFixed(2) || "0.00"}
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-sm text-right px-1 py-1 font-bold ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            {monthTotal.completedQuantityMT?.toFixed(2) ||
                              "0.00"}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Table 2: Item Purchase Amounts - Pivot Format */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            PURCHASE - Item Purchase Amounts by Month
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows item name and purchase amounts by status (Ongoing/Completed)
            for each month
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-100 z-30">
                  Item Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200">
                  YTD
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showCompleted() ? "flex-1 border-r" : ""
                        }`}
                      >
                        Ongoing
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                </th>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <th
                      key={month}
                      className="px-2 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200 min-w-[140px]"
                    >
                      {month.toUpperCase()}
                      <div className="flex mt-1">
                        {showOngoing() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showCompleted()
                                ? "flex-1 border-r border-gray-300"
                                : ""
                            }`}
                          >
                            Ongoing
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-xs font-normal px-1 py-1 ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {purchaseTable2Rows.map((row) => (
                <tr key={row.itemName} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                    {row.itemName}
                  </td>
                  {/* YTD Column */}
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex">
                      {showOngoing() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showCompleted()
                              ? "flex-1 border-r border-gray-200"
                              : ""
                          }`}
                        >
                          {formatCurrency(row.ytd.ongoingAmount)}
                        </span>
                      )}
                      {showCompleted() && (
                        <span
                          className={`text-sm text-right px-1 py-1 ${
                            showOngoing() ? "flex-1" : ""
                          }`}
                        >
                          {formatCurrency(row.ytd.completedAmount)}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Monthly Columns */}
                  {filteredMonths.map((monthNum) => {
                    const month = monthNames[monthNum - 1];
                    const monthData = row.months[monthNum] || {
                      ongoingAmount: 0,
                      completedAmount: 0,
                    };
                    return (
                      <td
                        key={month}
                        className="px-2 py-2 border-r border-gray-300"
                      >
                        <div className="flex">
                          {showOngoing() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showCompleted()
                                  ? "flex-1 border-r border-gray-200"
                                  : ""
                              }`}
                            >
                              {formatCurrency(monthData.ongoingAmount)}
                            </span>
                          )}
                          {showCompleted() && (
                            <span
                              className={`text-sm text-right px-1 py-1 ${
                                showOngoing() ? "flex-1" : ""
                              }`}
                            >
                              {formatCurrency(monthData.completedAmount)}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-gray-700 z-20">
                  TOTAL PURCHASE
                </td>
                {/* YTD Total */}
                <td className="px-2 py-3 border-r border-gray-600">
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                          showCompleted() ? "flex-1" : ""
                        }`}
                      >
                        {formatCurrency(purchaseTable2Totals.ytd.ongoingAmount)}
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-sm text-right px-1 py-1 font-bold ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        {formatCurrency(
                          purchaseTable2Totals.ytd.completedAmount
                        )}
                      </span>
                    )}
                  </div>
                </td>
                {/* Monthly Totals */}
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthTotal = purchaseTable2Totals.months[monthNum] || {
                    ongoingAmount: 0,
                    completedAmount: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 border-r border-gray-600"
                    >
                      <div className="flex">
                        {showOngoing() && (
                          <span
                            className={`text-sm text-right px-1 py-1 border-r border-gray-600 font-bold ${
                              showCompleted() ? "flex-1" : ""
                            }`}
                          >
                            {formatCurrency(monthTotal.ongoingAmount)}
                          </span>
                        )}
                        {showCompleted() && (
                          <span
                            className={`text-sm text-right px-1 py-1 font-bold ${
                              showOngoing() ? "flex-1" : ""
                            }`}
                          >
                            {formatCurrency(monthTotal.completedAmount)}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 4: Purchase Adjustment */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            PURCHASE ADJUSTMENT
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows additional charges, debit notes, and credit notes for purchase
            contracts for each month
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-blue-600 text-white border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold border-r border-gray-400 sticky left-0 bg-blue-600 z-30 min-w-[200px]">
                  Adjustment Type
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]">
                  YTD
                </th>
                {monthNames.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]"
                  >
                    {month.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Additional Charges Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  ADDITIONAL CHARGES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(table4DataPrepared.ytd.additionalCharges)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table4DataPrepared.months[monthNum] || {
                    additionalCharges: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.additionalCharges)}
                    </td>
                  );
                })}
              </tr>

              {/* Debit Notes Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  DEBIT NOTES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(table4DataPrepared.ytd.debitNotes)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table4DataPrepared.months[monthNum] || {
                    debitNotes: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.debitNotes)}
                    </td>
                  );
                })}
              </tr>

              {/* Credit Notes Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  CREDIT NOTES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(table4DataPrepared.ytd.creditNotes)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table4DataPrepared.months[monthNum] || {
                    creditNotes: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.creditNotes)}
                    </td>
                  );
                })}
              </tr>

              {/* Total Adjustment Row */}
              <tr className="bg-green-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-green-700 z-20">
                  <div className="flex items-center gap-2">
                    TOTAL ADJUSTMENT
                    <button
                      onClick={() => fetchBreakdown("purchaseAdjustments")}
                      className="text-white hover:text-gray-200 cursor-pointer"
                      title="View calculation breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold">
                  {formatCurrency(table4DataPrepared.ytd.totalAdjustment)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = table4DataPrepared.months[monthNum] || {
                    totalAdjustment: 0,
                  };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold"
                    >
                      {formatCurrency(monthData.totalAdjustment)}
                    </td>
                  );
                })}
              </tr>

              {/* Actual Total Purchase Row */}
              <tr className="bg-green-800 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-green-800 z-20">
                  <div className="flex items-center gap-2">
                    ACTUAL TOTAL PURCHASE
                    <button
                      onClick={() => fetchBreakdown("purchase")}
                      className="text-white hover:text-gray-200 cursor-pointer"
                      title="View calculation breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold">
                  {formatCurrency(actualTotalPurchase.ytd)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthActualTotal =
                    actualTotalPurchase.months[monthNum] || 0;
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold"
                    >
                      {formatCurrency(monthActualTotal)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* COST OF GOODS & NET PROFIT CARD */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            COST OF GOODS &amp; NET PROFIT
          </h3>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-blue-600 text-white border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold border-r border-gray-400 sticky left-0 bg-blue-600 z-30 min-w-[200px]">
                  Adjustment Type
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]">
                  YTD
                </th>
                {monthNames.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]"
                  >
                    {month.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Gross Profit Row */}
              <tr className="bg-gray-900 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-700 sticky left-0 bg-gray-900 z-20">
                  <div className="flex items-center gap-2">
                    GROSS PROFIT &amp; (LOSS)
                    <button
                      onClick={() => fetchBreakdown("grossProfit")}
                      className="text-white hover:text-gray-200 cursor-pointer"
                      title="View calculation breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-700 font-bold">
                  {formatCurrency(grossProfit.ytd)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthGross = grossProfit.months[monthNum] || 0;
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-700 font-bold"
                    >
                      {formatCurrency(monthGross)}
                    </td>
                  );
                })}
              </tr>

              {/* OTHER INCOME Header */}
              <tr className="bg-blue-800 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-700 sticky left-0 bg-blue-800 z-20">
                  OTHER INCOME
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-700" />
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-700"
                    />
                  );
                })}
              </tr>

              {/* TOTAL OTHER INCOME Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  <div className="flex items-center gap-2">
                    TOTAL OTHER INCOME
                    <button
                      onClick={() => fetchBreakdown("otherIncome")}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                      title="View detailed breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(otherIncomePrepared.ytd.amount)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = otherIncomePrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.amount || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* EXPENSES Header */}
              <tr className="bg-blue-900 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-700 sticky left-0 bg-blue-900 z-20">
                  EXPENSES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-700" />
                {monthNames.map((month) => (
                  <td
                    key={month}
                    className="px-2 py-3 text-sm text-right border-r border-gray-700"
                  />
                ))}
              </tr>

              {/* TOTAL EXPENSES Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  <div className="flex items-center gap-2">
                    TOTAL EXPENSES
                    <button
                      onClick={() => fetchBreakdown("expenses")}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                      title="View detailed breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(otherExpensesPrepared.ytd.amount)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData =
                    otherExpensesPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.amount || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* COST OF GOODS Section Header */}
              <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-700 sticky left-0 bg-gray-800 z-20">
                  COST OF GOODS
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-700" />
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-700"
                    />
                  );
                })}
              </tr>

              {/* FORECAST BALANCE FOR ONGOING */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  FORECAST BALANCE FOR ONGOING
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.forecastBalance)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.forecastBalance || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* ACTUAL FREIGHT */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  ACTUAL FREIGHT
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.actualFreight)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.actualFreight || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* HANDLING CHARGES */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  HANDLING CHARGES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.handlingCharges)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.handlingCharges || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* DEMURRAGE & DETENTION CHARGES */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  DEMURRAGE &amp; DETENTION CHARGES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.demurrageDetention)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.demurrageDetention || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* TRANSPORTATION */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  TRANSPORTATION
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.transportation)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.transportation || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* WAREHOUSE CHARGES */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  WAREHOUSE CHARGES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.warehouseCharges)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.warehouseCharges || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* INSURANCE */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  INSURANCE
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.insurance)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.insurance || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* COMMISSION */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  COMMISSION
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.commission)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.commission || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* COURIER CHARGES */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  COURIER CHARGES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(costOfGoodsPrepared.ytd.courierCharges)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.courierCharges || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* TOTAL COST OF GOODS */}
              <tr className="bg-green-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-green-700 z-20">
                  <div className="flex items-center gap-2">
                    TOTAL COST OF GOODS
                    <button
                      onClick={() => fetchBreakdown("cogs")}
                      className="text-white hover:text-gray-200 cursor-pointer"
                      title="View detailed breakdown"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold">
                  {formatCurrency(costOfGoodsPrepared.ytd.totalCOGS)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const monthData = costOfGoodsPrepared.months[monthNum] || {};
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold"
                    >
                      {formatCurrency(monthData.totalCOGS || 0)}
                    </td>
                  );
                })}
              </tr>

              {/* Gross Profit & (Loss) Row */}
              <tr className="bg-gray-900 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-700 sticky left-0 bg-gray-900 z-20">
                  NET PROFIT &amp; (LOSS)
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-700 font-bold">
                  {formatCurrency(netProfit.ytd)}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const value = netProfit.months[monthNum] || 0;
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-700 font-bold"
                    >
                      {formatCurrency(value)}
                    </td>
                  );
                })}
              </tr>

              {/* PROFIT/LOSS PERCENTAGE Row */}
              <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-700 sticky left-0 bg-gray-800 z-20">
                  PROFIT/LOSS PERCENTAGE (%)
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-700 font-bold">
                  {`${(profitPercentage.ytd || 0).toFixed(2)}%`}
                </td>
                {filteredMonths.map((monthNum) => {
                  const month = monthNames[monthNum - 1];
                  const value = profitPercentage.months[monthNum] || 0;
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-700 font-bold"
                    >
                      {`${value.toFixed(2)}%`}
                    </td>
                  );
                })}
              </tr>

              {/* PROFIT/LOSS STATUS Row */}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-700 sticky left-0 bg-gray-700 z-20">
                  PROFIT/LOSS STATUS
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-700 font-bold">
                  {getProfitStatus(netProfit.ytd)}
                </td>
                {monthNames.map((month, monthIndex) => {
                  const monthNum = monthIndex + 1;
                  const value = netProfit.months[monthNum] || 0;
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-center border-r border-gray-700 font-bold"
                    >
                      {getProfitStatus(value)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table: SALES WITHOUT PURCHASE - Item Amounts - Pivot Format (at bottom, separate from main calculations) */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            SALES WITHOUT PURCHASE - Item Sales Amounts by Month
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows sales amounts for contracts that do not have any purchase
            contracts assigned
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-100 z-30">
                  Item Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200">
                  YTD
                  <div className="flex">
                    {showOngoing() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showCompleted() ? "flex-1 border-r" : ""
                        }`}
                      >
                        Ongoing
                      </span>
                    )}
                    {showCompleted() && (
                      <span
                        className={`text-xs font-normal px-2 py-1 ${
                          showOngoing() ? "flex-1" : ""
                        }`}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                </th>
                {monthNames.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-gray-200 min-w-[140px]"
                  >
                    {month.toUpperCase()}
                    <div className="flex mt-1">
                      {showOngoing() && (
                        <span
                          className={`text-xs font-normal px-1 py-1 ${
                            showCompleted()
                              ? "flex-1 border-r border-gray-300"
                              : ""
                          }`}
                        >
                          Ongoing
                        </span>
                      )}
                      {showCompleted() && (
                        <span
                          className={`text-xs font-normal px-1 py-1 ${
                            showOngoing() ? "flex-1" : ""
                          }`}
                        >
                          Completed
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesWithoutPurchaseRows.map((row) => (
                <tr key={row.itemName} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                    {row.itemName}
                  </td>
                  {/* YTD Column */}
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex">
                      <span className="flex-1 text-sm text-right px-1 py-1 border-r border-gray-200">
                        {formatCurrency(row.ytd.ongoingAmount)}
                      </span>
                      <span className="flex-1 text-sm text-right px-1 py-1">
                        {formatCurrency(row.ytd.completedAmount)}
                      </span>
                    </div>
                  </td>
                  {/* Monthly Columns */}
                  {filteredMonths.map((monthNum) => {
                    const month = monthNames[monthNum - 1];
                    const monthData = row.months[monthNum] || {
                      ongoingAmount: 0,
                      completedAmount: 0,
                    };
                    return (
                      <td
                        key={month}
                        className="px-2 py-2 border-r border-gray-300"
                      >
                        <div className="flex">
                          <span className="flex-1 text-sm text-right px-1 py-1 border-r border-gray-200">
                            {formatCurrency(monthData.ongoingAmount)}
                          </span>
                          <span className="flex-1 text-sm text-right px-1 py-1">
                            {formatCurrency(monthData.completedAmount)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-gray-700 z-20">
                  TOTAL SALES WITHOUT PURCHASE
                </td>
                {/* YTD Total */}
                <td className="px-2 py-3 border-r border-gray-600">
                  <div className="flex">
                    <span className="flex-1 text-sm text-right px-1 py-1 border-r border-gray-600 font-bold">
                      {formatCurrency(
                        salesWithoutPurchaseRows.reduce(
                          (sum, row) => sum + (row.ytd.ongoingAmount || 0),
                          0
                        )
                      )}
                    </span>
                    <span className="flex-1 text-sm text-right px-1 py-1 font-bold">
                      {formatCurrency(
                        salesWithoutPurchaseRows.reduce(
                          (sum, row) => sum + (row.ytd.completedAmount || 0),
                          0
                        )
                      )}
                    </span>
                  </div>
                </td>
                {/* Monthly Totals */}
                {monthNames.map((month, monthIndex) => {
                  const monthNum = monthIndex + 1;
                  const monthOngoingTotal = salesWithoutPurchaseRows.reduce(
                    (sum, row) =>
                      sum + (row.months[monthNum]?.ongoingAmount || 0),
                    0
                  );
                  const monthCompletedTotal = salesWithoutPurchaseRows.reduce(
                    (sum, row) =>
                      sum + (row.months[monthNum]?.completedAmount || 0),
                    0
                  );
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 border-r border-gray-600"
                    >
                      <div className="flex">
                        <span className="flex-1 text-sm text-right px-1 py-1 border-r border-gray-600 font-bold">
                          {formatCurrency(monthOngoingTotal)}
                        </span>
                        <span className="flex-1 text-sm text-right px-1 py-1 font-bold">
                          {formatCurrency(monthCompletedTotal)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SALES ADJUSTMENT for SALES WITHOUT PURCHASE */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            SALES ADJUSTMENT (Sales Without Purchase)
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows additional charges, debit notes, and credit notes for sales
            contracts without purchase for each month
          </p>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto max-h-[600px] table-scroll-container"
          style={{ maxWidth: "100%" }}
        >
          <table
            className="w-full border-collapse"
            style={{ minWidth: "max-content" }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-blue-600 text-white border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-bold border-r border-gray-400 sticky left-0 bg-blue-600 z-30 min-w-[200px]">
                  Adjustment Type
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]">
                  YTD
                </th>
                {monthNames.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-3 text-center text-sm font-bold border-r border-gray-400 bg-blue-700 min-w-[140px]"
                  >
                    {month.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Additional Charges Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  ADDITIONAL CHARGES INCLUDING IN THE COMMERCIAL INVOICE
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(
                    salesAdjustmentsWithoutPurchasePrepared.ytd
                      .additionalCharges
                  )}
                </td>
                {monthNames.map((month, monthIndex) => {
                  const monthNum = monthIndex + 1;
                  const monthData = salesAdjustmentsWithoutPurchasePrepared
                    .months[monthNum] || { additionalCharges: 0 };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.additionalCharges)}
                    </td>
                  );
                })}
              </tr>

              {/* Debit Notes Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  DEBIT NOTES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(
                    salesAdjustmentsWithoutPurchasePrepared.ytd.debitNotes
                  )}
                </td>
                {monthNames.map((month, monthIndex) => {
                  const monthNum = monthIndex + 1;
                  const monthData = salesAdjustmentsWithoutPurchasePrepared
                    .months[monthNum] || { debitNotes: 0 };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.debitNotes)}
                    </td>
                  );
                })}
              </tr>

              {/* Credit Notes Row */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium border-r border-gray-300 sticky left-0 bg-white z-20">
                  CREDIT NOTES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-300">
                  {formatCurrency(
                    salesAdjustmentsWithoutPurchasePrepared.ytd.creditNotes
                  )}
                </td>
                {monthNames.map((month, monthIndex) => {
                  const monthNum = monthIndex + 1;
                  const monthData = salesAdjustmentsWithoutPurchasePrepared
                    .months[monthNum] || { creditNotes: 0 };
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-300"
                    >
                      {formatCurrency(monthData.creditNotes)}
                    </td>
                  );
                })}
              </tr>

              {/* ACTUAL TOTAL SALES Row */}
              <tr className="bg-green-800 text-white font-bold border-t-2 border-gray-900">
                <td className="px-4 py-3 text-sm font-bold border-r border-gray-600 sticky left-0 bg-green-800 z-20">
                  ACTUAL TOTAL SALES
                </td>
                <td className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold">
                  {formatCurrency(
                    salesWithoutPurchaseRows.reduce(
                      (sum, row) =>
                        sum +
                        (row.ytd.ongoingAmount || 0) +
                        (row.ytd.completedAmount || 0),
                      0
                    ) +
                      salesAdjustmentsWithoutPurchasePrepared.ytd
                        .totalAdjustment
                  )}
                </td>
                {monthNames.map((month, monthIndex) => {
                  const monthNum = monthIndex + 1;
                  const monthSalesTotal = salesWithoutPurchaseRows.reduce(
                    (sum, row) => {
                      const monthData = row.months[monthNum] || {};
                      return (
                        sum +
                        (monthData.ongoingAmount || 0) +
                        (monthData.completedAmount || 0)
                      );
                    },
                    0
                  );
                  const monthAdjustment =
                    salesAdjustmentsWithoutPurchasePrepared.months[monthNum]
                      ?.totalAdjustment || 0;
                  const monthActualTotal = monthSalesTotal + monthAdjustment;
                  return (
                    <td
                      key={month}
                      className="px-2 py-3 text-sm text-right border-r border-gray-600 font-bold"
                    >
                      {formatCurrency(monthActualTotal)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown Modal */}
      {breakdownModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {breakdownModal.type === "expenses"
                  ? "TOTAL EXPENSES"
                  : breakdownModal.type === "cogs"
                  ? "TOTAL COST OF GOODS"
                  : breakdownModal.type === "sales"
                  ? "ACTUAL TOTAL SALES"
                  : breakdownModal.type === "purchase"
                  ? "ACTUAL TOTAL PURCHASE"
                  : breakdownModal.type === "grossProfit"
                  ? "GROSS PROFIT & (LOSS)"
                  : breakdownModal.type === "netProfit"
                  ? "NET PROFIT & (LOSS)"
                  : breakdownModal.type === "otherIncome"
                  ? "TOTAL OTHER INCOME"
                  : breakdownModal.type === "salesAdjustments"
                  ? "SALES ADJUSTMENTS - TOTAL ADJUSTMENT"
                  : breakdownModal.type === "purchaseAdjustments"
                  ? "PURCHASE ADJUSTMENTS - TOTAL ADJUSTMENT"
                  : "Detailed Breakdown"}{" "}
                - Detailed Breakdown
              </h3>
              <button
                onClick={() =>
                  setBreakdownModal({
                    isOpen: false,
                    type: null,
                    data: null,
                    loading: false,
                  })
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {breakdownModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoaderComponent />
                </div>
              ) : breakdownModal.data ? (
                <div className="space-y-6">
                  {/* Source Information */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">
                      Source Module
                    </h4>
                    <p className="text-sm text-blue-800">
                      {breakdownModal.data.source || "Multiple Sources"}
                    </p>
                    {breakdownModal.data.description && (
                      <p className="text-sm text-blue-700 mt-2">
                        {breakdownModal.data.description}
                      </p>
                    )}
                    {breakdownModal.data.formula && (
                      <div className="mt-3 pt-3 border-t border-blue-300">
                        <h5 className="font-semibold text-blue-900 mb-2">
                          Calculation Formula
                        </h5>
                        <p className="text-sm text-blue-800 font-mono bg-blue-100 p-2 rounded">
                          {breakdownModal.data.formula}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Components Breakdown (for calculated values) */}
                  {breakdownModal.data.components &&
                    breakdownModal.data.components.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">
                          Components
                        </h4>
                        <div className="space-y-3">
                          {breakdownModal.data.components.map(
                            (component, index) => (
                              <div
                                key={index}
                                className="border border-gray-200 rounded-lg p-4"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900">
                                      {component.name}
                                    </h5>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {component.source}
                                    </p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-lg font-semibold text-gray-900">
                                      {formatCurrency(component.amount)}
                                    </p>
                                    {breakdownModal.data.total !== undefined &&
                                      breakdownModal.data.total !== 0 && (
                                        <p className="text-xs text-gray-500">
                                          {(
                                            (Math.abs(component.amount) /
                                              Math.abs(
                                                breakdownModal.data.total
                                              )) *
                                            100
                                          ).toFixed(1)}
                                          %
                                        </p>
                                      )}
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">
                              Total
                            </span>
                            <span className="text-xl font-bold text-gray-900">
                              {formatCurrency(breakdownModal.data.total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Categories Breakdown */}
                  {breakdownModal.type === "expenses" &&
                  breakdownModal.data.categories ? (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">
                        Expense Categories
                      </h4>
                      <div className="space-y-3">
                        {breakdownModal.data.categories.map(
                          (category, index) => (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h5 className="font-medium text-gray-900">
                                    {category.category}
                                  </h5>
                                  <p className="text-sm text-gray-600">
                                    Count: {category.count} items
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-semibold text-gray-900">
                                    {formatCurrency(category.amount)}
                                  </p>
                                  {breakdownModal.data.total > 0 && (
                                    <p className="text-xs text-gray-500">
                                      {(
                                        (category.amount /
                                          breakdownModal.data.total) *
                                        100
                                      ).toFixed(1)}
                                      %
                                    </p>
                                  )}
                                </div>
                              </div>
                              {category.items &&
                                category.items.length > 0 &&
                                (() => {
                                  const categoryKey = `expenses-${index}`;
                                  const currentPage =
                                    itemsPagination[categoryKey] || 1;
                                  const totalPages = Math.ceil(
                                    category.items.length / ITEMS_PER_PAGE
                                  );
                                  const startIndex =
                                    (currentPage - 1) * ITEMS_PER_PAGE;
                                  const endIndex = startIndex + ITEMS_PER_PAGE;
                                  const paginatedItems = category.items.slice(
                                    startIndex,
                                    endIndex
                                  );

                                  return (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs font-medium text-gray-700">
                                          All Items ({category.items.length}{" "}
                                          total)
                                        </p>
                                        {totalPages > 1 && (
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() =>
                                                setItemsPagination((prev) => ({
                                                  ...prev,
                                                  [categoryKey]: Math.max(
                                                    1,
                                                    currentPage - 1
                                                  ),
                                                }))
                                              }
                                              disabled={currentPage === 1}
                                              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              Previous
                                            </button>
                                            <span className="text-xs text-gray-600">
                                              Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                              onClick={() =>
                                                setItemsPagination((prev) => ({
                                                  ...prev,
                                                  [categoryKey]: Math.min(
                                                    totalPages,
                                                    currentPage + 1
                                                  ),
                                                }))
                                              }
                                              disabled={
                                                currentPage === totalPages
                                              }
                                              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              Next
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                                        {paginatedItems.map(
                                          (item, itemIndex) => (
                                            <div
                                              key={itemIndex}
                                              className="flex justify-between text-xs text-gray-600 py-1 px-2 hover:bg-white rounded"
                                            >
                                              <span>
                                                {item.expenseNumber || "N/A"}
                                              </span>
                                              <span className="font-medium">
                                                {formatCurrency(item.amount)}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                            </div>
                          )
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">
                            Total Expenses
                          </span>
                          <span className="text-xl font-bold text-gray-900">
                            {formatCurrency(breakdownModal.data.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : breakdownModal.type === "cogs" &&
                    breakdownModal.data.categories ? (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">
                        Cost of Goods Categories
                      </h4>
                      <div className="space-y-3">
                        {breakdownModal.data.categories.map(
                          (category, index) => (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900">
                                    {category.name}
                                  </h5>
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Source:</span>{" "}
                                    {category.source}
                                  </p>
                                  {category.description && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {category.description}
                                    </p>
                                  )}
                                  {category.count !== undefined && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Count: {category.count} records
                                    </p>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-lg font-semibold text-gray-900">
                                    {formatCurrency(category.amount)}
                                  </p>
                                  {breakdownModal.data.total > 0 && (
                                    <p className="text-xs text-gray-500">
                                      {(
                                        (category.amount /
                                          breakdownModal.data.total) *
                                        100
                                      ).toFixed(1)}
                                      %
                                    </p>
                                  )}
                                </div>
                              </div>
                              {category.items &&
                                category.items.length > 0 &&
                                (() => {
                                  const categoryKey = `cogs-${index}`;
                                  const currentPage =
                                    itemsPagination[categoryKey] || 1;
                                  const totalPages = Math.ceil(
                                    category.items.length / ITEMS_PER_PAGE
                                  );
                                  const startIndex =
                                    (currentPage - 1) * ITEMS_PER_PAGE;
                                  const endIndex = startIndex + ITEMS_PER_PAGE;
                                  const paginatedItems = category.items.slice(
                                    startIndex,
                                    endIndex
                                  );

                                  return (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs font-medium text-gray-700">
                                          All Items ({category.items.length}{" "}
                                          total)
                                        </p>
                                        {totalPages > 1 && (
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() =>
                                                setItemsPagination((prev) => ({
                                                  ...prev,
                                                  [categoryKey]: Math.max(
                                                    1,
                                                    currentPage - 1
                                                  ),
                                                }))
                                              }
                                              disabled={currentPage === 1}
                                              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              Previous
                                            </button>
                                            <span className="text-xs text-gray-600">
                                              Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                              onClick={() =>
                                                setItemsPagination((prev) => ({
                                                  ...prev,
                                                  [categoryKey]: Math.min(
                                                    totalPages,
                                                    currentPage + 1
                                                  ),
                                                }))
                                              }
                                              disabled={
                                                currentPage === totalPages
                                              }
                                              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              Next
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                                        {paginatedItems.map(
                                          (item, itemIndex) => (
                                            <div
                                              key={itemIndex}
                                              className="flex justify-between text-xs text-gray-600 py-1 px-2 hover:bg-white rounded"
                                            >
                                              <span>
                                                {item.invoiceNumber || "N/A"}
                                              </span>
                                              <span className="font-medium">
                                                {formatCurrency(item.amount)}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                            </div>
                          )
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">
                            Total Cost of Goods
                          </span>
                          <span className="text-xl font-bold text-gray-900">
                            {formatCurrency(breakdownModal.data.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : breakdownModal.data.components &&
                    breakdownModal.data.components.length >
                      0 ? // Components already displayed above
                  null : breakdownModal.data.total !== undefined ? (
                    // Simple total display for otherIncome or other types
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">
                          Total
                        </span>
                        <span className="text-xl font-bold text-gray-900">
                          {formatCurrency(breakdownModal.data.total)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No breakdown data available
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default P_L_Reports;
