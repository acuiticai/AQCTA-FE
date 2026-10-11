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
  FileSpreadsheet as ExcelIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
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

export default function Expenses() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // State management
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("All");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("All");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState("All");
  const [selectedExpenseTypeFilter, setSelectedExpenseTypeFilter] =
    useState("All");
  const [selectedExpenseStatusFilter, setSelectedExpenseStatusFilter] =
    useState("All");
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
  const [expenses, setExpenses] = useState([]);
  console.log("expenses", expenses);
  const [businesses, setBusinesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [overallStats, setOverallStats] = useState({
    totalExpenses: 0,
    approveTransaction: 0,
    pendingApproval: 0,
    totalValue: 0,
    approvedByManagement: 0,
    makeTransaction: 0,
    cancelled: 0,
  });

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    fetchExpenses();
    fetchBusinesses();
    fetchVendors();
    fetchEmployees();
  }, [
    currentPage,
    entriesPerPage,
    selectedBusinessFilter,
    selectedVendorFilter,
    selectedEmployeeFilter,
    selectedExpenseTypeFilter,
    selectedExpenseStatusFilter,
    selectedPaymentStatusFilter,
    selectedDateCreatedFilter,
    selectedDueDateFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
  ]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: entriesPerPage,
        ...(selectedBusinessFilter !== "All" && {
          business: selectedBusinessFilter,
        }),
        ...(selectedVendorFilter !== "All" && { vendor: selectedVendorFilter }),
        ...(selectedEmployeeFilter !== "All" && {
          employee: selectedEmployeeFilter,
        }),
        ...(selectedExpenseTypeFilter !== "All" && {
          expenseType: selectedExpenseTypeFilter,
        }),
        ...(selectedExpenseStatusFilter !== "All" && {
          status: selectedExpenseStatusFilter,
        }),
        ...(selectedPaymentStatusFilter !== "All" && {
          paymentStatus: selectedPaymentStatusFilter,
        }),
        // Prioritize date range picker over individual date filters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        // Date Created filter - filters by createdAt
        ...(!dateRangeStart &&
          selectedDateCreatedFilter && {
            createdDateFrom: selectedDateCreatedFilter,
            createdDateTo: selectedDateCreatedFilter, // Same date for both start and end
          }),
        ...(selectedDueDateFilter && { dateTo: selectedDueDateFilter }),
        ...(searchTerm && { search: searchTerm }),
      };

      console.log("🔍 API Request params:", params);

      const response = await axios.get(`${Base_URL}/expenses`, {
        params,
        headers,
      });

      if (response.data.success) {
        setExpenses(response.data.data);
        setTotalPages(response.data.pagination.pages);
        console.log("response.data.stats", response.data.stats);
        setOverallStats(response.data.stats || {});
      }
    } catch (error) {
      console.error("Error fetching expenses:", error);
      notifyError("Failed to load expenses");
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

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${Base_URL}/vendors`, { headers });
      console.log("🔍 Vendors API response:", response.data);
      setVendors(response.data.data || response.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management`, {
        headers,
        params: { limit: 1000 },
      });
      console.log("🔍 Employees API response:", response.data);
      const employeeData = response.data.staffList || response.data.data || [];
      console.log("🔍 Setting employees data:", employeeData);
      setEmployees(employeeData);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    // Clear individual date filters when date range is applied
    setSelectedDateCreatedFilter("");
    setSelectedDueDateFilter("");
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: "bg-gray-100 text-gray-800",
      Created: "bg-blue-100 text-blue-800",
      "Approved by Management": "bg-green-100 text-green-800",
      "Make Transaction": "bg-yellow-100 text-yellow-800",
      "Approve Transaction": "bg-purple-100 text-purple-800",
      Cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getExpenseTypeColor = (type) => {
    const colors = {
      staff_claims: "bg-purple-100 text-purple-800",
      bills: "bg-blue-100 text-blue-800",
      rents: "bg-green-100 text-green-800",
      non_trading_invoices: "bg-orange-100 text-orange-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getExpenseTypeLabel = (type) => {
    const labels = {
      staff_claims: "Staff Claims",
      bills: "Bills",
      rents: "Rents",
      non_trading_invoices: "Non-trading Invoices",
    };
    return labels[type] || type;
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
    history.push(`/update-expense/${id}`);
  };

  const handleView = (id) => {
    history.push(`/view-expense/${id}`);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      const response = await axios.delete(`${Base_URL}/expenses/${id}`, {
        headers,
      });

      if (response.data.success) {
        notifySuccess("Expense deleted successfully");
        fetchExpenses();
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      notifyError(error.response?.data?.error || "Failed to delete expense");
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);

      // Fetch all expenses with current filters
      const params = {
        businessId:
          selectedBusinessFilter !== "All" ? selectedBusinessFilter : undefined,
        vendorId:
          selectedVendorFilter !== "All" ? selectedVendorFilter : undefined,
        employeeId:
          selectedEmployeeFilter !== "All" ? selectedEmployeeFilter : undefined,
        expenseType:
          selectedExpenseTypeFilter !== "All"
            ? selectedExpenseTypeFilter
            : undefined,
        status:
          selectedExpenseStatusFilter !== "All"
            ? selectedExpenseStatusFilter
            : undefined,
        paymentStatus:
          selectedPaymentStatusFilter !== "All"
            ? selectedPaymentStatusFilter
            : undefined,
        search: searchTerm,
        page: 1,
        limit: 999999, // Get all records
        // Prioritize date range picker over individual date filters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        // Date Created filter - filters by createdAt
        ...(!dateRangeStart &&
          selectedDateCreatedFilter && {
            createdDateFrom: selectedDateCreatedFilter,
            createdDateTo: selectedDateCreatedFilter,
          }),
        ...(selectedDueDateFilter && { dateTo: selectedDueDateFilter }),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/expenses`, {
        params,
        headers,
      });

      const allExpenses = response.data.data || [];

      if (allExpenses.length === 0) {
        notifyError("No expenses found to export");
        return;
      }

      // Prepare Excel data
      const exportData = allExpenses.map((expense) => ({
        "Expense Number": expense.expenseNumber || "",
        "Vendor Name":
          expense.vendor?.basicInformation?.vendorDisplayName || "",
        "Employee Name":
          expense.employee?.basicInformation?.employeeDisplayName || "",
        "Expense Type": getExpenseTypeLabel(expense.expenseType) || "",
        "Expense Date": expense.expenseDate
          ? formatDate(expense.expenseDate)
          : "",
        "Due Date": expense.dueDate ? formatDate(expense.dueDate) : "",
        Status: expense.status || "",
        // "Sub Total": expense.subTotal || 0,
        Discount: expense.discountAmount || 0,
        // "Shipping Charges": expense.shippingCharges || 0,
        // "Adjustment": expense.adjustment || 0,
        Total: expense.total || 0,
        "Amount Paid": expense.amountPaid || 0,
        "Remaining Amount": expense.remainingAmount || 0,
        Currency: expense.currency || "USD",
        "Payment Status": (() => {
          const totalAmount = parseFloat(expense.grandTotal) || 0;
          const approvedPayments = Array.isArray(expense.payments)
            ? expense.payments.filter((p) => p.status === "Approved")
            : [];
          const paidAmount = approvedPayments.reduce(
            (sum, p) => sum + (parseFloat(p.amount) || 0),
            0
          );
          if (paidAmount === 0) return "Unpaid";
          if (paidAmount < totalAmount) return "Partial Paid";
          return "Paid";
        })(),
        "Expense Account": expense.expenseAccount?.accountName || "",
        Notes: expense.notes || "",
        "Created At": expense.createdAt ? formatDate(expense.createdAt) : "",
        "Updated At": expense.updatedAt ? formatDate(expense.updatedAt) : "",
      }));

      // Create summary rows
      const summaryRows = [
        {
          "Expense Number": `Expenses Report`,
          "Vendor Name": "",
          "Employee Name": "",
          "Expense Type": "",
          "Expense Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          "Shipping Charges": "",
          Adjustment: "",
          "Grand Total": "",
          Currency: "",
          "Payment Status": "",
          "Expense Account": "",
          Description: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Expense Number": `Generated on: ${formatDate(new Date())}`,
          "Vendor Name": "",
          "Employee Name": "",
          "Expense Type": "",
          "Expense Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          "Shipping Charges": "",
          Adjustment: "",
          "Grand Total": "",
          Currency: "",
          "Payment Status": "",
          "Expense Account": "",
          Description: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Expense Number": `Total Expenses: ${allExpenses.length}`,
          "Vendor Name": "",
          "Employee Name": "",
          "Expense Type": "",
          "Expense Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          "Shipping Charges": "",
          Adjustment: "",
          "Grand Total": "",
          Currency: "",
          "Payment Status": "",
          "Expense Account": "",
          Description: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Expense Number": `Total Value: ${formatAmount(
            allExpenses.reduce((sum, exp) => sum + (exp.grandTotal || 0), 0)
          )}`,
          "Vendor Name": "",
          "Employee Name": "",
          "Expense Type": "",
          "Expense Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          "Shipping Charges": "",
          Adjustment: "",
          "Grand Total": "",
          Currency: "",
          "Payment Status": "",
          "Expense Account": "",
          Description: "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Expense Number": "",
          "Vendor Name": "",
          "Employee Name": "",
          "Expense Type": "",
          "Expense Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          "Shipping Charges": "",
          Adjustment: "",
          "Grand Total": "",
          Currency: "",
          "Payment Status": "",
          "Expense Account": "",
          Description: "",
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
      XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

      // Generate filename
      const filename = `Expenses_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess("Expenses exported to Excel successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      notifyError("Failed to export expenses to Excel. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  console.log("🔍 Current state:", {
    vendors: vendors.length,
    employees: employees.length,
    expenses: expenses.length,
  });

  console.log(
    "🔍 Vendor filter options:",
    vendors.map((v) => ({
      id: v._id,
      name: v.basicInformation?.vendorDisplayName || v.name,
    }))
  );

  console.log(
    "🔍 Employee filter options:",
    employees.map((e) => ({
      id: e._id,
      name: e.displayName || e.fullName,
    }))
  );

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedBusinessFilter("All");
    setSelectedVendorFilter("All");
    setSelectedEmployeeFilter("All");
    setSelectedExpenseTypeFilter("All");
    setSelectedExpenseStatusFilter("All");
    setSelectedPaymentStatusFilter("All");
    setSelectedDateCreatedFilter("");
    setSelectedDueDateFilter("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // State for documents modal
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  const handleViewDocuments = (documents) => {
    if (documents && documents.length > 0) {
      setSelectedDocuments(documents);
      setShowDocumentsModal(true);
    }
  };

  // Filter configuration
  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
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
      label: "Vendor",
      value: selectedVendorFilter,
      onChange: setSelectedVendorFilter,
      options: [
        { value: "All", label: "All Vendors" },
        ...vendors.map((v) => ({
          value: v._id,
          label: v.basicInformation?.vendorDisplayName || v.name,
        })),
      ],
      placeholder: "Vendor: All",
      icon: User,
    },
    {
      label: "Employee",
      value: selectedEmployeeFilter,
      onChange: setSelectedEmployeeFilter,
      options: [
        { value: "All", label: "All Employees" },
        ...employees.map((e) => ({
          value: e._id,
          label: e.displayName || e.fullName || "Unknown Employee",
        })),
      ],
      placeholder: "Employee: All",
      icon: Users,
    },
    {
      label: "Expense Type",
      value: selectedExpenseTypeFilter,
      onChange: setSelectedExpenseTypeFilter,
      options: [
        { value: "All", label: "All Types" },
        { value: "staff_claims", label: "Staff Claims" },
        { value: "bills", label: "Bills" },
        { value: "rents", label: "Rents" },
        { value: "non_trading_invoices", label: "Non-trading Invoices" },
      ],
      placeholder: "Expense Type: All",
      icon: Package,
    },
    {
      label: "Expense Status",
      value: selectedExpenseStatusFilter,
      onChange: setSelectedExpenseStatusFilter,
      options: [
        { value: "All", label: "Status" },
        { value: "Draft", label: "Draft" },
        { value: "Created", label: "Created" },
        { value: "Approved by Management", label: "Approved by Management" },
        { value: "Make Transaction", label: "Make Transaction" },
        { value: "Approve Transaction", label: "Approve Transaction" },
        { value: "Cancelled", label: "Cancelled" },
        // Add payment status options for filtering
        { value: "Paid", label: "Paid" },
        { value: "Unpaid", label: "Unpaid" },
        { value: "Partial Paid", label: "Partial Paid" },
      ],
      placeholder: "Status: All",
      icon: FileText,
    },
    {
      label: "Payment Status",
      value: selectedPaymentStatusFilter,
      onChange: setSelectedPaymentStatusFilter,
      options: [
        { value: "All", label: "All Payments" },
        { value: "unpaid", label: "Unpaid" },
        { value: "partial", label: "Partial Paid" },
        { value: "paid", label: "Paid" },
      ],
      placeholder: "Payment Status: All",
      icon: DollarSign,
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

  // Summary cards data
  const summaryCardsData = [
    {
      title: "Total Expenses",
      value: overallStats.totalExpenses,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Approve Transaction",
      value: overallStats.approveTransaction,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Pending Approval",
      value: overallStats.pendingApproval,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Total Value",
      value: `$${formatAmount(overallStats.totalValue)}`,
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
              <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
              <p className="text-gray-600 mt-2">
                Manage and track all business expenses
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
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExcelIcon size={18} />
                {loading ? "Exporting..." : "Export"}
              </button>
              <button
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors shadow-sm"
                onClick={() => history.push("/create-expense")}
              >
                <Plus size={20} />
                Create Expense
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
            searchPlaceholder="Search"
            headers={[
              "Expense No",
              "Vendor/Employee",
              "Type & Status",
              "Dates",
              "Amount",
              "Expense Account",
              "Documents",
              "Actions",
            ]}
            data={expenses}
            loading={loading}
            renderRow={(expense) => (
              <tr
                key={expense._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Expense Details */}
                <td className="py-4 px-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      #{expense.expenseNumber}
                    </p>
                    {expense.reference && (
                      <p className="text-sm text-gray-500">
                        Ref: {expense.reference}
                      </p>
                    )}
                  </div>
                </td>
                {/* Vendor/Employee */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {expense.expenseType === "staff_claims" ? (
                        <Users size={16} className="text-gray-600" />
                      ) : (
                        <User size={16} className="text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 truncate">
                        {expense.expenseType === "staff_claims"
                          ? expense.employee?.displayName ||
                            `${expense.employee?.personalInfo?.firstName} ${expense.employee?.personalInfo?.lastName}`
                          : expense?.vendor?.basicInformation?.companyName ||
                            expense.vendor?.basicInformation
                              ?.vendorDisplayName ||
                            "N/A"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {expense.expenseType === "staff_claims"
                          ? "Employee"
                          : "Vendor"}
                      </p>
                    </div>
                  </div>
                </td>
                {/* Type & Status */}
                <td className="py-4 px-4">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getExpenseTypeColor(
                        expense.expenseType
                      )}`}
                    >
                      {getExpenseTypeLabel(expense.expenseType)}
                    </span>
                    <br />
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        expense.status
                      )}`}
                    >
                      {expense.status}
                    </span>
                    {/* Payment Status Badge */}
                    {(() => {
                      const totalAmount = parseFloat(expense.total) || 0;
                      // Calculate paid amount from approved payments only
                      const approvedPayments = Array.isArray(expense.payments)
                        ? expense.payments.filter(
                            (p) => p.status === "Approved"
                          )
                        : [];
                      const paidAmount = approvedPayments.reduce(
                        (sum, p) => sum + (parseFloat(p.amount) || 0),
                        0
                      );
                      const remainingAmount = totalAmount - paidAmount;
                      if (paidAmount === 0) {
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                              <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                              Unpaid
                            </span>
                          </div>
                        );
                      } else if (paidAmount < totalAmount) {
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                              Partial Paid
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {expense.currency} {formatAmount(paidAmount)} /{" "}
                              {expense.currency} {formatAmount(totalAmount)}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                              Paid
                            </span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </td>
                {/* Dates */}
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(expense.expenseDate)}
                      </p>
                      <p className="text-xs text-gray-500">Expense Date</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {formatDate(expense.dueDate)}
                      </p>
                      <p className="text-xs text-gray-500">Due Date</p>
                    </div>
                  </div>
                </td>
                {/* Amount */}
                <td className="py-4 px-4 text-left">
                  <div className="text-left">
                    <p className="text-lg font-bold text-gray-900">
                      {expense.currency} {formatAmount(expense.total)}
                    </p>
                    {expense.items?.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {expense.items.length} item
                        {expense.items.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </td>
                {/* Expense Account */}
                <td className="py-4 px-4">
                  <div>
                    {expense.expenseAccount ? (
                      <div>
                        <p className="font-medium text-gray-900">
                          {expense.expenseAccount.code || "N/A"} -{" "}
                          {expense.expenseAccount.accountName ||
                            "Unknown Account"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {expense.expenseAccount.accountType?.name ||
                            expense.expenseAccount.accountType?.accountHeader ||
                            ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">
                        No account specified
                      </span>
                    )}
                  </div>
                </td>
                {/* Documents */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    {expense.documents?.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <FileText
                            size={16}
                            className="text-[var(--p-blue)]"
                          />
                          <span className="text-sm text-gray-600">
                            {expense.documents.length} file
                            {expense.documents.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => handleViewDocuments(expense.documents)}
                          className="text-[var(--p-blue)] hover:text-[#9CBA33] p-1"
                          title="View Documents"
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
                      onClick={() => handleView(expense._id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(expense._id)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    {(expense.status === "Draft" ||
                      expense.status === "Cancelled") && (
                      <button
                        onClick={() => handleDelete(expense._id)}
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

      {/* Documents Modal */}
      {showDocumentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Supporting Documents ({selectedDocuments.length})
              </h2>
              <button
                onClick={() => {
                  setShowDocumentsModal(false);
                  setSelectedDocuments([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-8 w-8 text-[var(--p-blue)] flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-medium text-gray-900 truncate"
                          title={doc.name}
                        >
                          {doc.name}
                        </h3>
                        {doc.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {doc.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {doc.uploadedAt && (
                            <span>Uploaded: {formatDate(doc.uploadedAt)}</span>
                          )}
                          {doc.size && (
                            <span>
                              Size: {(doc.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleOpenFile(doc.fileId)}
                            className="px-3 py-1.5 bg-[var(--p-blue)] text-white rounded-md text-sm hover:bg-[#9CBA33] transition-colors flex items-center gap-1"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
