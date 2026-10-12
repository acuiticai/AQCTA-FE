import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { FiEye, FiX, FiDownload, FiFileText } from "react-icons/fi";
import { Link } from "react-router-dom";
import sales from "../../assets/img/icons/Sales.png";
import group from "../../assets/img/icons/Group.png";
import union from "../../assets/img/icons/Union.png";
import AddTransactionButton from "../../components/TreasuryAndFinance/AddTransactionButton";
import DateRangeComponent from "@/page-layouts/components/DateRangeComponent";
import useAsync from "@/hooks/useAsync";
import BankManagementServices from "@/services/BankManagementServices";
import Papa from "papaparse";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { ActionButtons } from "@/page-layouts/index";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  isSingleAssignedBusiness,
  readAssignedBusinessesFallback,
} from "@/utils/sessionAssignedBusinesses";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import { DownloadIcon } from "@/customer/components/ui/icons";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Main Ledger Component
const Ledgers = () => {
  const { data } = useAsync(BankManagementServices.getAllAccounts);

  const bankAccounts = data?.accounts || [];

  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  console.log("current page", currentPage);
  const currentPageRef = useRef(1);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedTransactionType, setSelectedTransactionType] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [businesses, setBusinesses] = useState([]);
  // Pre-existing fetchStats target (overview tiles use transaction response stats)
  const [, setStats] = useState(null);
  const isSingleBusiness = isSingleAssignedBusiness();

  // Fetch transactions based on API filters
  const fetchTransactions = useCallback(
    async (page = currentPage, limit = recordsPerPage) => {
      try {
        setLoading(true);

        // Create API params with all filters
        const apiParams = {
          page: page,
          limit: limit || recordsPerPage,
          ...(searchQuery && { search: searchQuery }),
          ...(selectedBusiness && { business: selectedBusiness }),
          ...(selectedAccount && { account: selectedAccount }),
          ...(selectedTransactionType !== "All" && {
            transactionType: selectedTransactionType,
          }),
          ...(selectedCategory !== "All" && { category: selectedCategory }),
          ...(dateRangeStart && { startDate: dateRangeStart }),
          ...(dateRangeEnd && { endDate: dateRangeEnd }),
          ...(singleDate &&
            !dateRangeStart &&
            !dateRangeEnd && { date: singleDate }),
        };

        // Remove undefined values
        Object.keys(apiParams).forEach(
          (key) => apiParams[key] === undefined && delete apiParams[key]
        );

        const response = await axios.get(
          `${Base_URL}/ledger-management/transactions`,
          { params: apiParams }
        );

        console.log("transactions", response.data);
        const nextTransactions = response.data.transactions || [];
        setFilteredTransactions(nextTransactions);
        setTotalResults(response.data.total || 0);
        setTotalBalance(response.data.stats?.totalBalance || 0);
        setTotalIncome(response.data.stats?.totalIncome || 0);
        setTotalExpense(response.data.stats?.totalExpense || 0);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
        setLoading(false);
      }
    },
    [
      searchQuery,
      selectedBusiness,
      selectedAccount,
      selectedTransactionType,
      selectedCategory,
      dateRangeStart,
      dateRangeEnd,
      singleDate,
      currentPage,
      recordsPerPage,
    ]
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    // fetchTransactions will be called by useEffect when currentPage changes
  };

  // Fetch transactions when filters change
  useEffect(() => {
    fetchTransactions(currentPage, recordsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    selectedBusiness,
    selectedAccount,
    selectedTransactionType,
    selectedCategory,
    dateRangeStart,
    dateRangeEnd,
    singleDate,
    currentPage,
    recordsPerPage,
  ]);

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    try {
      // Create API params for stats with date range
      const apiParams = {};

      if (dateRangeStart || dateRangeEnd) {
        if (dateRangeStart) apiParams.startDate = dateRangeStart;
        if (dateRangeEnd) apiParams.endDate = dateRangeEnd;
      }

      if (selectedBusiness) {
        apiParams.business = selectedBusiness;
      }

      const response = await axios.get(`${Base_URL}/ledgers/stats`, {
        params: apiParams,
      });
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [dateRangeStart, dateRangeEnd, selectedBusiness]);

  // Handle date range apply
  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setSingleDate(""); // Clear single date when range is set
    setCurrentPage(1);
  };

  // Handle date range clear
  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  // Initial data fetching
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Load assigned businesses and auto-select when only one
  useEffect(() => {
    const list = readAssignedBusinessesFallback();
    setBusinesses(list);
    if (list.length === 1) {
      setSelectedBusiness(String(list[0]._id));
    }
  }, []);
  console.log("selectedTransaction", selectedTransaction);

  const handleViewTransaction = async (reference) => {
    try {
      const response = await axios.get(
        `${Base_URL}/ledger-management/transaction/${reference}`
      );
      setSelectedTransaction(response.data);
    } catch (error) {
      console.error("Failed to fetch transaction details:", error);
    }
  };

  const handleFilterChange = (name, value) => {
    setCurrentPage(1); // Reset to first page on filter change
    if (name === "transactionType") {
      setSelectedTransactionType(value);
    } else if (name === "category") {
      setSelectedCategory(value);
    } else if (name === "business") {
      setSelectedBusiness(value);
    } else if (name === "account") {
      setSelectedAccount(value);
    } else if (name === "search") {
      setSearchQuery(value);
    }
  };

  const closeTransactionDetails = () => {
    setSelectedTransaction(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("statement", file);

    try {
      await axios.post(`${Base_URL}/ledgers/upload-statement`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      fetchTransactions();
      fetchStats();
    } catch (error) {
      console.error("Failed to upload bank statement:", error);
    }
  };

  // Function to get file extension from filename
  const getFileExtension = (filename) => {
    return filename.split(".").pop().toUpperCase();
  };

  // Function to get color for file type
  const getFileColor = (extension) => {
    const colors = {
      PDF: "bg-red-500",
      DOC: "bg-blue-500",
      DOCX: "bg-blue-500",
      XLS: "bg-green-500",
      XLSX: "bg-green-500",
      JPG: "bg-purple-500",
      JPEG: "bg-purple-500",
      PNG: "bg-purple-500",
    };
    return colors[extension] || "bg-gray-500";
  };

  // Function to download document
  const handleDownloadDocument = async (doc) => {
    try {
      const response = await axios.get(`${Base_URL}/documents/${doc.id}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", doc.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Failed to download document:", error);
    }
  };

  // Function to view document
  const handleViewDocument = async (doc) => {
    try {
      const response = await axios.get(`${Base_URL}/documents/${doc.id}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      setViewingDocument({
        ...doc,
        url,
      });
    } catch (error) {
      console.error("Failed to view document:", error);
    }
  };

  // Function to close document viewer
  const closeDocumentViewer = () => {
    if (viewingDocument && viewingDocument.url) {
      window.URL.revokeObjectURL(viewingDocument.url);
    }
    setViewingDocument(null);
  };

  const handleTransactionTypeChange = (input) => {
    setSelectedTransactionType(input);
    setCurrentPage(1);
  };

  const handleAccountChange = (input) => {
    setSelectedAccount(input);
    setCurrentPage(1);
  };

  const handleBusinessChange = (input) => {
    setSelectedBusiness(input);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    if (!isSingleBusiness) {
      setSelectedBusiness("");
    } else if (businesses.length === 1) {
      setSelectedBusiness(String(businesses[0]._id));
    }
    setSelectedAccount("");
    setSelectedTransactionType("All");
    setSelectedCategory("All");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSingleDate("");
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      setLoading(true);

      // Fetch all records with current filters (no pagination)
      const apiParams = {
        page: 1,
        limit: 999999, // Very large limit to get all records
        ...(searchQuery && { search: searchQuery }),
        ...(selectedBusiness && { business: selectedBusiness }),
        ...(selectedAccount && { account: selectedAccount }),
        ...(selectedTransactionType !== "All" && {
          transactionType: selectedTransactionType,
        }),
        ...(selectedCategory !== "All" && { category: selectedCategory }),
        ...(dateRangeStart && { startDate: dateRangeStart }),
        ...(dateRangeEnd && { endDate: dateRangeEnd }),
        ...(singleDate &&
          !dateRangeStart &&
          !dateRangeEnd && { date: singleDate }),
      };

      // Remove undefined values
      Object.keys(apiParams).forEach(
        (key) => apiParams[key] === undefined && delete apiParams[key]
      );

      const response = await axios.get(
        `${Base_URL}/ledger-management/transactions`,
        { params: apiParams }
      );

      const allTransactions = response.data.transactions || [];

      if (allTransactions.length === 0) {
        notifyError("No transactions found to export");
        setLoading(false);
        return;
      }

      // Create a map of bank account IDs to names for quick lookup
      const bankAccountMap = {};
      bankAccounts.forEach((account) => {
        bankAccountMap[account._id] = account.accountName;
      });

      const exportData = allTransactions.map((transaction) => {
        // Get bank account name from populated object or from map
        let bankAccountName = "";
        if (transaction.bankAccountId) {
          if (
            typeof transaction.bankAccountId === "object" &&
            transaction.bankAccountId.accountName
          ) {
            bankAccountName = transaction.bankAccountId.accountName;
          } else if (typeof transaction.bankAccountId === "string") {
            bankAccountName =
              bankAccountMap[transaction.bankAccountId] ||
              transaction.bankAccountId;
          } else if (transaction.bankAccountId._id) {
            bankAccountName =
              bankAccountMap[transaction.bankAccountId._id] ||
              transaction.bankAccountId._id;
          }
        }

        return {
          Date: formatDate(transaction.date),
          "Reference #": transaction.reference || "",
          Description: transaction.description || "",
          Type: transaction.type || "",
          Amount: transaction.amount || 0,
          Currency: transaction.currency || "USD",
          Category: transaction.category || "",
          "Bank Account": bankAccountName,
          Status: transaction.status || "",
          "Created At": transaction.createdAt
            ? formatDate(transaction.createdAt)
            : "",
        };
      });

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Ledgers_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      notifySuccess("Ledgers exported successfully");
      setLoading(false);
    } catch (error) {
      console.error("Failed to export:", error);
      notifyError("Failed to export ledgers");
      setLoading(false);
    }
  };

  const handleRecordsPerPageChange = (value) => {
    setCurrentPage(1);
    setRecordsPerPage(value);
    // fetchTransactions will be called by useEffect when recordsPerPage changes
  };

  const columns = [
    {
      key: "date",
      header: "Date",
      render: (row) => formatDate(row.date),
    },
    {
      key: "reference",
      header: "Reference #",
      render: (row) => (
        <button
          type="button"
          className="epc-cell__link"
          onClick={() => handleViewTransaction(row.reference)}
        >
          {row.reference || "—"}
        </button>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="epc-cell__primary">{row.description || "—"}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <span
          className={
            row.type === "Income" || row.type === "Inflow"
              ? "epc-cell__primary"
              : "epc-cell__secondary"
          }
        >
          {row.type || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => (
        <span className="epc-cell__primary">{formatAmount(row.amount)}</span>
      ),
    },
    {
      key: "currency",
      header: "Currency",
      render: (row) => row.currency || "USD",
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (row) => (
        <ActionButtons
          maxVisibleActions={1}
          items={[
            {
              action: ACTION_BUTTON_TYPES.VIEW,
              title: "View transaction",
              onClick: () => handleViewTransaction(row.reference),
            },
          ]}
        />
      ),
    },
  ];

  const portalFilters = [
    {
      key: "transactionType",
      placeholder: "Transaction Type: All",
      options: [
        { value: "", label: "Transaction Type: All" },
        { value: "Income", label: "Income" },
        { value: "Expense", label: "Expense" },
        { value: "Inflow", label: "Inflow" },
        { value: "Outflow", label: "Outflow" },
      ],
    },
    {
      key: "category",
      placeholder: "Category: All",
      options: [
        { value: "", label: "Category: All" },
        { value: "Sales", label: "Sales" },
        { value: "Services", label: "Services" },
        { value: "Supplies", label: "Supplies" },
        { value: "Utilities", label: "Utilities" },
        { value: "Rent", label: "Rent" },
        { value: "Vendor Payments", label: "Vendor Payments" },
      ],
    },
    ...(!isSingleBusiness
      ? [
          {
            key: "business",
            placeholder: "Business: All",
            options: [
              { value: "", label: "Business: All" },
              ...(businesses?.map((business) => ({
                value: business._id,
                label: business.name,
              })) || []),
            ],
          },
        ]
      : []),
    {
      key: "account",
      placeholder: "Account: All",
      options: [
        { value: "", label: "Account: All" },
        ...(bankAccounts?.map((account) => ({
          value: account._id,
          label: account.accountName,
        })) || []),
      ],
    },
  ];

  const portalFilterValues = {
    transactionType:
      selectedTransactionType === "All" ? "" : selectedTransactionType,
    category: selectedCategory === "All" ? "" : selectedCategory,
    business: selectedBusiness || "",
    account: selectedAccount || "",
  };

  const handlePortalFilterChange = (key, value) => {
    if (key === "transactionType") {
      handleTransactionTypeChange(value || "All");
      return;
    }
    if (key === "category") {
      handleFilterChange("category", value || "All");
      return;
    }
    if (key === "business") {
      handleBusinessChange(value || "");
      return;
    }
    if (key === "account") {
      handleAccountChange(value || "");
    }
  };

  return (
    <EpcPage
      title="Ledgers"
      subtitle="Review ledger transactions across bank accounts."
      action={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={loading}
          >
            <DownloadIcon size={15} />
            Export
          </Button>
          <input
            type="file"
            id="uploadBankStatement"
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
          />
          <AddTransactionButton />
        </div>
      }
    >
      <div className="epc-stack">
        {/* Date range kept above table content (complex filter) */}
        <div className="flex flex-wrap gap-2">
          <DateRangeComponent
            startDate={dateRangeStart}
            endDate={dateRangeEnd}
            onApply={handleDateRangeApply}
            onClear={handleDateRangeClear}
          />
        </div>

        {/* Overview Stats */}
        <div className="mb-2 bg-[#F9F9FA] rounded-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#f8f8e1] rounded-lg p-6">
              <div className="bg-[var(--p-blue)] w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <img src={sales} alt="sales" className="h-6" />
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-2">
                {formatAmount(totalBalance)}
              </div>
              <div className="text-[#425166]">Total Balance</div>
            </div>
            <div className="bg-[#DCFCE7] rounded-lg p-6">
              <div className="bg-[#3CD856] w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <img src={group} alt="group" className="h-6" />
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-2">
                {formatAmount(totalIncome)}
              </div>
              <div className="text-[#425166]">Total Income</div>
            </div>
            <div className="bg-[#FFF4DE] rounded-lg p-6">
              <div className="bg-[#FF947A] w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <img src={union} alt="union" className="h-6" />
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-2">
                {formatAmount(totalExpense)}
              </div>
              <div className="text-[#425166]">Total Expense</div>
            </div>
          </div>
        </div>

        <FilterBar
          subtitle="Narrow by type, category, business, account or search."
          searchPlaceholder="Search ledgers…"
          searchValue={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          values={portalFilterValues}
          onChange={handlePortalFilterChange}
          onReset={clearAllFilters}
          filters={portalFilters}
        />

        <Card>
          <CardHeader
            title="All Ledgers"
            subtitle={
              loading ? "Loading…" : `${totalResults} total transactions`
            }
          />

          <PortalDataTable
            columns={columns}
            rows={loading ? [] : filteredTransactions}
            rowKey={(row) => row._id || row.reference}
            emptyMessage={
              loading ? "Loading transactions…" : "No transactions found"
            }
          />
          {!loading && totalResults > 0 ? (
            <Pagination
              page={currentPage}
              pageSize={recordsPerPage}
              total={totalResults}
              itemLabel="transactions"
              onPageChange={handlePageChange}
              onPageSizeChange={handleRecordsPerPageChange}
            />
          ) : null}
        </Card>
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={closeTransactionDetails}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Transaction Details
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Reference # {selectedTransaction.reference}
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] rounded-full p-1 transition-colors"
                onClick={closeTransactionDetails}
                aria-label="Close"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="space-y-6">
                {/* Basic Transaction Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        Transaction Type
                      </p>
                      <p className="font-medium text-gray-900">
                        <span
                          className={`${
                            selectedTransaction.type === "Income" ||
                            selectedTransaction.type === "Inflow"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {selectedTransaction.type}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Amount</p>
                      <p className="font-medium text-gray-900">
                        {formatAmount(selectedTransaction.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Currency</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.currency || "USD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Date</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(
                          selectedTransaction.date.includes("/")
                            ? selectedTransaction.date
                                .split("/")
                                .reverse()
                                .join("-")
                            : selectedTransaction.date
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <p className="font-medium text-green-600">
                        {selectedTransaction.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Bank Account</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.bankAccountId?.accountName || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description and Category */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Description & Category
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Description</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.description || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Category</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.category || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Related Entities */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Related Entities
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Customer</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.customerId?.basicInformation
                          ?.primaryContact?.firstName &&
                        selectedTransaction.customerId?.basicInformation
                          ?.primaryContact?.lastName
                          ? `${selectedTransaction.customerId.basicInformation.primaryContact.firstName} ${selectedTransaction.customerId.basicInformation.primaryContact.lastName}`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Vendor</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.vendorId?.basicInformation
                          ?.primaryContact?.firstName &&
                        selectedTransaction.vendorId?.basicInformation
                          ?.primaryContact?.lastName
                          ? `${selectedTransaction.vendorId.basicInformation.primaryContact.firstName} ${selectedTransaction.vendorId.basicInformation.primaryContact.lastName}`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Staff</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction?.staffId?.displayName || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Related Contracts & Invoices */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Related Contracts & Invoices
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        Sales Contract
                      </p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction?.salesContractId?.contractNo ||
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        Purchase Contract
                      </p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction?.purchaseContractId?.contractNo ||
                          "-"}
                      </p>
                    </div>
                    {selectedTransaction?.vendorInvoiceId && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          Vendor Invoice
                        </p>
                        <p className="font-medium text-gray-900">
                          {selectedTransaction?.vendorInvoiceId?._id ? (
                            <Link
                              to={`/view-vendor-invoice/${selectedTransaction.vendorInvoiceId._id}`}
                              className="text-[var(--p-blue)] hover:underline"
                            >
                              {selectedTransaction.vendorInvoiceId
                                .invoiceNumber || "View invoice"}
                            </Link>
                          ) : (
                            selectedTransaction?.vendorInvoiceId
                              ?.invoiceNumber || "-"
                          )}
                        </p>
                      </div>
                    )}
                    {selectedTransaction?.chequeId && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Cheque</p>
                        <p className="font-medium text-gray-900">
                          {selectedTransaction.chequeId._id ? (
                            <Link
                              to={`/Cheques/${selectedTransaction.chequeId._id}`}
                              className="text-[var(--p-blue)] hover:underline"
                            >
                              {selectedTransaction.chequeId.chequeNumber ||
                                "View cheque"}
                              {selectedTransaction.chequeId.status
                                ? ` (${selectedTransaction.chequeId.status})`
                                : ""}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Support Documents */}
                {selectedTransaction.documents &&
                  selectedTransaction.documents.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Support Documents
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {selectedTransaction.documents.map((doc, index) => {
                          const fileExt = getFileExtension(doc.name);
                          const colorClass = getFileColor(fileExt);

                          return (
                            <div
                              key={index}
                              className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between min-w-[200px] hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center flex-1 min-w-0">
                                <div
                                  className={`h-10 w-10 ${colorClass} rounded-lg flex items-center justify-center text-white text-xs mr-3 flex-shrink-0`}
                                >
                                  {fileExt}
                                </div>
                                <span className="text-sm text-gray-900 truncate">
                                  {doc.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                <button
                                  className="text-gray-500 hover:text-gray-700 p-1 rounded transition-colors"
                                  onClick={() => handleViewDocument(doc)}
                                  title="View document"
                                >
                                  <FiEye size={18} />
                                </button>
                                <button
                                  className="text-gray-500 hover:text-gray-700 p-1 rounded transition-colors"
                                  onClick={() => handleDownloadDocument(doc)}
                                  title="Download document"
                                >
                                  <FiDownload size={18} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end p-6 pt-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeTransactionDetails}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-medium flex items-center">
                <FiFileText className="mr-2" />
                {viewingDocument.name}
              </h3>
              <div className="flex items-center">
                <button
                  className="text-gray-600 hover:text-gray-900 mr-4 flex items-center"
                  onClick={() => handleDownloadDocument(viewingDocument)}
                >
                  <FiDownload className="mr-1" />
                  Download
                </button>
                <button
                  className="text-gray-600 hover:text-gray-900"
                  onClick={closeDocumentViewer}
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>
            <div className="flex-grow overflow-auto p-4 bg-gray-100">
              {/* Render different file types accordingly */}
              {viewingDocument.url &&
                (() => {
                  const fileExt = getFileExtension(
                    viewingDocument.name
                  ).toLowerCase();

                  // PDF files
                  if (fileExt === "pdf") {
                    return (
                      <iframe
                        src={viewingDocument.url}
                        className="w-full h-full border-0"
                        title={viewingDocument.name}
                      />
                    );
                  }

                  // Image files
                  else if (["jpg", "jpeg", "png", "gif"].includes(fileExt)) {
                    return (
                      <div className="flex items-center justify-center h-full">
                        <img
                          src={viewingDocument.url}
                          alt={viewingDocument.name}
                          className="max-w-full max-h-full"
                        />
                      </div>
                    );
                  }

                  // Other file types - offer download only
                  else {
                    return (
                      <div className="flex flex-col items-center justify-center h-full bg-white rounded p-8 text-center">
                        <div
                          className={`${getFileColor(
                            fileExt.toUpperCase()
                          )} rounded-full h-20 w-20 flex items-center justify-center text-white text-2xl mb-4`}
                        >
                          {fileExt.toUpperCase()}
                        </div>
                        <h4 className="text-xl font-medium mb-2">
                          {viewingDocument.name}
                        </h4>
                        <p className="text-gray-500 mb-6">
                          This file type cannot be previewed in the browser
                        </p>
                        <button
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
                          onClick={() =>
                            handleDownloadDocument(viewingDocument)
                          }
                        >
                          <FiDownload className="mr-2" />
                          Download File
                        </button>
                      </div>
                    );
                  }
                })()}
            </div>
          </div>
        </div>
      )}
    </EpcPage>
  );
};

export default Ledgers;
