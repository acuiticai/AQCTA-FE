import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import {
  DataTable,
  ActionButtons,
  ToggleSwitch,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Warehouses = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const routePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canDelete } = routePerms;

  const tWithFallback = (key, fallback, opts) => {
    const translated = t(key, { defaultValue: fallback, ...opts });
    return translated && translated !== key ? translated : fallback;
  };

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState(null);

  const currentPageRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list);
        setBusinessesLoading(false);
        // Keep Business filter empty by default; fetch still uses all assigned businesses
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchWarehouses = async (
    bizIds = selectedBusinesses,
    page = currentPageRef.current,
    limit = recordsPerPage,
    search = searchTerm,
    status = statusFilter,
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Empty filter = all assigned businesses
      let ids = Array.isArray(bizIds) ? bizIds.filter(Boolean) : [];
      if (!ids.length) {
        ids = (businesses || []).map((b) => b._id).filter(Boolean);
      }
      if (!ids.length) {
        setWarehouses([]);
        setTotalResults(0);
        return;
      }

      const response = await axios.get(`${Base_URL}/warehouses`, {
        headers,
        params: {
          businessIds: ids.join(","),
          page,
          limit,
          search: search || undefined,
          status: status || undefined,
        },
      });
      setWarehouses(response.data?.data || []);
      setTotalResults(response.data?.total || 0);
    } catch (err) {
      console.error(err);
      setError(
        tWithFallback("warehouse.messages.fetchFailed", "Failed to fetch warehouses."),
      );
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessesLoading) return;
    fetchWarehouses(selectedBusinesses, 1, recordsPerPage, searchTerm, statusFilter);
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, [selectedBusinesses.join(","), statusFilter, businessesLoading, businesses]);

  const handleSearch = (value) => {
    const trimmed = value || "";
    setSearchTerm(trimmed);
    currentPageRef.current = 1;
    setCurrentPage(1);
    fetchWarehouses(selectedBusinesses, 1, recordsPerPage, trimmed, statusFilter);
  };

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) &&
      !selectedBusinesses.length &&
      !statusFilter;
    setSelectedBusinesses([]);
    setStatusFilter(null);
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    if (onlySearchActive) {
      fetchWarehouses([], 1, recordsPerPage, "", null);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchWarehouses(selectedBusinesses, page, recordsPerPage, searchTerm, statusFilter);
  };

  const handleAdd = () => {
    if (!canAdd) return;
    history.push("/warehouses/create", { from: "/warehouses" });
  };

  const handleEdit = (wh) => {
    if (!canUpdate) return;
    history.push(`/warehouses/edit/${wh._id}`, { from: "/warehouses" });
  };

  const openDeleteModal = (wh) => {
    setWarehouseToDelete(wh);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setWarehouseToDelete(null);
  };

  const confirmDelete = async () => {
    if (!warehouseToDelete) return;
    try {
      await axios.delete(`${Base_URL}/warehouses/${warehouseToDelete._id}`, {
        headers,
      });
      notifySuccess(
        tWithFallback(
          "warehouse.messages.deletedSuccess",
          "Warehouse deleted successfully",
        ),
      );
      closeDeleteModal();
      fetchWarehouses();
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          tWithFallback("warehouse.messages.deleteFailed", "Failed to delete warehouse."),
      );
    }
  };

  const handleToggleStatus = async (wh) => {
    try {
      await axios.put(
        `${Base_URL}/warehouses/${wh._id}/status`,
        {},
        { headers },
      );
      fetchWarehouses();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to update status");
    }
  };

  const tableHeaders = [
    tWithFallback("warehouse.name", "Warehouse Name"),
    tWithFallback("warehouse.code", "Code"),
    t("Business"),
    tWithFallback("warehouse.address", "Address"),
    tWithFallback("warehouse.isDefault", "Default"),
    t("Status"),
    t("common.action") || t("common.actions") || "Actions",
  ];

  const filters = [
    {
      isClearButton: true,
      tooltip: tWithFallback("warehouse.clearFilters", "Clear Filters"),
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusinesses,
      onChange: (value) => {
        const next = Array.isArray(value) ? value : value ? [value] : [];
        setSelectedBusinesses(next);
      },
      placeholder: t("item.selectBusinesses") || t("Business") || "Select Business",
      isMulti: true,
      options: businesses.map((b) => ({
        value: b._id,
        label: b.name,
      })),
    }] : []),
    {
      value: statusFilter || "",
      onChange: (value) => setStatusFilter(value || null),
      placeholder: t("Status"),
      options: [
        { value: "", label: t("All") || "All" },
        { value: "Active", label: t("common.active") || "Active" },
        { value: "Inactive", label: t("common.inactive") || "Inactive" },
      ],
    },
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {tWithFallback("warehouse.title", "Warehouses")}
                </h1>
                <p className="text-gray-600 mt-2">
                  {tWithFallback(
                    "warehouse.description",
                    "Manage warehouses and storage locations for your inventory.",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                <button
                  type="button"
                  onClick={() => history.push("/locations")}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Locations
                </button>
                <button
                  type="button"
                  onClick={() => history.push("/stock-levels")}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Stock Levels
                </button>
                {canAdd && (
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                  >
                    <Plus size={20} />
                    {tWithFallback("warehouse.add", "Add Warehouse")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
            <DataTable
              onSearch={handleSearch}
              searchValue={searchTerm}
              searchPlaceholder={tWithFallback(
                "warehouse.searchPlaceholder",
                "Search warehouses...",
              )}
              filters={filters}
              loading={loading || businessesLoading}
              headers={tableHeaders}
              data={warehouses}
              totalResults={totalResults}
              resultsPerPage={recordsPerPage}
              onPageChange={handlePageChange}
              onChangeResultsPerPage={(n) => {
                setRecordsPerPage(n);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchWarehouses(selectedBusinesses, 1, n, searchTerm, statusFilter);
              }}
              currentPage={currentPage}
              tableError={error}
              emptyMessage={tWithFallback(
                "warehouse.emptyMessage",
                "No warehouses found. Add a warehouse to start managing inventory locations.",
              )}
              renderRow={(wh) => (
                <tr
                  key={wh._id}
                  className="border-b"
                  style={{ fontSize: "12px", fontWeight: "400" }}
                >
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {wh.name || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {wh.code || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {wh.business?.name || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {wh.address || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {wh.isDefault ? t("Yes") || "Yes" : t("No") || "No"}
                  </td>
                  <td className="py-2 px-4">
                    <ToggleSwitch
                      isOn={wh.status === "Active"}
                      handleToggle={() => handleToggleStatus(wh)}
                    />
                  </td>
                  <td className="py-2 px-4">
                    <ActionButtons
                      actions={[
                        canUpdate && {
                          type: ACTION_BUTTON_TYPES.EDIT,
                          onClick: () => handleEdit(wh),
                        },
                        canDelete && {
                          type: ACTION_BUTTON_TYPES.DELETE,
                          onClick: () => openDeleteModal(wh),
                        },
                      ].filter(Boolean)}
                    />
                  </td>
                </tr>
              )}
            />
          </div>
        </div>

        <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal}>
          <ModalHeader>
            {tWithFallback("warehouse.delete", "Delete Warehouse")}
          </ModalHeader>
          <ModalBody>
            {warehouseToDelete && (
              <p>
                {tWithFallback(
                  "warehouse.deleteConfirm",
                  `Are you sure you want to delete warehouse ${warehouseToDelete.name}?`,
                  { name: warehouseToDelete.name },
                )}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg"
              onClick={closeDeleteModal}
            >
              {t("Cancel") || "Cancel"}
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
              onClick={confirmDelete}
            >
              {t("Delete") || "Delete"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default Warehouses;
