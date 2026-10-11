import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import {
  Eye,
  PenSquare,
  Plus,
  ChevronDown,
  Package,
  Truck,
  FileText,
  DollarSign,
} from "lucide-react";
import {
  AddButton,
  DataCard,
  PageHeader,
} from "../headercomponents/StyledComponents";
import { notifyError } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ExpensesTable = ({ Data }) => {
  // State for all data
  const [allVendorInvoices, setAllVendorInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [showDropdown, setShowDropdown] = useState(false);
  const [existingInvoiceTypes, setExistingInvoiceTypes] = useState([]);
  const history = useHistory();

  // Combined state for all data
  const [allData, setAllData] = useState([]);

  console.log("Purchase Contract Data", Data);

  // Fetch all data for this purchase contract
  useEffect(() => {
    if (Data?._id) {
      fetchAllData();
    }
  }, [Data?._id, currentPage, entriesPerPage, searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".relative")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const fetchAllData = async () => {
    console.log("Data contractNo", Data?.contractNo);
    setLoading(true);
    try {
      // Fetch vendor invoices and expenses in parallel
      const [vendorInvoicesResponse, expensesResponse] = await Promise.all([
        axios.get(`${Base_URL}/vendor-invoices`, {
          params: {
            contract: Data?.contractNo,
            // Remove business filter to get all invoices for this contract regardless of business
            page: currentPage,
            limit: entriesPerPage,
            search: searchTerm,
          },
        }),
        axios.get(`${Base_URL}/expenses`, {
          params: {
            contractNumber: Data?.contractNo,
            contractId: Data?._id,
            contractType: "purchase",
            business: Data.business,
            page: currentPage,
            limit: entriesPerPage,
            search: searchTerm,
          },
        }),
      ]);

      const allInvoices = vendorInvoicesResponse.data.data || [];
      const allExpenses = expensesResponse.data.data || [];

      setAllVendorInvoices(allInvoices);
      setExpenses(allExpenses);

      // Filter expenses by contract
      const contractExpenses = allExpenses.filter((expense) =>
        expense.items?.some(
          (item) =>
            item.contractId?.toString() === Data._id.toString() ||
            item.contractNumber === Data.contractNo
        )
      );

      // Combine all data with type information
      const combinedData = [
        // Add invoices with type information
        ...allInvoices.map((invoice) => ({
          ...invoice,
          recordType: "invoice",
          type:
            invoice.invoiceType === "commission"
              ? "Commission Agent Invoice"
              : invoice.invoiceType === "logistic"
              ? "Logistic Service Provider Invoice"
              : invoice.vendor?.basicInformation?.vendorType === "Supplier"
              ? "Supplier Invoice"
              : invoice.vendor?.basicInformation?.vendorType ===
                "Logistic Service Provider"
              ? "Logistics Invoice"
              : "Vendor Invoice",
          sortDate: new Date(invoice.createdAt),
        })),
        // Add expenses with type information
        ...contractExpenses.map((expense) => ({
          ...expense,
          recordType: "expense",
          type:
            expense.expenseType === "staff_claims"
              ? "Staff Claims"
              : expense.expenseType === "bills"
              ? "Bills"
              : expense.expenseType === "rents"
              ? "Rents"
              : "Other Expense",
          sortDate: new Date(expense.createdAt),
        })),
      ];

      // Sort by date (latest first)
      combinedData.sort((a, b) => b.sortDate - a.sortDate);

      setAllData(combinedData);

      // Track existing invoice types to prevent duplicates
      const existingTypes = allInvoices.map((invoice) => invoice.invoiceType);
      setExistingInvoiceTypes([...new Set(existingTypes)]);

      setTotalPages(vendorInvoicesResponse.data.totalPages || 1);
    } catch (error) {
      console.error("Error fetching data:", error);
      notifyError("Failed to fetch expenses data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Draft":
        return "text-gray-500 bg-gray-100 border-gray-200";
      case "Created":
        return "text-blue-500 bg-blue-100 border-blue-200";
      case "Approved by Management":
        return "text-yellow-600 bg-yellow-100 border-yellow-200";
      case "Make Transaction":
        return "text-orange-500 bg-orange-100 border-orange-200";
      case "Approve Transaction":
        return "text-green-500 bg-green-100 border-green-200";
      default:
        return "text-gray-500 bg-gray-100 border-gray-200";
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "Commission Agent Invoice":
        return "bg-purple-100 text-purple-800";
      case "Supplier Invoice":
        return "bg-blue-100 text-blue-800";
      case "Logistics Invoice":
        return "bg-green-100 text-green-800";
      case "Logistic Service Provider Invoice":
        return "bg-indigo-100 text-indigo-800";
      case "Staff Claims":
        return "bg-orange-100 text-orange-800";
      case "Bills":
        return "bg-yellow-100 text-yellow-800";
      case "Rents":
        return "bg-indigo-100 text-indigo-800";
      case "Other Expense":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Determine contract type based on data structure
  const getContractType = () => {
    return Data.basicInfo?.typeOfSaleContract ? "sales" : "purchase";
  };

  // Get available invoice types based on contract type
  const getAvailableInvoiceTypes = () => {
    const contractType = getContractType();
    const baseTypes = [];

    if (contractType === "purchase") {
      baseTypes.push(
        {
          value: "supplier",
          label: "Supplier Invoice",
          disabled: existingInvoiceTypes.includes("supplier"),
        },
        {
          value: "commission",
          label: "Commission Agent Invoice",
          disabled: existingInvoiceTypes.includes("commission"),
        },
        {
          value: "logistic",
          label: "Logistic Service Provider Invoice",
          disabled: existingInvoiceTypes.includes("logistic"),
        }
      );
    } else {
      // Sales contract can only create commission invoices
      baseTypes.push({
        value: "commission",
        label: "Commission Agent Invoice",
        disabled: existingInvoiceTypes.includes("commission"),
      });
    }

    return baseTypes;
  };

  const handleInvoiceTypeSelection = (invoiceType) => {
    const contractType = getContractType();
    const queryParams = new URLSearchParams({
      contractId: Data._id,
      contractType: contractType,
      businessId: Data.business,
      vendorId:
        invoiceType === "commission"
          ? Data.basicInfo?.agent_id || ""
          : Data.basicInfo?.selectedVendorId?._id || "",
      invoiceType: invoiceType,
    }).toString();

    history.push(`/create-vendor-invoice?${queryParams}`);
    setShowDropdown(false);
  };

  const handleAddNew = () => {
    const availableTypes = getAvailableInvoiceTypes();
    const enabledTypes = availableTypes.filter((type) => !type.disabled);

    if (enabledTypes.length === 1) {
      // If only one type is available, go directly
      handleInvoiceTypeSelection(enabledTypes[0].value);
    } else if (enabledTypes.length > 1) {
      // Show dropdown if multiple types are available
      setShowDropdown(!showDropdown);
    } else {
      // No types available
      notifyError(
        "All invoice types have already been created for this contract."
      );
    }
  };

  const handleViewInvoice = (invoiceId) => {
    history.push(`/view-vendor-invoice/${invoiceId}`);
  };

  const handleEditInvoice = (invoiceId) => {
    history.push(`/update-vendor-invoice/${invoiceId}`);
  };

  const handleViewExpense = (expenseId) => {
    history.push(`/view-expense/${expenseId}`);
  };

  const handleEditExpense = (expenseId) => {
    history.push(`/update-expense/${expenseId}`);
  };

  // Helper function to render unified table
  const renderUnifiedTable = () => (
    <DataCard className="mb-6">
      <PageHeader title="All Expenses & Invoices">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={handleAddNew}
              className="flex items-center bg-[#F2F2F2] text-black text-sm font-medium px-4 py-2 rounded-xl shadow-sm hover:bg-gray-200 transition"
            >
              Add Invoice
              <span className="ml-2 flex items-center justify-center w-6 h-6 bg-[var(--p-blue)] text-white rounded-full">
                {getAvailableInvoiceTypes().filter((type) => !type.disabled)
                  .length > 1 ? (
                  <ChevronDown size={14} />
                ) : (
                  <Plus size={14} />
                )}
              </span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  {getAvailableInvoiceTypes().map((type) => (
                    <button
                      key={type.value}
                      onClick={() =>
                        !type.disabled && handleInvoiceTypeSelection(type.value)
                      }
                      disabled={type.disabled}
                      className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                        type.disabled
                          ? "text-gray-400 cursor-not-allowed bg-gray-50"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                      }`}
                    >
                      {type.label}
                      {type.disabled && (
                        <span className="text-xs text-gray-400 block">
                          Already created
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="overflow-x-auto">
        <DataTable
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
          searchPlaceholder="Search all records..."
          headers={[
            "Number",
            "Vendor/Employee",
            "Type",
            "Amount",
            "Date Created",
            "Status",
            "Actions",
          ]}
          data={allData}
          loading={loading}
          colWidths={{
            Number: "minmax(120px, 1fr)",
            "Vendor/Employee": "minmax(150px, 2fr)",
            Type: "minmax(140px, 1fr)",
            Amount: "minmax(100px, 1fr)",
            "Date Created": "minmax(120px, 1fr)",
            Status: "minmax(100px, 1fr)",
            Actions: "minmax(80px, 0.5fr)",
          }}
          renderRow={(record) => (
            <tr
              key={record._id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-4 px-4 font-medium text-gray-900">
                {record.recordType === "invoice"
                  ? record.invoiceNumber
                  : record.expenseNumber}
              </td>
              <td className="py-4 px-4">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">
                    {record.vendor?.basicInformation?.vendorDisplayName ||
                      record.employee?.displayName ||
                      record.employee?.fullName ||
                      "N/A"}
                  </p>
                  <p className="text-gray-500">
                    {record.recordType === "invoice"
                      ? record.vendor?.basicInformation?.vendorType || "N/A"
                      : record.expenseType === "staff_claims"
                      ? "Employee"
                      : "Vendor"}
                  </p>
                </div>
              </td>
              <td className="py-4 px-4">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(
                    record.type
                  )}`}
                >
                  {record.type}
                </span>
              </td>
              <td className="py-4 px-4 font-medium text-gray-900">
                {formatAmount(record.total)}
              </td>
              <td className="py-4 px-4 text-gray-600">
                {formatDate(record.createdAt)}
              </td>
              <td className="py-4 px-4">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    record.status
                  )}`}
                >
                  {record.status}
                </span>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      record.recordType === "invoice"
                        ? handleViewInvoice(record._id)
                        : handleViewExpense(record._id)
                    }
                    className="p-1 text-gray-500 hover:text-[var(--p-blue)] transition-colors"
                    title={
                      record.recordType === "invoice"
                        ? "View Invoice"
                        : "View Expense"
                    }
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() =>
                      record.recordType === "invoice"
                        ? handleEditInvoice(record._id)
                        : handleEditExpense(record._id)
                    }
                    className="p-1 text-gray-500 hover:text-[var(--p-blue)] transition-colors"
                    title={
                      record.recordType === "invoice"
                        ? "Edit Invoice"
                        : "Edit Expense"
                    }
                  >
                    <PenSquare size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )}
          emptyMessage="No expenses or invoices found for this contract"
        />
      </div>
    </DataCard>
  );

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Unified Table */}
      {renderUnifiedTable()}
    </div>
  );
};

export default ExpensesTable;
