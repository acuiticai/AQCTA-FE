import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import {
  Download,
  Search,
  RefreshCw,
  Loader,
  Info,
  X,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  MapPin,
  Users,
  ShoppingCart,
  Truck,
  Calendar,
  CheckCircle,
  AlertCircle,
  Filter,
} from "lucide-react";
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
import RegionMap from "@/components/RegionMap";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SupplierReports = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const adminId = adminInfo?.id || adminInfo?._id;

  // Filters
  const currentYear = new Date().getFullYear();
  const [searchParams, setSearchParams] = useState({
    business: "",
    year: currentYear.toString(),
    vendor: "", // Single vendor for detailed stats
    startDate: "",
    endDate: "",
  });

  // Vendor options for dropdown
  const [vendorOptions, setVendorOptions] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Analytics Data States
  const [topVendorsByPurchase, setTopVendorsByPurchase] = useState([]);
  const [paymentAnalytics, setPaymentAnalytics] = useState([]);
  const [shipmentAnalytics, setShipmentAnalytics] = useState([]);
  const [regionWiseVendors, setRegionWiseVendors] = useState([]);
  const [vendorPerformance, setVendorPerformance] = useState([]);
  const [selectedVendorStats, setSelectedVendorStats] = useState(null);
  const [purchasedItems, setPurchasedItems] = useState([]);
  const [linkedContracts, setLinkedContracts] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Summary statistics
  const [summaryStats, setSummaryStats] = useState({
    totalVendors: 0,
    activeVendors: 0,
    totalPurchaseValue: 0,
    totalPurchaseOrders: 0,
    onTimeDeliveryRate: 0,
  });

  // Tabs state
  const [activeTab, setActiveTab] = useState("overview"); // overview, purchases, payments, shipments, regions, detailed, items, contracts, paymentStatus

  // Track which tabs have been loaded to avoid refetching
  const [loadedTabs, setLoadedTabs] = useState(new Set(["overview"])); // Overview is loaded by default
  const [tabLoading, setTabLoading] = useState({}); // Loading state per tab

  // Vendors with regions for map
  const [vendorsWithRegions, setVendorsWithRegions] = useState([]);
  const [loadingVendorsMap, setLoadingVendorsMap] = useState(false);

  // Year options
  const yearOptions = [
    ...Array.from({ length: 11 }, (_, i) => {
      const year = currentYear - i;
      return { value: year.toString(), label: year.toString() };
    }),
  ];

  // Fetch all vendors for dropdown
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const queryParams = new URLSearchParams();

      if (searchParams.business) {
        queryParams.append("businessId", searchParams.business);
      }

      const response = await axios.get(
        `${Base_URL}/reports/vendors/list?${queryParams.toString()}`,
        {
          headers: {
            authorization: `Bearer ${adminInfo?.token}`,
          },
        }
      );

      const vendors = response.data?.data || [];
      const options = vendors.map((vendor) => ({
        value: vendor._id,
        label:
          vendor.basicInformation?.companyName ||
          vendor.basicInformation?.vendorDisplayName ||
          vendor.companyName ||
          "N/A",
      }));

      setVendorOptions([{ value: "", label: "All Vendors" }, ...options]);
    } catch (err) {
      console.error("❌ Error fetching vendors:", err);
      setVendorOptions([{ value: "", label: "All Vendors" }]);
    } finally {
      setLoadingVendors(false);
    }
  };

  // Fetch vendors when business changes
  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.business]);

  // Fetch vendors with regions for map
  const fetchVendorsWithRegions = async () => {
    setLoadingVendorsMap(true);
    try {
      const params = {};
      if (searchParams.business) {
        params.businessId = searchParams.business;
      }

      // Fetch vendors and regions in parallel
      const [vendorsResponse, regionsResponse] = await Promise.all([
        axios
          .get(`${Base_URL}/vendors`, {
            params,
            headers: {
              authorization: `Bearer ${adminInfo?.token}`,
            },
          })
          .catch((err) => {
            console.error("Error fetching vendors:", err);
            return { data: { data: [] } };
          }),
        axios
          .get(`${Base_URL}/regions`, {
            headers: {
              authorization: `Bearer ${adminInfo?.token}`,
            },
          })
          .catch(() => ({ data: { data: [] } })),
      ]);

      let vendors =
        vendorsResponse?.data?.data || vendorsResponse?.data?.vendors || [];
      const allRegions = regionsResponse?.data?.data || [];

      // Create a map of region IDs to region names for lookup
      const regionMap = new Map();
      allRegions.forEach((region) => {
        regionMap.set(region._id, region.name);
      });

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

      setVendorsWithRegions(vendorsWithRegionData);
    } catch (error) {
      console.error("❌ Error fetching vendors with regions:", error);
      setVendorsWithRegions([]);
    } finally {
      setLoadingVendorsMap(false);
    }
  };

  // Fetch supplier analytics data for a specific tab
  const fetchSupplierAnalytics = async (tabName = "overview") => {
    // Allow search without year/date range - will fetch all data

    // Check if this tab is already loaded
    if (loadedTabs.has(tabName)) {
      return; // Already loaded, skip fetch
    }

    // Set loading state for this specific tab
    setTabLoading((prev) => ({ ...prev, [tabName]: true }));
    setLoading(true);

    try {
      const cleanParams = Object.fromEntries(
        Object.entries(searchParams).filter(
          ([_, v]) => v !== "" && v !== null && v !== undefined
        )
      );

      // Add tab parameter to request
      cleanParams.tab = tabName;

      const response = await axios.get(
        `${Base_URL}/reports/supplier-analytics`,
        {
          params: cleanParams,
          headers: {
            authorization: `Bearer ${adminInfo?.token}`,
          },
        }
      );

      if (response.data?.success) {
        const data = response.data?.data || {};

        // Always update summary stats (needed for overview)
        if (data.summaryStats) {
          setSummaryStats(data.summaryStats);
        }

        // Update data based on tab
        if (tabName === "overview") {
          // Overview only needs summary stats (already set above)
        } else if (tabName === "purchases") {
          setTopVendorsByPurchase(data.topVendorsByPurchase || []);
          setVendorPerformance(data.vendorPerformance || []);
        } else if (tabName === "payments") {
          setPaymentAnalytics(data.paymentAnalytics || []);
        } else if (tabName === "shipments") {
          setShipmentAnalytics(data.shipmentAnalytics || []);
        } else if (tabName === "regions") {
          setRegionWiseVendors(data.regionWiseVendors || []);
        } else if (tabName === "items") {
          setPurchasedItems(data.purchasedItems || []);
        } else if (tabName === "contracts") {
          setLinkedContracts(data.linkedContracts || []);
        } else if (tabName === "paymentStatus") {
          setPaymentStatus(data.paymentStatus || []);
        } else if (tabName === "detailed") {
          // Detailed tab needs all data
          setTopVendorsByPurchase(data.topVendorsByPurchase || []);
          setPaymentAnalytics(data.paymentAnalytics || []);
          setShipmentAnalytics(data.shipmentAnalytics || []);
          setRegionWiseVendors(data.regionWiseVendors || []);
          setVendorPerformance(data.vendorPerformance || []);
          setPurchasedItems(data.purchasedItems || []);
          setLinkedContracts(data.linkedContracts || []);
          setPaymentStatus(data.paymentStatus || []);
          if (searchParams.vendor) {
            setSelectedVendorStats(data.selectedVendorStats || null);
          }
        }

        // Mark this tab as loaded
        setLoadedTabs((prev) => new Set([...prev, tabName]));
      } else {
        throw new Error(response.data?.message || "Failed to fetch data");
      }
    } catch (err) {
      console.error("❌ Error fetching supplier analytics:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch supplier analytics";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setTabLoading((prev) => ({ ...prev, [tabName]: false }));
    }
  };

  // Fetch overview data when filters change (only overview on initial load)
  useEffect(() => {
    // Reset loaded tabs when filters change (except overview)
    setLoadedTabs(new Set(["overview"]));

    // Reset all data except summary stats
    setTopVendorsByPurchase([]);
    setPaymentAnalytics([]);
    setShipmentAnalytics([]);
    setRegionWiseVendors([]);
    setVendorPerformance([]);
    setPurchasedItems([]);
    setLinkedContracts([]);
    setPaymentStatus([]);
    setSelectedVendorStats(null);

    // Fetch overview data only
    fetchSupplierAnalytics("overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParams.year,
    searchParams.business,
    searchParams.vendor,
    searchParams.startDate,
    searchParams.endDate,
  ]);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab && loadedTabs.has(activeTab)) {
      return; // Already loaded
    }

    // Fetch data for the active tab (no year/date requirement)
    if (activeTab) {
      fetchSupplierAnalytics(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fetch vendors with regions when regions tab is active
  useEffect(() => {
    if (activeTab === "regions") {
      fetchVendorsWithRegions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchParams.business]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setSearchParams((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle date range change
  const handleDateRangeChange = ({ startDate, endDate }) => {
    setSearchParams((prev) => ({
      ...prev,
      startDate,
      endDate,
    }));
  };

  // Handle reset filters
  const handleReset = () => {
    const resetParams = {
      business: "",
      year: currentYear.toString(), // Reset to current year
      vendor: "", // Reset vendor filter
      startDate: "", // Reset date range
      endDate: "", // Reset date range
    };
    setSearchParams(resetParams);

    // Reset loaded tabs
    setLoadedTabs(new Set(["overview"]));

    // Clear all data
    setTopVendorsByPurchase([]);
    setPaymentAnalytics([]);
    setShipmentAnalytics([]);
    setRegionWiseVendors([]);
    setVendorPerformance([]);
    setPurchasedItems([]);
    setLinkedContracts([]);
    setPaymentStatus([]);
    setVendorsWithRegions([]);
    setSelectedVendorStats(null);
    setSummaryStats({
      totalVendors: 0,
      activeVendors: 0,
      totalPurchaseValue: 0,
      totalPurchaseOrders: 0,
      averagePaymentDays: 0,
      onTimeDeliveryRate: 0,
    });

    // Fetch overview data with reset params
    setTimeout(() => {
      fetchSupplierAnalytics("overview");
    }, 100);
  };

  // Export to Excel
  const handleExport = async () => {
    // Allow export without year/date range - will export all data

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

      const response = await axios.get(
        `${Base_URL}/reports/supplier-analytics/export`,
        {
          params: cleanParams,
          headers: {
            authorization: `Bearer ${adminInfo?.token}`,
          },
          responseType: "blob",
        }
      );

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Generate a better filename with date and filters
      const dateStr = new Date().toISOString().split("T")[0];
      const yearStr = searchParams.year || new Date().getFullYear();
      link.setAttribute(
        "download",
        `Supplier_Analytics_Report_${yearStr}_${dateStr}.xlsx`
      );

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Excel file downloaded successfully!");
    } catch (err) {
      console.error("❌ Error exporting report:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to export report";
      toast.error(errorMessage);
    } finally {
      setExportLoading(false);
    }
  };

  // Format currency with specific currency code
  const formatCurrencyWithCode = (amount, currencyCode = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Format number
  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US").format(num || 0);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  // Render Summary Cards
  const renderSummaryCards = () => {
    const baseCurrency = summaryStats.baseCurrency || "USD";

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Vendors</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatNumber(summaryStats.totalVendors)}
              </p>
            </div>
            <Users className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Vendors</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatNumber(summaryStats.activeVendors)}
              </p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Purchase Value</p>
              <p
                className="text-xl font-bold text-gray-800"
                title={`Base Currency: ${baseCurrency}`}
              >
                {formatCurrencyWithCode(
                  summaryStats.totalPurchaseValue,
                  baseCurrency
                )}
              </p>
              {summaryStats.totalPurchaseValueByCurrency &&
                Object.keys(summaryStats.totalPurchaseValueByCurrency).length >
                  0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {Object.entries(summaryStats.totalPurchaseValueByCurrency)
                      .filter(([curr]) => curr !== baseCurrency)
                      .slice(0, 2)
                      .map(([curr, amt]) => (
                        <div key={curr}>
                          {formatCurrencyWithCode(amt, curr)}
                        </div>
                      ))}
                  </div>
                )}
            </div>
            <DollarSign className="text-purple-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Purchase Orders</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatNumber(summaryStats.totalPurchaseOrders)}
              </p>
            </div>
            <ShoppingCart className="text-orange-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">On-Time Delivery</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatPercentage(summaryStats.onTimeDeliveryRate)}
              </p>
            </div>
            <Truck className="text-teal-500" size={32} />
          </div>
        </div>
      </div>
    );
  };

  // Render Top Vendors by Purchase Table
  const renderTopVendorsTable = () => {
    const baseCurrency = summaryStats.baseCurrency || "USD";
    const headers = [
      "Vendor Name",
      "Total Purchase Value",
      "Number of Orders",
      "Average Order Value",
      "Paid Amount",
      "Pending Amount",
      "Linked Contracts",
      "Last Purchase Date",
      "Status",
    ];

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="mr-2 text-blue-500" size={20} />
          Top Vendors by Purchase Volume (Base: {baseCurrency})
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                📊 Data Source Information
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Models:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      Vendor
                    </span>
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      PurchaseContract
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Calculated Fields:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Total purchase value calculated in base currency (
                    {baseCurrency}), order count, average order value from
                    PurchaseContract collection
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Currency Conversion:
                  </span>
                  <div className="mt-1 text-gray-200">
                    All amounts shown in original currencies with conversion to{" "}
                    {baseCurrency} for totals
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Payment Data:
                  </span>
                  <div className="mt-1">
                    From{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      VendorInvoice
                    </span>{" "}
                    collection
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Linked Contracts:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Count of sales contracts linked to purchase contracts
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>
        {topVendorsByPurchase.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No vendor data found for the selected filters.</p>
          </div>
        ) : (
          <DataTable
            headers={headers}
            data={topVendorsByPurchase}
            renderRow={(row) => {
              const rowBaseCurrency = row.baseCurrency || baseCurrency;
              const hasCurrencyBreakdown =
                row.totalPurchaseValueByCurrency &&
                Object.keys(row.totalPurchaseValueByCurrency).length > 0;

              return (
                <tr
                  key={row.vendorId || row.vendorName}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-sm">{row.vendorName}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">
                        {formatCurrencyWithCode(
                          row.totalPurchaseValue,
                          rowBaseCurrency
                        )}
                      </span>
                      {hasCurrencyBreakdown && (
                        <div className="text-xs text-gray-500 mt-1">
                          {Object.entries(row.totalPurchaseValueByCurrency)
                            .filter(([curr]) => curr !== rowBaseCurrency)
                            .slice(0, 2)
                            .map(([curr, amt]) => (
                              <div key={curr}>
                                {formatCurrencyWithCode(amt, curr)}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    {formatNumber(row.orderCount)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {formatCurrencyWithCode(row.avgOrderValue, rowBaseCurrency)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {formatCurrency(row.totalPaidAmount || 0)}
                  </td>
                  <td
                    className={`px-4 py-2 text-sm text-right ${
                      row.totalPendingAmount > 0
                        ? "text-red-600 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    {formatCurrency(row.totalPendingAmount || 0)}
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    {formatNumber(row.linkedContractsCount || 0)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {row.lastPurchaseDate
                      ? new Date(row.lastPurchaseDate).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        row.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            }}
            recordsPerPage={10}
            onRecordsPerPageChange={(val) => {}}
            emptyMessage="No vendors found"
            colWidths={{
              "Vendor Name": "200px",
              "Total Purchase Value": "180px",
              "Number of Orders": "120px",
              "Average Order Value": "150px",
              "Paid Amount": "120px",
              "Pending Amount": "120px",
              "Linked Contracts": "120px",
              "Last Purchase Date": "130px",
              Status: "100px",
            }}
          />
        )}
      </div>
    );
  };

  // Render Payment Analytics Table
  const renderPaymentAnalyticsTable = () => {
    const headers = [
      "Vendor Name",
      "Total Paid",
      "Total Pending",
      "On-Time Payments",
      "Number of Payments",
    ];

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <DollarSign className="mr-2 text-green-500" size={20} />
          Payment Analytics - Who We Pay Fast
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                💰 Payment Analytics Data
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Model:
                  </span>
                  <div className="mt-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      VendorInvoice
                    </span>{" "}
                    collection
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Payment Data:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Extracted from{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      payments
                    </span>{" "}
                    array in VendorInvoice documents
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Calculations:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Payment data calculated from payment dates vs invoice due
                    dates
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    On-time Rate:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Percentage of payments made before or on due date
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>
        {paymentAnalytics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DollarSign size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No payment analytics data found for the selected filters.</p>
          </div>
        ) : (
          <DataTable
            headers={headers}
            data={paymentAnalytics}
            renderRow={(row) => (
              <tr
                key={row.vendorId || row.vendorName}
                className="border-b hover:bg-gray-50"
              >
                <td className="px-4 py-2 text-sm">{row.vendorName}</td>
                <td className="px-4 py-2 text-sm text-right">
                  {formatCurrency(row.totalPaid || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-right text-red-600">
                  {formatCurrency(row.totalPendingAmount || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-center">
                  {formatPercentage(row.onTimePaymentRate || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-center">
                  {formatNumber(row.paymentCount || 0)}
                </td>
              </tr>
            )}
            recordsPerPage={10}
            onRecordsPerPageChange={(val) => {}}
            emptyMessage="No payment analytics found"
            colWidths={{
              "Vendor Name": "250px",
              "Total Paid": "120px",
              "Total Pending": "120px",
              "On-Time Payments": "130px",
              "Number of Payments": "130px",
            }}
          />
        )}
      </div>
    );
  };

  // Render Shipment Analytics Table
  const renderShipmentAnalyticsTable = () => {
    const headers = [
      "Vendor Name",
      "Total Shipments",
      "On-Time Deliveries",
      "Average Delivery Days",
      "Total Quantity Shipped",
      "Performance",
    ];

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Truck className="mr-2 text-orange-500" size={20} />
          Shipment Analytics - Timely Delivery Management
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                🚚 Shipment Analytics Data
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Model:
                  </span>
                  <div className="mt-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      Shipment
                    </span>{" "}
                    collection
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Shipment Data:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Linked to PurchaseContract via{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      contractShipment
                    </span>{" "}
                    field
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Delivery Calculation:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Compares actual delivery date with expected delivery date
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    On-time Rate:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Percentage of shipments delivered on or before expected date
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>
        {shipmentAnalytics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Truck size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No shipment analytics data found for the selected filters.</p>
          </div>
        ) : (
          <DataTable
            headers={headers}
            data={shipmentAnalytics}
            renderRow={(row) => (
              <tr
                key={row.vendorId || row.vendorName}
                className="border-b hover:bg-gray-50"
              >
                <td className="px-4 py-2 text-sm">{row.vendorName}</td>
                <td className="px-4 py-2 text-sm text-center">
                  {formatNumber(row.totalShipments || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-center">
                  {formatPercentage(row.onTimeDeliveryRate || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-center">
                  {row.avgDeliveryDays || 0} days
                </td>
                <td className="px-4 py-2 text-sm text-right">
                  {formatNumber(row.totalQuantity || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-center">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      (row.onTimeDeliveryRate || 0) >= 90
                        ? "bg-green-100 text-green-800"
                        : (row.onTimeDeliveryRate || 0) >= 70
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {(row.onTimeDeliveryRate || 0) >= 90
                      ? "Excellent"
                      : (row.onTimeDeliveryRate || 0) >= 70
                      ? "Good"
                      : "Needs Improvement"}
                  </span>
                </td>
              </tr>
            )}
            recordsPerPage={10}
            onRecordsPerPageChange={(val) => {}}
            emptyMessage="No shipment analytics found"
            colWidths={{
              "Vendor Name": "250px",
              "Total Shipments": "130px",
              "On-Time Deliveries": "150px",
              "Average Delivery Days": "150px",
              "Total Quantity Shipped": "150px",
              Performance: "150px",
            }}
          />
        )}
      </div>
    );
  };

  // Render Region-wise Vendor Distribution
  const renderRegionWiseDistribution = () => {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <MapPin className="mr-2 text-purple-500" size={20} />
          Region-wise Vendor Distribution
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                🌍 Regional Distribution Data
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Model:
                  </span>
                  <div className="mt-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      Vendor
                    </span>{" "}
                    collection
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Region Field:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Extracted from vendor's{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      region
                    </span>{" "}
                    or{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      address.region
                    </span>{" "}
                    field
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Map Display:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Shows all vendors with location data on an interactive map
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>

        {/* Vendors Map Section */}
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Vendors by Region
            </h3>
            <div className="text-sm text-gray-600">
              {loadingVendorsMap ? (
                <div className="flex items-center gap-2">
                  <Loader className="animate-spin" size={16} />
                  <span>Loading...</span>
                </div>
              ) : (
                <>
                  {vendorsWithRegions.length} vendor
                  {vendorsWithRegions.length !== 1 ? "s" : ""} with location
                  data
                </>
              )}
            </div>
          </div>
          {loadingVendorsMap ? (
            <div className="flex justify-center items-center h-64">
              <LoaderComponent />
            </div>
          ) : vendorsWithRegions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
              <p>
                No vendors with location data found for the selected filters.
              </p>
            </div>
          ) : (
            <RegionMap
              data={vendorsWithRegions}
              height="650px"
              markerColor="#3B82F6"
              title="Vendors by Region"
            />
          )}
        </div>
      </div>
    );
  };

  // Render Purchased Items Table
  const renderPurchasedItemsTable = () => {
    const baseCurrency = summaryStats.baseCurrency || "USD";
    const headers = [
      "Vendor Name",
      "Purchase Contract No.",
      "Item Name",
      "Quantity (FCL)",
      "Quantity (MTS)",
      "Unit Price",
      "Total Value",
      "Purchase Date",
    ];

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Package className="mr-2 text-indigo-500" size={20} />
          Purchased Items & Quantities (Base: {baseCurrency})
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                📦 Purchased Items Data
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Model:
                  </span>
                  <div className="mt-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      PurchaseContract
                    </span>{" "}
                    collection
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Items Array:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Extracted from{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      productInfo
                    </span>{" "}
                    array in PurchaseContract
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Currency Display:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Prices shown in original currency with base currency (
                    {baseCurrency}) conversion
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">Fields:</span>
                  <div className="mt-1 text-gray-200">
                    Item name, quantity (FCL & MTS), unit price, total value
                    from each purchase contract
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Grouped By:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Vendor and purchase contract number
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>
        {purchasedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No purchased items found for the selected filters.</p>
          </div>
        ) : (
          <DataTable
            headers={headers}
            data={purchasedItems}
            renderRow={(row, index) => {
              const itemCurrency = row.currency || baseCurrency;
              const showConversion =
                itemCurrency !== baseCurrency && row.totalValueInBase;

              return (
                <tr
                  key={`${row.purchaseContractId}-${row.itemId}-${index}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-sm">{row.vendorName}</td>
                  <td className="px-4 py-2 text-sm font-medium text-blue-600">
                    {row.purchaseContractNo}
                  </td>
                  <td className="px-4 py-2 text-sm">{row.itemName}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    {formatNumber(row.quantityFCL || 0)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {formatNumber(row.quantityMTS || 0)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {formatCurrencyWithCode(row.unitPrice || 0, itemCurrency)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-medium">
                    <div className="flex flex-col items-end">
                      <span>
                        {formatCurrencyWithCode(
                          row.totalValue || 0,
                          itemCurrency
                        )}
                      </span>
                      {showConversion && (
                        <span className="text-xs text-gray-500 mt-1">
                          ≈{" "}
                          {formatCurrencyWithCode(
                            row.totalValueInBase,
                            baseCurrency
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {row.purchaseDate
                      ? new Date(row.purchaseDate).toLocaleDateString()
                      : "N/A"}
                  </td>
                </tr>
              );
            }}
            recordsPerPage={20}
            onRecordsPerPageChange={(val) => {}}
            emptyMessage="No purchased items found"
            colWidths={{
              "Vendor Name": "200px",
              "Purchase Contract No.": "180px",
              "Item Name": "200px",
              "Quantity (FCL)": "120px",
              "Quantity (MTS)": "120px",
              "Unit Price": "120px",
              "Total Value": "150px",
              "Purchase Date": "130px",
            }}
          />
        )}
      </div>
    );
  };

  // Render Linked Contracts Table
  const renderLinkedContractsTable = () => {
    const headers = [
      "Vendor Name",
      "Purchase Contract No.",
      "Sales Contract No.",
      "Customer Name",
      "Actions",
    ];

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ShoppingCart className="mr-2 text-teal-500" size={20} />
          Linked Contracts (Purchase to Sales)
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                🔗 Linked Contracts Data
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Models:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      PurchaseContract
                    </span>
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      SalesContract
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Link Field:
                  </span>
                  <div className="mt-1 text-gray-200">
                    PurchaseContract's{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      assignedSales
                    </span>{" "}
                    array contains SalesContract IDs
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Customer Info:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Populated from SalesContract's{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      basicInfo.selectedCustomerId
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Relationship:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Shows which purchase contracts are linked to which sales
                    contracts
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>
        {linkedContracts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No linked contracts found for the selected filters.</p>
          </div>
        ) : (
          <DataTable
            headers={headers}
            data={linkedContracts}
            renderRow={(row, index) => (
              <tr
                key={`${row.purchaseContractId}-${row.salesContractId}-${index}`}
                className="border-b hover:bg-gray-50"
              >
                <td className="px-4 py-2 text-sm">{row.vendorName}</td>
                <td className="px-4 py-2 text-sm font-medium text-blue-600">
                  {row.purchaseContractNo}
                </td>
                <td className="px-4 py-2 text-sm font-medium text-green-600">
                  {row.salesContractNo}
                </td>
                <td className="px-4 py-2 text-sm">{row.customerName}</td>
                <td className="px-4 py-2 text-sm">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() =>
                        window.open(
                          `/view-purchase-contract/${row.purchaseContractId}`,
                          "_blank"
                        )
                      }
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      View Purchase
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          `/view-sales-contract/${row.salesContractId}`,
                          "_blank"
                        )
                      }
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                    >
                      View Sales
                    </button>
                  </div>
                </td>
              </tr>
            )}
            recordsPerPage={20}
            onRecordsPerPageChange={(val) => {}}
            emptyMessage="No linked contracts found"
            colWidths={{
              "Vendor Name": "200px",
              "Purchase Contract No.": "200px",
              "Sales Contract No.": "200px",
              "Customer Name": "250px",
              Actions: "200px",
            }}
          />
        )}
      </div>
    );
  };

  // Render Payment Status Table
  const renderPaymentStatusTable = () => {
    const headers = [
      "Vendor Name",
      "Invoice Number",
      "Purchase Contract No.",
      "Invoice Date",
      "Due Date",
      "Total Amount",
      "Paid Amount",
      "Pending Amount",
      "Status",
    ];

    // Calculate summary
    const totalInvoices = paymentStatus.length;
    const totalAmount = paymentStatus.reduce(
      (sum, p) => sum + (p.totalAmount || 0),
      0
    );
    const totalPaid = paymentStatus.reduce(
      (sum, p) => sum + (p.paidAmount || 0),
      0
    );
    const totalPending = paymentStatus.reduce(
      (sum, p) => sum + (p.pendingAmount || 0),
      0
    );
    const paidCount = paymentStatus.filter((p) => p.status === "Paid").length;
    const pendingCount = paymentStatus.filter(
      (p) => p.status === "Pending"
    ).length;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <DollarSign className="mr-2 text-green-500" size={20} />
          Payment Status (Paid & Pending)
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                💳 Payment Status Data
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Model:
                  </span>
                  <div className="mt-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      VendorInvoice
                    </span>{" "}
                    collection
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Invoice Fields:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Invoice number, date, due date, total amount from
                    VendorInvoice
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Payment Calculation:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      paidAmount
                    </span>
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      remainingAmount
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Status Logic:
                  </span>
                  <div className="mt-1 text-gray-200">
                    If remainingAmount &gt; 0 then "Pending", else "Paid"
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Purchase Link:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Linked via{" "}
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      purchaseContract
                    </span>{" "}
                    field in VendorInvoice
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Invoices</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatNumber(totalInvoices)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalPaid)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{paidCount} invoices</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Pending</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalPending)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {pendingCount} invoices
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>

        {paymentStatus.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DollarSign size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No payment data found for the selected filters.</p>
          </div>
        ) : (
          <DataTable
            headers={headers}
            data={paymentStatus}
            renderRow={(row, index) => (
              <tr
                key={`${row.invoiceNumber}-${index}`}
                className="border-b hover:bg-gray-50"
              >
                <td className="px-4 py-2 text-sm">{row.vendorName}</td>
                <td className="px-4 py-2 text-sm font-medium">
                  {row.invoiceNumber}
                </td>
                <td className="px-4 py-2 text-sm">
                  {row.purchaseContractNo || "N/A"}
                </td>
                <td className="px-4 py-2 text-sm">
                  {row.invoiceDate
                    ? new Date(row.invoiceDate).toLocaleDateString()
                    : "N/A"}
                </td>
                <td className="px-4 py-2 text-sm">
                  {row.dueDate
                    ? new Date(row.dueDate).toLocaleDateString()
                    : "N/A"}
                </td>
                <td className="px-4 py-2 text-sm text-right">
                  {formatCurrency(row.totalAmount || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-right text-green-600">
                  {formatCurrency(row.paidAmount || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-right text-red-600 font-medium">
                  {formatCurrency(row.pendingAmount || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-center">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.status === "Paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            )}
            recordsPerPage={20}
            onRecordsPerPageChange={(val) => {}}
            emptyMessage="No payment status data found"
            colWidths={{
              "Vendor Name": "200px",
              "Invoice Number": "150px",
              "Purchase Contract No.": "180px",
              "Invoice Date": "120px",
              "Due Date": "120px",
              "Total Amount": "130px",
              "Paid Amount": "120px",
              "Pending Amount": "130px",
              Status: "100px",
            }}
          />
        )}
      </div>
    );
  };

  // Render Selected Vendor Detailed Stats
  const renderSelectedVendorStats = () => {
    if (!selectedVendorStats) return null;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Info className="mr-2 text-blue-500" size={20} />
          Detailed Stats for {selectedVendorStats.vendorName}
          <div className="relative group ml-2 cursor-help">
            <Info
              className="text-gray-400 hover:text-blue-500 transition-colors"
              size={18}
            />
            <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
              <div className="font-bold mb-3 text-base text-blue-300">
                📋 Detailed Vendor Stats
              </div>
              <div className="space-y-2 text-gray-100">
                <div>
                  <span className="font-semibold text-yellow-300">
                    Data Model:
                  </span>
                  <div className="mt-1">
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                      selectedVendorStats
                    </span>{" "}
                    object from API response
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Vendor Filter:
                  </span>
                  <div className="mt-1 text-gray-200">
                    When a specific vendor is selected, detailed stats are
                    calculated for that vendor only
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Includes:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Purchase history, payment analytics, shipment data,
                    purchased items, linked contracts for selected vendor
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-yellow-300">
                    Real-time:
                  </span>
                  <div className="mt-1 text-gray-200">
                    Updates when vendor filter changes
                  </div>
                </div>
              </div>
              <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Purchase Orders</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatNumber(selectedVendorStats.totalOrders)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Purchase Value</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(selectedVendorStats.totalValue)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Average Order Value</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(selectedVendorStats.avgOrderValue)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3 text-gray-700">
              Recent Purchase Orders
            </h4>
            {selectedVendorStats.recentOrders?.length > 0 ? (
              <div className="space-y-2">
                {selectedVendorStats.recentOrders.map((order, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="font-semibold text-blue-600">
                      {formatCurrency(order.value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No recent orders</p>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-gray-700">
              Top Items Purchased
            </h4>
            {selectedVendorStats.topItems?.length > 0 ? (
              <div className="space-y-2">
                {selectedVendorStats.topItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium">{item.itemName}</p>
                      <p className="text-sm text-gray-600">
                        Qty: {formatNumber(item.quantity)}
                      </p>
                    </div>
                    <p className="font-semibold text-green-600">
                      {formatCurrency(item.totalValue)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No items data</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Filters Section
  const renderFilters = () => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Filter className="mr-2 text-gray-600" size={20} />
        Filters
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
            Business
            {searchParams.business && (
              <button
                onClick={() => handleFilterChange("business", "")}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Clear Business"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <BusinessDropdown
            adminId={adminId}
            selectedBusiness={searchParams.business}
            value={searchParams.business}
            onChange={(value) => handleFilterChange("business", value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
            Year
            {searchParams.year &&
              searchParams.year !== currentYear.toString() && (
                <button
                  onClick={() =>
                    handleFilterChange("year", currentYear.toString())
                  }
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Reset to Current Year"
                >
                  <X size={16} />
                </button>
              )}
          </label>
          <DropdownBasic
            options={yearOptions}
            value={searchParams.year}
            onChange={(value) => handleFilterChange("year", value)}
            placeholder="Select Year"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
            Vendor
            {searchParams.vendor && (
              <button
                onClick={() => handleFilterChange("vendor", "")}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Clear Vendor"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <DropdownBasic
            options={vendorOptions}
            value={searchParams.vendor}
            onChange={(value) => handleFilterChange("vendor", value)}
            placeholder="Select Vendor"
            loading={loadingVendors}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
            Date Range
            {(searchParams.startDate || searchParams.endDate) && (
              <button
                onClick={() =>
                  handleDateRangeChange({ startDate: "", endDate: "" })
                }
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Clear Date Range"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <DateRangeComponent
            startDate={searchParams.startDate}
            endDate={searchParams.endDate}
            onChange={handleDateRangeChange}
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={() => {
              // Remove current tab from loaded tabs to force refresh
              setLoadedTabs((prev) => {
                const newSet = new Set(prev);
                newSet.delete(activeTab);
                return newSet;
              });
              fetchSupplierAnalytics(activeTab);
            }}
            disabled={loading || tabLoading[activeTab]}
            className="bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white flex items-center justify-center px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || tabLoading[activeTab] ? (
              <>
                <Loader className="mr-2 animate-spin" size={16} />
                Loading...
              </>
            ) : (
              <>
                <Search className="mr-2" size={16} />
                Search
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            title="Reset Filters"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleExport}
            disabled={loading || exportLoading}
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
  );

  // Render Tabs
  const renderTabs = () => (
    <div className="bg-white rounded-lg shadow-md mb-6">
      <div className="flex overflow-x-auto border-b">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "overview"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("purchases")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "purchases"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Top Purchases
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "payments"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Payment Analytics
        </button>
        <button
          onClick={() => setActiveTab("shipments")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "shipments"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Shipment Performance
        </button>
        <button
          onClick={() => setActiveTab("regions")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "regions"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Regional Distribution
        </button>
        <button
          onClick={() => setActiveTab("items")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "items"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Purchased Items
        </button>
        <button
          onClick={() => setActiveTab("contracts")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "contracts"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Linked Contracts
        </button>
        <button
          onClick={() => setActiveTab("paymentStatus")}
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === "paymentStatus"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Payment Status
        </button>
        {searchParams.vendor && (
          <button
            onClick={() => setActiveTab("detailed")}
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
              activeTab === "detailed"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Detailed Stats
          </button>
        )}
      </div>
    </div>
  );

  // Render content based on active tab
  const renderTabContent = () => {
    // Show loading if this specific tab is loading
    if (tabLoading[activeTab] || (loading && !loadedTabs.has(activeTab))) {
      return (
        <div className="flex justify-center items-center h-64">
          <LoaderComponent />
        </div>
      );
    }

    switch (activeTab) {
      case "overview":
        return (
          <>
            {renderSummaryCards()}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h4 className="font-semibold mb-4 flex items-center">
                  Quick Insights
                  <div className="relative group ml-2 cursor-help">
                    <Info
                      className="text-gray-400 hover:text-blue-500 transition-colors"
                      size={18}
                    />
                    <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
                      <div className="font-bold mb-3 text-base text-blue-300">
                        💡 Quick Insights Data
                      </div>
                      <div className="space-y-2 text-gray-100">
                        <div>
                          <span className="font-semibold text-yellow-300">
                            Summary Stats:
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                              Vendor
                            </span>
                            <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                              PurchaseContract
                            </span>
                            <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                              VendorInvoice
                            </span>
                            <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                              Shipment
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-yellow-300">
                            Calculations:
                          </span>
                          <div className="mt-1 text-gray-200">
                            Total vendors, active vendors, total purchase value,
                            on-time delivery rate
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-yellow-300">
                            Real-time:
                          </span>
                          <div className="mt-1 text-gray-200">
                            Data is fetched based on selected filters (business,
                            year, date range, vendor)
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <span className="text-gray-700">Total Vendors</span>
                    <span className="font-bold text-blue-600">
                      {formatNumber(summaryStats.totalVendors)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <span className="text-gray-700">Active Vendors</span>
                    <span className="font-bold text-green-600">
                      {formatNumber(summaryStats.activeVendors)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                    <span className="text-gray-700">Total Purchase Value</span>
                    <span className="font-bold text-purple-600">
                      {formatCurrency(summaryStats.totalPurchaseValue)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h4 className="font-semibold mb-4 flex items-center">
                  Performance Metrics
                  <div className="relative group ml-2 cursor-help">
                    <Info
                      className="text-gray-400 hover:text-blue-500 transition-colors"
                      size={18}
                    />
                    <div className="absolute left-0 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-gray-700">
                      <div className="font-bold mb-3 text-base text-blue-300">
                        ⚡ Performance Metrics Data
                      </div>
                      <div className="space-y-2 text-gray-100">
                        <div>
                          <span className="font-semibold text-yellow-300">
                            Metrics:
                          </span>
                          <div className="mt-1 text-gray-200">
                            On-time delivery rate from{" "}
                            <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                              Shipment
                            </span>{" "}
                            collection
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-yellow-300">
                            Total Orders:
                          </span>
                          <div className="mt-1 text-gray-200">
                            Count from{" "}
                            <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                              PurchaseContract
                            </span>{" "}
                            collection
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-yellow-300">
                            Average Order Value:
                          </span>
                          <div className="mt-1 text-gray-200">
                            Calculated as total purchase value / total purchase
                            orders
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-teal-50 rounded">
                    <span className="text-gray-700">On-Time Delivery Rate</span>
                    <span className="font-bold text-teal-600">
                      {formatPercentage(summaryStats.onTimeDeliveryRate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                    <span className="text-gray-700">Total Purchase Orders</span>
                    <span className="font-bold text-yellow-600">
                      {formatNumber(summaryStats.totalPurchaseOrders)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                    <span className="text-gray-700">Avg Order Value</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(
                        summaryStats.totalPurchaseValue /
                          (summaryStats.totalPurchaseOrders || 1)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      case "purchases":
        return renderTopVendorsTable();
      case "payments":
        return renderPaymentAnalyticsTable();
      case "shipments":
        return renderShipmentAnalyticsTable();
      case "regions":
        return renderRegionWiseDistribution();
      case "items":
        return renderPurchasedItemsTable();
      case "contracts":
        return renderLinkedContractsTable();
      case "paymentStatus":
        return renderPaymentStatusTable();
      case "detailed":
        return renderSelectedVendorStats();
      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Supplier Reports & Analytics
        </h1>
        <p className="text-gray-600">
          Comprehensive vendor analytics including purchase volumes, payment
          patterns, shipment performance, and regional distribution
        </p>
      </div>

      {renderFilters()}
      {renderTabs()}
      {renderTabContent()}
    </div>
  );
};

export default SupplierReports;
