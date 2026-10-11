import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { FiEye, FiKey, FiTrash2 } from "react-icons/fi";
import { Plus } from "lucide-react";
import { useHistory } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { DataTable, ToggleSwitch, CustomModal, SummaryCards } from "@/page-layouts";
import { groupCustomersByEmail } from "@/utils/groupByEntity";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { getCountryOptions } from "@/utils/locationCascade";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CustomerListScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [customerToUpdateStatus, setCustomerToUpdateStatus] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  // Use same default as DataTable config (table_entries_per_page) to avoid duplicate API call on load
  const [recordsPerPage, setRecordsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);

  const routePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canView, canViewDetails, canDelete } = routePerms;

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [customerToResetPassword, setCustomerToResetPassword] = useState(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [overallStats, setOverallStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    companyCustomers: 0,
  });

  const countryFilterOptions = useMemo(
    () =>
      getCountryOptions().map((c) => ({
        value: c.label,
        label: c.label,
      })),
    []
  );

  const headers = useMemo(() => {
    const cols = [
      t("customer.companyName"),
      t("customer.companyRegistrationNumber"),
      t("customer.email"),
      t("customer.country"),
      t("customer.stateProvince"),
      t("customer.city"),
      t("customer.website"),
    ];
    if (!isSingleAssignedBusiness()) {
      cols.push(t("customer.businesses"));
    }
    cols.push(t("Status"), t("common.action"));
    return cols;
  }, [t]);

  const handleAddNew = () => {
    history.push("/New Customer");
  };

  const handleViewCustomer = (customerId) => {
    if (!(canView || canViewDetails || canUpdate)) return;
    history.push(`/Edit Customer/${customerId}`);
  };

  const openDeleteCustomer = (customer) => {
    if (!canDelete) return;
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setCustomerToDelete(null);
  };

  const openResetPassword = (customer) => {
    if (!canUpdate) return;
    setCustomerToResetPassword(customer);
    setResetPasswordModalOpen(true);
  };

  const closeResetPasswordModal = () => {
    setResetPasswordModalOpen(false);
    setCustomerToResetPassword(null);
  };

  const confirmResetPassword = async () => {
    if (!customerToResetPassword?._id || !canUpdate) return;
    try {
      setResetPasswordLoading(true);
      const response = await axios.post(
        `${Base_URL}/customers/${customerToResetPassword._id}/reset-password`
      );
      notifySuccess(
        response?.data?.message || t("customer.resetPasswordSuccess")
      );
      closeResetPasswordModal();
    } catch (err) {
      console.error(err);
      notifyError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          t("customer.resetPasswordFailed")
      );
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete?._id || !canDelete) return;
    try {
      setDeleteLoading(true);
      await axios.delete(`${Base_URL}/customers/${customerToDelete._id}`);
      notifySuccess(t("customer.deletedSuccess"));
      closeDeleteModal();
      refetchCustomers(currentPageRef.current, recordsPerPage);
    } catch (err) {
      console.error(err);
      notifyError(
        err?.response?.data?.message || err?.response?.data?.error || t("customer.deleteFailed")
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    const fetchBusinessesAndCustomers = async () => {
      try {
        // Resolve initial limit from config (same as DataTable) so we make only one customers API call
        let initialLimit = 5;
        try {
          const cached = localStorage.getItem("configurations");
          if (cached) {
            const cfg = JSON.parse(cached);
            const stored = cfg?.table_entries_per_page;
            if (Number.isFinite(stored) && stored > 0) {
              initialLimit = Number(stored);
              setRecordsPerPage(initialLimit);
            }
          } else {
            const res = await fetch(`${Base_URL}/configuration`);
            if (res.ok) {
              const data = await res.json();
              const cfg = Array.isArray(data) && data.length > 0 ? data[0] : data;
              const stored = cfg?.table_entries_per_page;
              if (Number.isFinite(stored) && stored > 0) {
                initialLimit = Number(stored);
                setRecordsPerPage(initialLimit);
              }
              try {
                localStorage.setItem("configurations", JSON.stringify(cfg || {}));
              } catch (e) { }
            }
          }
        } catch (e) {
          // keep initialLimit 5
        }

        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedBusinesses = JSON.parse(storedBusinesses);
          setBusinesses(parsedBusinesses);
          setBusinessesLoading(false);
          const defaultBusinessId =
            Array.isArray(parsedBusinesses) &&
            parsedBusinesses.length === 1 &&
            parsedBusinesses[0]?._id
              ? String(parsedBusinesses[0]._id)
              : "";
          if (defaultBusinessId) {
            setSelectedBusiness(defaultBusinessId);
          }
          // Single fetch with configured limit (no duplicate call with limit=10)
          fetchCustomers(defaultBusinessId, 1, initialLimit, "");
        }
      } catch (err) {
        console.error("Error fetching businesses:", err);
        setBusinessesLoading(false);
      }
    };

    fetchBusinessesAndCustomers();
  }, []);

  const fetchCustomers = async (
    businessId,
    page = 1,
    limit,
    search = "",
    status = "",
    country = ""
  ) => {
    try {
      setLoading(true);
      setError(null);

      const hasSearch = search && search.trim();
      const storedBusinesses = localStorage.getItem("businesses");
      const parsedBusinesses = storedBusinesses ? JSON.parse(storedBusinesses) : [];
      const isMultipleBusinesses = !businessId && parsedBusinesses.length > 1;

      // Fetch all when searching OR when multiple businesses (for grouping)
      const needFetchAll = hasSearch || isMultipleBusinesses;
      const params = {
        page: needFetchAll ? 1 : page,
        limit: needFetchAll ? 9999 : (limit || recordsPerPage),
      };

      if (businessId) {
        params.businessId = businessId;
      } else if (parsedBusinesses.length > 0) {
        params.businessIds = JSON.stringify(
          parsedBusinesses.map((business) => business._id)
        );
      }

      if (status) {
        params.status = status;
      }
      if (country) {
        params.country = country;
      }
      if (hasSearch) {
        params.search = search.trim();
      }

      const response = await axios.get(`${Base_URL}/customers`, { params });

      let customersData = Array.isArray(response.data.customers)
        ? response.data.customers
        : [];

      // Client-side search covers extra fields / multi-business grouping cases
      if (hasSearch) {
        const searchValue = search.trim().toLowerCase();
        customersData = customersData.filter((customer) => {
          const bi = customer.basicInformation || {};
          const haystack = [
            bi.companyName,
            bi.customerDisplayName,
            bi.companyRegistrationNumber,
            bi.customerEmail,
            bi.website,
            bi.country,
            bi.stateProvince,
            bi.city,
            bi.postCode,
            bi.companyAddress,
            bi.addressLabel,
            bi.customerCode,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(searchValue);
        });
      }

      if (isMultipleBusinesses && customersData.length > 0) {
        const grouped = groupCustomersByEmail(customersData, parsedBusinesses);
        const totalFiltered = grouped.length;
        const startIndex = (page - 1) * (limit || recordsPerPage);
        const endIndex = startIndex + (limit || recordsPerPage);
        const paginatedData = grouped.slice(startIndex, endIndex);

        setTotalResults(totalFiltered);
        setFilteredCustomers(paginatedData);
      } else if (hasSearch) {
        const totalFiltered = customersData.length;
        const startIndex = (page - 1) * recordsPerPage;
        const endIndex = startIndex + recordsPerPage;
        const paginatedData = customersData.slice(startIndex, endIndex);

        setTotalResults(totalFiltered);
        setFilteredCustomers(paginatedData);
      } else {
        setTotalResults(response.data.total);
        setFilteredCustomers(customersData);
      }

      setCustomers(customersData);

      const fromApi = response.data?.overallStats;
      if (fromApi && typeof fromApi === "object") {
        setOverallStats({
          totalCustomers: Number(fromApi.totalCustomers) || 0,
          activeCustomers: Number(fromApi.activeCustomers) || 0,
          inactiveCustomers: Number(fromApi.inactiveCustomers) || 0,
          companyCustomers: Number(fromApi.companyCustomers) || 0,
        });
      } else {
        setOverallStats({
          totalCustomers: response.data.total || 0,
          activeCustomers: 0,
          inactiveCustomers: 0,
          companyCustomers: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError(t("customer.fetchFailed"));
    } finally {
      setLoading(false);
    }
  };

  const refetchCustomers = (
    page = currentPageRef.current,
    limit = recordsPerPage,
    overrides = {}
  ) => {
    fetchCustomers(
      overrides.businessId !== undefined ? overrides.businessId : selectedBusiness,
      page,
      limit,
      overrides.search !== undefined ? overrides.search : searchTerm,
      overrides.status !== undefined ? overrides.status : selectedStatus,
      overrides.country !== undefined ? overrides.country : selectedCountry
    );
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    refetchCustomers(page, recordsPerPage);
  };

  const handleBusinessChange = (businessId) => {
    setSelectedBusiness(businessId);
    setCurrentPage(1);
    currentPageRef.current = 1;
    refetchCustomers(1, recordsPerPage, { businessId });
  };

  const handleStatusFilterChange = (value) => {
    setSelectedStatus(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    refetchCustomers(1, recordsPerPage, { status: value });
  };

  const handleCountryChange = (value) => {
    setSelectedCountry(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    refetchCustomers(1, recordsPerPage, { country: value });
  };

  const handleSearch = (defaultValue) => {
    const searchValue = defaultValue || "";
    setSearchTerm(searchValue);
    setCurrentPage(1);
    currentPageRef.current = 1;
    refetchCustomers(1, recordsPerPage, { search: searchValue });
  };

  const handleStatusClick = (customer) => {
    setCustomerToUpdateStatus(customer);
    setNewStatus(customer.status === "Active" ? "Inactive" : "Active");
    setStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setCustomerToUpdateStatus(null);
    setNewStatus("");
  };

  const updateStatus = async () => {
    if (!customerToUpdateStatus || !newStatus) return;

    try {
      setLoading(true);
      const response = await axios.put(
        `${Base_URL}/customers/${customerToUpdateStatus._id}`,
        { status: newStatus }
      );

      if (response.status === 200) {
        notifySuccess(
          t("customer.statusUpdated", {
            from: customerToUpdateStatus.status,
            to: newStatus,
          })
        );
        closeStatusModal();
        refetchCustomers(currentPage, recordsPerPage);
      } else {
        notifyError(t("customer.statusUpdateFailed"));
      }
    } catch (err) {
      console.error("Error updating customer status:", err);
      notifyError(t("customer.statusUpdateFailed"));
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSelectedBusiness("");
    setSelectedStatus("");
    setSelectedCountry("");
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchCustomers("", 1, recordsPerPage, "", "", "");
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
        },
      },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: t("Business"),
            value: selectedBusiness,
            placeholder: t("customer.selectBusiness"),
            onChange: (value) => {
              handleBusinessChange(value);
            },
            options: [
              { value: "", label: t("common.allBusinesses") },
              ...businesses.map((business) => ({
                value: business._id,
                label: business.name,
              })),
            ],
          },
        ]
      : []),
    {
      value: selectedStatus,
      onChange: handleStatusFilterChange,
      placeholder: t("Status"),
      isClearable: true,
      options: [
        { value: "", label: t("common.allStatuses") },
        { value: "Active", label: t("common.active") },
        { value: "Inactive", label: t("common.inactive") },
      ],
    },
    {
      value: selectedCountry,
      onChange: handleCountryChange,
      placeholder: t("customer.country"),
      isClearable: true,
      options: [
        { value: "", label: t("customer.allCountries") },
        ...countryFilterOptions,
      ],
    },
  ];


  // Calculate total pages based on filtered results
  const totalPages = Math.ceil(totalResults / recordsPerPage) || 1;

  const summaryCardsData = useMemo(
    () => [
      {
        title: t("customer.totalCustomers"),
        value: overallStats.totalCustomers || totalResults || 0,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: t("common.active"),
        value: overallStats.activeCustomers || 0,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: t("common.inactive"),
        value: overallStats.inactiveCustomers || 0,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: InProgressSvg,
      },
      {
        title: t("customer.companies"),
        value: overallStats.companyCustomers || 0,
        backgroundColor: "completed-light",
        iconColor: "overdue-dark",
        Icon: DelayedSvg,
      },
    ],
    [overallStats, totalResults, t],
  );

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t("customer.title")}</h1>
              <p className="text-gray-600 mt-2">
                {!selectedBusiness
                  ? t("customer.showingFromAllBusinesses")
                  : t("customer.manageSubtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              {canAdd && (
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  {t("Add New")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 w-full max-w-full min-w-0 overflow-x-hidden">
          <SummaryCards cards={summaryCardsData} columnsCount={4} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
      <DataTable
        //for filters
        onSearch={handleSearch}
        searchValue={searchTerm}
        searchPlaceholder={t("Search")}
        filters={filters}
        //for table
        headers={headers}
        data={filteredCustomers}
        loading={loading || businessesLoading}
        totalRecords={totalResults}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={handlePageChange}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          currentPageRef.current = 1;
          setCurrentPage(1);
          refetchCustomers(1, perPage);
        }}
        renderRow={(customer) => {
          const bi = customer.basicInformation || {};
          const addr = Array.isArray(customer.addresses)
            ? customer.addresses[0] || {}
            : {};
          const showBusinesses = !isSingleAssignedBusiness();
          const cell = (value) => {
            const text = value != null ? String(value).trim() : "";
            return text || "—";
          };
          return (
          <tr key={customer._id} className="border-b">
            <td className="py-2 px-4">
              {cell(bi.companyName || bi.customerDisplayName)}
            </td>
            <td className="py-2 px-4">
              {cell(bi.companyRegistrationNumber)}
            </td>
            <td className="py-2 px-4">
              {cell(bi.customerEmail)}
            </td>
            <td className="py-2 px-4">
              {cell(bi.country || addr.country)}
            </td>
            <td className="py-2 px-4">
              {cell(bi.stateProvince || addr.state)}
            </td>
            <td className="py-2 px-4">
              {cell(bi.city || addr.city)}
            </td>
            <td className="py-2 px-4 max-w-[180px] truncate" title={bi.website || ""}>
              {cell(bi.website)}
            </td>
            {showBusinesses && (
            <td className="py-2 px-4">
              {(() => {
                const filterBusinessName = selectedBusiness
                  ? (businesses.find((b) => (b._id || b.id)?.toString() === String(selectedBusiness))?.name)
                  : null;
                if (selectedBusiness) return filterBusinessName || customer?.business?.name || "-";
                return customer.businessesDisplay ?? (() => {
                  const names = new Set();
                  const primary = customer?.business?.name;
                  if (primary) names.add(primary);
                  if (Array.isArray(customer.businesses)) {
                    customer.businesses.forEach((b) => {
                      const id = (b?._id || b)?.toString();
                      const found = businesses.find((x) => (x._id || x.id)?.toString() === id);
                      if (found?.name) names.add(found.name);
                    });
                  }
                  return Array.from(names).filter(Boolean).join(", ") || "-";
                })();
              })()}
            </td>
            )}
            <td className="py-2 px-4">
              {canUpdate ? (
                <ToggleSwitch
                  isOn={customer.status === "Active"}
                  handleToggle={() => handleStatusClick(customer)}
                  disabled={loading}
                />
              ) : (
                <span className="text-sm text-gray-600">
                  {customer.status === "Active"
                    ? t("common.active")
                    : customer.status === "Inactive"
                      ? t("common.inactive")
                      : customer.status}
                </span>
              )}
            </td>
            <td className="py-2 px-4">
              <div className="flex items-center gap-1 flex-wrap">
                {(canView || canViewDetails || canUpdate) && (
                  <button
                    type="button"
                    className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => handleViewCustomer(customer._id)}
                    title={t("common.view") || "View"}
                  >
                    <FiEye size={14} />
                  </button>
                )}
                {canUpdate && (
                  <button
                    type="button"
                    className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => openResetPassword(customer)}
                    title={t("customer.resetPassword") || "Reset password"}
                    disabled={resetPasswordLoading}
                  >
                    <FiKey size={14} />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => openDeleteCustomer(customer)}
                    title={t("common.delete") || "Delete"}
                  >
                    <FiTrash2 size={14} />
                  </button>
                )}
              </div>
            </td>
          </tr>
          );
        }}
      />
        </div>

      {/* Status Update Modal */}
      <CustomModal
        open={statusModalOpen}
        onClose={closeStatusModal}
        title={t("customer.updateCustomerStatus")}
        width="500px"
        showActions={true}
        actions={[
          {
            label: t("Cancel"),
            secondary: true,
            onClick: closeStatusModal,
          },
          {
            label: loading ? t("common.updating") : t("customer.updateStatus"),
            primary: true,
            onClick: updateStatus,
            disabled: loading || !newStatus,
          },
        ]}
      >
        {customerToUpdateStatus && (
          <div className="space-y-4">
            <div className="mb-4">
              <p className="text-base text-gray-700 font-medium">
                {t("customer.areYouSureChangeStatus")}
              </p>
            </div>
          </div>
        )}
      </CustomModal>

      <CustomModal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title={t("customer.deleteCustomer")}
        width="440px"
        showActions
        actions={[
          { label: t("Cancel"), secondary: true, onClick: closeDeleteModal },
          {
            label: deleteLoading ? t("customer.deleting") : t("Delete"),
            failure: true,
            disabled: deleteLoading,
            onClick: confirmDeleteCustomer,
          },
        ]}
      >
        {customerToDelete && (
          <p className="text-sm text-gray-700">
            {t("customer.deleteConfirm")}
          </p>
        )}
      </CustomModal>

      <CustomModal
        open={resetPasswordModalOpen}
        onClose={closeResetPasswordModal}
        title={t("customer.resetPassword")}
        width="440px"
        showActions
        actions={[
          {
            label: t("Cancel"),
            secondary: true,
            onClick: closeResetPasswordModal,
          },
          {
            label: resetPasswordLoading
              ? t("customer.resettingPassword")
              : t("customer.resetPassword"),
            primary: true,
            disabled: resetPasswordLoading,
            onClick: confirmResetPassword,
          },
        ]}
      >
        {customerToResetPassword && (
          <p className="text-sm text-gray-700">
            {t("customer.resetPasswordConfirm", {
              email:
                customerToResetPassword.basicInformation?.customerEmail || "—",
            })}
          </p>
        )}
      </CustomModal>
      </div>
    </div>
  );
};

export default CustomerListScreen;
