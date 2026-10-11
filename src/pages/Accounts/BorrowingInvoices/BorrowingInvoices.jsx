import React, { useState, useEffect, useContext } from "react";
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Plus,
  Calendar,
  ChevronDown,
  DollarSign,
  Package,
  Users,
  FileText,
  Building,
  Receipt,
  Clock,
  User,
  Info,
  X,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Banknote,
} from "lucide-react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import { DataTable, SummaryCards } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import DateRangePicker from "@/components/common/DateRangePicker";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function BorrowingInvoices() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // State management
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("All");
  const [selectedLenderFilter, setSelectedLenderFilter] = useState("All");
  const [selectedBorrowingTypeFilter, setSelectedBorrowingTypeFilter] =
    useState("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [selectedPaymentStatusFilter, setSelectedPaymentStatusFilter] =
    useState("All");
  const [selectedDateCreatedFilter, setSelectedDateCreatedFilter] =
    useState("");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(true);

  // Data states
  const [borrowingInvoices, setBorrowingInvoices] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [lenders, setLenders] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [overallStats, setOverallStats] = useState({
    totalBorrowings: 0,
    applied: 0,
    underReview: 0,
    approved: 0,
    disbursed: 0,
    active: 0,
    paidOff: 0,
    defaulted: 0,
    cancelled: 0,
    totalPrincipalBorrowed: 0,
    totalOutstandingBalance: 0,
    totalInterestPaid: 0,
  });

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    fetchBorrowingInvoices();
    fetchBusinesses();
    fetchLenders();
  }, [
    currentPage,
    entriesPerPage,
    selectedBusinessFilter,
    selectedLenderFilter,
    selectedBorrowingTypeFilter,
    selectedStatusFilter,
    selectedPaymentStatusFilter,
    selectedDateCreatedFilter,
    selectedDueDateFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
  ]);

  const fetchBorrowingInvoices = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: entriesPerPage,
        ...(selectedBusinessFilter !== "All" && {
          business: selectedBusinessFilter,
        }),
        ...(selectedLenderFilter !== "All" && { lender: selectedLenderFilter }),
        ...(selectedBorrowingTypeFilter !== "All" && {
          borrowingType: selectedBorrowingTypeFilter,
        }),
        ...(selectedStatusFilter !== "All" && {
          status: selectedStatusFilter,
        }),
        ...(selectedPaymentStatusFilter !== "All" && {
          paymentStatus: selectedPaymentStatusFilter,
        }),
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        ...(selectedDateCreatedFilter && {
          dateFrom: selectedDateCreatedFilter,
        }),
        ...(selectedDueDateFilter && { dateTo: selectedDueDateFilter }),
        ...(searchTerm && { search: searchTerm }),
      };

      console.log("🔍 API Request params:", params);

      const response = await axios.get(`${Base_URL}/borrowing-invoices`, {
        params,
        headers,
      });

      if (response.data.success) {
        setBorrowingInvoices(response.data.data);
        setTotalPages(response.data.pagination.pages);
        console.log("response.data.stats", response.data.stats);
        setOverallStats(response.data.stats || {});
      }
    } catch (error) {
      console.error("Error fetching borrowing invoices:", error);
      notifyError("Failed to load borrowing invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        setBusinesses(JSON.parse(storedBusinesses));
      }
    } catch (error) {
      console.error("Error fetching businesses:", error);
    }
  };

  const fetchLenders = async () => {
    try {
      const response = await axios.get(`${Base_URL}/vendors`, { headers });
      console.log("🔍 Lenders API response:", response.data);
      setLenders(response.data.data || response.data || []);
    } catch (error) {
      console.error("Error fetching lenders:", error);
    }
  };

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const getStatusColor = (status) => {
    const colors = {
      Applied: "bg-blue-100 text-blue-800",
      "Under Review": "bg-yellow-100 text-yellow-800",
      Approved: "bg-green-100 text-green-800",
      Disbursed: "bg-purple-100 text-purple-800",
      Active: "bg-emerald-100 text-emerald-800",
      "Paid Off": "bg-gray-100 text-gray-800",
      Defaulted: "bg-red-100 text-red-800",
      Cancelled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getBorrowingTypeColor = (type) => {
    const colors = {
      bank_loan: "bg-blue-100 text-blue-800",
      line_of_credit: "bg-green-100 text-green-800",
      equipment_financing: "bg-purple-100 text-purple-800",
      working_capital: "bg-orange-100 text-orange-800",
      invoice_factoring: "bg-cyan-100 text-cyan-800",
      merchant_cash_advance: "bg-pink-100 text-pink-800",
      personal_guarantee: "bg-indigo-100 text-indigo-800",
      trade_credit: "bg-teal-100 text-teal-800",
      others: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getBorrowingTypeLabel = (type) => {
    const labels = {
      bank_loan: "Bank Loan",
      line_of_credit: "Line of Credit",
      equipment_financing: "Equipment Financing",
      working_capital: "Working Capital",
      invoice_factoring: "Invoice Factoring",
      merchant_cash_advance: "Merchant Cash Advance",
      personal_guarantee: "Personal Guarantee",
      trade_credit: "Trade Credit",
      others: "Others",
    };
    return labels[type] || type;
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      current: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      defaulted: "bg-red-100 text-red-800",
      paid_off: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error opening file");
      console.error("Error: ", error);
    }
  };

  const handleEdit = (id) => {
    history.push(`/update-borrowing-invoice/${id}`);
  };

  const handleView = (id) => {
    history.push(`/view-borrowing-invoice/${id}`);
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm("Are you sure you want to delete this borrowing invoice?")
    ) {
      return;
    }

    try {
      const response = await axios.delete(
        `${Base_URL}/borrowing-invoices/${id}`,
        {
          headers,
        }
      );

      if (response.data.success) {
        notifySuccess("Borrowing invoice deleted successfully");
        fetchBorrowingInvoices();
      }
    } catch (error) {
      console.error("Error deleting borrowing invoice:", error);
      notifyError(
        error.response?.data?.error || "Failed to delete borrowing invoice"
      );
    }
  };

  console.log("🔍 Current state:", {
    lenders: lenders.length,
    borrowingInvoices: borrowingInvoices.length,
  });

  console.log(
    "🔍 Lender filter options:",
    lenders.map((l) => ({
      id: l._id,
      name: l.basicInformation?.vendorDisplayName || l.name,
    }))
  );

  // Filter configuration
  const filters = [
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
      label: "Lender",
      value: selectedLenderFilter,
      onChange: setSelectedLenderFilter,
      options: [
        { value: "All", label: "All Lenders" },
        ...lenders.map((l) => ({
          value: l._id,
          label: l.basicInformation?.vendorDisplayName || l.name,
        })),
      ],
      placeholder: "Lender: All",
      icon: User,
    },
    {
      label: "Borrowing Type",
      value: selectedBorrowingTypeFilter,
      onChange: setSelectedBorrowingTypeFilter,
      options: [
        { value: "All", label: "All Types" },
        { value: "bank_loan", label: "Bank Loan" },
        { value: "line_of_credit", label: "Line of Credit" },
        { value: "equipment_financing", label: "Equipment Financing" },
        { value: "working_capital", label: "Working Capital" },
        { value: "invoice_factoring", label: "Invoice Factoring" },
        { value: "merchant_cash_advance", label: "Merchant Cash Advance" },
        { value: "personal_guarantee", label: "Personal Guarantee" },
        { value: "trade_credit", label: "Trade Credit" },
        { value: "others", label: "Others" },
      ],
      placeholder: "Type: All",
      icon: Package,
    },
    {
      label: "Status",
      value: selectedStatusFilter,
      onChange: setSelectedStatusFilter,
      options: [
        { value: "All", label: "All Statuses" },
        { value: "Applied", label: "Applied" },
        { value: "Under Review", label: "Under Review" },
        { value: "Approved", label: "Approved" },
        { value: "Disbursed", label: "Disbursed" },
        { value: "Active", label: "Active" },
        { value: "Paid Off", label: "Paid Off" },
        { value: "Defaulted", label: "Defaulted" },
        { value: "Cancelled", label: "Cancelled" },
      ],
      placeholder: "Status: All",
      icon: FileText,
    },
    {
      label: "Payment Status",
      value: selectedPaymentStatusFilter,
      onChange: setSelectedPaymentStatusFilter,
      options: [
        { value: "All", label: "All Payment Statuses" },
        { value: "current", label: "Current" },
        { value: "overdue", label: "Overdue" },
        { value: "defaulted", label: "Defaulted" },
        { value: "paid_off", label: "Paid Off" },
      ],
      placeholder: "Payment Status: All",
      icon: DollarSign,
    },
    {
      label: "Date Created",
      value: selectedDateCreatedFilter,
      onChange: (val) => setSelectedDateCreatedFilter(val),
      isDatePicker: true,
      placeholder: "Date Created",
      icon: Calendar,
    },
  ];

  // Summary cards data
  const summaryCardsData = [
    {
      title: "Total Borrowings",
      value: overallStats.totalBorrowings,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Active Loans",
      value: overallStats.active,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Pending Review",
      value: overallStats.underReview + overallStats.applied,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Outstanding Balance",
      value: `$${formatAmount(overallStats.totalOutstandingBalance)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Borrowing Invoices
              </h1>
              <p className="text-gray-600 mt-2">
                Manage loans, credit lines, and borrowing instruments
              </p>
            </div>
            <div className="flex items-center gap-4">
              <DateRangePicker
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder="Filter by date range"
                className="flex-shrink-0"
              />
              <button
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors shadow-sm"
                onClick={() => history.push("/create-borrowing-invoice")}
              >
                <Plus size={20} />
                Create Borrowing
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
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
            searchPlaceholder="Search borrowing invoices..."
            headers={[
              "Borrowing No",
              "Lender",
              "Type & Status",
              "Dates",
              "Amount & Terms",
              "Payment Status",
              "Documents",
              "Actions",
            ]}
            data={borrowingInvoices}
            loading={loading}
            renderRow={(borrowing) => (
              <tr
                key={borrowing._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Borrowing Details */}
                <td className="py-4 px-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      #{borrowing.borrowingNumber}
                    </p>
                    {borrowing.purpose && (
                      <p
                        className="text-sm text-gray-500 truncate max-w-32"
                        title={borrowing.purpose}
                      >
                        {borrowing.purpose}
                      </p>
                    )}
                  </div>
                </td>

                {/* Lender */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <PiggyBank size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 truncate">
                        {borrowing.lender?.basicInformation
                          ?.vendorDisplayName || "N/A"}
                      </p>
                      <p className="text-sm text-gray-500">Lender</p>
                    </div>
                  </div>
                </td>

                {/* Type & Status */}
                <td className="py-4 px-4">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getBorrowingTypeColor(
                        borrowing.borrowingType
                      )}`}
                    >
                      {getBorrowingTypeLabel(borrowing.borrowingType)}
                    </span>
                    <br />
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        borrowing.status
                      )}`}
                    >
                      {borrowing.status}
                    </span>
                  </div>
                </td>

                {/* Dates */}
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(borrowing.createdAt)}
                      </p>
                      <p className="text-xs text-gray-500">Applied Date</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {formatDate(borrowing.maturityDate)}
                      </p>
                      <p className="text-xs text-gray-500">Maturity Date</p>
                    </div>
                  </div>
                </td>

                {/* Amount & Terms */}
                <td className="py-4 px-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {borrowing.currency}{" "}
                      {formatAmount(borrowing.principalAmount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {borrowing.interestRate}% • {borrowing.termMonths}m
                    </p>
                    {borrowing.remainingBalance !== undefined && (
                      <p className="text-xs text-orange-600">
                        Outstanding: {borrowing.currency}{" "}
                        {formatAmount(borrowing.remainingBalance)}
                      </p>
                    )}
                  </div>
                </td>

                {/* Payment Status */}
                <td className="py-4 px-4">
                  <div className="text-center">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(
                        borrowing.paymentStatus
                      )}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mr-1 ${
                          borrowing.paymentStatus === "current"
                            ? "bg-green-500"
                            : borrowing.paymentStatus === "overdue"
                            ? "bg-red-500"
                            : borrowing.paymentStatus === "defaulted"
                            ? "bg-red-600"
                            : "bg-gray-500"
                        }`}
                      ></div>
                      {borrowing.paymentStatus?.replace("_", " ").toUpperCase()}
                    </span>
                    {borrowing.nextPaymentDue && (
                      <p className="text-xs text-gray-500 mt-1">
                        Next: {formatDate(borrowing.nextPaymentDue)}
                      </p>
                    )}
                  </div>
                </td>

                {/* Documents */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    {borrowing.documents?.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <FileText
                            size={16}
                            className="text-[var(--p-blue)]"
                          />
                          <span className="text-sm text-gray-600">
                            {borrowing.documents.length} file
                            {borrowing.documents.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            handleOpenFile(borrowing.documents[0].fileId)
                          }
                          className="text-[var(--p-blue)] hover:text-[#9CBA33] p-1"
                          title="View Document"
                        >
                          <Eye size={16} />
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">
                        No documents
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleView(borrowing._id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(borrowing._id)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    {(borrowing.status === "Applied" ||
                      borrowing.status === "Cancelled") && (
                      <button
                        onClick={() => handleDelete(borrowing._id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete"
                      >
                        <Trash2 size={16} />
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
