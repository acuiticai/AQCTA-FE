import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import {
  DataTable,
  ActionButtons,
  ToggleSwitch,
} from "@/page-layouts";
import { Plus } from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** System category for inspection costing — edit/delete disabled. */
const isFixedCategory = (category) =>
  /staff\s*man\s*hours?/i.test(String(category?.name || ""));

const Categories = () => {
  const { t } = useTranslation();
  const checkTokenExpired = useCheckTokenExpired();
  const routePerms = useRouteModulePermissions();
  const {
    canAdd,
    canUpdate,
    canDelete,
    canView,
    canViewDetails,
  } = routePerms;
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]); // multi-select
  const [totalResults, setTotalResults] = useState(0);
  // Match DataTable's stored table_entries_per_page so first fetch uses correct limit (avoids flash of 10 then 5)
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    try {
      const c = localStorage.getItem("configurations");
      if (c) {
        const parsed = JSON.parse(c);
        const p = parsed && parsed.table_entries_per_page;
        if (Number.isFinite(p) && p > 0) return Number(p);
      }
    } catch (_) {}
    return 10;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [categoryToUpdateStatus, setCategoryToUpdateStatus] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  // For delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentPageRef = useRef(1);
  const history = useHistory();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list);
        setBusinessesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Separate useEffect to fetch categories when businesses are loaded
  useEffect(() => {
    if (businessesLoading) return;
    if (selectedBusinesses.length === 0 && statusFilter === null) {
      fetchCategories("", 1, recordsPerPage, "", "All");
    }
  }, [businessesLoading, businesses]);

  const handleEdit = (category) => {
    if (!canUpdate || isFixedCategory(category)) return;
    history.push(`/edit-category/${category._id}`);
  };

  const handleViewDetails = (category) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setCategoryToUpdateStatus(null);
  };

  const openDeleteModal = (category) => {
    if (!canDelete || isFixedCategory(category)) return;
    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setCategoryToDelete(null);
    setDeleteModalOpen(false);
  };

  const fetchCategories = async (
    businessId,
    page = 1,
    limit = 10,
    search = "",
    status = "All",
    businessIdsOverride = null
  ) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      let url = `${Base_URL}/categories?page=${page}&limit=${limit}`;

      const assignedBusinessIds = businesses.map((b) => b?._id).filter(Boolean);

      if (businessId) {
        url += `&businessId=${businessId}`;
      } else {
        let effectiveBusinessIds = [];

        if (businessIdsOverride !== null) {
          if (Array.isArray(businessIdsOverride) && businessIdsOverride.length > 0) {
            effectiveBusinessIds = businessIdsOverride;
          } else {
            effectiveBusinessIds = assignedBusinessIds;
          }
        } else if (selectedBusinesses.length > 1) {
          effectiveBusinessIds = selectedBusinesses;
        } else {
          effectiveBusinessIds = assignedBusinessIds;
        }

        if (effectiveBusinessIds.length === 0) {
          setFilteredCategories([]);
          setTotalResults(0);
          setLoading(false);
          return;
        }

        if (effectiveBusinessIds.length === 1) {
          url += `&businessId=${effectiveBusinessIds[0]}`;
        } else {
          url += `&businessIds=${effectiveBusinessIds.join(",")}`;
        }
      }

      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      if (status && status !== "All" && status !== null) {
        url += `&status=${status}`;
      }

      // Inventory catalog only — keep separate from settings class/categories
      url += `&purpose=inventory`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        setFilteredCategories(response.data.categories || response.data);
        setTotalResults(response.data.total || response.data.length || 0);
        setCurrentPage(page);
        currentPageRef.current = page;
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      if (err.response?.status === 401) {
        checkTokenExpired();
      } else {
        setError(err.response?.data?.message || t("category.loadFailed"));
        notifyError(err.response?.data?.message || t("category.loadFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    const businessId = selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
    const status = statusFilter || "All";
    fetchCategories(businessId, 1, recordsPerPage, searchValue, status);
  };

  const handlePageChange = (page) => {
    const businessId = selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
    const status = statusFilter || "All";
    fetchCategories(businessId, page, recordsPerPage, searchTerm, status);
  };

  const handleBusinessesChange = (ids) => {
    const nextSelected = Array.isArray(ids) ? ids : [];
    setSelectedBusinesses(nextSelected);
    setCurrentPage(1);
    currentPageRef.current = 1;
    const status = statusFilter || "All";
    // If multiple businesses selected, pass empty businessId and let fetchCategories use businessIds list.
    const businessId = nextSelected.length === 1 ? nextSelected[0] : "";
    fetchCategories(
      businessId,
      1,
      recordsPerPage,
      searchTerm,
      status,
      nextSelected.length > 1
        ? nextSelected
        : nextSelected.length === 0
          ? []
          : null
    );
  };

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    currentPageRef.current = 1;
    const businessId = selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
    fetchCategories(businessId, 1, recordsPerPage, searchTerm, status || "All");
  };

  const clearAllFilters = () => {
    setSelectedBusinesses([]);
    setStatusFilter(null);
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchCategories("", 1, recordsPerPage, "", "All", []);
  };

  const handleStatusToggle = (category) => {
    if (!canUpdate) return;
    setCategoryToUpdateStatus(category);
    setStatusModalOpen(true);
  };

  const confirmStatusUpdate = async () => {
    if (!categoryToUpdateStatus || !canUpdate) return;

    try {
      const token = localStorage.getItem("token");
      const newStatus = categoryToUpdateStatus.status === "Active" ? "Inactive" : "Active";

      await axios.patch(
        `${Base_URL}/categories/${categoryToUpdateStatus._id}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      notifySuccess(
        `${t("common.statusUpdatedTo")} ${
          newStatus === "Active" ? t("common.active") : t("common.inactive")
        }`
      );
      closeStatusModal();

      // Refresh the list
      const businessId = selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
      const status = statusFilter || "All";
      fetchCategories(businessId, currentPage, recordsPerPage, searchTerm, status);
    } catch (err) {
      console.error("Error updating category status:", err);
      if (err.response?.status === 401) {
        checkTokenExpired();
      } else {
        notifyError(err.response?.data?.message || t("common.statusUpdateFailed"));
      }
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete || !canDelete || deleteLoading) return;

    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${Base_URL}/categories/${categoryToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      notifySuccess(t("category.deletedSuccess"));
      setCategoryToDelete(null);
      setDeleteModalOpen(false);

      // Refresh the list
      const businessId = selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
      const status = statusFilter || "All";
      fetchCategories(businessId, currentPage, recordsPerPage, searchTerm, status);
    } catch (err) {
      console.error("Error deleting category:", err);
      if (err.response?.status === 401) {
        checkTokenExpired();
      } else {
        notifyError(err.response?.data?.message || t("category.deleteFailed"));
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // Table headers
  const headers = [
    t("category.name"),
    t("category.description"),
    t("Business"),
    t("Status"),
    t("common.createdAt"),
    t("common.action"),
  ];

  const colWidths = useMemo(
    () => ({
      [t("category.name")]: "180px",
      [t("category.description")]: "220px",
      [t("Business")]: "160px",
      [t("Status")]: "120px",
      [t("common.createdAt")]: "120px",
      [t("common.action")]: "200px",
    }),
    [t]
  );

  const HiddenHeaders = [];

  // Filters
  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    {
      isBusinessDropdown: true,
      businessDropdownProps: {
        selectionMode: "multiple",
        selectedBusinesses,
        onChange: handleBusinessesChange,
      },
    },
    {
      value: statusFilter,
      onChange: (value) => handleStatusFilterChange(value),
      placeholder: t("Filter by Status"),
      options: [
        { value: "All", label: t("common.allStatuses") },
        { value: "Active", label: t("common.active") },
        { value: "Inactive", label: t("common.inactive") },
      ],
    },
  ];

  const totalPages = Math.ceil(totalResults / recordsPerPage) || 1;

  return (
    <RoutePermissionGate title={t("category.title")}>
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t("category.title")}
              </h1>
              <p className="text-gray-600 mt-2">
                {t("category.catalogDescription")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              {canAdd && (
                <button
                  type="button"
                  onClick={() => history.push("/Add New Category")}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  {t("category.new")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
      <DataTable
        // filters
        onSearch={handleSearch}
        searchValue={searchTerm}
        searchPlaceholder={t("Search")}
        filters={filters}
        // table
        loading={loading || businessesLoading}
        totalRecords={totalResults}
        headers={headers}
        headersToHide={HiddenHeaders}
        colWidths={colWidths}
        wideTable
        skipDynamicColumnWidths
        isCollapsible={false}
        actionColumnHeaderLabel={t("common.action")}
        data={filteredCategories}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={handlePageChange}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          currentPageRef.current = 1;
          setCurrentPage(1);
          const businessId = selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
          const status = statusFilter || "All";
          fetchCategories(businessId, 1, perPage, searchTerm, status);
        }}
        renderRow={(category) => (
          <tr key={category._id} className="hover:bg-gray-50">
            <td className="py-2 px-4 text-sm font-medium text-gray-900">
              {category.name}
            </td>
            <td className="py-2 px-4 text-sm text-gray-500">
              {category.description || "-"}
            </td>
            <td className="py-2 px-4 text-sm text-gray-500">
              {category.business?.name || "-"}
            </td>
            <td className="py-2 px-4 text-sm">
              <span
                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  category.status === "Active"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {category.status === "Active"
                  ? t("common.active")
                  : t("common.inactive")}
              </span>
            </td>
            <td className="py-2 px-4 text-sm text-gray-500">
              {category.createdAt
                ? new Date(category.createdAt).toLocaleDateString()
                : "-"}
            </td>
            <td className="py-2 px-4 text-sm font-medium">
              <div className="flex items-center gap-1 flex-nowrap">
                <ToggleSwitch
                  isOn={category.status === "Active"}
                  handleToggle={() => handleStatusToggle(category)}
                  disabled={!canUpdate}
                />
                {!isFixedCategory(category) && (
                  <ActionButtons
                    rbac={{
                      canView,
                      canViewDetails,
                      canUpdate,
                      canDelete,
                    }}
                    items={[
                      {
                        tooltip: t("Edit"),
                        action: ACTION_BUTTON_TYPES.EDIT,
                        onClick: () => handleEdit(category),
                      },
                      {
                        tooltip: t("Delete"),
                        action: ACTION_BUTTON_TYPES.DELETE,
                        onClick: () => openDeleteModal(category),
                      },
                    ]}
                  />
                )}
              </div>
            </td>
          </tr>
        )}
      />
        </div>

      {/* View Details Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalHeader>{t("category.details")}</ModalHeader>
        <ModalBody>
          {selectedCategory && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("category.name")}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedCategory.name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("category.description")}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedCategory.description || "-"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("Business")}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedCategory.business?.name || "-"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("Status")}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      selectedCategory.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedCategory.status === "Active"
                      ? t("common.active")
                      : t("common.inactive")}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("common.createdAt")}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedCategory.createdAt
                    ? new Date(selectedCategory.createdAt).toLocaleString()
                    : "-"}
                </p>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            {t("Close")}
          </button>
        </ModalFooter>
      </Modal>

      {/* Status Update Confirmation Modal */}
      <Modal isOpen={statusModalOpen} onClose={closeStatusModal}>
        <ModalHeader>{t("common.updateStatus")}</ModalHeader>
        <ModalBody>
          {categoryToUpdateStatus && (
            <p>
              {t("category.statusUpdateConfirm", {
                action:
                  categoryToUpdateStatus.status === "Active"
                    ? t("common.inactive")
                    : t("common.active"),
                name: categoryToUpdateStatus.name,
              })}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            onClick={closeStatusModal}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 mr-2"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={confirmStatusUpdate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t("Confirm")}
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal}>
        <ModalHeader>{t("Are you sure?")}</ModalHeader>
        <ModalBody>
          {categoryToDelete && (
            <p>
              {t("category.deleteConfirm", {
                name: categoryToDelete.name,
              })}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            onClick={closeDeleteModal}
            disabled={deleteLoading}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 mr-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleteLoading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-80 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[96px]"
          >
            {deleteLoading ? (
              <>
                <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {t("Deleting...")}
              </>
            ) : (
              t("Delete")
            )}
          </button>
        </ModalFooter>
      </Modal>
    </div>
    </div>
    </RoutePermissionGate>
  );
};

export default Categories;
