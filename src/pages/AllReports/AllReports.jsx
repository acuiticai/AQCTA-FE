import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import {
  Download,
  FileText,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Plus,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  BarChart3,
} from "lucide-react";
import {
  DataTable,
  InputField,
  DropdownBasic,
  FormInput,
  Loader,
} from "@/page-layouts/index";
import { formatDate, formatTime } from "@/components/formatAmount";
import { toast } from "react-toastify";
import { AdminContext } from "@/context/AdminContext";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AllReports = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const adminId = adminInfo?.id || adminInfo?._id;

  // Filters
  const [searchParams, setSearchParams] = useState({
    search: "",
    year: "",
    month: "",
    investor: "",
    business: "",
    customerName: "",
    projectStatus: "",
    finalProjectStatus: "",
    typeOfProduct: "",
    // grade: "", // Commented out - grade filter removed
    salesStatus: "",
    subSalesContractNo: "",
    startDate: "",
    endDate: "",
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown options state
  const [customerOptions, setCustomerOptions] = useState([]);
  // const [gradeOptions, setGradeOptions] = useState([]); // Commented out - grade filter removed
  const [productTypeOptions, setProductTypeOptions] = useState([]);

  // Data
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [statistics, setStatistics] = useState({
    totalSalesValue: 0,
    totalPurchaseValue: 0,
    totalCOGS: 0,
    totalGrossProfit: 0,
    totalReports: 0,
    avgSalesValue: 0,
  });
  const [baseCurrency, setBaseCurrency] = useState("USD");

  // Dropdown Options - Dynamic year generation (current year to last 10 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: "", label: "All Years" },
    ...Array.from({ length: 11 }, (_, i) => {
      const year = currentYear - i;
      return { value: year.toString(), label: year.toString() };
    }),
  ];

  const monthOptions = [
    { value: "", label: "All Months" },
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const projectStatusOptions = [
    { value: "", label: "All Statuses" },
    { value: "ONGOING", label: "Ongoing" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "COMPLETED", label: "Completed" },
  ];

  const investorOptions = [
    { value: "", label: "All Investors" },
    { value: "BARENA", label: "BARENA" },
    { value: "BAHMAN", label: "BAHMAN" },
  ];

  // Fetch product types from items API (like SalesContract does)
  const [items, setItems] = useState([]);

  const fetchProductTypes = async () => {
    try {
      // Get businesses from localStorage (like SalesContract does)
      let businessIds = [];
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const businessesArr = JSON.parse(storedBusinesses);
        businessIds = businessesArr.map((b) => b._id);
      }

      let query = {};
      if (searchParams.business) {
        query.businessId = searchParams.business;
      } else if (businessIds.length > 0) {
        query.businessIds = businessIds;
      }

      const response = await axios.get(`${Base_URL}/items`, { params: query });

      if (response.status === 200 && response.data) {
        const itemsData = Array.isArray(response.data)
          ? response.data
          : response.data.items || [];
        setItems(itemsData);

        // Get unique product types from items - use item name for filtering
        const uniqueTypes = [
          ...new Map(
            itemsData
              .map((item) => {
                // Use item name as the key for filtering
                const itemName =
                  item.name || item.title || item.typeOfProduct || "";
                return [itemName, { value: itemName, label: itemName }];
              })
              .filter(([name]) => name && name.trim() !== "")
          ).values(),
        ].sort((a, b) => a.label.localeCompare(b.label));

        setProductTypeOptions([
          { value: "", label: "All Products" },
          ...uniqueTypes,
        ]);
      }
    } catch (err) {
      console.error("Error fetching product types:", err);
      // Fallback to enum values
      setProductTypeOptions([
        { value: "", label: "All Products" },
        { value: "LATEX", label: "LATEX" },
        { value: "NATURAL", label: "NATURAL" },
        { value: "SYNTHETIC", label: "SYNTHETIC" },
        { value: "CARBON BLACK", label: "CARBON BLACK" },
        { value: "NATURAL RUBBER", label: "NATURAL RUBBER" },
        { value: "RUBBER", label: "RUBBER" },
        { value: "OTHER", label: "OTHER" },
      ]);
    }
  };

  // Fetch customer options (like SalesContract does - simpler approach)
  const fetchCustomerOptions = async (businessId = null) => {
    try {
      // Simple fetch like SalesContract.jsx
      const response = await axios.get(`${Base_URL}/customers`);
      console.log("Customers fetched successfully:", response.data);

      if (response.status) {
        const customers = response?.data.customers || response?.data || [];

        // Transform customers like SalesContract does
        const transformedCustomers = customers.map((customer) => ({
          value: customer._id,
          label:
            customer?.basicInfo?.buyerCompanyName ||
            customer?.basicInformation?.customerDisplayName ||
            customer?.basicInformation?.companyName ||
            customer?.companyName ||
            customer?.name ||
            "Unknown Customer",
        }));

        setCustomerOptions([
          { value: "", label: "All Customers" },
          ...transformedCustomers,
        ]);
      } else {
        console.error("Failed to fetch customers");
        setCustomerOptions([{ value: "", label: "All Customers" }]);
      }
    } catch (error) {
      console.error("❌ Error fetching customers:", error);
      setCustomerOptions([{ value: "", label: "All Customers" }]);
    }
  };

  // Fetch grade options - Commented out - grade filter removed
  // const fetchGradeOptions = async () => {
  //   try {
  //     const response = await axios.get(`${Base_URL}/items/Grade/get_all`);
  //     const grades = response.data?.grades || response.data || [];
  //
  //     // Get unique grades by name
  //     const uniqueGrades = [...new Map(
  //       grades.map(grade => [
  //         grade.name || grade,
  //         { value: grade.name || grade, label: grade.name || grade }
  //       ])
  //     ).values()].sort((a, b) => a.label.localeCompare(b.label));
  //
  //     setGradeOptions([
  //       { value: "", label: "All Grades" },
  //       ...uniqueGrades
  //     ]);
  //     } catch (err) {
  //     console.error("Error fetching grades:", err);
  //     setGradeOptions([{ value: "", label: "All Grades" }]);
  //   }
  // };

  const salesStatusOptions = [
    { value: "", label: "All" },
    { value: "SALES WITHOUT PURCHASE", label: "Sales Without Purchase" },
    { value: "SALES WITH PURCHASE", label: "Sales With Purchase" },
  ];

  // Fetch Statistics
  const fetchStatistics = async () => {
    try {
      const res = await axios.get(`${Base_URL}/sales-reports/stats`);
      if (res.data.success) {
        setStatistics(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching statistics:", err);
    }
  };

  // Fetch data
  const fetchData = async (page = 1, perPage = limit) => {
    setLoading(true);
    try {
      // Convert customer ID to customer name for backend
      let paramsToSend = { ...searchParams };
      if (paramsToSend.customerName) {
        const selectedCustomer = customerOptions.find(
          (opt) => opt.value === paramsToSend.customerName
        );
        if (selectedCustomer) {
          paramsToSend.customerName = selectedCustomer.label;
        }
      }

      // Filter out empty strings and undefined values
      const cleanParams = Object.fromEntries(
        Object.entries({
          page,
          limit: perPage,
          ...paramsToSend,
        }).filter(
          ([_, v]) =>
            v !== "" && v !== null && v !== undefined && v !== "undefined"
        )
      );

      console.log("📤 Sending request with params:", cleanParams);

      const res = await axios.get(`${Base_URL}/sales-reports`, {
        params: cleanParams,
      });

      console.log("📥 Received response:", {
        success: res.data.success,
        dataLength: res.data.data?.length || 0,
        total: res.data.total,
        debug: res.data.debug,
      });

      if (res.data.success) {
        setRecords(res.data.data || []);
        setCurrentPage(res.data.currentPage || 1);
        setTotalPages(res.data.totalPages || 1);
        setLimit(res.data.limit || 10);
        setTotal(res.data.total || 0);
        setBaseCurrency(res.data.baseCurrency || "USD");
      }
    } catch (err) {
      console.error("❌ API Error:", err);
      console.error("❌ Error details:", err.response?.data || err.message);
      toast.error("Failed to fetch sales reports");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, limit);
    fetchStatistics();
    // fetchGradeOptions(); // Commented out - grade filter removed
    fetchCustomerOptions();
    // eslint-disable-next-line
  }, [currentPage, limit]);

  // Fetch product types when business changes (like SalesContract does for items)
  useEffect(() => {
    fetchProductTypes();
  }, [searchParams.business]);

  // Initial fetch for product types on mount
  useEffect(() => {
    fetchProductTypes();
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, limit);
  };

  const handleReset = () => {
    const resetParams = {
      search: "",
      year: "",
      month: "",
      investor: "",
      business: "",
      customerName: "",
      projectStatus: "",
      finalProjectStatus: "",
      typeOfProduct: "",
      // grade: "", // Commented out - grade filter removed
      salesStatus: "",
      subSalesContractNo: "",
      startDate: "",
      endDate: "",
    };

    setSearchParams(resetParams);
    setResetKey((prev) => prev + 1);
    setCurrentPage(1);

    // Fetch data immediately with reset params to avoid state update delay
    setLoading(true);
    const cleanParams = Object.fromEntries(
      Object.entries({
        page: 1,
        limit: limit,
        ...resetParams,
      }).filter(
        ([_, v]) =>
          v !== "" && v !== null && v !== undefined && v !== "undefined"
      )
    );

    axios
      .get(`${Base_URL}/sales-reports`, { params: cleanParams })
      .then((res) => {
        if (res.data.success) {
          setRecords(res.data.data || []);
          setCurrentPage(res.data.currentPage || 1);
          setTotalPages(res.data.totalPages || 1);
          setLimit(res.data.limit || 10);
          setTotal(res.data.total || 0);
        }
      })
      .catch((err) => {
        console.error("❌ API Error:", err);
        toast.error("Failed to fetch sales reports");
        setRecords([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleDownload = async (type) => {
    setExcelLoading(true);
    try {
      // Convert customer ID to customer name for backend (same as fetchData)
      let paramsToSend = { ...searchParams };
      if (paramsToSend.customerName) {
        const selectedCustomer = customerOptions.find(
          (opt) => opt.value === paramsToSend.customerName
        );
        if (selectedCustomer) {
          paramsToSend.customerName = selectedCustomer.label;
        }
      }

      // Filter out empty strings and undefined values
      const cleanParams = Object.fromEntries(
        Object.entries(paramsToSend).filter(
          ([_, v]) =>
            v !== "" && v !== null && v !== undefined && v !== "undefined"
        )
      );

      const params = new URLSearchParams(cleanParams).toString();
      const url = `${Base_URL}/sales-reports/export/${type}?${params}`;

      console.log(
        "📤 Excel Export - Sending request with params:",
        cleanParams
      );

      const response = await axios.get(url, {
        responseType: "blob",
        timeout: 60000, // 60 second timeout for large exports
      });

      // Create blob link to download
      const blob = new Blob([response.data]);
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `sales-reports-${Date.now()}.xlsx`;
      link.click();

      toast.success(`Report exported successfully as ${type.toUpperCase()}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Failed to export report as ${type.toUpperCase()}`);
    } finally {
      setExcelLoading(false);
    }
  };

  // Filtered records for table search
  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      (rec.customerName || "").toLowerCase().includes(q) ||
      (rec.subSalesContractNo || "").toLowerCase().includes(q) ||
      (rec.company || "").toLowerCase().includes(q) ||
      (rec.investor || "").toLowerCase().includes(q) ||
      (rec.grade || "").toLowerCase().includes(q)
    );
  });

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

  // Format large numbers with K, M, B suffixes
  const formatLargeNumber = (value) => {
    if (!value && value !== 0) return "-";
    const num = parseFloat(value);

    if (Math.abs(num) >= 1000000000) {
      return (num / 1000000000).toFixed(2) + "B";
    } else if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(2) + "M";
    } else if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(2) + "K";
    }
    return num.toFixed(2);
  };

  // Format currency with K, M, B suffixes for large values
  const formatCurrencyCompact = (value) => {
    if (!value && value !== 0) return "-";
    const num = parseFloat(value);

    if (Math.abs(num) >= 1000000000) {
      return "$" + (num / 1000000000).toFixed(2) + "B";
    } else if (Math.abs(num) >= 1000000) {
      return "$" + (num / 1000000).toFixed(2) + "M";
    } else if (Math.abs(num) >= 1000) {
      return "$" + (num / 1000).toFixed(2) + "K";
    }
    return formatCurrency(num);
  };

  return (
    <div
      className="p-6 bg-gray-50 min-h-screen"
      style={{ overflowX: "hidden" }}
    >
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-sm font-medium truncate">
                Total Sales Value
              </p>
              <p
                className="text-xl md:text-2xl font-bold text-gray-900 mt-1 truncate"
                title={formatCurrency(statistics.totalSalesValue)}
              >
                {formatCurrencyCompact(statistics.totalSalesValue)}
              </p>
              {Math.abs(statistics.totalSalesValue) >= 1000 && (
                <p
                  className="text-xs text-gray-400 mt-1 truncate"
                  title={formatCurrency(statistics.totalSalesValue)}
                >
                  {formatCurrency(statistics.totalSalesValue)}
                </p>
              )}
            </div>
            <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-orange-500 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-sm font-medium truncate">
                Total Purchase Value
              </p>
              <p
                className="text-xl md:text-2xl font-bold text-gray-900 mt-1 truncate"
                title={formatCurrency(statistics.totalPurchaseValue)}
              >
                {formatCurrencyCompact(statistics.totalPurchaseValue)}
              </p>
              {Math.abs(statistics.totalPurchaseValue) >= 1000 && (
                <p
                  className="text-xs text-gray-400 mt-1 truncate"
                  title={formatCurrency(statistics.totalPurchaseValue)}
                >
                  {formatCurrency(statistics.totalPurchaseValue)}
                </p>
              )}
            </div>
            <div className="bg-orange-100 p-3 rounded-full flex-shrink-0">
              <ShoppingCart className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-500 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-sm font-medium truncate">
                Gross Profit
              </p>
              <p
                className={`text-xl md:text-2xl font-bold mt-1 truncate ${
                  statistics.totalGrossProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
                title={formatCurrency(statistics.totalGrossProfit)}
              >
                {formatCurrencyCompact(statistics.totalGrossProfit)}
              </p>
              {Math.abs(statistics.totalGrossProfit) >= 1000 && (
                <p
                  className="text-xs text-gray-400 mt-1 truncate"
                  title={formatCurrency(statistics.totalGrossProfit)}
                >
                  {formatCurrency(statistics.totalGrossProfit)}
                </p>
              )}
            </div>
            <div className="bg-green-100 p-3 rounded-full flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-purple-500 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-sm font-medium truncate">
                Total Reports
              </p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1 truncate">
                {statistics.totalReports >= 1000
                  ? formatLargeNumber(statistics.totalReports)
                  : statistics.totalReports}
              </p>
              {statistics.totalReports >= 1000 && (
                <p
                  className="text-xs text-gray-400 mt-1 truncate"
                  title={`${statistics.totalReports} reports`}
                >
                  {statistics.totalReports.toLocaleString()} reports
                </p>
              )}
            </div>
            <div className="bg-purple-100 p-3 rounded-full flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Sales & Purchase Reports
            </h2>
            {baseCurrency && baseCurrency !== "USD" && (
              <p className="text-sm text-gray-600 mt-1">
                Base Currency:{" "}
                <span className="font-semibold">{baseCurrency}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={() => handleDownload("excel")}
              disabled={excelLoading}
            >
              {excelLoading ? (
                <>
                  <Loader color="white" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Excel
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="relative">
            <InputField
              type="text"
              name="search"
              value={searchParams.search || ""}
              placeholder="Search by name, contract, company..."
              className="pl-10 text-sm"
              onChange={(e) =>
                setSearchParams((prev) => ({ ...prev, search: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          </div>

          <DropdownBasic
            placeholder="Year"
            name="year"
            value={searchParams.year || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, year: val }))
            }
            options={yearOptions}
            className="text-sm"
          />

          <DropdownBasic
            placeholder="Month"
            name="month"
            value={searchParams.month || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, month: val }))
            }
            options={monthOptions}
            className="text-sm"
          />

          <DropdownBasic
            placeholder="Investor"
            name="investor"
            value={searchParams.investor || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, investor: val }))
            }
            options={investorOptions}
            className="text-sm"
          />

          {adminId ? (
            <BusinessDropdown
              adminId={adminId}
              selectedBusiness={searchParams.business || ""}
              onChange={(val) => {
                setSearchParams((prev) => ({
                  ...prev,
                  business: val,
                  customerName: "",
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <DropdownBasic
            placeholder="Customer Name"
            name="customerName"
            value={searchParams.customerName || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, customerName: val }))
            }
            options={customerOptions}
            className="text-sm"
            disabled={customerOptions.length <= 1}
          />

          <DropdownBasic
            placeholder="Project Status"
            name="projectStatus"
            value={searchParams.projectStatus || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, projectStatus: val }))
            }
            options={projectStatusOptions}
            className="text-sm"
          />

          <DropdownBasic
            placeholder="Product Type"
            name="typeOfProduct"
            value={searchParams.typeOfProduct || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, typeOfProduct: val }))
            }
            options={productTypeOptions}
            className="text-sm"
          />

          {/* Grade filter - Commented out */}
          {/* <DropdownBasic
            placeholder="Grade"
            name="grade"
            value={searchParams.grade || ""}
            onChange={(val) => setSearchParams((prev) => ({ ...prev, grade: val }))}
            options={gradeOptions}
            className="text-sm"
        /> */}

          <DropdownBasic
            placeholder="Sales Status"
            name="salesStatus"
            value={searchParams.salesStatus || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, salesStatus: val }))
            }
            options={salesStatusOptions}
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <InputField
            type="text"
            name="subSalesContractNo"
            value={searchParams.subSalesContractNo || ""}
            placeholder="Contract No."
            className="text-sm"
            onChange={(e) =>
              setSearchParams((prev) => ({
                ...prev,
                subSalesContractNo: e.target.value,
              }))
            }
          />

          <FormInput
            key={resetKey}
            type="date-range"
            initialStartDate={searchParams.startDate}
            initialEndDate={searchParams.endDate}
            onChange={(value) => {
              setSearchParams((prev) => ({
                ...prev,
                startDate: value.startDate,
                endDate: value.endDate,
              }));
            }}
            marginLeft="-44px"
          />

          <div className="flex gap-2 md:col-span-3">
            <button
              onClick={handleSearch}
              className="bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white flex items-center justify-center px-6 py-2 rounded-lg text-sm font-medium transition-colors"
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
          </div>
        </div>
      </div>

      {/* Table with horizontal scroll - shows all 90+ columns */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <style>{`
          /* Container for table with horizontal scroll - ONLY scrolls the table area */
          .sales-reports-table-wrapper {
            width: 100%;
            max-width: 100vw;
            overflow-x: auto;
            overflow-y: visible;
            -webkit-overflow-scrolling: touch;
            position: relative;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
          }
          
          /* Custom scrollbar styling */
          .sales-reports-table-wrapper::-webkit-scrollbar {
            height: 8px;
          }
          
          .sales-reports-table-wrapper::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          
          .sales-reports-table-wrapper::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          
          .sales-reports-table-wrapper::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          
          /* Ensure DataTable layout doesn't overflow page */
          .sales-reports-table-wrapper .data-table-layout {
            width: 100%;
            max-width: 100%;
            overflow: visible;
          }
          
          /* Override DataTable's overflow-x-hidden - THIS IS KEY */
          /* Target all levels of overflow-x-hidden divs */
          .sales-reports-table-wrapper .data-table-layout > div > div.overflow-x-hidden,
          .sales-reports-table-wrapper .data-table-layout div.overflow-x-hidden,
          .sales-reports-table-wrapper .data-table-layout > div.overflow-x-hidden,
          .sales-reports-table-wrapper div.overflow-x-hidden {
            overflow-x: auto !important;
            overflow-y: visible !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          
          /* Also target by class selector */
          .sales-reports-table-wrapper [class*="overflow-x-hidden"] {
            overflow-x: auto !important;
            overflow-y: visible !important;
          }
          
          /* Make table expand to show all columns */
          .sales-reports-table-wrapper .data-table-layout table,
          .sales-reports-table-wrapper table {
            min-width: max-content !important;
            width: max-content !important;
            table-layout: auto !important;
            display: table !important;
          }
          
          /* Ensure table cells don't wrap */
          .sales-reports-table-wrapper .data-table-layout table td,
          .sales-reports-table-wrapper .data-table-layout table th,
          .sales-reports-table-wrapper table td,
          .sales-reports-table-wrapper table th {
            white-space: nowrap !important;
          }
          
          /* Ensure wrapper is the scroll container */
          .sales-reports-table-wrapper {
            isolation: isolate;
          }
          
          /* Prevent wrapper from expanding page width */
          .sales-reports-table-wrapper > * {
            max-width: 100%;
          }
        `}</style>
        <div className="sales-reports-table-wrapper">
          <DataTable
            noBackground={true}
            noPadding={true}
            containerClassName="w-full"
            headers={[
              "Year",
              "Month",
              "Investor",
              "Project Status",
              "Contract Date",
              "Contract No.",
              "Company",
              "Customer Name",
              "Grade",
              "Product Type",
              "FCL Size",
              "Container Weight",
              "Delivery Terms",
              "Qty (FCL)",
              "Qty (MTS)",
              "Price (USD/MT)",
              "Total Sales Value (USD)",
              "Terms & Condition",
              "Deposit %",
              "Shipping Terms",
              "SDN Date",
              "SDN No.",
              "SDN Amount",
              "SCN Date",
              "SCN No.",
              "SCN Amount",
              "SPI No.",
              "SPI Amount",
              "SPI Payment Date",
              "SPI Received",
              "SPI Bank Charges",
              "SPI FOREX",
              "SPI Bank",
              "SCI Date",
              "SCI No.",
              "SCI Amount",
              "SCI Payment Date",
              "SCI Received",
              "SCI Bank Charges",
              "CI Outstanding",
              "Sales Status",
              "Purchase Company",
              "Purchase Contract Date",
              "Supplier Name",
              "Purchase Project No.",
              "PO/PC",
              "Purchase Grade",
              "Purchase Qty (FCL)",
              "Purchase Qty (MTS)",
              "Purchase Price/MT",
              "Total Purchase Value",
              "Purchase Deposit %",
              "Purchase Terms",
              "PDN Date",
              "PDN No.",
              "PDN Amount",
              "PCN Date",
              "PCN No.",
              "PCN Amount",
              "PPI Date",
              "PPI No.",
              "PPI Amount",
              "PPI Payment Date",
              "PPI Received",
              "PCI Date",
              "PCI No.",
              "PCI Amount",
              "PCI Payment Date",
              "PCI Received",
              "Freight Description",
              "Freight FCL",
              "Freight MTS",
              "Freight Amount",
              "Switch BL",
              "THC & EDI",
              "Telex Fee",
              "Other Handling",
              "Total Handling",
              "Demurrage",
              "Transportation",
              "Warehouse",
              "Freight Insurance",
              "Commission",
              "Courier",
              "Total COGS",
              "Forecast Cost/MT",
              "Total Forecast Cost",
              "Cost Variance",
              "Gross Profit",
              "Initial ETD",
              "Actual ETD",
              "Sales Person",
              "Final Customer",
              "Final Customer Price",
              "Have Freight?",
              "Freight Recorded?",
              "Freight Paid?",
              "Status",
            ]}
            data={filteredRecords}
            searchValue={searchQuery}
            onSearch={setSearchQuery}
            searchPlaceholder="Search in results..."
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            recordsPerPage={limit}
            onRecordsPerPageChange={setLimit}
            loading={loading}
            colWidths={{
              Year: "70px",
              Month: "70px",
              Investor: "100px",
              "Project Status": "120px",
              "Contract Date": "120px",
              "Contract No.": "180px",
              Company: "100px",
              "Customer Name": "200px",
              Grade: "100px",
              "Product Type": "120px",
              "FCL Size": "80px",
              "Container Weight": "120px",
              "Delivery Terms": "100px",
              "Qty (FCL)": "90px",
              "Qty (MTS)": "100px",
              "Price (USD/MT)": "120px",
              "Total Sales Value (USD)": "150px",
              "Terms & Condition": "100px",
              "Deposit %": "80px",
              "Shipping Terms": "200px",
              "SDN Date": "100px",
              "SDN No.": "110px",
              "SDN Amount": "110px",
              "SCN Date": "100px",
              "SCN No.": "110px",
              "SCN Amount": "110px",
              "SPI No.": "130px",
              "SPI Amount": "110px",
              "SPI Payment Date": "130px",
              "SPI Received": "110px",
              "SPI Bank Charges": "120px",
              "SPI FOREX": "110px",
              "SPI Bank": "120px",
              "SCI Date": "100px",
              "SCI No.": "130px",
              "SCI Amount": "110px",
              "SCI Payment Date": "130px",
              "SCI Received": "110px",
              "SCI Bank Charges": "120px",
              "CI Outstanding": "120px",
              "Sales Status": "150px",
              "Purchase Company": "120px",
              "Purchase Contract Date": "150px",
              "Supplier Name": "150px",
              "Purchase Project No.": "140px",
              "PO/PC": "100px",
              "Purchase Grade": "110px",
              "Purchase Qty (FCL)": "130px",
              "Purchase Qty (MTS)": "130px",
              "Purchase Price/MT": "130px",
              "Total Purchase Value": "150px",
              "Purchase Deposit %": "130px",
              "Purchase Terms": "150px",
              "PDN Date": "100px",
              "PDN No.": "110px",
              "PDN Amount": "110px",
              "PCN Date": "100px",
              "PCN No.": "110px",
              "PCN Amount": "110px",
              "PPI Date": "100px",
              "PPI No.": "110px",
              "PPI Amount": "110px",
              "PPI Payment Date": "130px",
              "PPI Received": "110px",
              "PCI Date": "100px",
              "PCI No.": "110px",
              "PCI Amount": "110px",
              "PCI Payment Date": "130px",
              "PCI Received": "110px",
              "Freight Description": "150px",
              "Freight FCL": "110px",
              "Freight MTS": "110px",
              "Freight Amount": "120px",
              "Switch BL": "100px",
              "THC & EDI": "110px",
              "Telex Fee": "100px",
              "Other Handling": "120px",
              "Total Handling": "120px",
              Demurrage: "110px",
              Transportation: "120px",
              Warehouse: "110px",
              "Freight Insurance": "140px",
              Commission: "100px",
              Courier: "100px",
              "Total COGS": "110px",
              "Forecast Cost/MT": "130px",
              "Total Forecast Cost": "150px",
              "Cost Variance": "120px",
              "Gross Profit": "120px",
              "Initial ETD": "100px",
              "Actual ETD": "100px",
              "Sales Person": "120px",
              "Final Customer": "150px",
              "Final Customer Price": "150px",
              "Have Freight?": "100px",
              "Freight Recorded?": "130px",
              "Freight Paid?": "110px",
              Status: "100px",
            }}
            renderRow={(rec) => {
              const statusColor =
                rec.projectStatus === "ONGOING"
                  ? "text-blue-700 bg-blue-50 border border-blue-200"
                  : rec.projectStatus === "COMPLETED"
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-red-700 bg-red-50 border border-red-200";

              const profitColor =
                rec.grossProfit > 0
                  ? "text-green-600 font-semibold"
                  : rec.grossProfit < 0
                  ? "text-red-600 font-semibold"
                  : "text-gray-600";

              // Check if purchase is linked
              const hasLinkedPurchase =
                rec.salesStatus === "SALES WITH PURCHASE" ||
                rec.purchase?.supplierName ||
                rec.purchase?.company;

              return (
                <tr
                  key={rec._id}
                  className={`border-b hover:bg-gray-50 transition-colors ${
                    hasLinkedPurchase ? "bg-green-50/30" : ""
                  }`}
                  title={
                    hasLinkedPurchase
                      ? "This sales contract has a linked purchase"
                      : ""
                  }
                >
                  {/* Year */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.year || "-"}
                  </td>

                  {/* Month */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.month || "-"}
                  </td>

                  {/* Investor */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.investor || "-"}
                  </td>

                  {/* Project Status */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}
                    >
                      {rec.projectStatus || "-"}
                    </span>
                  </td>

                  {/* Contract Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.contractDate ? formatDate(rec.contractDate) : "-"}
                  </td>

                  {/* Contract No. */}
                  <td className="px-3 py-2 text-sm font-medium text-blue-600 whitespace-nowrap">
                    {rec.subSalesContractNo || "-"}
                  </td>

                  {/* Company */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.company || "-"}
                  </td>

                  {/* Customer Name */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.customerName || "-"}
                  </td>

                  {/* Grade */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.grade || "-"}
                  </td>

                  {/* Product Type */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                      {rec.typeOfProduct || "-"}
                    </span>
                  </td>

                  {/* FCL Size */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.fclSize || "-"}
                  </td>

                  {/* Container Weight */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.containerWeight?.toFixed(2) || "-"}
                  </td>

                  {/* Delivery Terms */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.deliveryTerms || "-"}
                  </td>

                  {/* Quantity FCL */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.quantityFCL?.toFixed(2) || "-"}
                  </td>

                  {/* Quantity MTS */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.quantityMTS?.toFixed(2) || "-"}
                  </td>

                  {/* Price USD/MT */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.priceUSDPerMT
                      ? formatCurrency(rec.priceUSDPerMT)
                      : "-"}
                  </td>

                  {/* Total Sales Value */}
                  <td className="px-3 py-2 text-sm text-right font-medium whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(rec.totalSalesValueUSD)}</span>
                      {rec.currency &&
                        rec.currency !== baseCurrency &&
                        rec.totalSalesValueOriginal && (
                          <span className="text-xs text-gray-500 mt-1">
                            ≈{" "}
                            {formatCurrencyWithCode(
                              rec.totalSalesValueOriginal,
                              rec.currency
                            )}
                          </span>
                        )}
                    </div>
                  </td>

                  {/* Terms & Condition */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.termsAndCondition || "-"}
                  </td>

                  {/* Deposit % */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.depositPercent !== undefined
                      ? `${rec.depositPercent}%`
                      : "-"}
                  </td>

                  {/* Shipping Terms */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap min-w-[150px]">
                    {rec.shippingTerms || "-"}
                  </td>

                  {/* SDN Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.sdn?.date ? formatDate(rec.sdn.date) : "-"}
                  </td>

                  {/* SDN No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.sdn?.number || "-"}
                  </td>

                  {/* SDN Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.sdn?.amountUSD)}
                  </td>

                  {/* SCN Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.scn?.date ? formatDate(rec.scn.date) : "-"}
                  </td>

                  {/* SCN No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.scn?.number || "-"}
                  </td>

                  {/* SCN Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.scn?.amountUSD)}
                  </td>

                  {/* SPI No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.spi?.number || "-"}
                  </td>

                  {/* SPI Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.spi?.amountUSD)}
                  </td>

                  {/* SPI Payment Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.spi?.paymentDate
                      ? formatDate(rec.spi.paymentDate)
                      : "-"}
                  </td>

                  {/* SPI Received */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.spi?.receivedAmount)}
                  </td>

                  {/* SPI Bank Charges */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.spi?.bankCharges)}
                  </td>

                  {/* SPI FOREX */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.spi?.forexGainLoss)}
                  </td>

                  {/* SPI Bank */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.spi?.receivingBank || "-"}
                  </td>

                  {/* SCI Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.sci?.date ? formatDate(rec.sci.date) : "-"}
                  </td>

                  {/* SCI No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.sci?.number || "-"}
                  </td>

                  {/* SCI Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.sci?.amountUSD)}
                  </td>

                  {/* SCI Payment Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.sci?.paymentDate
                      ? formatDate(rec.sci.paymentDate)
                      : "-"}
                  </td>

                  {/* SCI Received */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.sci?.receivedAmount)}
                  </td>

                  {/* SCI Bank Charges */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.sci?.bankCharges)}
                  </td>

                  {/* CI Outstanding */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.sci?.outstanding)}
                  </td>

                  {/* Sales Status */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.salesStatus === "SALES WITH PURCHASE" ? (
                      <span
                        className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 font-semibold"
                        title="This sales contract has a linked purchase"
                      >
                        ✓ WITH PURCHASE
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                        {rec.salesStatus || "NO PURCHASE"}
                      </span>
                    )}
                  </td>

                  {/* Purchase Company */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.purchase?.company || "-"}
                  </td>

                  {/* Purchase Contract Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.purchase?.contractDate
                      ? formatDate(rec.purchase.contractDate)
                      : "-"}
                  </td>

                  {/* Supplier Name */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.purchase?.supplierName || "-"}
                  </td>

                  {/* Purchase Project No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.purchase?.projectNo || "-"}
                  </td>

                  {/* PO/PC */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.purchase?.poOrPc || "-"}
                  </td>

                  {/* Purchase Grade */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.purchase?.grade || "-"}
                  </td>

                  {/* Purchase Qty FCL */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.purchase?.quantityFCL?.toFixed(2) || "-"}
                  </td>

                  {/* Purchase Qty MTS */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.purchase?.totalQuantityMTS?.toFixed(2) || "-"}
                  </td>

                  {/* Purchase Price/MT */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.purchase?.purchasePricePerMT)}
                  </td>

                  {/* Total Purchase Value */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.purchase?.totalPurchaseValue)}
                  </td>

                  {/* Purchase Deposit % */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.purchase?.depositPercent !== undefined
                      ? `${rec.purchase.depositPercent}%`
                      : "-"}
                  </td>

                  {/* Purchase Terms */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.purchase?.purchaseTerms || "-"}
                  </td>

                  {/* PDN Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.pdn?.date ? formatDate(rec.pdn.date) : "-"}
                  </td>

                  {/* PDN No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.pdn?.number || "-"}
                  </td>

                  {/* PDN Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.pdn?.amountUSD)}
                  </td>

                  {/* PCN Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.pcn?.date ? formatDate(rec.pcn.date) : "-"}
                  </td>

                  {/* PCN No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.pcn?.number || "-"}
                  </td>

                  {/* PCN Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.pcn?.amountUSD)}
                  </td>

                  {/* PPI Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.ppi?.date ? formatDate(rec.ppi.date) : "-"}
                  </td>

                  {/* PPI No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.ppi?.number || "-"}
                  </td>

                  {/* PPI Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.ppi?.amountUSD)}
                  </td>

                  {/* PPI Payment Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.ppi?.paymentDate
                      ? formatDate(rec.ppi.paymentDate)
                      : "-"}
                  </td>

                  {/* PPI Received */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.ppi?.paymentAmount)}
                  </td>

                  {/* PCI Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.pci?.date ? formatDate(rec.pci.date) : "-"}
                  </td>

                  {/* PCI No. */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.pci?.number || "-"}
                  </td>

                  {/* PCI Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.pci?.amountUSD)}
                  </td>

                  {/* PCI Payment Date */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.pci?.paymentDate
                      ? formatDate(rec.pci.paymentDate)
                      : "-"}
                  </td>

                  {/* PCI Received */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.pci?.paymentAmount)}
                  </td>

                  {/* Freight Description */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.cogs?.freightDescription || "-"}
                  </td>

                  {/* Freight FCL */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.cogs?.freightFCL?.toFixed(2) || "-"}
                  </td>

                  {/* Freight MTS */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.cogs?.freightMTS?.toFixed(2) || "-"}
                  </td>

                  {/* Freight Amount */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.freightAmount)}
                  </td>

                  {/* Switch BL */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.switchBL)}
                  </td>

                  {/* THC & EDI */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.thcEdiDocsEfsArcAgency)}
                  </td>

                  {/* Telex Fee */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.telexFee)}
                  </td>

                  {/* Other Handling */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.otherHandlingCharges)}
                  </td>

                  {/* Total Handling */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.totalHandlingCharges)}
                  </td>

                  {/* Demurrage */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.demurrageDetention)}
                  </td>

                  {/* Transportation */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.transportation)}
                  </td>

                  {/* Warehouse */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.warehouse)}
                  </td>

                  {/* Freight Insurance */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.freightInsurance)}
                  </td>

                  {/* Commission */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.commission)}
                  </td>

                  {/* Courier */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.courier)}
                  </td>

                  {/* Total COGS */}
                  <td className="px-3 py-2 text-sm text-right font-medium whitespace-nowrap">
                    {rec.cogs?.totalCOGS ? (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(rec.cogs.totalCOGS)}</span>
                        {rec.currency &&
                          rec.currency !== baseCurrency &&
                          rec.cogs.totalCOGSOriginal && (
                            <span className="text-xs text-gray-500 mt-1">
                              ≈{" "}
                              {formatCurrencyWithCode(
                                rec.cogs.totalCOGSOriginal,
                                rec.currency
                              )}
                            </span>
                          )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Forecast Cost/MT */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.forecastCostPerMT)}
                  </td>

                  {/* Total Forecast Cost */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.totalForecastCost)}
                  </td>

                  {/* Cost Variance */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.cogs?.costVariance)}
                  </td>

                  {/* Gross Profit */}
                  <td
                    className={`px-3 py-2 text-sm text-right font-medium whitespace-nowrap ${profitColor}`}
                  >
                    {rec.grossProfit !== undefined ? (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(rec.grossProfit)}</span>
                        {rec.currency &&
                          rec.currency !== baseCurrency &&
                          rec.grossProfitOriginal !== undefined && (
                            <span className="text-xs text-gray-500 mt-1">
                              ≈{" "}
                              {formatCurrencyWithCode(
                                rec.grossProfitOriginal,
                                rec.currency
                              )}
                            </span>
                          )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Initial ETD */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.shippingInfo?.initialETD
                      ? formatDate(rec.shippingInfo.initialETD)
                      : "-"}
                  </td>

                  {/* Actual ETD */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.shippingInfo?.actualETD
                      ? formatDate(rec.shippingInfo.actualETD)
                      : "-"}
                  </td>

                  {/* Sales Person */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.shippingInfo?.salesPerson || "-"}
                  </td>

                  {/* Final Customer */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.shippingInfo?.bahmanFinalCustomer || "-"}
                  </td>

                  {/* Final Customer Price */}
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(rec.shippingInfo?.bahmanFinalCustomerPrice)}
                  </td>

                  {/* Have Freight? */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.shippingInfo?.haveFreight ? "Yes" : "No"}
                  </td>

                  {/* Freight Recorded? */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.shippingInfo?.freightRecorded ? "Yes" : "No"}
                  </td>

                  {/* Freight Paid? */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.shippingInfo?.freightPaid ? "Yes" : "No"}
                  </td>

                  {/* Status (Final) */}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}
                    >
                      {rec.finalProjectStatus || rec.projectStatus || "-"}
                    </span>
                  </td>
                </tr>
              );
            }}
          />
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
          <span className="text-gray-400 text-xs">← Scroll →</span>
        </div>
      </div>
    </div>
  );
};

export default AllReports;
