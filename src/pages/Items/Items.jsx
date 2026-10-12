import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { ActionButtons, ToggleSwitch, Button } from "@/page-layouts";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import PortalButton from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { formatAmount } from "@/components/formatAmount";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const formatStockQty = (qty, unit) => {
  const n = parseFloat(qty);
  if (Number.isNaN(n)) return "-";
  const rounded = Number(n.toFixed(2));
  return `${rounded}${unit ? ` ${unit}` : ""}`;
};

const ItemListScreen = () => {
  const { t } = useTranslation();
  const checkTokenExpired = useCheckTokenExpired();
  const itemModulePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canDelete } = itemModulePerms;
  const [filteredItems, setFilteredItems] = useState([]);
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
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [itemToUpdateStatus, setItemToUpdateStatus] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [categories, setCategories] = useState([]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

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

    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem("token");
        let url = `${Base_URL}/categories`;
        const assignedIds = businesses.map((b) => b?._id).filter(Boolean);

        if (selectedBusinesses.length === 1) {
          url += `?businessId=${selectedBusinesses[0]}`;
        } else if (selectedBusinesses.length > 1) {
          url += `?businessIds=${selectedBusinesses.join(",")}`;
        } else if (assignedIds.length === 1) {
          url += `?businessId=${assignedIds[0]}`;
        } else if (assignedIds.length > 1) {
          url += `?businessIds=${assignedIds.join(",")}`;
        }

        url += `${url.includes("?") ? "&" : "?"}purpose=inventory`;

        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(response.data.categories || response.data || []);
      } catch (err) {
        console.error("Error fetching categories:", err);
        setCategories([]);
      }
    };

    fetchCategories();
  }, [businessesLoading, businesses, selectedBusinesses]);

  useEffect(() => {
    if (businessesLoading) return;
    fetchItems(
      selectedBusinesses,
      1,
      recordsPerPage,
      searchTerm,
      statusFilter || "All",
      categoryFilter
    );
    setCurrentPage(1);
    currentPageRef.current = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessesLoading,
    businesses,
    selectedBusinesses,
    statusFilter,
    categoryFilter,
    recordsPerPage,
  ]);

  const handleEdit = (itemId) => {
    if (!canUpdate) return;
    history.push(`/edit-item/${itemId}`, { from: "/items" });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setItemToUpdateStatus(null);
  };

  const openDeleteModal = (item) => {
    if (!canDelete) return;
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setItemToDelete(null);
    setDeleteModalOpen(false);
  };

  const fetchItems = async (
    businessIds,
    page = 1,
    limit = recordsPerPage,
    search = searchTerm,
    status = statusFilter,
    categoryId = categoryFilter
  ) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit,
      };

      if (Array.isArray(businessIds) && businessIds.length > 0) {
        params.businessIds = businessIds;
      } else {
        const assignedIds = businesses
          .map((business) => business._id)
          .filter(Boolean);
        if (assignedIds.length === 0) {
          setFilteredItems([]);
          setTotalResults(0);
          setLoading(false);
          return;
        }
        if (assignedIds.length === 1) {
          params.businessId = assignedIds[0];
        } else {
          params.businessIds = assignedIds;
        }
      }

      if (search && search.trim() !== "") {
        params.search = search.trim();
      }

      if (status && status !== "All" && status !== null) {
        params.status = status;
      }

      if (categoryId && categoryId !== "All" && categoryId !== null) {
        params.categoryId = categoryId;
      }

      const response = await axios.get(`${Base_URL}/items`, { params });
      if (checkTokenExpired(response)) return;

      let items = [];
      let total = 0;

      if (response.data) {
        if (response.data.items !== undefined) {
          items = Array.isArray(response.data.items) ? response.data.items : [];
          total =
            typeof response.data.total === "number" ? response.data.total : 0;
        } else if (Array.isArray(response.data)) {
          items = response.data;
          total = response.data.length;
        } else if (response.data.data) {
          if (Array.isArray(response.data.data)) {
            items = response.data.data;
            total = response.data.data.length;
          } else if (response.data.data.items !== undefined) {
            items = Array.isArray(response.data.data.items)
              ? response.data.data.items
              : [];
            total =
              typeof response.data.data.total === "number"
                ? response.data.data.total
                : 0;
          }
        }
      }

      setFilteredItems(items);
      setTotalResults(total);
    } catch (err) {
      console.error("Error fetching items for business:", err);
      console.error("Error response:", err.response?.data);
      setError("Failed to fetch items for the selected business.");
      setFilteredItems([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchItems(
      selectedBusinesses,
      page,
      recordsPerPage,
      searchTerm,
      statusFilter || "All",
      categoryFilter || null
    );
  };

  const handleSearch = (searchValue) => {
    const trimmedSearch = searchValue ? searchValue.trim() : "";
    setSearchTerm(searchValue ?? "");
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchItems(
      selectedBusinesses,
      1,
      recordsPerPage,
      trimmedSearch,
      statusFilter || "All",
      categoryFilter
    );
  };

  const handleBusinessChange = (ids) => {
    setSelectedBusinesses(Array.isArray(ids) ? ids : []);
    setCategoryFilter(null);
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const handleStatusClick = (item) => {
    if (!canUpdate) return;
    setItemToUpdateStatus(item);
    setStatusModalOpen(true);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    currentPageRef.current = 1;
    setCurrentPage(1);
  };

  const updateStatus = async (newStatus) => {
    try {
      setLoading(true);
      const response = await axios.put(
        `${Base_URL}/items/status/${itemToUpdateStatus._id}`,
        { status: newStatus }
      );
      if (checkTokenExpired(response)) return;
      if (response.status === 200) {
        notifySuccess(`Status updated to ${newStatus}`);
        fetchItems(
          selectedBusinesses,
          currentPage,
          recordsPerPage,
          searchTerm,
          statusFilter || "All",
          categoryFilter
        );
      } else {
        notifyError("Failed to update status.");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      notifyError("Something went wrong.");
    } finally {
      setLoading(false);
      closeStatusModal();
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete || !canDelete) return;
    try {
      setLoading(true);
      const response = await axios.delete(
        `${Base_URL}/items/${itemToDelete._id}`
      );
      if (checkTokenExpired(response)) return;
      if (response.status === 200 || response.status === 204) {
        notifySuccess("Item deleted successfully.");
        fetchItems(
          selectedBusinesses,
          currentPage,
          recordsPerPage,
          searchTerm,
          statusFilter || "All",
          categoryFilter
        );
      } else {
        notifyError("Failed to delete item.");
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      notifyError("Something went wrong while deleting item.");
    } finally {
      setLoading(false);
      closeDeleteModal();
    }
  };

  const clearAllFilters = () => {
    setStatusFilter(null);
    setCategoryFilter(null);
    setSelectedBusinesses([]);
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const portalFilters = useMemo(() => {
    const list = [];
    if (!isSingleAssignedBusiness()) {
      list.push({
        key: "business",
        placeholder: t("item.selectBusinesses"),
        options: [
          { value: "", label: t("common.allBusinesses") },
          ...businesses.map((b) => ({ value: b._id, label: b.name })),
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
        key: "category",
        placeholder: t("category.title"),
        options: [
          { value: "", label: t("item.allCategories") },
          ...categories.map((category) => ({
            value: category._id,
            label: category.name,
          })),
        ],
      }
    );
    return list;
  }, [t, businesses, categories]);

  const portalFilterValues = {
    business: selectedBusinesses[0] || "",
    status: statusFilter || "",
    category: categoryFilter || "",
  };

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      handleBusinessChange(value ? [value] : []);
      return;
    }
    if (key === "status") {
      handleStatusFilterChange(value || null);
      return;
    }
    if (key === "category") {
      handleCategoryFilterChange(value || null);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: t("item.name"),
        width: "18%",
        render: (item) => {
          const displayImage =
            item.featuredImage ||
            (item.images && item.images.length > 0 ? item.images[0] : null);
          const hasImages = displayImage !== null;
          const isFeaturedImage = !!item.featuredImage;

          return (
            <div className="flex items-center gap-2">
              {hasImages && (
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full overflow-hidden border-2 bg-gray-100 flex items-center justify-center ${
                      isFeaturedImage ? "border-yellow-400" : "border-gray-200"
                    }`}
                  >
                    <img
                      src={displayImage}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle"%3EImage%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  {isFeaturedImage && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
                      <span className="text-[8px]">⭐</span>
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="epc-cell__primary">{item.name}</div>
                {item.type ? (
                  <div className="epc-cell__secondary">{item.type}</div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        key: "category",
        header: t("Category"),
        width: "12%",
        render: (item) => (
          <span className="epc-cell__primary">
            {item.category?.name || "—"}
          </span>
        ),
      },
      {
        key: "unit",
        header: t("Unit"),
        width: "8%",
        render: (item) => item.unit || "—",
      },
      {
        key: "stock",
        header: t("Stock") || "Stock",
        width: "10%",
        render: (item) =>
          item.stockInformation?.enabled ? (
            <span className="epc-cell__primary">
              {formatStockQty(
                item.stockInformation?.stock,
                item.unit || item.uom
              )}
            </span>
          ) : (
            <span className="epc-cell__secondary">—</span>
          ),
      },
      {
        key: "sellingPrice",
        header: t("item.sellingPrice"),
        width: "10%",
        render: (item) =>
          item.salesInformation?.enabled
            ? formatAmount(item.salesInformation.sellingPrice)
            : "—",
      },
      {
        key: "costPrice",
        header: t("item.costPrice"),
        width: "10%",
        render: (item) =>
          item.purchaseInformation?.enabled
            ? formatAmount(item.purchaseInformation.costPrice)
            : "—",
      },
      {
        key: "business",
        header: t("Business"),
        width: "12%",
        render: (item) => item?.business?.name || "—",
      },
      {
        key: "status",
        header: t("Status"),
        width: "8%",
        render: (item) => (
          <ToggleSwitch
            isOn={item.status === "Active"}
            handleToggle={() => {
              if (!canUpdate) return;
              handleStatusClick(item);
            }}
            disabled={!canUpdate}
          />
        ),
      },
      {
        key: "actions",
        header: t("common.action"),
        width: "10%",
        align: "right",
        render: (item) => (
          <ActionButtons
            rbac={{
              canView: itemModulePerms.canView,
              canViewDetails: itemModulePerms.canViewDetails,
              canUpdate,
              canDelete,
            }}
            items={[
              {
                tooltip: t("Edit"),
                action: ACTION_BUTTON_TYPES.EDIT,
                onClick: () => handleEdit(item._id),
              },
              {
                tooltip: t("Delete"),
                action: ACTION_BUTTON_TYPES.DELETE,
                onClick: () => openDeleteModal(item),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canUpdate, canDelete, itemModulePerms]
  );

  const isLoading = loading || businessesLoading;

  return (
    <EpcPage
      flush
      title={t("item.title")}
      subtitle={t("item.catalogDescription")}
      action={
        canAdd ? (
          <PortalButton
            onClick={() =>
              history.push("/Add New Item", { from: "/items" })
            }
          >
            <PlusIcon size={15} />
            {t("item.new")}
          </PortalButton>
        ) : null
      }
    >
      <div className="epc-stack">
        <FilterBar
          subtitle={t("item.catalogDescription")}
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
            title={t("item.title")}
            subtitle={
              isLoading
                ? "Loading…"
                : `${totalResults} ${
                    totalResults === 1 ? "item" : "items"
                  }`
            }
          />

          <PortalDataTable
            columns={columns}
            rows={isLoading ? [] : filteredItems}
            rowKey="_id"
            emptyMessage={
              isLoading
                ? "Loading…"
                : error || "No items match these filters."
            }
          />

          {!isLoading && totalResults > 0 ? (
            <Pagination
              page={currentPage}
              pageSize={recordsPerPage}
              total={totalResults}
              itemLabel="items"
              onPageChange={handlePageChange}
              onPageSizeChange={handleRecordsPerPageChange}
            />
          ) : null}
        </Card>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalHeader>{t("item.details")}</ModalHeader>
        <ModalBody>
          {selectedItem && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 pb-2 border-b">
                <h3 className="text-lg font-semibold">{selectedItem.name}</h3>
              </div>
              <div>
                <p className="text-sm text-[var(--p-blue)]">{t("Category")}:</p>
                <p className="font-medium">
                  {selectedItem.category?.name || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--p-blue)]">{t("item.type")}:</p>
                <p className="font-medium">{selectedItem.type || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--p-blue)]">{t("Unit")}:</p>
                <p className="font-medium">{selectedItem.unit || "-"}</p>
              </div>
              {selectedItem.salesInformation?.enabled && (
                <>
                  <div>
                    <p className="text-sm text-[var(--p-blue)]">
                      {t("item.sellingPrice")}:
                    </p>
                    <p className="font-medium">
                      {formatAmount(
                        selectedItem.salesInformation.sellingPrice
                      ) || "-"}
                    </p>
                  </div>
                  {selectedItem.salesInformation.taxOnItem && (
                    <div>
                      <p className="text-sm text-[var(--p-blue)]">
                        {t("item.salesTax")}:
                      </p>
                      <p className="font-medium">
                        {selectedItem.salesInformation.taxOnItem?.name
                          ? `${selectedItem.salesInformation.taxOnItem.name} (${selectedItem.salesInformation.taxOnItem.percentage}%)`
                          : selectedItem.salesInformation.taxOnItem}
                      </p>
                    </div>
                  )}
                </>
              )}
              {selectedItem.purchaseInformation?.enabled && (
                <>
                  <div>
                    <p className="text-sm text-[var(--p-blue)]">
                      {t("item.costPrice")}:
                    </p>
                    <p className="font-medium">
                      {formatAmount(
                        selectedItem.purchaseInformation.costPrice
                      ) || "-"}
                    </p>
                  </div>
                  {selectedItem.purchaseInformation.taxOnItem && (
                    <div>
                      <p className="text-sm text-[var(--p-blue)]">
                        {t("item.purchaseTax")}:
                      </p>
                      <p className="font-medium">
                        {selectedItem.purchaseInformation.taxOnItem?.name
                          ? `${selectedItem.purchaseInformation.taxOnItem.name} (${selectedItem.purchaseInformation.taxOnItem.percentage}%)`
                          : selectedItem.purchaseInformation.taxOnItem}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-[var(--p-blue)]">
                      {t("item.inventoryEnabled")}:
                    </p>
                    <p className="font-medium">
                      {selectedItem.stockInformation?.enabled
                        ? t("Yes")
                        : t("No")}
                    </p>
                  </div>
                  {selectedItem.stockInformation?.enabled && (
                    <div>
                      <p className="text-sm text-[var(--p-blue)]">
                        {t("Stock") || "Stock"}:
                      </p>
                      <p className="font-semibold text-lg text-gray-900">
                        {formatStockQty(
                          selectedItem.stockInformation?.stock,
                          selectedItem.unit || selectedItem.uom
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
              <div>
                <p className="text-sm text-[var(--p-blue)]">{t("Status")}:</p>
                <p
                  className={`font-medium ${
                    selectedItem.status === "Active"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-500"
                  }`}
                >
                  {selectedItem.status}
                </p>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end items-center w-full space-x-3">
            <button
              onClick={closeModal}
              className="px-5 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {t("Cancel")}
            </button>
            {canUpdate && (
              <button
                className="px-5 py-2 text-sm font-medium text-white bg-[var(--p-blue)] hover:bg-[#9abb32] transition-colors duration-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-opacity-50"
                onClick={() => {
                  closeModal();
                  handleEdit(selectedItem._id);
                }}
              >
                {t("item.edit")}
              </button>
            )}
          </div>
        </ModalFooter>
      </Modal>

      <Modal
        style={{ width: "auto", padding: "24px" }}
        isOpen={statusModalOpen}
        onClose={closeStatusModal}
      >
        <ModalHeader style={{ marginTop: 0 }}>
          {t("common.updateStatus")}
        </ModalHeader>
        <ModalBody style={{ marginBottom: "12px" }}>
          {itemToUpdateStatus && (
            <div className="flex gap-4 py-2 pb-4 items-center">
              <p>
                {t("item.changeStatusFor")}{" "}
                <span className="font-semibold">
                  {itemToUpdateStatus.name}
                </span>
                ?
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter style={{ padding: "12px 24px" }}>
          <Button onClick={closeStatusModal} secondary>
            {t("Cancel")}
          </Button>
          {itemToUpdateStatus && (
            <Button
              gray={itemToUpdateStatus.status === "Active"}
              onClick={() =>
                updateStatus(
                  itemToUpdateStatus.status === "Active"
                    ? "Inactive"
                    : "Active"
                )
              }
            >
              {itemToUpdateStatus.status === "Active"
                ? t("common.inactive")
                : t("common.active")}
            </Button>
          )}
        </ModalFooter>
      </Modal>

      <Modal
        style={{ width: "auto", padding: "24px" }}
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
      >
        <ModalHeader style={{ marginTop: 0 }}>{t("item.delete")}</ModalHeader>
        <ModalBody style={{ marginBottom: "12px" }}>
          {itemToDelete && (
            <div className="flex gap-4 py-2 pb-4 items-center">
              <p>
                {t("item.deleteConfirm")}{" "}
                <span className="font-semibold">{itemToDelete.name}</span>?
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter style={{ padding: "12px 24px" }}>
          <Button onClick={closeDeleteModal} secondary>
            {t("Cancel")}
          </Button>
          {itemToDelete && (
            <Button
              danger
              onClick={handleDeleteItem}
              style={{ backgroundColor: "#e53e3e", color: "#fff" }}
            >
              {t("Delete")}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </EpcPage>
  );
};

export default ItemListScreen;
