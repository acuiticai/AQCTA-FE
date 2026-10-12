import React, { useState, useEffect, useRef, useContext } from "react";
import { useHistory } from "react-router-dom";
import { X } from "lucide-react";
import axios from "axios";
import { ActionButtons } from "@/page-layouts";
import EpcListPage from "@/components/Epc/EpcListPage";
import Button from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";
import { AdminContext } from "@/context/AdminContext";
import { notifySuccess, notifyError } from "@/utils/toast";
import RouteActionGate from "@/components/RouteActionGate";
import {
  PERMISSION_ACTION,
  useRouteModulePermissions,
} from "@/utils/permissionUtils";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ChartOfAccounts = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = { authorization: `Bearer ${adminInfo?.token}` };
  const routePerms = useRouteModulePermissions();

  const [accounts, setAccounts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState(["All"]);
  const [category, setCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]); // multi-select preserved as array
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);

  // Fetch paginated + filtered accounts from server
  const fetchAccounts = async (
    page,
    limit,
    businessIds,
    search,
    categoryFilter,
    bizList
  ) => {
    setIsLoading(true);
    try {
      const params = {
        page: page || currentPage,
        limit: limit || recordsPerPage,
      };

      if (Array.isArray(businessIds) && businessIds.length === 1) {
        params.business = businessIds[0];
      } else {
        const list = bizList || businesses;
        if (list.length === 0) {
          setAccounts([]);
          setTotalResults(0);
          setIsLoading(false);
          return;
        }
        params.businessIds =
          Array.isArray(businessIds) && businessIds.length > 1
            ? businessIds.join(",")
            : list.map((b) => b._id).join(",");
      }

      if (search && search.trim()) {
        params.search = search.trim();
      }

      if (categoryFilter && categoryFilter !== "All") {
        params.accountHeader = categoryFilter;
      }

      const response = await axios.get(`${Base_URL}/accounts`, { params });
      setAccounts(response.data.accounts || []);
      setTotalResults(response.data.total || 0);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all accounts (no pagination, no filters) just to extract unique category headers
  const fetchCategoryOptions = async (businessIds, bizList) => {
    try {
      const params = { page: 1, limit: 9999 };
      if (Array.isArray(businessIds) && businessIds.length === 1) {
        params.business = businessIds[0];
      } else {
        const list = bizList || businesses;
        if (list.length === 0) {
          setAvailableCategories(["All"]);
          return;
        }
        params.businessIds =
          Array.isArray(businessIds) && businessIds.length > 1
            ? businessIds.join(",")
            : list.map((b) => b._id).join(",");
      }
      const response = await axios.get(`${Base_URL}/accounts`, { params });
      const cats = [
        "All",
        ...new Set(
          (response.data.accounts || [])
            .map((a) => a.accountType?.accountHeader)
            .filter(Boolean)
        ),
      ].sort((a, b) =>
        a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)
      );
      setAvailableCategories(cats);
    } catch (error) {
      console.error("Error fetching category options:", error);
    }
  };

  // Single init: load assigned businesses, then fetch accounts and categories with the fresh list.
  useEffect(() => {
    const init = async () => {
      if (!adminInfo?.id) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        const preselected = list.length === 1 ? [list[0]._id] : [];
        setSelectedBusinesses(preselected);
        // Pass list directly — React state hasn't updated yet at this point
        fetchAccounts(1, recordsPerPage, preselected, "", "All", list);
        fetchCategoryOptions(preselected, list);
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
        setIsLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminInfo?.id]);

  const handlePageChange = (page) => {
    const newPage = Number(page);
    if (newPage !== currentPageRef.current) {
      currentPageRef.current = newPage;
      setCurrentPage(newPage);
      fetchAccounts(
        newPage,
        recordsPerPage,
        selectedBusinesses,
        searchQuery,
        category
      );
    }
  };

  const handleBusinessesChange = (ids) => {
    const next = Array.isArray(ids) ? ids : [];
    setSelectedBusinesses(next);
    setCategory("All");
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchAccounts(1, recordsPerPage, next, searchQuery, "All");
    fetchCategoryOptions(next);
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchAccounts(1, recordsPerPage, selectedBusinesses, searchQuery, cat);
  };

  const handleSearch = (searchTerm) => {
    setSearchQuery(searchTerm);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchAccounts(
      1,
      recordsPerPage,
      selectedBusinesses,
      searchTerm,
      category
    );
  };

  const clearAllFilters = () => {
    const preselected = businesses.length === 1 ? [businesses[0]._id] : [];
    setSelectedBusinesses(preselected);
    setCategory("All");
    setSearchQuery("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchAccounts(1, recordsPerPage, preselected, "", "All", businesses);
  };

  const handleViewAccount = async (id) => {
    setIsLoadingAccount(true);
    setShowModal(true);
    try {
      const response = await axios.get(`${Base_URL}/accounts/${id}`);
      setSelectedAccount(response.data);
    } catch (error) {
      console.error("Error fetching account details:", error);
      alert("Failed to load account details");
    } finally {
      setIsLoadingAccount(false);
    }
  };

  const handleDeleteAccount = async (id, name) => {
    if (!window.confirm(`Delete account "${name}"? This cannot be undone.`))
      return;
    try {
      await axios.delete(`${Base_URL}/accounts/${id}`);
      notifySuccess("Account deleted successfully");
      fetchAccounts(
        currentPage,
        recordsPerPage,
        selectedBusinesses,
        searchQuery,
        category
      );
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to delete account");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAccount(null);
  };

  const buildActionItems = (account) => [
    ...(routePerms.canUpdate
      ? [
          {
            action: ACTION_BUTTON_TYPES.EDIT,
            title: "Edit",
            onClick: () => history.push(`/chart-of-account/${account._id}`),
          },
        ]
      : []),
    ...(routePerms.canViewDetails
      ? [
          {
            action: ACTION_BUTTON_TYPES.VIEW,
            title: "View account details",
            onClick: () => handleViewAccount(account._id),
          },
        ]
      : []),
    ...(routePerms.canDelete
      ? [
          {
            action: ACTION_BUTTON_TYPES.DELETE,
            title: "Delete account",
            onClick: () =>
              handleDeleteAccount(account._id, account.accountName),
          },
        ]
      : []),
  ];

  const columns = [
    {
      key: "name",
      header: "Account Name",
      render: (row) => (
        <span className="epc-cell__primary">{row.accountName || "—"}</span>
      ),
    },
    {
      key: "code",
      header: "Account Code",
      render: (row) => (
        <span className="epc-cell__secondary">{row.code || "—"}</span>
      ),
    },
    {
      key: "type",
      header: "Account Type",
      render: (row) =>
        row.accountType ? (
          <>
            <div className="epc-cell__primary">{row.accountType.name}</div>
            <div className="epc-cell__secondary">
              {row.accountType.accountHeader}
            </div>
          </>
        ) : (
          "—"
        ),
    },
    {
      key: "parent",
      header: "Parent Account",
      render: (row) => row.parentAccount?.accountName || "—",
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
    ...(!isSingleAssignedBusiness()
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
      key: "category",
      placeholder: "All Categories",
      options: [
        { value: "", label: "All Categories" },
        ...availableCategories
          .filter((cat) => cat !== "All")
          .map((cat) => ({ value: cat, label: cat })),
      ],
    },
  ];

  // FilterBar uses "" for "all"; internal state still uses "All" for API
  const filterValues = {
    business:
      selectedBusinesses.length === 1 ? selectedBusinesses[0] : "",
    category: category === "All" ? "" : category,
  };

  return (
    <RouteActionGate
      title="Chart of Accounts"
      requiredPermission={PERMISSION_ACTION.VIEW}
    >
      <EpcListPage
        title="Chart of Accounts"
        subtitle="Manage and organise your chart of accounts"
        action={
          routePerms.canAdd ? (
            <Button onClick={() => history.push("/add-new-account")}>
              <PlusIcon size={15} />
              Add New
            </Button>
          ) : null
        }
        searchValue={searchQuery}
        searchPlaceholder="Search accounts..."
        onSearchChange={handleSearch}
        filterSubtitle="Narrow by business or account category."
        filters={portalFilters}
        filterValues={filterValues}
        onFilterChange={(key, value) => {
          if (key === "business") {
            handleBusinessesChange(value ? [value] : []);
          } else if (key === "category") {
            handleCategoryChange(value || "All");
          }
        }}
        onFilterReset={clearAllFilters}
        tableTitle="Accounts"
        tableSubtitle={
          isLoading ? "Loading…" : `${totalResults} total accounts`
        }
        columns={columns}
        rows={accounts}
        rowKey="_id"
        loading={isLoading}
        emptyMessage="No accounts found"
        page={currentPage}
        pageSize={recordsPerPage}
        total={totalResults}
        itemLabel="accounts"
        onPageChange={handlePageChange}
        onPageSizeChange={(perPage) => {
          setRecordsPerPage(perPage);
          currentPageRef.current = 1;
          setCurrentPage(1);
          fetchAccounts(1, perPage, selectedBusinesses, searchQuery, category);
        }}
      >
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
            onClick={closeModal}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] relative flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">
                  Account Details
                </h2>
                <button
                  className="text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] rounded-full p-1"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {isLoadingAccount ? (
                  <div className="text-center py-6">
                    <p className="text-gray-600">Loading account details...</p>
                  </div>
                ) : (
                  selectedAccount && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">
                            Account Name
                          </p>
                          <p className="font-medium text-gray-900">
                            {selectedAccount.accountName}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">
                            Account Code
                          </p>
                          <p className="font-medium text-gray-900">
                            {selectedAccount.code || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">
                            Account Type
                          </p>
                          <p className="font-medium text-gray-900">
                            {selectedAccount.accountType
                              ? `${selectedAccount.accountType.name} (${selectedAccount.accountType.accountHeader})`
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">
                            Transaction Type
                          </p>
                          <p className="font-medium text-gray-900">
                            {selectedAccount.isDebit ? "Debit" : "Credit"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600 mb-1">
                            Parent Account
                          </p>
                          <p className="font-medium text-gray-900">
                            {selectedAccount.parentAccount?.accountName ||
                              "None"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Description
                        </h3>
                        <p className="text-gray-600">
                          {selectedAccount.description ||
                            "No description provided"}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="flex justify-end p-6 pt-4 border-t border-gray-200 flex-shrink-0">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </EpcListPage>
    </RouteActionGate>
  );
};

export default ChartOfAccounts;
