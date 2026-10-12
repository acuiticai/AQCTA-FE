import React, { useState, useEffect, useRef, useContext } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { formatAmount } from "@/components/formatAmount";
import { ActionButtons, ToggleSwitch } from "@/page-layouts/index";
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
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import StatCard from "@/customer/components/ui/StatCard";
import {
  DownloadIcon,
  PlusIcon,
  WalletIcon,
  DocumentIcon,
  InvoiceIcon,
  FileIcon,
} from "@/customer/components/ui/icons";
import { saveAs } from "file-saver";
import Papa from "papaparse";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BankingManagement = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = { authorization: `Bearer ${adminInfo?.token}` };
  const routePerms = useRouteModulePermissions();

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
  const currentPageRef = useRef(1);

  // Filters
  const [transactionType, setTransactionType] = useState("All");
  const [category, setCategory] = useState("All");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const history = useHistory();
  const isSingleBusiness = isSingleAssignedBusiness();

  useEffect(() => {
    // Wait until assigned businesses are resolved before fetching
    if (businessesLoading) return;
    fetchAccounts(currentPage, recordsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const response = await axios.get(`${Base_URL}/bank-account-types`, {
          params,
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      setFilteredAccounts(accounts);
      setTotalResults(total);
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
      notifyError(
        error.response?.data?.message || "Failed to delete bank account"
      );
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

  const handleBusinessChange = (businessId) => {
    setSelectedBusiness(businessId);
    setCurrentPage(1);
  };

  const buildActionItems = (account) => [
    ...((account.accountCategory || "bank") === "bank" &&
    account.bankType !== "Money Changer"
      ? [
          {
            action: ACTION_BUTTON_TYPES.HISTORY,
            title: "Reconciliations",
            onClick: () =>
              history.push(`/bank-management/${account._id}/reconciliations`),
          },
        ]
      : []),
    ...(routePerms.canUpdate
      ? [
          {
            action: ACTION_BUTTON_TYPES.EDIT,
            title: "Edit",
            onClick: () => history.push(`/edit-account/${account._id}`),
          },
        ]
      : []),
    ...(routePerms.canDelete
      ? [
          {
            action: ACTION_BUTTON_TYPES.DELETE,
            title: "Delete",
            onClick: () => handleDelete(account._id),
          },
        ]
      : []),
  ];

  const columns = [
    ...(!isSingleBusiness
      ? [
          {
            key: "business",
            header: "Business Name",
            render: (row) => (
              <span className="epc-cell__primary">
                {row.business?.name || "No business"}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "accountName",
      header: "Account Name",
      render: (row) => (
        <span className="epc-cell__primary">
          {row.accountName || "No account name"}
        </span>
      ),
    },
    {
      key: "accountType",
      header: "Account Type",
      render: (row) => (
        <span className="epc-cell__secondary">
          {row.accountType?.name || row.accountType || "—"}
        </span>
      ),
    },
    {
      key: "accountNumber",
      header: "Account Number",
      render: (row) => row.accountNumber || "—",
    },
    {
      key: "accountCode",
      header: "Account Code",
      render: (row) =>
        row.accountCode ? (
          <>
            <div className="epc-cell__primary">{row.accountCode.code}</div>
            <div className="epc-cell__secondary">
              {row.accountCode.accountName}
            </div>
          </>
        ) : (
          <span className="epc-cell__secondary">No account code</span>
        ),
    },
    {
      key: "currency",
      header: "Currency",
      render: (row) => row.currencyType || "—",
    },
    {
      key: "balance",
      header: "Balance",
      render: (row) => (
        <span className="epc-cell__primary">
          {formatAmount(row.openingBalance)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <ToggleSwitch
          isOn={row.isActive}
          handleToggle={() =>
            routePerms.canUpdate &&
            handleToggleStatus(row._id, row.isActive)
          }
          id={`toggle-table-${row._id}`}
        />
      ),
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (row) => (
        <ActionButtons maxVisibleActions={3} items={buildActionItems(row)} />
      ),
    },
  ];

  const portalFilters = [
    ...(!isSingleBusiness
      ? [
          {
            key: "business",
            placeholder: "Select Business",
            options: [
              { value: "", label: "All Businesses" },
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
          },
        ]
      : []),
    {
      key: "transactionType",
      placeholder: "Bank Type: All",
      options: [
        { value: "", label: "Bank Type: All" },
        { value: "Bank Account", label: "Bank Account" },
        { value: "Money Changer", label: "Money Changer" },
      ],
    },
    {
      key: "category",
      placeholder: "Account Type: All",
      options: [
        { value: "", label: "Account Type: All" },
        ...accountTypes.map((accountType) => ({
          value: accountType._id,
          label: accountType.name,
        })),
      ],
    },
  ];

  const portalFilterValues = {
    business: selectedBusiness || "",
    transactionType: transactionType === "All" ? "" : transactionType,
    category: category === "All" ? "" : category,
  };

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      handleBusinessChange(value || "");
      return;
    }
    if (key === "transactionType") {
      setTransactionType(value || "All");
      setCurrentPage(1);
      return;
    }
    if (key === "category") {
      setCategory(value || "All");
      setCurrentPage(1);
      currentPageRef.current = 1;
    }
  };

  const stats = [
    {
      icon: WalletIcon,
      label: "Total Balance",
      value: formatAmount(bankStats.totalBalance),
      tone: "brand",
    },
    {
      icon: DocumentIcon,
      label: "Total Accounts",
      value: String(bankStats.totalAccounts),
      tone: "success",
    },
    {
      icon: InvoiceIcon,
      label: "Bank Accounts",
      value: String(bankStats.bankAccounts),
      tone: "warning",
    },
    {
      icon: FileIcon,
      label: "Money Changer Accounts",
      value: String(bankStats.moneyChangerAccounts),
      tone: "info",
    },
  ];

  return (
    <RouteActionGate
      title="Banking Accounts"
      requiredPermission={PERMISSION_ACTION.VIEW}
    >
      <EpcPage
        title="Banking Management"
        subtitle="Manage and track all bank accounts"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeComponent
              startDate={dateRangeStart}
              endDate={dateRangeEnd}
              onApply={handleDateRangeApply}
              onClear={handleDateRangeClear}
              placeholder="Filter by date range"
            />
            <Button
              variant="secondary"
              onClick={() => history.push("/provider-settlements")}
            >
              Settlements
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              <DownloadIcon size={15} />
              Export
            </Button>
            {routePerms.canAdd ? (
              <Button onClick={() => history.push("/add-account")}>
                <PlusIcon size={15} />
                Add New
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="epc-stack">
          <div className="epc-statgrid">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>

          <FilterBar
            subtitle="Narrow by business, bank type, account type or search."
            searchPlaceholder="Search accounts…"
            searchValue={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
              currentPageRef.current = 1;
            }}
            values={portalFilterValues}
            onChange={handlePortalFilterChange}
            onReset={clearAllFilters}
            filters={portalFilters}
          />

          <Card>
            <CardHeader
              title="Bank Accounts"
              subtitle={
                loading ? "Loading…" : `${totalResults} total accounts`
              }
            />

            <PortalDataTable
              columns={columns}
              rows={loading ? [] : filteredAccounts}
              rowKey="_id"
              emptyMessage={
                loading ? "Loading accounts…" : "No bank accounts found."
              }
            />
            {!loading && totalResults > 0 ? (
              <Pagination
                page={currentPage}
                pageSize={recordsPerPage}
                total={totalResults}
                itemLabel="accounts"
                onPageChange={handlePageChange}
                onPageSizeChange={(value) => {
                  setRecordsPerPage(value);
                  setCurrentPage(1);
                }}
              />
            ) : null}
          </Card>
        </div>
      </EpcPage>
    </RouteActionGate>
  );
};

export default BankingManagement;
