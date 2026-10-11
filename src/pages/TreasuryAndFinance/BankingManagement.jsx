import React, { useState, useEffect, useRef, useContext } from "react";
import axios from "axios";
import {
  AiOutlineEdit,
  AiOutlineDelete,
  AiOutlineFileSync,
} from "react-icons/ai";
import { Plus, Download } from "lucide-react";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { formatAmount } from "@/components/formatAmount";
import stat1 from "../../assets/img/icons/stats-1.png";
import stat2 from "../../assets/img/icons/stats-2.png";
import stat3 from "../../assets/img/icons/stats-3.png";
import stat4 from "../../assets/img/icons/stats-4.png";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { DataTable, ToggleSwitch } from "@/page-layouts/index";
import DateRangeComponent from "@/page-layouts/components/DateRangeComponent";
import { notifySuccess, notifyError } from "@/utils/toast";
import Swal from "sweetalert2";
import { AdminContext } from "@/context/AdminContext";
import RouteActionGate from "@/components/RouteActionGate";
import {
  PERMISSION_ACTION,
  useRouteModulePermissions,
} from "@/utils/permissionUtils";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const BankingManagement = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = { authorization: `Bearer ${adminInfo?.token}` };
  const routePerms = useRouteModulePermissions();

  const [accounts, setAccounts] = useState([]);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [loading, setLoading] = useState(true);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [bankStats, setBankStats] = useState({
    totalBalance: 0,
    totalAccounts: 0,
    bankAccounts: 0,
    moneyChangerAccounts: 0,
  });

  // Table view pagination
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const currentPageRef = useRef(1);

  // Filters
  const [transactionType, setTransactionType] = useState("All");
  const [category, setCategory] = useState("All");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const history = useHistory();
  const isSingleBusiness = isSingleAssignedBusiness();
  const accountTableHeaders = [
    ...(!isSingleBusiness ? ["Business Name"] : []),
    "Account Name",
    "Account Type",
    "Account Number",
    "Account Code",
    "Currency",
    "Balance",
    "Status",
    "Action",
  ];

  useEffect(() => {
    // Wait until assigned businesses are resolved before fetching
    if (businessesLoading) return;
    fetchAccounts(currentPage, recordsPerPage);
  }, [
    businessesLoading,
    businesses,
    selectedBusiness,
    transactionType,
    category,
    searchQuery,
    recordsPerPage,
    dateRangeStart,
    dateRangeEnd,
    currentPage,
  ]);

  // Fetch bank account types when business changes
  useEffect(() => {
    const fetchBankAccountTypes = async () => {
      try {
        const params = selectedBusiness ? { business: selectedBusiness } : {};
        const response = await axios.get(`${Base_URL}/bank-account-types`, { params });
        setAccountTypes(response.data);
      } catch (error) {
        console.error("Error fetching bank account types:", error);
      }
    };
    if (!businessesLoading) fetchBankAccountTypes();
  }, [businessesLoading, selectedBusiness]);

  // Fetch only businesses assigned to the logged-in user
  useEffect(() => {
    const fetchAssignedBusinesses = async () => {
      if (!adminInfo?.id) {
        setBusinessesLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        // Auto-preselect if exactly one assigned business
        if (list.length === 1) {
          setSelectedBusiness(list[0]._id);
        }
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
      } finally {
        setBusinessesLoading(false);
      }
    };
    fetchAssignedBusinesses();
  }, [adminInfo?.id]);

  const fetchAccounts = async (page = 1, limit = recordsPerPage) => {
    try {
      setLoading(!searchQuery);
      const params = {
        page,
        limit,
        // If a specific business is selected use it; otherwise scope to all assigned businesses
        business: selectedBusiness || undefined,
        businessIds:
          !selectedBusiness && businesses.length > 0
            ? businesses.map((b) => b._id).join(",")
            : undefined,
        search: searchQuery || undefined,
        transactionType:
          transactionType !== "All" ? transactionType : undefined,
        category: category !== "All" ? category : undefined,
        includeInactive: "true",
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/bank-management/accounts`, {
        params,
      });

      const { accounts = [], total = 0, stats = {} } = response.data;

      setAccounts(accounts);
      setFilteredAccounts(accounts);
      setTotalResults(total);
      setTotalPages(Math.ceil(total / recordsPerPage));
      setBankStats({
        totalBalance: stats.totalBalance || 0,
        totalAccounts: stats.totalAccounts || 0,
        bankAccounts: stats.bankAccounts || 0,
        moneyChangerAccounts: stats.moneyChangerAccounts || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchAccounts(page, recordsPerPage);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const action = newStatus ? "activate" : "deactivate";

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `Do you want to ${action} this bank account?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: `Yes, ${action} it!`,
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await axios.patch(
        `${Base_URL}/bank-management/toggle-status/${id}`,
        {
          isActive: newStatus,
        }
      );

      notifySuccess(
        response.data.message || `Bank account ${action}d successfully`
      );
      fetchAccounts(currentPage, recordsPerPage);
    } catch (error) {
      console.error("Failed to toggle status:", error);
      notifyError(
        error.response?.data?.message || "Failed to update bank account status"
      );
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This bank account will be permanently deleted.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      await axios.delete(`${Base_URL}/bank-management/accounts/${id}`);
      notifySuccess("Bank account deleted successfully");
      fetchAccounts(currentPage, recordsPerPage);
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to delete bank account");
    }
  };

  const handleExport = async () => {
    try {
      const params = {
        page: 1,
        limit: 999999,
        // Mirror the same business scoping as the table
        business: selectedBusiness || undefined,
        businessIds:
          !selectedBusiness && businesses.length > 0
            ? businesses.map((b) => b._id).join(",")
            : undefined,
        search: searchQuery || undefined,
        transactionType:
          transactionType !== "All" ? transactionType : undefined,
        category: category !== "All" ? category : undefined,
        includeInactive: "true",
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/bank-management/accounts`, {
        params,
      });

      const allAccounts = response.data.accounts || [];

      if (!allAccounts.length) {
        notifyError("No accounts found to export");
        return;
      }

      const csvData = allAccounts.map((account) => ({
        Status: account.isActive ? "Active" : "Inactive",
        BankType: account.bankType || "",
        BusinessName: account.business?.name || "",
        BusinessEmail: account.business?.email || "",
        BusinessTel: account.business?.tel || "",
        AccountName: account.accountName || "",
        AccountType: account.accountType?.name || account.accountType || "",
        AccountNumber: account.accountNumber || "",
        AccountCode: account.accountCode?.code || "N/A",
        AccountCodeName: account.accountCode?.accountName || "",
        BankName: account.bankName || "",
        CurrencyType: account.currencyType || "",
        OpeningBalance: account.openingBalance || 0,
        IBAN: account.iban || "",
        SwiftCode: account.swiftCode || "",
        BankAddress: account.bankAddress?.replace(/<[^>]+>/g, "") || "",
        CreatedAt: new Date(account.createdAt).toLocaleString(),
        UpdatedAt: new Date(account.updatedAt).toLocaleString(),
      }));

      const csv = Papa.unparse(csvData);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `BankAccounts_${new Date().toISOString().slice(0, 10)}.csv`);
      notifySuccess("Bank accounts exported successfully");
    } catch (error) {
      console.error("Failed to export accounts:", error);
      notifyError("Failed to export bank accounts");
    }
  };

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setCurrentPage(1);
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    if (!isSingleBusiness) {
      setSelectedBusiness("");
    } else if (businesses.length === 1) {
      setSelectedBusiness(businesses[0]._id);
    }
    setTransactionType("All");
    setCategory("All");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const renderTableView = () => (
    <div className="mt-8">
      <div className="overflow-x-auto">
        <DataTable
          headers={accountTableHeaders}
          loading={loading}
          data={filteredAccounts}
          title=""
          totalRecords={totalResults}
          currentPage={currentPage}
          filters={[
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
              isBusinessDropdown: true,
              businessDropdownProps: {
                selectionMode: "single",
                selectedBusiness,
                onChange: (id) => {
                  handleBusinessChange(id);
                  setCurrentPage(1);
                },
                placeholder: "Select Business",
              },
            },
            {
              options: [
                { value: "All", label: "Bank Type: All" },
                { value: "Bank Account", label: "Bank Account" },
                { value: "Money Changer", label: "Money Changer" },
              ],
              value: transactionType,
              onChange: (value) => {
                setTransactionType(value);
                setCurrentPage(1);
              },
              placeholder: "Bank Type: All",
            },
            {
              options: [
                { value: "All", label: "Account Type: All" },
                ...accountTypes.map((accountType) => ({
                  value: accountType._id,
                  label: accountType.name,
                })),
              ],
              value: category,
              onChange: (value) => {
                setCategory(value);
                setCurrentPage(1);
                currentPageRef.current = 1;
              },
              placeholder: "Account Type: All",
            },
          ]}
          onPageChange={handlePageChange}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={(value) => {
            setRecordsPerPage(value);
            setCurrentPage(1);
          }}
          totalPages={totalPages}
          onSearch={(val) => { setSearchQuery(val); setCurrentPage(1); currentPageRef.current = 1; }}
          searchValue={searchQuery}
          renderRow={(account) => (
            <tr key={account._id} className="border-t border-gray-100">
              {!isSingleBusiness && (
                <td className="py-3 px-4">
                  {account.business?.name || (
                    <span className="italic">No business</span>
                  )}
                </td>
              )}
              <td className="py-3 px-4">
                {account.accountName || <span className="italic">No account name</span>}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`text-${
                    account.accountType === "Income" ? "green" : "red"
                  }-500`}
                >
                  {account.accountType?.name || account.accountType}
                </span>
              </td>
              <td className="py-3 px-4">{account.accountNumber}</td>
              <td className="py-3 px-4">
                {account.accountCode ? (
                  <div>
                    {account.accountCode.code} -{" "}
                    {account.accountCode.accountName}
                  </div>
                ) : (
                  <span className="italic">No account code</span>
                )}
              </td>
              <td className="py-3 px-4">{account.currencyType}</td>
              <td className="py-3 px-4">
                {formatAmount(account.openingBalance)}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center">
                  <ToggleSwitch
                    isOn={account.isActive}
                    handleToggle={() =>
                      routePerms.canUpdate &&
                      handleToggleStatus(account._id, account.isActive)
                    }
                    id={`toggle-table-${account._id}`}
                  />
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-3">
                  {/* Statement reconciliation is only for real bank accounts.
                      Cash is counted; clearing settles against a provider; a
                      money changer is an FX dealer (also caught by bankType so
                      legacy accounts without a category are excluded). */}
                  {(account.accountCategory || "bank") === "bank" &&
                    account.bankType !== "Money Changer" && (
                    <button
                      onClick={() =>
                        history.push(
                          `/bank-management/${account._id}/reconciliations`
                        )
                      }
                      className="text-gray-600 hover:text-blue-700"
                      title="Reconciliations"
                    >
                      <AiOutlineFileSync size={20} />
                    </button>
                  )}
                  {routePerms.canUpdate && (
                    <button
                      onClick={() =>
                        history.push(`/edit-account/${account._id}`)
                      }
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <AiOutlineEdit size={20} />
                    </button>
                  )}
                  {routePerms.canDelete && (
                    <button
                      onClick={() => handleDelete(account._id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <AiOutlineDelete size={20} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );

  const renderStats = () => (
    <div className="bg-[#FAFAFA] rounded-xl p-6 flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-grow">
        {/* Total Balance */}
        <div className="bg-[#C1B31426] rounded-xl p-4 w-full">
          <div className="flex items-center space-x-3">
            <img src={stat1} alt="stat1" className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-semibold mt-3 text-[#1C1C1C]">
            {formatAmount(bankStats.totalBalance)}
          </h3>
          <p className="text-sm text-[#475467] mt-1">Total Balance</p>
        </div>

        {/* Total Accounts */}
        <div className="bg-[#DCFCE7] rounded-xl p-4 w-full">
          <div className="flex items-center space-x-3">
            <img src={stat2} alt="stat2" className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-semibold mt-3 text-[#1C1C1C]">
            {bankStats.totalAccounts}
          </h3>
          <p className="text-sm text-[#475467] mt-1">Total Accounts</p>
        </div>

        {/* Bank Accounts */}
        <div className="bg-[#FFF4DE] rounded-xl p-4 w-full">
          <div className="flex items-center space-x-3">
            <img src={stat3} alt="stat3" className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-semibold mt-3 text-[#1C1C1C]">
            {bankStats.bankAccounts}
          </h3>
          <p className="text-sm text-[#475467] mt-1">Bank Accounts</p>
        </div>

        {/* Money Changer Accounts */}
        <div className="bg-[#F3E8FF] rounded-xl p-4 w-full">
          <div className="flex items-center space-x-3">
            <img src={stat4} alt="stat4" className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-semibold mt-3 text-[#1C1C1C]">
            {bankStats.moneyChangerAccounts}
          </h3>
          <p className="text-sm text-[#475467] mt-1">Money Changer Accounts</p>
        </div>
      </div>
    </div>
  );

  const handleBusinessChange = (businessId) => {
    setSelectedBusiness(businessId);
    setCurrentPage(1);
  };

  return (
    <RouteActionGate
      title="Banking Accounts"
      requiredPermission={PERMISSION_ACTION.VIEW}
    >
      <div className="w-full container py-8 px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Banking Management</h1>
            <p className="text-gray-600 mt-2">Manage and track all bank accounts</p>
          </div>
          <div className="flex items-center gap-4">
            <DateRangeComponent
              startDate={dateRangeStart}
              endDate={dateRangeEnd}
              onApply={handleDateRangeApply}
              onClear={handleDateRangeClear}
              placeholder="Filter by date range"
            />
            <button
              onClick={() => history.push("/provider-settlements")}
              className="flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Settlements
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download size={18} />
              Export
            </button>
            {routePerms.canAdd && (
              <button
                onClick={() => history.push("/add-account")}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
              >
                <Plus size={20} />
                Add New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      {renderStats()}

      <div className="w-full">
        {renderTableView()}
      </div>

      </div>
    </RouteActionGate>
  );
};

export default BankingManagement;
