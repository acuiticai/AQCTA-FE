import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiSearch, FiChevronDown, FiEdit2, FiTrash2 } from "react-icons/fi";
import axios from "axios";
import DateRangeComponent from "../../components/DateRangeComponent";
import UploadBankStatementModal from "../../components/TreasuryAndFinance/UploadBankStatementModal";
import sales from "../../assets/img/icons/Sales.png";
import group from "../../assets/img/icons/Group.png";
import union from "../../assets/img/icons/Union.png";
import useAsync from "@/hooks/useAsync";
import BankManagementServices from "@/services/BankManagementServices";
import action from "../../assets/img/Layer_1.png";
import AddLedgerFromStatement from "../../components/TreasuryAndFinance/AddLedgerFromStatement";
import arrowDown from "../../assets/img/icons/frame.svg";
import arrowUp from "../../assets/img/icons/export.svg";
import { toast, ToastContainer } from "react-toastify";
import { formatAmount, formatDate } from "@/components/formatAmount";
import CustomDatePicker from "@/components/CustomDatePicker";
import CustomPagination from "@/components/CustomPagination";
import { Select } from "@windmill/react-ui";
import { notifyError, notifySuccess } from "@/utils/toast";
import { PageHeader } from "@/page-layouts/index";
import { DataTable } from "@/page-layouts";
import {
  isSingleAssignedBusiness,
  readAssignedBusinessesFallback,
} from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BankStatements = () => {
  const { data } = useAsync(BankManagementServices.getAllAccounts);

  const bankAccounts = data?.accounts || [];
  const [statements, setStatements] = useState([]);
  console.log("statemnts", statements);
  const [filteredStatements, setFilteredStatements] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  console.log("current page", currentPage);
  const currentPageRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [stats, setStats] = useState({
    totalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
  });
  const [filters, setFilters] = useState({
    name: "",
    business: "",
    account: "",
    date: "",
    transactionType: "All",
    category: "All",
  });
  const [businesses, setBusinesses] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [showAddLedgerModal, setShowAddLedgerModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  // Temporary quick-edit of a statement line's amounts (to correct an import).
  const [editStatement, setEditStatement] = useState(null);
  const [editDep, setEditDep] = useState("");
  const [editWd, setEditWd] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Delete confirm for a single statement line.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingRow, setDeletingRow] = useState(false);
  const isSingleBusiness = isSingleAssignedBusiness();

  // Fetch statements
  const fetchStatements = useCallback(
    async (page, limit) => {
      try {
        setLoading(true);
        const response = await axios.get(`${Base_URL}/bank-statements`, {
          params: {
            startDate: startDate,
            endDate: endDate,
            ...filters,
            page: page,
            limit: limit || recordsPerPage,
          },
        });

        console.log("res", response.data);

        if (response.data && response.data.statements) {
          setStatements(response.data.statements);
          setFilteredStatements(response.data.statements);
          setTotalResults(response.data.total);
          setStats({
            totalBalance: response.data.stats?.totalBalance || 0,
            totalIncome: response.data.stats?.totalIncome || 0,
            totalExpense: response.data.stats?.totalExpense || 0,
          });
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch statements:", error);
        setLoading(false);
      }
    },
    [filters, startDate, endDate]
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchStatements(page);
  };

  // Fetch businesses on component mount
  useEffect(() => {
    const list = readAssignedBusinessesFallback();
    setBusinesses(list);
    if (list.length === 1) {
      setFilters((prev) => ({ ...prev, business: String(list[0]._id) }));
    }
  }, []);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  // Handle date range change
  const handleDateRangeChange = (range) => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);

    if (!statements.length) return;

    if (range.startDate && range.endDate) {
      // Convert dates to ISO strings for consistent comparison
      const startDateStr = new Date(range.startDate)
        .toISOString()
        .split("T")[0];
      const endDateStr = new Date(range.endDate).toISOString().split("T")[0];

      setFilteredStatements(
        statements.filter((statement) => {
          if (!statement.date) return false;

          // Convert statement date to ISO string
          const statementDateStr = new Date(statement.date)
            .toISOString()
            .split("T")[0];

          // Check if the statement date is within the range (inclusive)
          return (
            statementDateStr >= startDateStr && statementDateStr <= endDateStr
          );
        })
      );
    } else if (range.startDate) {
      // If only start date is provided, show all dates after and including start date
      const startDateStr = new Date(range.startDate)
        .toISOString()
        .split("T")[0];

      setFilteredStatements(
        statements.filter((statement) => {
          if (!statement.date) return false;

          const statementDateStr = new Date(statement.date)
            .toISOString()
            .split("T")[0];

          return statementDateStr >= startDateStr;
        })
      );
    } else if (range.endDate) {
      // If only end date is provided, show all dates before and including end date
      const endDateStr = new Date(range.endDate).toISOString().split("T")[0];

      setFilteredStatements(
        statements.filter((statement) => {
          if (!statement.date) return false;

          const statementDateStr = new Date(statement.date)
            .toISOString()
            .split("T")[0];

          return statementDateStr <= endDateStr;
        })
      );
    } else {
      // If no dates are selected, show all statements
      setFilteredStatements(statements);
    }
  };

  // Handle import statement - now opens the modal instead
  const handleImportStatement = () => {
    setShowUploadModal(true);
  };

  // Export statements
  const handleExport = () => {
    if (filteredStatements.length === 0) {
      notifyError("No statements to export");
      return;
    }

    try {
      const csvData = [
        [
          "Date",
          "Reference",
          "Description",
          "Payee",
          "Deposits",
          "Withdrawals",
          "Account",
          "Business",
        ],
        ...filteredStatements.map((statement) => [
          new Date(statement.date).toLocaleDateString(),
          statement.reference || "",
          statement.description || "",
          statement.payee || "",
          statement.deposit || "",
          statement.withdrawal || "",
          statement?.accountId?.accountName || "",
          statement.business || "",
        ]),
      ];

      const csvContent = csvData.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "bank_statements.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url); // Clean up
    } catch (error) {
      console.error("Failed to export statements:", error);
      notifyError("Failed to export statements");
    }
  };

  // Handle modal close
  const handleUploadModalClose = () => {
    setShowUploadModal(false);
  };

  // Handle successful upload
  const handleUploadSuccess = (result) => {
    setShowUploadModal(false);
    fetchStatements(); // Refresh the statements list

    const imported = result?.count ?? 0;
    const total = result?.totalRows;
    if (total && imported < total) {
      // Partial import — say so plainly rather than implying everything landed.
      notifySuccess(`Imported ${imported} of ${total} rows from the statement.`);
    } else {
      notifySuccess(
        imported
          ? `Imported ${imported} statement line(s).`
          : "Statement uploaded successfully"
      );
    }
  };

  // Handle search by name
  const handleSearchByName = (value) => {
    const searchTerm = value;
    setFilters({ ...filters, name: searchTerm });

    if (!statements.length) return;

    if (searchTerm) {
      setFilteredStatements(
        statements.filter(
          (statement) =>
            (statement.description || "")
              .toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            (statement.payee || "")
              .toLowerCase()
              .includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredStatements(statements);
    }
  };

  // Handle business filter
  const handleBusinessFilter = (business) => {
    setFilters({ ...filters, business });

    if (!statements.length) return;

    if (business) {
      setFilteredStatements(
        statements.filter((statement) => statement.business === business)
      );
    } else {
      setFilteredStatements(statements);
    }
  };

  // Handle account filter
  const handleAccountFilter = (account) => {
    setFilters({ ...filters, account });

    if (!statements.length) return;

    if (account && account !== "All") {
      setFilteredStatements(
        statements.filter((statement) => statement.accountId._id === account)
      );
    } else {
      setFilteredStatements(statements);
    }
  };

  // Handle date filter
  const handleDateFilter = (date) => {
    setFilters({ ...filters, date });

    if (!statements.length) return;

    if (date) {
      // Convert the selected date to a string in YYYY-MM-DD format
      const selectedDateStr = new Date(date).toISOString().split("T")[0];

      setFilteredStatements(
        statements.filter((statement) => {
          if (!statement.date) return false;

          // Convert the statement date to the same format
          const statementDateStr = new Date(statement.date)
            .toISOString()
            .split("T")[0];

          return statementDateStr === selectedDateStr;
        })
      );
    } else {
      setFilteredStatements(statements);
    }
  };

  // Handle transaction type filter
  const handleTransactionTypeFilter = (type) => {
    setFilters({ ...filters, transactionType: type });

    if (!statements.length) return;

    if (type !== "All") {
      setFilteredStatements(
        statements.filter((statement) => {
          if (type === "Income") return statement.deposit > 0;
          if (type === "Expense") return statement.withdrawal > 0;
          return true;
        })
      );
    } else {
      setFilteredStatements(statements);
    }
  };

  // Handle category filter
  const handleCategoryFilter = (category) => {
    setFilters({ ...filters, category });

    if (!statements.length) return;

    if (category !== "All") {
      setFilteredStatements(
        statements.filter((statement) => statement.category === category)
      );
    } else {
      setFilteredStatements(statements);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (typeof amount !== "number") return "0.00";
    return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  // View statement details
  const showLedgerForm = (statement) => {
    setSelectedStatement(statement);
    setShowAddLedgerModal(true);
  };

  const handleCloseModal = () => {
    setShowAddLedgerModal(false);
  };

  // Temporary quick-edit of the deposit / withdrawal amounts on a statement line.
  const openEdit = (statement) => {
    setEditStatement(statement);
    setEditDep(statement.deposit ? String(statement.deposit) : "");
    setEditWd(statement.withdrawal ? String(statement.withdrawal) : "");
  };

  const saveEdit = async () => {
    if (!editStatement) return;
    const dep = Number(editDep) || 0;
    const wd = Number(editWd) || 0;
    if (dep > 0 && wd > 0) {
      notifyError("A line is either a deposit or a withdrawal — leave the other at 0.");
      return;
    }
    if (dep <= 0 && wd <= 0) {
      notifyError("Enter a deposit or a withdrawal greater than zero.");
      return;
    }
    try {
      setSavingEdit(true);
      await axios.put(`${Base_URL}/bank-statements/${editStatement._id}`, {
        deposit: dep,
        withdrawal: wd,
      });
      notifySuccess("Statement line updated");
      setEditStatement(null);
      fetchStatements(currentPageRef.current || currentPage);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to update this statement line"
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingRow(true);
      await axios.delete(`${Base_URL}/bank-statements/${deleteTarget._id}`);
      notifySuccess("Statement line deleted");
      setDeleteTarget(null);
      fetchStatements(currentPageRef.current || currentPage);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to delete this statement line"
      );
    } finally {
      setDeletingRow(false);
    }
  };

  useEffect(() => {
    window.scroll(0, 0);
  }, []);

  const CustomFilterComponent = () => {
    return (
      <div className="flex flex-wrap gap-2">
        <DateRangeComponent
          initialStartDate={startDate}
          initialEndDate={endDate}
          onChange={handleDateRangeChange}
        />
        {/* <button
        className="bg-white flex items-center gap-2 border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50"
        onClick={handleExport}
      >
        <img src={arrowDown} alt="Export" className="w-5 h-5" />
        <span>Export</span>
      </button> */}
        <button
          className="bg-white flex items-center gap-2 border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50"
          onClick={handleImportStatement}
        >
          <img src={arrowUp} alt="Import" className="w-5 h-5" />
          <span className="text-gray-800">Import Bank Statement</span>
        </button>
      </div>
    );
  };

  return (
    <div className="relative container max-w-7xl mx-auto px-4 py-8">
      {/* <ToastContainer position="top-center" /> */}
      {showAddLedgerModal && selectedStatement && (
        <AddLedgerFromStatement
          statementData={selectedStatement}
          onClose={handleCloseModal}
        />
      )}

      {/* Temporary quick-edit of a statement line's amounts */}
      {editStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit statement amount</h2>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setEditStatement(null)}
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-500">
              Temporary tool to correct an imported amount. A line is either a
              deposit or a withdrawal — leave the other at 0. Matched lines can't be
              edited; undo the match first.
            </p>

            <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <div><span className="text-gray-400">Ref:</span> {editStatement.reference || "—"}</div>
              <div className="truncate"><span className="text-gray-400">Desc:</span> {editStatement.description || "—"}</div>
              <div><span className="text-gray-400">Date:</span> {formatDate(editStatement.date)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Deposit
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editDep}
                  onChange={(e) => {
                    setEditDep(e.target.value);
                    if (e.target.value && Number(e.target.value) > 0) setEditWd("");
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Withdrawal
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editWd}
                  onChange={(e) => {
                    setEditWd(e.target.value);
                    if (e.target.value && Number(e.target.value) > 0) setEditDep("");
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setEditStatement(null)}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[var(--p-blue)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                onClick={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete a statement line */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Delete this statement line?</h2>
            <p className="mb-4 text-sm text-gray-600">
              This permanently removes the line from the imported statement. Matched
              lines can't be deleted — undo the match first.
            </p>
            <div className="mb-5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <div><span className="text-gray-400">Ref:</span> {deleteTarget.reference || "—"}</div>
              <div className="truncate"><span className="text-gray-400">Desc:</span> {deleteTarget.description || "—"}</div>
              <div>
                <span className="text-gray-400">Amount:</span>{" "}
                {deleteTarget.deposit > 0
                  ? `+${formatAmount(deleteTarget.deposit)}`
                  : `-${formatAmount(deleteTarget.withdrawal)}`}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingRow}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                onClick={confirmDelete}
                disabled={deletingRow}
              >
                {deletingRow ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Statement Upload Modal */}
      {showUploadModal && (
        <UploadBankStatementModal
          onClose={handleUploadModalClose}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader
          title="Bank Statements"
          CustomFilterComponent={CustomFilterComponent}
        />
      </div>

      {/* Filters Section */}
      <div
        className={`grid grid-cols-1 gap-4 mb-8 ${
          isSingleBusiness ? "md:grid-cols-3" : "md:grid-cols-4"
        }`}
      >
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search By Name"
            className="bg-gray-100 rounded-md py-2 pl-10 pr-4 w-full focus:outline-none"
            value={filters.name}
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </div>
        {!isSingleBusiness && (
          <div className="relative">
            <select
              className="bg-gray-100 text-gray-600 rounded-md py-2 px-4 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              value={filters.business}
              onChange={(e) => handleBusinessFilter(e.target.value)}
            >
              <option value="">Search By Business</option>
              {businesses.map((business) => (
                <option key={business._id} value={business._id}>
                  {business.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <FiChevronDown className="text-gray-400" />
            </div>
          </div>
        )}
        <div className="relative">
          <select
            className="bg-gray-100 text-gray-600 rounded-md py-2 px-4 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            value={filters.account}
            onChange={(e) => handleAccountFilter(e.target.value)}
          >
            <option value="">Search By Account</option>
            <option value="All">All Accounts</option>
            {bankAccounts?.length > 0
              ? bankAccounts?.map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.accountName}
                  </option>
                ))
              : []}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <FiChevronDown className="text-gray-400" />
          </div>
        </div>
        <div className="relative">
          <CustomDatePicker
            className="bg-gray-100 rounded-md py-2 px-4 w-full focus:outline-none"
            value={filters.date}
            bgColor="#F3F4F6"
            onChange={(date) => handleDateFilter(date)}
          />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="mb-8 bg-gray-50 rounded-lg p-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#f8f8e1] rounded-lg p-6">
            <div className="bg-[var(--p-blue)] w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <img src={sales} alt="Total Balance" className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-2">
              USD {formatAmount(stats.totalBalance)}
            </div>
            <div className="text-gray-600">Total Balance</div>
          </div>
          <div className="bg-[#DCFCE7] rounded-lg p-6">
            <div className="bg-[#3CD856] w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <img src={group} alt="Total Income" className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-2">
              USD {formatAmount(stats.totalIncome)}
            </div>
            <div className="text-gray-600">Total Income</div>
          </div>
          <div className="bg-[#FFF4DE] rounded-lg p-6">
            <div className="bg-[#FF947A] w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <img src={union} alt="Total Expense" className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-2">
              USD {formatAmount(stats.totalExpense)}
            </div>
            <div className="text-gray-600">Total Expense</div>
          </div>
        </div>
      </div>

      {/* Statements Table */}
      <DataTable
        title="Bank Statements"
        loading={loading}
        filters={[
          {
            label: "Transaction Type",
            value: filters.transactionType,
            onChange: (value) => handleTransactionTypeFilter(value),
            options: [
              { label: "All", value: "All" },
              { label: "Income", value: "Income" },
              { label: "Expense", value: "Expense" },
            ],
          },
          {
            label: "Category",
            value: filters.category,
            onChange: (value) => handleCategoryFilter(value),
            options: [
              { label: "Select Category: All", value: "All" },
              { label: "Sales", value: "Sales" },
              { label: "Services", value: "Services" },
              { label: "Transfers", value: "Transfers" },
              { label: "Utilities", value: "Utilities" },
            ],
            placeholder: "Select Category",
            type: "select",
          },
        ]}
        headers={[
          "Date",
          "Statement Details",
          "Deposits",
          "Withdrawals",
          "Action",
        ]}
        data={filteredStatements}
        renderRow={(statement) => (
          <tr className="border-b hover:bg-gray-50">
            <td className="py-3 px-4 text-gray-800">
              {formatDate(statement.date)}
            </td>
            <td className="py-3 px-4">
              <div className="text-gray-800 font-medium">
                Reference#: {statement.reference}
              </div>
              <div className="text-gray-600 text-sm">
                Description: {statement.description}
              </div>
              <div className="text-gray-600 text-sm">
                Payee: {statement.payee}
              </div>
            </td>
            <td className="py-3 px-4 text-gray-600 font-medium">
              {statement.deposit > 0
                ? `${statement.accountId?.currencyType || ""} ${formatAmount(
                    statement.deposit
                  )}`.trim()
                : "-"}
            </td>
            <td className="py-3 px-4 text-gray-600 font-medium">
              {statement.withdrawal > 0
                ? `${statement.accountId?.currencyType || ""} ${formatAmount(
                    statement.withdrawal
                  )}`.trim()
                : "-"}
            </td>
            <td className="py-3 px-4 text-center">
              <div className="flex items-center justify-center gap-3">
                <button
                  className="text-gray-600 hover:text-[var(--p-blue)]"
                  onClick={() => openEdit(statement)}
                  title="Edit amount (temporary)"
                >
                  <FiEdit2 size={16} />
                </button>
                <button
                  className="text-gray-600 hover:text-gray-900"
                  onClick={() => showLedgerForm(statement)}
                >
                  <img src={action} className="h-5" alt="action" />
                </button>
                <button
                  className="text-gray-600 hover:text-red-600"
                  onClick={() => setDeleteTarget(statement)}
                  title="Delete this statement line"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        )}
        currentPage={currentPage}
        totalPages={Math.ceil(totalResults / recordsPerPage)}
        recordsPerPage={recordsPerPage}
        onPageChange={handlePageChange}
        onRecordsPerPageChange={(value) => {
          setRecordsPerPage(value);
          currentPageRef.current = 1;
          setCurrentPage(1);
          fetchStatements(1, value);
        }}
        emptyMessage="No statements found"
        searchValue={filters.name}
        onSearch={handleSearchByName}
      />
    </div>
  );
};

export default BankStatements;
