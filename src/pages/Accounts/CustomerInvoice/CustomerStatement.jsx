import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect } from "react";
import {
  Download,
  FileText,
  Calendar,
  User,
  Search,
  Filter,
  Eye,
  RefreshCw,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  Printer,
  Share2,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  ChevronRight,
  History,
  BookOpen,
  CreditCard,
  Receipt,
} from "lucide-react";
import axios from "axios";
import { useHistory, useLocation } from "react-router-dom";
import {
  formatDate,
  formatAmount,
  formatDateToYMD,
  formatCurrencyAmount,
} from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { DataTable } from "@/page-layouts";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableDropdown from "@/components/SearchableDropdown";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import SingleBusinessField from "@/components/SingleBusinessField";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function CustomerStatement() {
  useTranslation();
  const history = useHistory();
  const location = useLocation();
  const initialBusinessId = location.state?.businessId;

  const routePerms = useRouteModulePermissions();
  const { canAdd, canView, canViewDetails } = routePerms;
  const canViewStatement = canView || canViewDetails;
  const canGenerateStatement = canViewStatement || canAdd;

  // State management
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [statementData, setStatementData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewTable, setShowPreviewTable] = useState(false);
  const [recentStatements, setRecentStatements] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [statementHistory, setStatementHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null); // Added missing state

  // Fetch businesses and customers on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch businesses from localStorage
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedData = JSON.parse(storedBusinesses);
          setBusinesses(parsedData);
          if (parsedData.length > 0) {
            // When navigating from customer-invoices with business filter, use that business
            const businessIdToSelect =
              initialBusinessId &&
              parsedData.some((b) => b._id === initialBusinessId)
                ? initialBusinessId
                : parsedData[0]._id;
            setSelectedBusiness(businessIdToSelect);
          }
        }

        // Customers will be fetched by the selectedBusiness useEffect
        // When initialBusinessId is set, selectedBusiness is set above, triggering that fetch
      } catch (error) {
        console.error("Error fetching initial data:", error);
        notifyError(ciText("Failed to load initial data"));
      }
    };

    fetchInitialData();
  }, [initialBusinessId]);

  // Fetch customers and currencies when business changes
  useEffect(() => {
    if (selectedBusiness) {
      const fetchCustomersForBusiness = async () => {
        try {
          const response = await axios.get(`${Base_URL}/customers`, {
            params: { businessId: selectedBusiness },
          });
          setCustomers(response?.data?.customers || []);
          setSelectedCustomer(""); // Reset customer selection
        } catch (error) {
          console.error("Error fetching customers for business:", error);
        }
      };

      const fetchCurrenciesForBusiness = async () => {
        try {
          const response = await axios.get(
            `${Base_URL}/finance/currencies?business_id=${selectedBusiness}`,
          );
          setCurrencies(response?.data?.data || []);
          // Set default currency to base currency if available
          const baseCurrency = response?.data?.data?.find(
            (currency) => currency.is_base,
          );
          setSelectedCurrency(baseCurrency?._id || "");
        } catch (error) {
          console.error("Error fetching currencies for business:", error);
        }
      };

      fetchCustomersForBusiness();
      fetchCurrenciesForBusiness();
    }
  }, [selectedBusiness]);

  // Format date for API - use YYYY-MM-DD for consistent inclusive date range
  const formatDateForApi = (d) => {
    if (!d) return undefined;
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d;
    const date = d instanceof Date ? d : new Date(d);
    return isNaN(date.getTime()) ? undefined : formatDateToYMD(date);
  };

  const hasValidDateRange = (() => {
    const from = formatDateForApi(dateFrom);
    const to = formatDateForApi(dateTo);
    if (!from || !to) return false;
    return new Date(from) <= new Date(to);
  })();

  const validateStatementFilters = () => {
    if (!selectedBusiness || !selectedCustomer) {
      notifyError(ciText("Please select both business and customer"));
      return false;
    }
    if (!dateFrom || !dateTo) {
      notifyError(ciText("Please select both Date From and Date To"));
      return false;
    }
    if (!hasValidDateRange) {
      notifyError(ciText("Date To cannot be earlier than Date From"));
      return false;
    }
    return true;
  };

  // Generate statement preview
  const handleGeneratePreview = async () => {
    if (!validateStatementFilters()) {
      return;
    }

    setPreviewLoading(true);
    try {
      const requestData = {
        businessId: selectedBusiness,
        customerId: selectedCustomer,
        dateFrom: formatDateForApi(dateFrom),
        dateTo: formatDateForApi(dateTo),
        currencyId: selectedCurrency || null, // Make currency optional
      };

      const response = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement`,
        requestData,
        {
          responseType: "blob",
        },
      );

      // Create blob URL for preview
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url); // Set the preview URL

      // Get preview data for table display
      const previewResponse = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement-preview`,
        requestData,
      );

      if (previewResponse.data.success) {
        setPreviewData(previewResponse.data.data);
        setShowPreviewTable(true);
      }

      setStatementData({
        url,
        businessId: selectedBusiness,
        customerId: selectedCustomer,
        dateFrom,
        dateTo,
        blob,
        generatedAt: new Date(),
      });

      setShowPreview(true);

      // Add to statement history
      const newStatement = {
        id: Date.now(),
        businessId: selectedBusiness,
        customerId: selectedCustomer,
        dateFrom,
        dateTo,
        generatedAt: new Date(),
        customerName:
          customers.find((c) => c._id === selectedCustomer)?.basicInformation
            ?.customerDisplayName || ciText("Unknown"),
        businessName:
          businesses.find((b) => b._id === selectedBusiness)?.name ||
          ciText("Unknown"),
      };

      setStatementHistory((prev) => [newStatement, ...prev]);

      notifySuccess(ciText("Statement preview generated successfully!"));
    } catch (error) {
      console.error("Error generating statement preview:", error);
      setPreviewData(null);
      setShowPreviewTable(false);
      setStatementData(null);
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setShowPreview(false);
      if (error.response?.status === 404) {
        notifyError(ciText("No invoices found for the selected criteria"));
      } else {
        notifyError(ciText("Failed to generate statement preview"));
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  // Download PDF statement
  const handleDownloadPDF = async () => {
    if (!validateStatementFilters()) {
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        businessId: selectedBusiness,
        customerId: selectedCustomer,
        dateFrom: formatDateForApi(dateFrom),
        dateTo: formatDateForApi(dateTo),
        currencyId: selectedCurrency || null, // Make currency optional
      };

      const response = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement`,
        requestData,
        {
          responseType: "blob",
        },
      );

      // Create blob URL for download
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;

      const selectedCustomerData = customers.find(
        (c) => c._id === selectedCustomer,
      );
      const customerName =
        selectedCustomerData?.basicInformation?.customerDisplayName ||
        "customer";
      const filename = `customer-statement-${customerName.replace(
        /\s+/g,
        "-",
      )}-${new Date().toISOString().split("T")[0]}.pdf`;

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Clean up blob URL
      window.URL.revokeObjectURL(url);

      notifySuccess(ciText("Statement downloaded successfully!"));
    } catch (error) {
      console.error("Error downloading statement:", error);
      if (error.response?.status === 404) {
        notifyError(ciText("No invoices found for the selected criteria"));
      } else {
        notifyError(ciText("Failed to download statement"));
      }
    } finally {
      setLoading(false);
    }
  };

  // Download CSV statement
  const handleDownloadCSV = async () => {
    if (!validateStatementFilters()) {
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        businessId: selectedBusiness,
        customerId: selectedCustomer,
        dateFrom: formatDateForApi(dateFrom),
        dateTo: formatDateForApi(dateTo),
        currencyId: selectedCurrency || null, // Make currency optional
      };

      const response = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement-csv`,
        requestData,
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const selectedCustomerData = customers.find(
        (c) => c._id === selectedCustomer,
      );
      const customerName =
        selectedCustomerData?.basicInformation?.customerDisplayName ||
        "customer";
      const filename = `customer-statement-${customerName.replace(
        /\s+/g,
        "-",
      )}-${new Date().toISOString().split("T")[0]}.csv`;

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      notifySuccess(ciText("CSV statement downloaded successfully!"));
    } catch (error) {
      console.error("Error downloading CSV statement:", error);
      notifyError(ciText("Failed to download CSV statement"));
    } finally {
      setLoading(false);
    }
  };

  // Print statement
  const handlePrint = async () => {
    if (!validateStatementFilters()) {
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        businessId: selectedBusiness,
        customerId: selectedCustomer,
        dateFrom: formatDateForApi(dateFrom),
        dateTo: formatDateForApi(dateTo),
        currencyId: selectedCurrency || null, // Include currency
      };

      const response = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement`,
        requestData,
        {
          responseType: "blob",
        },
      );

      // Create blob URL for printing
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          // Clean up blob URL after printing
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);
        };
      }

      notifySuccess(ciText("Statement opened for printing!"));
    } catch (error) {
      console.error("Error opening statement for printing:", error);
      if (error.response?.status === 404) {
        notifyError(ciText("No invoices found for the selected criteria"));
      } else {
        notifyError(ciText("Failed to open statement for printing"));
      }
    } finally {
      setLoading(false);
    }
  };

  // Share statement
  const handleShare = async () => {
    if (!validateStatementFilters()) {
      return;
    }

    try {
      const customerName =
        customers.find((c) => c._id === selectedCustomer)?.basicInformation
          ?.customerDisplayName || ciText("Customer");

      // First, generate the PDF to share
      setLoading(true);
      const requestData = {
        businessId: selectedBusiness,
        customerId: selectedCustomer,
        dateFrom: formatDateForApi(dateFrom),
        dateTo: formatDateForApi(dateTo),
        currencyId: selectedCurrency || null, // Include currency
      };

      const response = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement`,
        requestData,
        {
          responseType: "blob",
        },
      );

      // Create blob URL for sharing
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      // Create file object for sharing
      const filename = `customer-statement-${customerName.replace(
        /\s+/g,
        "-",
      )}-${new Date().toISOString().split("T")[0]}.pdf`;

      const file = new File([blob], filename, { type: "application/pdf" });

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        // Share the actual PDF file
        await navigator.share({
          title: "Customer Statement",
          text: `Customer statement for ${customerName}`,
          files: [file],
        });
        notifySuccess(ciText("Statement PDF shared successfully!"));
      } else if (navigator.share) {
        // Fallback: share text if file sharing not supported
        const currentDate = new Date();
        const shareText = `Customer statement for ${customerName} generated from PCI. Generated on ${formatDate(
          currentDate,
        )}.`;

        await navigator.share({
          title: "Customer Statement",
          text: shareText,
        });
        notifySuccess(ciText("Statement information shared successfully!"));
      } else {
        // Final fallback: copy to clipboard and show download option
        const currentDate = new Date();
        const shareText = `Customer Statement: ${customerName} - Generated on ${formatDate(
          currentDate,
        )}. Click the download button to get the PDF.`;

        await navigator.clipboard.writeText(shareText);
        notifySuccess(
          "Statement information copied to clipboard! You can now download the PDF.",
        );
      }

      // Clean up blob URL
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("Error sharing statement:", error);
      if (error.response?.status === 404) {
        notifyError(ciText("No invoices found for the selected criteria"));
      } else {
        notifyError(ciText("Failed to share statement"));
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear form
  const handleClear = () => {
    setSelectedCustomer("");
    setSelectedCurrency("");
    setDateFrom("");
    setDateTo("");
    setStatementData(null);
    setShowPreview(false);
    setPreviewUrl(null); // Clear preview URL
  };

  // Regenerate statement with same parameters
  const handleRegenerate = () => {
    if (statementData) {
      handleGeneratePreview();
    }
  };

  // Get selected customer data
  const selectedCustomerData = customers.find(
    (c) => c._id === selectedCustomer,
  );

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-4 sm:px-6 py-8 min-w-0 overflow-x-hidden max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {ciText("Customer Statements")}
              </h1>
              <p className="text-gray-600 mt-2">
                {ciText(
                  "Generate, preview, and download customer account statements",
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Statement History */}
        {showHistory && statementHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <History size={20} className="text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                {ciText("Statement History")}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statementHistory.slice(0, 6).map((statement) => (
                <div
                  key={statement.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={16} className="text-blue-600" />
                    <span className="font-medium text-sm text-gray-900">
                      {statement.customerName}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {statement.businessName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Generated: {formatDate(statement.generatedAt)}
                  </p>
                  {statement.dateFrom && statement.dateTo && (
                    <p className="text-xs text-gray-500">
                      Period: {formatDate(statement.dateFrom)} -{" "}
                      {formatDate(statement.dateTo)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {statementHistory.length > 6 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                Showing last 6 statements. Total: {statementHistory.length}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Statement Generator */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {ciText("Generate Statement")}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {ciText("Select criteria and generate customer statements")}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Business Selection */}
                <SingleBusinessField
                  selectedValue={selectedBusiness}
                  onAutoSelect={(id) => {
                    if (!selectedBusiness) setSelectedBusiness(id);
                  }}
                >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {ciText("Business")}
                  </label>
                  <SearchableDropdown
                    value={selectedBusiness}
                    onChange={(e) => setSelectedBusiness(e.target.value)}
                    placeholder={ciText("Select Business")}
                    searchPlaceholder="Search businesses..."
                    options={
                      businesses?.map((business) => ({
                        value: business._id,
                        label: business.name,
                        name: business.name,
                      })) || []
                    }
                    searchKeys={["name"]}
                    renderOption={(option) => (
                      <div>
                        <div className="font-medium">{option.name}</div>
                      </div>
                    )}
                  />
                </div>
                </SingleBusinessField>

                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {ciText("Customer")}
                  </label>
                  <SearchableDropdown
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    placeholder={ciText("Select Customer")}
                    searchPlaceholder="Search customers..."
                    disabled={!selectedBusiness && !isSingleAssignedBusiness()}
                    options={
                      customers?.map((customer) => ({
                        value: customer._id,
                        label:
                          customer.basicInformation?.companyName ||
                          customer.basicInformation?.customerDisplayName ||
                          customer?.name,
                        name:
                          customer.basicInformation?.companyName ||
                          customer?.name,
                        displayName:
                          customer.basicInformation?.customerDisplayName,
                        email: customer.basicInformation?.customerEmail,
                      })) || []
                    }
                    searchKeys={["name", "displayName", "email"]}
                    renderOption={(option) => (
                      <div>
                        <div className="font-medium">{option.name}</div>
                        {option.displayName &&
                          option.displayName !== option.name && (
                            <div className="text-xs text-gray-500">
                              {option.displayName}
                            </div>
                          )}
                        {option.email && (
                          <div className="text-xs text-gray-400">
                            {option.email}
                          </div>
                        )}
                      </div>
                    )}
                  />
                </div>

                {/* Currency Selection */}
                {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency{" "}
                  <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <SearchableDropdown
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  placeholder={ciText("Select Currency")}
                  searchPlaceholder="Search currencies..."
                  disabled={!selectedBusiness}
                  clearable={true}
                  options={
                    currencies?.map((currency) => ({
                      value: currency._id,
                      label: `${currency.symbol} - ${currency.name}${
                        currency.is_base ? " (Base)" : ""
                      }`,
                      symbol: currency.symbol,
                      name: currency.name,
                      isBase: currency.is_base,
                    })) || []
                  }
                  searchKeys={["symbol", "name"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">
                        {option.symbol} - {option.name}
                      </div>
                      {option.isBase && (
                        <div className="text-xs text-green-600 font-medium">
                          {ciText("Base Currency")}
                        </div>
                      )}
                    </div>
                  )}
                />
              </div> */}

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Date From")}
                    </label>
                    <div className="relative">
                      <CustomDatePicker
                        value={dateFrom}
                        onChange={(value) => {
                          setDateFrom(value);
                          if (
                            value &&
                            dateTo &&
                            new Date(dateTo) < new Date(value)
                          ) {
                            setDateTo(null);
                          }
                        }}
                        placeholder={ciText("Start Date")}
                        bgColor="#FFFFFF"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #EEEEEE",
                          borderRadius: "4px",
                        }}
                      />
                      <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Date To")}
                    </label>
                    <div className="relative">
                      <CustomDatePicker
                        value={dateTo}
                        onChange={(value) => setDateTo(value)}
                        placeholder={ciText("End Date")}
                        minDate={dateFrom || null}
                        bgColor="#FFFFFF"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #EEEEEE",
                          borderRadius: "4px",
                        }}
                      />
                      <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4">
                  {canGenerateStatement && (
                    <>
                      <button
                        onClick={handleGeneratePreview}
                        disabled={
                          !selectedBusiness ||
                          !selectedCustomer ||
                          !hasValidDateRange ||
                          previewLoading
                        }
                        className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white font-medium rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {previewLoading ? (
                          <RefreshCw size={18} className="animate-spin" />
                        ) : (
                          <Eye size={18} />
                        )}
                        {previewLoading
                          ? ciText("Generating...")
                          : ciText("Generate Preview")}
                      </button>

                      <button
                        onClick={handleDownloadPDF}
                        disabled={
                          !selectedBusiness ||
                          !selectedCustomer ||
                          !hasValidDateRange ||
                          loading
                        }
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <RefreshCw size={18} className="animate-spin" />
                        ) : (
                          <Download size={18} />
                        )}
                        {loading ? ciText("Downloading...") : "Download PDF"}
                      </button>

                      <button
                        onClick={handleDownloadCSV}
                        disabled={
                          !selectedBusiness ||
                          !selectedCustomer ||
                          !hasValidDateRange ||
                          loading
                        }
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileSpreadsheet size={18} />
                        {loading ? "..." : "Export CSV"}
                      </button>
                    </>
                  )}

                  <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <X size={18} />
                    {ciText("Clear")}
                  </button>
                </div>
              </div>
            </div>

            {/* Statement Preview Table */}
            {showPreviewTable && previewData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {ciText("Statement Preview")}
                    </h2>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Generated {formatDate(new Date())}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRegenerate}
                      className="flex items-center gap-2 px-3 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <RefreshCw size={16} />
                      {ciText("Regenerate")}
                    </button>
                    <button
                      onClick={handlePrint}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Printer size={16} />
                      )}
                      {loading ? ciText("Opening...") : "Print"}
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={
                        !selectedBusiness ||
                        !selectedCustomer ||
                        !hasValidDateRange ||
                        loading
                      }
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Share2 size={16} />
                      )}
                      {loading ? ciText("Preparing...") : ciText("Share")}
                    </button>
                    <button
                      onClick={() => setShowPreviewTable(false)}
                      className="text-gray-500 hover:text-gray-700 p-2"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">
                      {ciText("Total Invoiced")}
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrencyAmount(
                        previewData.summary.currency,
                        previewData.summary.totalInvoiced,
                      )}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600 font-medium">
                      {ciText("Total Paid")}
                    </div>
                    <div className="text-2xl font-bold text-green-800">
                      {formatCurrencyAmount(
                        previewData.summary.currency,
                        previewData.summary.totalPaid,
                      )}
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-orange-600 font-medium">
                      {ciText("Balance Due")}
                    </div>
                    <div className="text-2xl font-bold text-orange-800">
                      {formatCurrencyAmount(
                        previewData.summary.currency,
                        previewData.summary.balanceDue,
                      )}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 font-medium">
                      {ciText("Transactions")}
                    </div>
                    <div className="text-2xl font-bold text-purple-800">
                      {previewData.transactions.length}
                    </div>
                  </div>
                </div>

                {/* Transaction Table */}
                <div className="w-full overflow-x-hidden">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          {ciText("Date")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          {ciText("Transaction")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          {ciText("Details")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-right text-sm font-medium text-gray-700">
                          {ciText("Amount")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-right text-sm font-medium text-gray-700">
                          {ciText("Payments")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-right text-sm font-medium text-gray-700">
                          {ciText("Balance")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.transactions.map((transaction, index) => (
                        <tr
                          key={index}
                          className={`${
                            transaction.type === "Payment Received"
                              ? "bg-green-50"
                              : index % 2 === 1
                                ? "bg-gray-50"
                                : "bg-white"
                          }`}
                        >
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900">
                            {formatDate(transaction.date)}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900">
                            {transaction.type}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900">
                            {transaction.details}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900 text-right">
                            {transaction.amount > 0
                              ? formatCurrencyAmount(
                                  previewData.summary.currency,
                                  transaction.amount,
                                )
                              : ""}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900 text-right">
                            {transaction.payments > 0
                              ? formatCurrencyAmount(
                                  previewData.summary.currency,
                                  transaction.payments,
                                )
                              : ""}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900 text-right font-medium">
                            {formatCurrencyAmount(
                              previewData.summary.currency,
                              transaction.balance,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PDF Preview Section */}
                {previewUrl && (
                  <div className="mt-6">
                    {/* PDF Preview */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            {ciText("PDF Preview")}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {previewData.summary.currency} Currency
                            </span>
                          </div>
                        </div>
                      </div>
                      <iframe
                        src={previewUrl}
                        className="w-full h-96"
                        title={ciText("Customer Statement Preview")}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Information & Actions */}
          <div className="space-y-6">
            {/* Selected Customer Info */}
            {selectedCustomerData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <User size={20} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {ciText("Customer Details")}
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {ciText("Name")}
                    </p>
                    <p className="text-gray-900">
                      {selectedCustomerData?.basicInformation
                        ?.customerDisplayName || selectedCustomerData?.name}
                    </p>
                  </div>

                  {selectedCustomerData.basicInformation?.companyName && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {ciText("Company")}
                      </p>
                      <p className="text-gray-900">
                        {selectedCustomerData?.basicInformation?.companyName}
                      </p>
                    </div>
                  )}

                  {selectedCustomerData?.basicInformation?.customerEmail && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {ciText("Email")}
                      </p>
                      <p className="text-gray-900">
                        {selectedCustomerData?.basicInformation?.customerEmail}
                      </p>
                    </div>
                  )}

                  {selectedCustomerData.companyInfo?.billingAddress && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {ciText("Billing Address")}
                      </p>
                      <p className="text-gray-900 text-sm">
                        {selectedCustomerData.companyInfo.billingAddress}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {ciText("Quick Actions")}
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                {canAdd && (
                  <button
                    onClick={() => history.push("/create-customer-invoice")}
                    className="w-full flex items-center gap-3 p-3 text-left text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <FileText size={16} className="text-blue-600" />
                    <span>{ciText("Create New Invoice")}</span>
                  </button>
                )}

                {canViewStatement && (
                  <button
                    onClick={() => history.push("/customer-invoices")}
                    className="w-full flex items-center gap-3 p-3 text-left text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Eye size={16} className="text-green-600" />
                    <span>{ciText("View All Invoices")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Help & Tips */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Info size={20} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">
                  {ciText("Tips & Information")}
                </h3>
              </div>

              <div className="space-y-2 text-sm text-blue-800">
                <p>• Select customer to generate statements</p>
                <p>• Use date range to filter specific periods</p>
                <p>• Preview before downloading for accuracy</p>
                <p>• CSV export includes detailed transaction data</p>
                <p>• PDF statements are professional and print-ready</p>
                <p>• Statements are automatically saved to history</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
