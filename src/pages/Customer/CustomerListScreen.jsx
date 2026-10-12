import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { FiEye, FiKey, FiTrash2 } from "react-icons/fi";
import { useHistory } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ToggleSwitch, CustomModal, SummaryCards } from "@/page-layouts";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";
import { groupCustomersByEmail } from "@/utils/groupByEntity";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { getCountryOptions } from "@/utils/locationCascade";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import DelayedSvg from "@/assets/img/delayed.svg";

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
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          t("customer.deleteFailed")
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    const fetchBusinessesAndCustomers = async () => {
      try {
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
              const cfg =
                Array.isArray(data) && data.length > 0 ? data[0] : data;
              const stored = cfg?.table_entries_per_page;
              if (Number.isFinite(stored) && stored > 0) {
                initialLimit = Number(stored);
                setRecordsPerPage(initialLimit);
              }
              try {
                localStorage.setItem(
                  "configurations",
                  JSON.stringify(cfg || {})
                );
              } catch (e) {}
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
      const parsedBusinesses = storedBusinesses
        ? JSON.parse(storedBusinesses)
        : [];
      const isMultipleBusinesses = !businessId && parsedBusinesses.length > 1;

      const needFetchAll = hasSearch || isMultipleBusinesses;
      const params = {
        page: needFetchAll ? 1 : page,
        limit: needFetchAll ? 9999 : limit || recordsPerPage,
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
      overrides.businessId !== undefined
        ? overrides.businessId
        : selectedBusiness,
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

  const portalFilters = useMemo(() => {
    const list = [];
    if (!isSingleAssignedBusiness()) {
      list.push({
        key: "business",
        placeholder: t("customer.selectBusiness"),
        options: [
          { value: "", label: t("common.allBusinesses") },
          ...businesses.map((business) => ({
            value: business._id,
            label: business.name,
          })),
        ],
      });
    }
    list.push(
      {
        key: "status",
        placeholder: t("Status"),
        options: [
          { value: "", label: t("common.allStatuses") },
          { value: "Active", label: t("common.active") },
          { value: "Inactive", label: t("common.inactive") },
        ],
      },
      {
        key: "country",
        placeholder: t("customer.country"),
        options: [
          { value: "", label: t("customer.allCountries") },
          ...countryFilterOptions,
        ],
      }
    );
    return list;
  }, [t, businesses, countryFilterOptions]);

  const portalFilterValues = {
    business: selectedBusiness || "",
    status: selectedStatus || "",
    country: selectedCountry || "",
  };

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      handleBusinessChange(value || "");
      return;
    }
    if (key === "status") {
      handleStatusFilterChange(value || "");
      return;
    }
    if (key === "country") {
      handleCountryChange(value || "");
    }
  };

  const summaryCardsData = [
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
  ];

  const showBusinesses = !isSingleAssignedBusiness();

  const columns = useMemo(() => {
    const cell = (value) => {
      const text = value != null ? String(value).trim() : "";
      return text || "—";
    };

    const cols = [
      {
        key: "companyName",
        header: t("customer.companyName"),
        width: "14%",
        render: (customer) => {
          const bi = customer.basicInformation || {};
          return (
            <span className="epc-cell__primary">
              {cell(bi.companyName || bi.customerDisplayName)}
            </span>
          );
        },
      },
      {
        key: "regNo",
        header: t("customer.companyRegistrationNumber"),
        width: "12%",
        render: (customer) =>
          cell(customer.basicInformation?.companyRegistrationNumber),
      },
      {
        key: "email",
        header: t("customer.email"),
        width: "14%",
        render: (customer) =>
          cell(customer.basicInformation?.customerEmail),
      },
      {
        key: "country",
        header: t("customer.country"),
        width: "10%",
        render: (customer) => {
          const bi = customer.basicInformation || {};
          const addr = Array.isArray(customer.addresses)
            ? customer.addresses[0] || {}
            : {};
          return cell(bi.country || addr.country);
        },
      },
      {
        key: "state",
        header: t("customer.stateProvince"),
        width: "10%",
        render: (customer) => {
          const bi = customer.basicInformation || {};
          const addr = Array.isArray(customer.addresses)
            ? customer.addresses[0] || {}
            : {};
          return cell(bi.stateProvince || addr.state);
        },
      },
      {
        key: "city",
        header: t("customer.city"),
        width: "10%",
        render: (customer) => {
          const bi = customer.basicInformation || {};
          const addr = Array.isArray(customer.addresses)
            ? customer.addresses[0] || {}
            : {};
          return cell(bi.city || addr.city);
        },
      },
      {
        key: "website",
        header: t("customer.website"),
        width: "10%",
        render: (customer) => {
          const website = customer.basicInformation?.website;
          return (
            <span className="epc-cell__secondary" title={website || ""}>
              {cell(website)}
            </span>
          );
        },
      },
    ];

    if (showBusinesses) {
      cols.push({
        key: "businesses",
        header: t("customer.businesses"),
        width: "12%",
        render: (customer) => {
          const filterBusinessName = selectedBusiness
            ? businesses.find(
                (b) =>
                  (b._id || b.id)?.toString() === String(selectedBusiness)
              )?.name
            : null;
          if (selectedBusiness)
            return filterBusinessName || customer?.business?.name || "—";
          if (customer.businessesDisplay) return customer.businessesDisplay;
          const names = new Set();
          const primary = customer?.business?.name;
          if (primary) names.add(primary);
          if (Array.isArray(customer.businesses)) {
            customer.businesses.forEach((b) => {
              const id = (b?._id || b)?.toString();
              const found = businesses.find(
                (x) => (x._id || x.id)?.toString() === id
              );
              if (found?.name) names.add(found.name);
            });
          }
          return Array.from(names).filter(Boolean).join(", ") || "—";
        },
      });
    }

    cols.push(
      {
        key: "status",
        header: t("Status"),
        width: "8%",
        render: (customer) =>
          canUpdate ? (
            <ToggleSwitch
              isOn={customer.status === "Active"}
              handleToggle={() => handleStatusClick(customer)}
              disabled={loading}
            />
          ) : (
            <span className="epc-cell__secondary">
              {customer.status === "Active"
                ? t("common.active")
                : customer.status === "Inactive"
                  ? t("common.inactive")
                  : customer.status}
            </span>
          ),
      },
      {
        key: "actions",
        header: t("common.action"),
        width: "10%",
        align: "right",
        render: (customer) => (
          <div className="flex items-center gap-1 flex-wrap justify-end">
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
        ),
      }
    );

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    t,
    showBusinesses,
    selectedBusiness,
    businesses,
    canUpdate,
    canView,
    canViewDetails,
    canDelete,
    loading,
    resetPasswordLoading,
  ]);

  const isLoading = loading || businessesLoading;

  return (
    <EpcPage
      title={t("customer.title")}
      subtitle={
        !selectedBusiness
          ? t("customer.showingFromAllBusinesses")
          : t("customer.manageSubtitle")
      }
      action={
        canAdd ? (
          <Button onClick={handleAddNew}>
            <PlusIcon size={15} />
            {t("Add New")}
          </Button>
        ) : null
      }
    >
      <SummaryCards
        cards={summaryCardsData}
        columnsCount={4}
        loading={isLoading && filteredCustomers.length === 0}
      />

      <FilterBar
        subtitle={t("customer.manageSubtitle")}
        searchPlaceholder={t("Search")}
        searchValue={searchTerm}
        onSearchChange={handleSearch}
        filters={portalFilters}
        values={portalFilterValues}
        onChange={handlePortalFilterChange}
        onReset={clearAllFilters}
      />

      <Card>
        <CardHeader
          title={t("customer.title")}
          subtitle={
            isLoading
              ? "Loading…"
              : `${totalResults} ${
                  totalResults === 1 ? "customer" : "customers"
                }`
          }
          action={
            <span className="epc-chip">
              {overallStats.activeCustomers || 0} active ·{" "}
              {overallStats.inactiveCustomers || 0} inactive
            </span>
          }
        />

        <PortalDataTable
          columns={columns}
          rows={isLoading ? [] : filteredCustomers}
          rowKey="_id"
          emptyMessage={
            isLoading
              ? "Loading…"
              : error || "No customers match these filters."
          }
        />

        {!isLoading && totalResults > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={recordsPerPage}
            total={totalResults}
            itemLabel="customers"
            onPageChange={handlePageChange}
            onPageSizeChange={(perPage) => {
              setRecordsPerPage(perPage);
              currentPageRef.current = 1;
              setCurrentPage(1);
              refetchCustomers(1, perPage);
            }}
          />
        ) : null}
      </Card>

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
          <p className="text-sm text-gray-700">{t("customer.deleteConfirm")}</p>
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
    </EpcPage>
  );
};

export default CustomerListScreen;
