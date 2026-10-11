import React, { useEffect, useState } from "react";
import {
  Download,
  FileText,
  Calendar,
  Building,
  User,
  Eye,
  RefreshCw,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Share2,
  Info,
  X,
} from "lucide-react";
import axios from "axios";
import {
  formatDate,
  formatDateToYMD,
  formatCurrencyAmount,
} from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function VendorStatement() {
  const { t } = useTranslation();
  const vs = (key, defaultValue, options = {}) =>
    t(`accounts.vendorStatement.${key}`, { defaultValue, ...options });

  const routePerms = useRouteModulePermissions();
  const { canView, canViewDetails } = routePerms;
  const canUseStatement = canView || canViewDetails;

  const [businesses, setBusinesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewTable, setShowPreviewTable] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [statementHistory, setStatementHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedData = JSON.parse(storedBusinesses);
          setBusinesses(parsedData);
          if (parsedData.length > 0) {
            setSelectedBusiness(parsedData[0]._id);
          }
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        notifyError(vs("failedLoadInitial", "Failed to load initial data"));
      }
    };

    fetchInitialData();
  }, []);

  // Fetch vendors when business changes
  useEffect(() => {
    const fetchVendorsForBusiness = async () => {
      if (!selectedBusiness) return;
      try {
        // Match existing Vendor Invoices behavior: use vendor listing endpoints
        // Prefer business-scoped vendors first
        const response = await axios.get(
          `${Base_URL}/vendors/all/${selectedBusiness}`,
          { params: { status: "Active" } },
        );
        const list = response?.data?.vendors || response?.data?.data || [];
        setVendors(
          Array.isArray(list)
            ? list.filter(
                (v) => String(v?.status ?? "Active").toLowerCase() === "active",
              )
            : [],
        );
        setSelectedVendor("");
      } catch (error) {
        // Fallback to all vendors (same as VendorInvoices.jsx)
        try {
          const fallback = await axios.get(`${Base_URL}/vendors`, {
            params: { status: "Active" },
          });
          const list = fallback?.data?.vendors || fallback?.data?.data || [];
          setVendors(
            Array.isArray(list)
              ? list.filter(
                  (v) =>
                    String(v?.status ?? "Active").toLowerCase() === "active",
                )
              : [],
          );
        } catch (e) {
          console.error("Error fetching vendors:", e);
          notifyError(vs("failedLoadVendors", "Failed to load vendors"));
        }
      }
    };

    fetchVendorsForBusiness();
  }, [selectedBusiness]);

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
    if (!selectedBusiness || !selectedVendor) {
      notifyError(
        vs("selectBusinessAndVendor", "Please select both business and vendor"),
      );
      return false;
    }
    if (!dateFrom || !dateTo) {
      notifyError(
        vs("selectDateFromAndTo", "Please select both Date From and Date To"),
      );
      return false;
    }
    if (!hasValidDateRange) {
      notifyError(
        vs("dateToBeforeFrom", "Date To cannot be earlier than Date From"),
      );
      return false;
    }
    return true;
  };

  const requestPayload = () => ({
    businessId: selectedBusiness,
    vendorId: selectedVendor,
    dateFrom: formatDateForApi(dateFrom),
    dateTo: formatDateForApi(dateTo),
    currencyId: selectedCurrency || null,
  });

  const handleGeneratePreview = async () => {
    if (!canUseStatement) return;
    if (!validateStatementFilters()) {
      return;
    }

    setPreviewLoading(true);
    try {
      const body = requestPayload();

      // PDF (blob) for iframe preview
      const pdfRes = await axios.post(
        `${Base_URL}/vendor-invoices/vendor-statement`,
        body,
        { responseType: "blob" },
      );
      const blob = new Blob([pdfRes.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);

      // JSON preview table
      const previewRes = await axios.post(
        `${Base_URL}/vendor-invoices/vendor-statement-preview`,
        body,
      );
      if (previewRes.data?.success) {
        setPreviewData(previewRes.data.data);
        setShowPreviewTable(true);
      }

      const vendorName =
        vendors.find((v) => v._id === selectedVendor)?.basicInformation
          ?.vendorDisplayName ||
        vendors.find((v) => v._id === selectedVendor)?.basicInformation
          ?.companyName ||
        vs("unknown", "Unknown");

      const businessName =
        businesses.find((b) => b._id === selectedBusiness)?.name ||
        vs("unknown", "Unknown");

      setStatementHistory((prev) => [
        {
          id: Date.now(),
          businessId: selectedBusiness,
          vendorId: selectedVendor,
          dateFrom,
          dateTo,
          generatedAt: new Date(),
          vendorName,
          businessName,
        },
        ...prev,
      ]);

      notifySuccess(
        vs(
          "previewGenerated",
          "Vendor statement preview generated successfully!",
        ),
      );
    } catch (error) {
      console.error("Error generating vendor statement preview:", error);
      setPreviewData(null);
      setShowPreviewTable(false);
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      if (error.response?.status === 404) {
        notifyError(
          vs(
            "noInvoicesFound",
            "No vendor invoices found for the selected criteria",
          ),
        );
      } else {
        notifyError(
          vs("previewFailed", "Failed to generate vendor statement preview"),
        );
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!canUseStatement) return;
    if (!validateStatementFilters()) {
      return;
    }

    setLoading(true);
    try {
      const body = requestPayload();
      const response = await axios.post(
        `${Base_URL}/vendor-invoices/vendor-statement`,
        body,
        { responseType: "blob" },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const vendorData = vendors.find((v) => v._id === selectedVendor);
      const vendorName =
        vendorData?.basicInformation?.vendorDisplayName ||
        vendorData?.basicInformation?.companyName ||
        vs("vendorFallback", "vendor");

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `vendor-statement-${vendorName.replace(/\s+/g, "-")}-${
          new Date().toISOString().split("T")[0]
        }.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifySuccess(
        vs("downloadSuccess", "Statement downloaded successfully!"),
      );
    } catch (error) {
      console.error("Error downloading vendor statement:", error);
      if (error.response?.status === 404) {
        notifyError(
          vs(
            "noInvoicesFound",
            "No vendor invoices found for the selected criteria",
          ),
        );
      } else {
        notifyError(vs("downloadFailed", "Failed to download statement"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!canUseStatement) return;
    if (!validateStatementFilters()) {
      return;
    }

    setLoading(true);
    try {
      const body = requestPayload();
      const response = await axios.post(
        `${Base_URL}/vendor-invoices/vendor-statement-csv`,
        body,
        { responseType: "blob" },
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);

      const vendorData = vendors.find((v) => v._id === selectedVendor);
      const vendorName =
        vendorData?.basicInformation?.vendorDisplayName ||
        vendorData?.basicInformation?.companyName ||
        vs("vendorFallback", "vendor");

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `vendor-statement-${vendorName.replace(/\s+/g, "-")}-${
          new Date().toISOString().split("T")[0]
        }.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifySuccess(
        vs("csvDownloadSuccess", "CSV statement downloaded successfully!"),
      );
    } catch (error) {
      console.error("Error downloading vendor statement CSV:", error);
      notifyError(vs("csvDownloadFailed", "Failed to download CSV statement"));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!validateStatementFilters()) {
      return;
    }

    setLoading(true);
    try {
      const body = requestPayload();
      const response = await axios.post(
        `${Base_URL}/vendor-invoices/vendor-statement`,
        body,
        { responseType: "blob" },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        w.onload = () => {
          w.print();
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        };
      }
      notifySuccess(vs("printSuccess", "Statement opened for printing!"));
    } catch (error) {
      console.error("Error printing vendor statement:", error);
      notifyError(vs("printFailed", "Failed to open statement for printing"));
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!validateStatementFilters()) {
      return;
    }

    try {
      setLoading(true);
      const body = requestPayload();
      const response = await axios.post(
        `${Base_URL}/vendor-invoices/vendor-statement`,
        body,
        { responseType: "blob" },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const vendorData = vendors.find((v) => v._id === selectedVendor);
      const vendorName =
        vendorData?.basicInformation?.vendorDisplayName ||
        vendorData?.basicInformation?.companyName ||
        vs("vendorFallback", "vendor");

      const filename = `vendor-statement-${vendorName.replace(/\s+/g, "-")}-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      const shareTitle = vs("shareTitle", "Vendor Statement");

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: shareTitle,
          text: vs("shareText", "Vendor statement for {{vendorName}}", {
            vendorName,
          }),
          files: [file],
        });
        notifySuccess(
          vs("sharePdfSuccess", "Statement PDF shared successfully!"),
        );
      } else if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: vs(
            "shareTextWithDate",
            "Vendor statement for {{vendorName}} generated on {{date}}.",
            { vendorName, date: formatDate(new Date()) },
          ),
        });
        notifySuccess(
          vs("shareInfoSuccess", "Statement information shared successfully!"),
        );
      } else {
        await navigator.clipboard.writeText(
          vs(
            "shareClipboard",
            "Vendor Statement: {{vendorName}} - Generated on {{date}}. Download the PDF from the statement page.",
            { vendorName, date: formatDate(new Date()) },
          ),
        );
        notifySuccess(
          vs("shareClipboardSuccess", "Statement info copied to clipboard!"),
        );
      }

      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Error sharing vendor statement:", error);
      notifyError(vs("shareFailed", "Failed to share statement"));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedVendor("");
    setSelectedCurrency("");
    setDateFrom("");
    setDateTo("");
    setPreviewData(null);
    setShowPreviewTable(false);
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const selectedVendorData = vendors.find((v) => v._id === selectedVendor);
  const selectedBusinessData = businesses.find(
    (b) => b._id === selectedBusiness,
  );

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-4 sm:px-6 py-8 min-w-0 overflow-x-hidden max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {vs("title", "Vendor Statements")}
              </h1>
              <p className="text-gray-600 mt-2">
                {vs(
                  "subtitle",
                  "Generate, preview, and download vendor account statements",
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <TrendingUp size={16} />
                {showHistory
                  ? vs("hideHistory", "Hide History")
                  : vs("showHistory", "Show History")}
              </button>
            </div>
          </div>
        </div>

        {showHistory && statementHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {vs("statementHistory", "Statement History")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statementHistory.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900">
                    {s.vendorName}
                  </div>
                  <div className="text-xs text-gray-600">{s.businessName}</div>
                  <div className="text-xs text-gray-500">
                    {vs("generatedOn", "Generated: {{date}}", {
                      date: formatDate(s.generatedAt),
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {vs("generateStatement", "Generate Statement")}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {vs(
                      "generateHint",
                      "Select criteria and generate vendor statements",
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <SingleBusinessField
                  selectedValue={selectedBusiness}
                  onAutoSelect={(id) => {
                    if (!selectedBusiness) setSelectedBusiness(id);
                  }}
                >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {vs("business", "Business")}
                  </label>
                  <SearchableDropdown
                    value={selectedBusiness}
                    onChange={(e) => setSelectedBusiness(e.target.value)}
                    placeholder={vs("selectBusiness", "Select Business")}
                    searchPlaceholder={vs(
                      "searchBusinesses",
                      "Search businesses...",
                    )}
                    options={
                      businesses?.map((b) => ({
                        value: b._id,
                        label: b.name,
                        name: b.name,
                      })) || []
                    }
                    searchKeys={["name"]}
                    renderOption={(o) => (
                      <div>
                        <div className="font-medium">{o.name}</div>
                      </div>
                    )}
                  />
                </div>
                </SingleBusinessField>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {vs("vendor", "Vendor")}
                  </label>
                  <SearchableDropdown
                    value={selectedVendor}
                    onChange={(e) => setSelectedVendor(e.target.value)}
                    placeholder={vs("selectVendor", "Select Vendor")}
                    searchPlaceholder={vs("searchVendors", "Search vendors...")}
                    disabled={!selectedBusiness && !isSingleAssignedBusiness()}
                    options={
                      vendors
                        ?.filter(
                          (v) =>
                            String(v?.status ?? "Active").toLowerCase() ===
                            "active",
                        )
                        .map((v) => ({
                          value: v._id,
                          label:
                            v.basicInformation?.vendorDisplayName ||
                            v.basicInformation?.companyName ||
                            v?.name,
                          name: v.basicInformation?.companyName || v?.name,
                          displayName: v.basicInformation?.vendorDisplayName,
                          email: v.basicInformation?.primaryContact?.email,
                        })) || []
                    }
                    searchKeys={["name", "displayName", "email"]}
                    renderOption={(o) => (
                      <div>
                        <div className="font-medium">{o.name}</div>
                        {o.displayName && o.displayName !== o.name && (
                          <div className="text-xs text-gray-500">
                            {o.displayName}
                          </div>
                        )}
                        {o.email && (
                          <div className="text-xs text-gray-400">{o.email}</div>
                        )}
                      </div>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {vs("dateFrom", "Date From")}
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
                        placeholder={vs("startDate", "Start Date")}
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
                      {vs("dateTo", "Date To")}
                    </label>
                    <div className="relative">
                      <CustomDatePicker
                        value={dateTo}
                        onChange={(value) => setDateTo(value)}
                        placeholder={vs("endDate", "End Date")}
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

                <div className="flex flex-wrap gap-3 pt-4">
                  <button
                    onClick={handleGeneratePreview}
                    disabled={
                      !canUseStatement ||
                      !selectedBusiness ||
                      !selectedVendor ||
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
                      ? vs("generating", "Generating...")
                      : vs("generatePreview", "Generate Preview")}
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    disabled={
                      !canUseStatement ||
                      !selectedBusiness ||
                      !selectedVendor ||
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
                    {loading
                      ? vs("downloading", "Downloading...")
                      : vs("downloadPdf", "Download PDF")}
                  </button>

                  <button
                    onClick={handleDownloadCSV}
                    disabled={
                      !canUseStatement ||
                      !selectedBusiness ||
                      !selectedVendor ||
                      !hasValidDateRange ||
                      loading
                    }
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileSpreadsheet size={18} />
                    {loading ? "..." : vs("exportCsv", "Export CSV")}
                  </button>

                  <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <X size={18} />
                    {vs("clear", "Clear")}
                  </button>
                </div>
              </div>
            </div>

            {showPreviewTable && previewData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 mt-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {vs("statementPreview", "Statement Preview")}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
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
                      {loading
                        ? vs("opening", "Opening...")
                        : vs("print", "Print")}
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={
                        !selectedBusiness ||
                        !selectedVendor ||
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
                      {loading
                        ? vs("preparing", "Preparing...")
                        : vs("share", "Share")}
                    </button>
                    <button
                      onClick={() => setShowPreviewTable(false)}
                      className="text-gray-500 hover:text-gray-700 p-2"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">
                      {vs("totalInvoiced", "Total Invoiced")}
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrencyAmount(
                        previewData.summary.currency,
                        previewData.summary.totalInvoiced || 0,
                      )}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600 font-medium">
                      {vs("totalPaid", "Total Paid")}
                    </div>
                    <div className="text-2xl font-bold text-green-800">
                      {formatCurrencyAmount(
                        previewData.summary.currency,
                        previewData.summary.totalPaid || 0,
                      )}
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-orange-600 font-medium">
                      {vs("balanceDue", "Balance Due")}
                    </div>
                    <div className="text-2xl font-bold text-orange-800">
                      {formatCurrencyAmount(
                        previewData.summary.currency,
                        previewData.summary.balanceDue || 0,
                      )}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 font-medium">
                      {vs("transactions", "Transactions")}
                    </div>
                    <div className="text-2xl font-bold text-purple-800">
                      {previewData.transactions.length}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          {vs("date", "Date")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          {vs("transaction", "Transaction")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          {vs("details", "Details")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-right text-sm font-medium text-gray-700">
                          {vs("amount", "Amount")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-right text-sm font-medium text-gray-700">
                          {vs("payments", "Payments")}
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-right text-sm font-medium text-gray-700">
                          {vs("balance", "Balance")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.transactions.map((t, idx) => (
                        <tr
                          key={idx}
                          className={`${
                            t.type === "Payment Made"
                              ? "bg-green-50"
                              : idx % 2 === 1
                                ? "bg-gray-50"
                                : "bg-white"
                          }`}
                        >
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900">
                            {formatDate(t.date)}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900">
                            {t.type}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900">
                            {t.details}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900 text-right">
                            {t.amount > 0
                              ? formatCurrencyAmount(
                                  previewData.summary.currency,
                                  t.amount,
                                )
                              : ""}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900 text-right">
                            {t.payments > 0
                              ? formatCurrencyAmount(
                                  previewData.summary.currency,
                                  t.payments,
                                )
                              : ""}
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900 text-right font-medium">
                            {formatCurrencyAmount(
                              previewData.summary.currency,
                              t.balance || 0,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewUrl && (
                  <div className="mt-6">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <iframe
                        src={previewUrl}
                        className="w-full h-96"
                        title={vs("previewTitle", "Vendor Statement Preview")}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {selectedVendorData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <User size={20} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {vs("vendorDetails", "Vendor Details")}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {vs("name", "Name")}
                    </p>
                    <p className="text-gray-900">
                      {selectedVendorData?.basicInformation
                        ?.vendorDisplayName ||
                        selectedVendorData?.basicInformation?.companyName ||
                        selectedVendorData?.name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isSingleAssignedBusiness() && selectedBusinessData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building size={20} className="text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {vs("businessDetails", "Business Details")}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {vs("name", "Name")}
                    </p>
                    <p className="text-gray-900">{selectedBusinessData.name}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Info size={20} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">
                  {vs("tipsTitle", "Tips & Information")}
                </h3>
              </div>
              <div className="space-y-2 text-sm text-blue-800">
                <p>
                  •{" "}
                  {vs(
                    "tipSelectBusinessVendor",
                    "Select business and vendor to generate statements",
                  )}
                </p>
                <p>
                  •{" "}
                  {vs(
                    "tipUseDateRange",
                    "Use date range to filter specific periods",
                  )}
                </p>
                <p>
                  •{" "}
                  {vs(
                    "tipPreviewBeforeDownload",
                    "Preview before downloading for accuracy",
                  )}
                </p>
                <p>
                  •{" "}
                  {vs(
                    "tipCsvExport",
                    "CSV export includes transaction history + summary",
                  )}
                </p>
                <p>
                  • {vs("tipPdfPrintReady", "PDF statements are print-ready")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
