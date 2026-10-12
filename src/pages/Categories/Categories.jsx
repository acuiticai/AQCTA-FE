import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { ActionButtons, ToggleSwitch } from "@/page-layouts";
import EpcListPage from "@/components/Epc/EpcListPage";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon } from "@/customer/components/ui/icons";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
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
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
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

  useEffect(() => {
    if (businessesLoading) return;
    if (selectedBusinesses.length === 0 && statusFilter === null) {
      fetchCategories("", 1, recordsPerPage, "", "All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessesLoading, businesses]);

  const handleEdit = (category) => {
    if (!canUpdate || isFixedCategory(category)) return;
    history.push(`/edit-category/${category._id}`);
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
          if (
            Array.isArray(businessIdsOverride) &&
            businessIdsOverride.length > 0
          ) {
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
    const businessId =
      selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
    const status = statusFilter || "All";
    fetchCategories(businessId, 1, recordsPerPage, searchValue, status);
  };

  const handlePageChange = (page) => {
    const businessId =
      selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
    const status = statusFilter || "All";
    fetchCategories(businessId, page, recordsPerPage, searchTerm, status);
  };

  const handleBusinessesChange = (ids) => {
    const nextSelected = Array.isArray(ids) ? ids : [];
    setSelectedBusinesses(nextSelected);
    setCurrentPage(1);
    currentPageRef.current = 1;
    const status = statusFilter || "All";
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
    const businessId =
      selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
    fetchCategories(
      businessId,
      1,
      recordsPerPage,
      searchTerm,
      status || "All"
    );
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
      const newStatus =
        categoryToUpdateStatus.status === "Active" ? "Inactive" : "Active";

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

      const businessId =
        selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
      const status = statusFilter || "All";
      fetchCategories(
        businessId,
        currentPage,
        recordsPerPage,
        searchTerm,
        status
      );
    } catch (err) {
      console.error("Error updating category status:", err);
      if (err.response?.status === 401) {
        checkTokenExpired();
      } else {
        notifyError(
          err.response?.data?.message || t("common.statusUpdateFailed")
        );
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

      const businessId =
        selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
      const status = statusFilter || "All";
      fetchCategories(
        businessId,
        currentPage,
        recordsPerPage,
        searchTerm,
        status
      );
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

  const portalFilters = useMemo(() => {
    const list = [];
    if (!isSingleAssignedBusiness()) {
      list.push({
        key: "business",
        placeholder: t("Business"),
        options: [
          { value: "", label: t("common.allBusinesses") },
          ...businesses.map((b) => ({ value: b._id, label: b.name })),
        ],
      });
    }
    list.push({
      key: "status",
      placeholder: t("Filter by Status"),
      options: [
        { value: "", label: t("common.allStatuses") },
        { value: "Active", label: t("common.active") },
        { value: "Inactive", label: t("common.inactive") },
      ],
    });
    return list;
  }, [t, businesses]);

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      handleBusinessesChange(value ? [value] : []);
      return;
    }
    if (key === "status") {
      handleStatusFilterChange(value || null);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: t("category.name"),
        width: "18%",
        render: (category) => (
          <span className="epc-cell__primary">{category.name}</span>
        ),
      },
      {
        key: "description",
        header: t("category.description"),
        width: "22%",
        render: (category) => (
          <span className="epc-cell__secondary">
            {category.description || "—"}
          </span>
        ),
      },
      {
        key: "business",
        header: t("Business"),
        width: "16%",
        render: (category) => category.business?.name || "—",
      },
      {
        key: "status",
        header: t("Status"),
        width: "12%",
        render: (category) => (
          <StatusPill status={category.status || "—"} />
        ),
      },
      {
        key: "createdAt",
        header: t("common.createdAt"),
        width: "12%",
        render: (category) =>
          category.createdAt
            ? new Date(category.createdAt).toLocaleDateString()
            : "—",
      },
      {
        key: "actions",
        header: t("common.action"),
        width: "20%",
        align: "right",
        render: (category) => (
          <div className="flex items-center gap-1 flex-nowrap justify-end">
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
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canUpdate, canDelete, canView, canViewDetails]
  );

  const isLoading = loading || businessesLoading;

  return (
    <RoutePermissionGate title={t("category.title")}>
      <EpcListPage
        title={t("category.title")}
        subtitle={t("category.catalogDescription")}
        action={
          canAdd ? (
            <Button onClick={() => history.push("/Add New Category")}>
              <PlusIcon size={15} />
              {t("category.new")}
            </Button>
          ) : null
        }
        searchValue={searchTerm}
        searchPlaceholder={t("Search")}
        onSearchChange={handleSearch}
        filterSubtitle={t("category.catalogDescription")}
        filters={portalFilters}
        filterValues={{
          business: selectedBusinesses[0] || "",
          status: statusFilter || "",
        }}
        onFilterChange={handlePortalFilterChange}
        onFilterReset={clearAllFilters}
        tableTitle={t("category.title")}
        tableSubtitle={
          isLoading
            ? "Loading…"
            : `${totalResults} ${
                totalResults === 1 ? "category" : "categories"
              }`
        }
        columns={columns}
        rows={filteredCategories}
        rowKey="_id"
        loading={isLoading}
        emptyMessage={error || "No categories match these filters."}
        page={currentPage}
        pageSize={recordsPerPage}
        total={totalResults}
        itemLabel="categories"
        onPageChange={handlePageChange}
        onPageSizeChange={(perPage) => {
          setRecordsPerPage(perPage);
          currentPageRef.current = 1;
          setCurrentPage(1);
          const businessId =
            selectedBusinesses.length === 1 ? selectedBusinesses[0] : "";
          const status = statusFilter || "All";
          fetchCategories(businessId, 1, perPage, searchTerm, status);
        }}
      >
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
                    <StatusPill status={selectedCategory.status || "—"} />
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
      </EpcListPage>
    </RoutePermissionGate>
  );
};

export default Categories;
