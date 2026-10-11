import React, { useEffect, useState, useContext } from "react";
import {
  Search,
  Calendar,
  ChevronDown,
  Eye,
  PenSquare,
  Plus,
  Filter,
  Building,
  DollarSign,
  Clock,
  FileText,
  ArrowRight,
  User,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileSpreadsheet as ExcelIcon,
  X,
} from "lucide-react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable, SummaryCards } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import DateRangePicker from "@/components/common/DateRangePicker";
import { notifyError, notifySuccess } from "@/utils/toast";
import * as XLSX from "xlsx";
import { AdminContext } from "@/context/AdminContext";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function SpecialTransfers() {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // State management
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("All");
  const [selectedTransferTypeFilter, setSelectedTransferTypeFilter] =
    useState("All");
  const [selectedTransactionTypeFilter, setSelectedTransactionTypeFilter] =
    useState("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [selectedDateCreatedFilter, setSelectedDateCreatedFilter] =
    useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const history = useHistory();
  const [businesses, setBusinesses] = useState([]);
  const [transferTypes, setTransferTypes] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [overallStats, setOverallStats] = useState({
    totalTransfers: 0,
    pendingTransfers: 0,
    completedTransfers: 0,
    totalAmount: 0,
  });

  const clearAllFilters = () => {
    setSelectedBusinessFilter("All");
    setSelectedTransferTypeFilter("All");
    setSelectedTransactionTypeFilter("All");
    setSelectedStatusFilter("All");
    setSelectedDateCreatedFilter("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1);
        },
      },
    },
    {
      label: "Business",
      value: selectedBusinessFilter,
      onChange: setSelectedBusinessFilter,
      options: [
        { value: "All", label: "All Businesses" },
        ...businesses.map((b) => ({
          value: b._id,
          label: b.name,
        })),
      ],
      placeholder: "Select Business",
      icon: Building,
    },
    {
      label: "Transfer Type",
      value: selectedTransferTypeFilter,
      onChange: setSelectedTransferTypeFilter,
      options: [
        { value: "All", label: "All Types" },
        { value: "inter_company", label: "Inter Company" },
        { value: "third_party_payment", label: "Third Party Payment" },
        { value: "third_party_received", label: "Third Party Received" },
        { value: "invoice_payment", label: "Invoice Payment" },
        { value: "payback_transfer", label: "Payback Transfer" },
      ],
      placeholder: "Transfer Type: All",
      icon: ArrowRight,
    },
    {
      label: "Transaction Type",
      value: selectedTransactionTypeFilter,
      onChange: setSelectedTransactionTypeFilter,
      options: [
        { value: "All", label: "All Types" },
        ...transferTypes.map((type) => ({
          value: type.name,
          label: type.name,
        })),
      ],
      placeholder: "Transaction Type: All",
      icon: CreditCard,
    },
    {
      label: "Status",
      value: selectedStatusFilter,
      onChange: setSelectedStatusFilter,
      options: [
        { value: "All", label: "All Status" },
        { value: "Floating", label: "Floating" },
        { value: "Completed", label: "Completed" },
        { value: "Cancelled", label: "Cancelled" },
        { value: "Failed", label: "Failed" },
        { value: "PaidBack", label: "Paid Back" },
      ],
      placeholder: "Status: All",
      icon: Clock,
    },
    {
      label: "Date Created",
      value: selectedDateCreatedFilter,
      onChange: (val) => {
        setSelectedDateCreatedFilter(val);
        // Clear date range picker when individual date filter is set
        if (val) {
          setDateRangeStart("");
          setDateRangeEnd("");
        }
        setCurrentPage(1); // Reset to first page when date filter changes
      },
      isDatePicker: true,
      placeholder: "Date Created",
      icon: Calendar,
    },
  ];

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const params = {
        business:
          selectedBusinessFilter !== "All" ? selectedBusinessFilter : undefined,
        transferType:
          selectedTransferTypeFilter !== "All"
            ? selectedTransferTypeFilter
            : undefined,
        transactionType:
          selectedTransactionTypeFilter !== "All"
            ? selectedTransactionTypeFilter
            : undefined,
        status:
          selectedStatusFilter !== "All" ? selectedStatusFilter : undefined,
        search: searchTerm,
        page: currentPage,
        limit: entriesPerPage,
        // Prioritize date range picker over individual date filters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        // Date Created filter - filters by createdAt
        ...(!dateRangeStart &&
          selectedDateCreatedFilter && {
            createdDateFrom: selectedDateCreatedFilter,
            createdDateTo: selectedDateCreatedFilter, // Same date for both start and end
          }),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key]
      );

      console.log("🔍 Special Transfers API Request params:", params);

      const res = await axios.get(`${Base_URL}/special-transfers`, { params });

      console.log("res.data", res.data);
      if (res.data.success) {
        setTransfers(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setOverallStats(
          res.data.stats || {
            totalTransfers: 0,
            pendingTransfers: 0,
            completedTransfers: 0,
            totalAmount: 0,
          }
        );
      }
    } catch (err) {
      console.error("Error fetching transfers", err);
      notifyError("Failed to fetch transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedData = JSON.parse(storedBusinesses);
          setBusinesses(parsedData);

          // Fetch transfer types for the first business (or selected business)
          if (parsedData.length > 0) {
            await fetchTransferTypes(parsedData[0]._id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch businesses:", error);
      }
    };

    fetchBusinesses();
  }, []);

  // Fetch transfer types for a business
  const fetchTransferTypes = async (businessId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/special-transfer-types/business/${businessId}/active`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success) {
        setTransferTypes(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching transfer types:", error);
      // Don't show error notification as this might be expected for new businesses
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchTransfers();
  }, [
    selectedBusinessFilter,
    selectedTransferTypeFilter,
    selectedTransactionTypeFilter,
    selectedStatusFilter,
    selectedDateCreatedFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
  ]);

  useEffect(() => {
    fetchTransfers();
  }, [currentPage, entriesPerPage]);

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    // Clear individual date filters when date range is applied
    setSelectedDateCreatedFilter("");
    setCurrentPage(1);
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);

      // Fetch all special transfers with current filters
      const params = {
        page: 1,
        limit: 999999, // Get all records
        ...(selectedBusinessFilter !== "All" && {
          business: selectedBusinessFilter,
        }),
        ...(selectedTransferTypeFilter !== "All" && {
          transferType: selectedTransferTypeFilter,
        }),
        ...(selectedTransactionTypeFilter !== "All" && {
          transactionType: selectedTransactionTypeFilter,
        }),
        ...(selectedStatusFilter !== "All" && {
          status: selectedStatusFilter,
        }),
        // Prioritize date range picker over individual date filters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        // Date Created filter - filters by createdAt
        ...(!dateRangeStart &&
          selectedDateCreatedFilter && {
            createdDateFrom: selectedDateCreatedFilter,
            createdDateTo: selectedDateCreatedFilter,
          }),
        ...(searchTerm && { search: searchTerm }),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/special-transfers`, {
        params,
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      const allTransfers = response.data.data || [];

      if (allTransfers.length === 0) {
        notifyError("No special transfers found to export");
        return;
      }

      // Prepare Excel data
      const exportData = allTransfers.map((transfer) => ({
        "Transfer Number": transfer.transferNumber || "",
        "Transfer Type": getTransferTypeLabel(transfer.transferType) || "",
        "Transaction Type": transfer.transactionType || "",
        Status: transfer.status || "",
        "Source Business":
          transfer.sourceBusiness?.name || transfer.business?.name || "",
        "Source Bank Account": transfer.sourceBankAccount?.accountName || "",
        "Source Bank": transfer.sourceBankAccount?.bankName || "",
        "Source Currency": transfer.sourceCurrency || "",
        "Source Amount": transfer.sourceAmount || 0,
        "Destination Business":
          transfer.destinationBusiness?.name ||
          transfer.thirdPartyInfo?.name ||
          "",
        "Destination Bank Account":
          transfer.destinationBankAccount?.accountName ||
          transfer.thirdPartyInfo?.accountNumber ||
          "",
        "Destination Bank":
          transfer.destinationBankAccount?.bankName ||
          transfer.thirdPartyInfo?.bankName ||
          "",
        "Destination Currency": transfer.destinationCurrency || "",
        "Destination Amount":
          transfer.conversionDetails?.convertedAmount ||
          transfer.sourceAmount ||
          0,
        "Exchange Rate": transfer.conversionDetails?.exchangeRate || 1,
        "Bank Charges": transfer.conversionDetails?.bankCharges || 0,
        "Transfer Date": transfer.transferDate
          ? formatDate(transfer.transferDate)
          : "",
        "Completion Date": transfer.completionDate
          ? formatDate(transfer.completionDate)
          : "",
        Reference: transfer.reference || "",
        Notes: transfer.notes || "",
        "Created At": transfer.createdAt ? formatDate(transfer.createdAt) : "",
        "Updated At": transfer.updatedAt ? formatDate(transfer.updatedAt) : "",
      }));

      // Create summary rows
      const summaryRows = [
        {
          "Transfer Number": `Special Transfers Report`,
          "Transfer Type": "",
          "Transaction Type": "",
          Status: "",
          "Source Business": "",
          "Source Bank Account": "",
          "Source Bank": "",
          "Source Currency": "",
          "Source Amount": "",
          "Destination Business": "",
          "Destination Bank Account": "",
          "Destination Bank": "",
          "Destination Currency": "",
          "Destination Amount": "",
          "Exchange Rate": "",
          "Bank Charges": "",
          "Transfer Date": "",
          "Completion Date": "",
          Reference: "",
          Notes: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Transfer Number": `Generated on: ${formatDate(new Date())}`,
          "Transfer Type": "",
          "Transaction Type": "",
          Status: "",
          "Source Business": "",
          "Source Bank Account": "",
          "Source Bank": "",
          "Source Currency": "",
          "Source Amount": "",
          "Destination Business": "",
          "Destination Bank Account": "",
          "Destination Bank": "",
          "Destination Currency": "",
          "Destination Amount": "",
          "Exchange Rate": "",
          "Bank Charges": "",
          "Transfer Date": "",
          "Completion Date": "",
          Reference: "",
          Notes: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Transfer Number": `Total Transfers: ${allTransfers.length}`,
          "Transfer Type": "",
          "Transaction Type": "",
          Status: "",
          "Source Business": "",
          "Source Bank Account": "",
          "Source Bank": "",
          "Source Currency": "",
          "Source Amount": "",
          "Destination Business": "",
          "Destination Bank Account": "",
          "Destination Bank": "",
          "Destination Currency": "",
          "Destination Amount": "",
          "Exchange Rate": "",
          "Bank Charges": "",
          "Transfer Date": "",
          "Completion Date": "",
          Reference: "",
          Notes: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Transfer Number": `Total Amount: ${formatAmount(
            allTransfers.reduce((sum, t) => sum + (t.sourceAmount || 0), 0)
          )}`,
          "Transfer Type": "",
          "Transaction Type": "",
          Status: "",
          "Source Business": "",
          "Source Bank Account": "",
          "Source Bank": "",
          "Source Currency": "",
          "Source Amount": "",
          "Destination Business": "",
          "Destination Bank Account": "",
          "Destination Bank": "",
          "Destination Currency": "",
          "Destination Amount": "",
          "Exchange Rate": "",
          "Bank Charges": "",
          "Transfer Date": "",
          "Completion Date": "",
          Reference: "",
          Notes: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Transfer Number": "",
          "Transfer Type": "",
          "Transaction Type": "",
          Status: "",
          "Source Business": "",
          "Source Bank Account": "",
          "Source Bank": "",
          "Source Currency": "",
          "Source Amount": "",
          "Destination Business": "",
          "Destination Bank Account": "",
          "Destination Bank": "",
          "Destination Currency": "",
          "Destination Amount": "",
          "Exchange Rate": "",
          "Bank Charges": "",
          "Transfer Date": "",
          "Completion Date": "",
          Reference: "",
          Notes: "",
          "Created At": "",
          "Updated At": "",
        },
      ];

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet([]);

      // Add summary rows
      XLSX.utils.sheet_add_json(worksheet, summaryRows, {
        skipHeader: true,
        origin: "A1",
      });

      // Add data rows
      XLSX.utils.sheet_add_json(worksheet, exportData, {
        skipHeader: false,
        origin: "A6", // Start after summary rows
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Special Transfers");

      // Generate filename
      const filename = `Special_Transfers_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess("Special transfers exported to Excel successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      notifyError(
        "Failed to export special transfers to Excel. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Floating: "bg-yellow-100 text-yellow-800 border-yellow-300",
      Completed: "bg-green-100 text-green-800 border-green-300",
      Cancelled: "bg-red-100 text-red-800 border-red-300",
      Failed: "bg-gray-100 text-gray-800 border-gray-300",
      PaidBack: "bg-blue-100 text-blue-800 border-blue-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getTransferTypeColor = (type) => {
    const colors = {
      inter_company: "bg-blue-50 text-blue-700",
      third_party_payment: "bg-purple-50 text-purple-700",
      third_party_received: "bg-orange-50 text-orange-700",
      invoice_payment: "bg-green-50 text-green-700",
      payback_transfer: "bg-yellow-50 text-yellow-700",
    };
    return colors[type] || "bg-gray-50 text-gray-700";
  };

  const getTransferTypeLabel = (type) => {
    const labels = {
      inter_company: "Inter Company",
      third_party_payment: "Third Party Payment",
      third_party_received: "Third Party Received",
      invoice_payment: "Invoice Payment",
      payback_transfer: "Payback Transfer",
    };
    return labels[type] || type;
  };

  const summaryCardsData = [
    {
      title: "Total Transfers",
      value: overallStats.totalTransfers || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Floating Transfers",
      value: overallStats.floatingTransfers || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Completed Transfers",
      value: overallStats.completedTransfers || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Total Amount",
      value: `$${formatAmount(overallStats.totalAmount || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Special Transfers
              </h1>
              <p className="text-gray-600 mt-2">
                Manage inter-company transfers and third-party payments
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <DateRangePicker
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder="Filter by date range"
                className="flex-shrink-0"
              />
              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExcelIcon size={18} />
                {loading ? "Exporting..." : "Export"}
              </button>
              <button
                className="flex items-center gap-2 px-4 sm:px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors shadow-sm whitespace-nowrap"
                onClick={() => history.push("/create-special-transfer")}
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Create Transfer</span>
                <span className="sm:hidden">Create</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <DataTable
            filters={filters}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            recordsPerPage={entriesPerPage}
            onRecordsPerPageChange={(num) => {
              setEntriesPerPage(num);
              setCurrentPage(1);
            }}
            searchValue={searchTerm}
            onSearch={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search transfers..."
            headers={[
              "Transfer No",
              "Type & Status",
              "Source",
              "Destination",
              "Amount",
              "Date",
              "Actions",
            ]}
            data={transfers}
            loading={loading}
            colWidths={{
              "Transfer No": "minmax(150px, 1fr)",
              "Type & Status": "minmax(180px, 1fr)",
              Source: "minmax(200px, 1fr)",
              Destination: "minmax(200px, 1fr)",
              Amount: "minmax(120px, 1fr)",
              Date: "minmax(120px, 1fr)",
              Actions: "minmax(100px, 1fr)",
            }}
            renderRow={(transfer) => (
              <tr
                key={transfer._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Transfer Number */}
                <td className="py-3 px-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      #{transfer.transferNumber}
                    </p>
                    {transfer.reference && (
                      <p className="text-xs text-gray-500 truncate">
                        Ref: {transfer.reference}
                      </p>
                    )}
                  </div>
                </td>

                {/* Type & Status */}
                <td className="py-3 px-3">
                  <div className="space-y-1">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTransferTypeColor(
                        transfer.transferType
                      )}`}
                    >
                      {getTransferTypeLabel(transfer.transferType)}
                    </span>
                    <br />
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        transfer.status
                      )}`}
                    >
                      {transfer.status}
                    </span>
                    <br />
                    <span className="text-xs text-gray-500">
                      {transfer.transactionType}
                    </span>
                    {transfer.isPayBackTransfer && (
                      <div className="mt-1">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                          Pay Back Transfer
                        </span>
                        {transfer.payBackStatus && (
                          <span className="ml-1 inline-block px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                            {transfer.payBackStatus}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* Source */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-gray-100 rounded-lg flex-shrink-0">
                      <Building size={14} className="text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {transfer.sourceBusiness?.name || "Unknown Business"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {transfer.sourceBankAccount?.accountName} -{" "}
                        {transfer.sourceBankAccount?.bankName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {transfer.sourceCurrency}{" "}
                        {formatAmount(transfer.sourceAmount)}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Destination */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-gray-100 rounded-lg flex-shrink-0">
                      {transfer.transferType === "inter_company" ? (
                        <Building size={14} className="text-gray-600" />
                      ) : transfer.transferType === "invoice_payment" ? (
                        <FileText size={14} className="text-gray-600" />
                      ) : transfer.transferType === "payback_transfer" ? (
                        <Building size={14} className="text-gray-600" />
                      ) : (
                        <User size={14} className="text-gray-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {transfer.transferType === "inter_company" ? (
                        <>
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {transfer.destinationBusiness?.name ||
                              "Unknown Business"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {transfer.destinationBankAccount?.accountName} -{" "}
                            {transfer.destinationBankAccount?.bankName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {transfer.destinationCurrency}{" "}
                            {formatAmount(
                              transfer.conversionDetails?.convertedAmount ||
                                transfer.sourceAmount
                            )}
                          </p>
                        </>
                      ) : transfer.transferType === "invoice_payment" ? (
                        <>
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {transfer.purchaseContract?.contractNo ||
                              "Contract"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {transfer.purchaseContract?.basicInfo
                              ?.selectedVendorId?.name || "Vendor"}
                          </p>
                          <p className="text-xs text-gray-400">
                            Invoice Payment
                          </p>
                        </>
                      ) : transfer.transferType === "payback_transfer" ? (
                        <>
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {transfer.destinationDetails?.businessName ||
                              transfer.destinationBusiness?.name ||
                              "Original Source"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {transfer.destinationDetails?.accountName ||
                              transfer.destinationBankAccount?.accountName}{" "}
                            -{" "}
                            {transfer.destinationDetails?.bankName ||
                              transfer.destinationBankAccount?.bankName}
                          </p>
                          <p className="text-xs text-gray-400">
                            Payback Transfer
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {transfer.thirdPartyInfo?.name || "Third Party"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {transfer.thirdPartyInfo?.bankName} -{" "}
                            {transfer.thirdPartyInfo?.accountNumber}
                          </p>
                          <p className="text-xs text-gray-400">
                            {transfer.thirdPartyInfo?.reason}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </td>

                {/* Amount */}
                <td className="py-3 px-3 text-left">
                  <div className="text-left">
                    <p className="font-bold text-sm text-gray-900">
                      {transfer.sourceCurrency}{" "}
                      {formatAmount(transfer.sourceAmount)}
                    </p>
                    {transfer.conversionDetails?.exchangeRate !== 1 && (
                      <p className="text-xs text-gray-500">
                        Rate: {transfer.conversionDetails.exchangeRate}
                      </p>
                    )}
                    {transfer.conversionDetails?.bankCharges &&
                      transfer.conversionDetails.bankCharges > 0 && (
                        <p className="text-xs text-red-500">
                          Charges:{" "}
                          {transfer.conversionDetails.bankChargesCurrency ||
                            (transfer.conversionDetails.exchangeRate !== 1
                              ? transfer.conversionDetails.toCurrency
                              : transfer.sourceCurrency)}{" "}
                          {formatAmount(transfer.conversionDetails.bankCharges)}
                        </p>
                      )}
                    {transfer.conversionDetails?.netAmount &&
                      transfer.conversionDetails.exchangeRate !== 1 && (
                        <p className="text-xs text-green-600">
                          Net: {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(transfer.conversionDetails.netAmount)}
                        </p>
                      )}
                    {transfer.conversionDetails?.bankCharges > 0 &&
                      transfer.conversionDetails.exchangeRate !== 1 && (
                        <p className="text-xs text-gray-500">
                          {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(
                            transfer.conversionDetails.convertedAmount
                          )}{" "}
                          - {transfer.conversionDetails.bankChargesCurrency}{" "}
                          {formatAmount(transfer.conversionDetails.bankCharges)}
                        </p>
                      )}
                  </div>
                </td>

                {/* Date */}
                <td className="py-3 px-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Calendar
                        size={12}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <span className="text-xs text-gray-600 truncate">
                        {formatDate(transfer.transferDate)}
                      </span>
                    </div>
                    {transfer.completionDate && (
                      <div className="flex items-center gap-1">
                        <CheckCircle
                          size={12}
                          className="text-green-400 flex-shrink-0"
                        />
                        <span className="text-xs text-green-600 truncate">
                          Completed: {formatDate(transfer.completionDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors"
                      onClick={() =>
                        history.push(`/view-special-transfer/${transfer._id}`)
                      }
                      title="View Transfer"
                    >
                      <Eye size={14} />
                    </button>
                    {transfer.status === "Floating" && (
                      <button
                        className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors"
                        onClick={() =>
                          history.push(
                            `/update-special-transfer/${transfer._id}`
                          )
                        }
                        title="Edit Transfer"
                      >
                        <PenSquare size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>
    </div>
  );
}
