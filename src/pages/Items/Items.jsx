import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import useButtonColor from "@/hooks/useButtonColor";
import { Plus } from "lucide-react";
import {
  DataTable,
  ActionButtons,
  ToggleSwitch,
  Button,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { formatAmount } from "@/components/formatAmount";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";
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
  const checkTokenExpired = useCheckTokenExpired(); // ✅ hook used properly
  const buttonColor = useButtonColor();
  const itemModulePerms = useRouteModulePermissions();
  const {
    canAdd,
    canUpdate,
    canDelete,
  } = itemModulePerms;
  const [filteredItems, setFilteredItems] = useState([]);
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
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [itemToUpdateStatus, setItemToUpdateStatus] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [categories, setCategories] = useState([]);

  // For delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // For image preview modal
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [itemForImagePreview, setItemForImagePreview] = useState(null);
  const imageModalTimeoutRef = useRef(null);

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

  // Categories dropdown: selected businesses or all synced assigned businesses
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

  // Fetch items on page load and when filters change (do not depend only on dropdown change)
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

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
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

  const openImageModal = (item) => {
    // Clear any pending close timeout
    if (imageModalTimeoutRef.current) {
      clearTimeout(imageModalTimeoutRef.current);
      imageModalTimeoutRef.current = null;
    }
    
    const imageToShow = item.featuredImage || (item.images && item.images.length > 0 ? item.images[0] : null);
    if (imageToShow) {
      setItemForImagePreview({ ...item, previewImage: imageToShow });
      setImageModalOpen(true);
    }
  };

  const closeImageModal = () => {
    // Clear any pending timeout
    if (imageModalTimeoutRef.current) {
      clearTimeout(imageModalTimeoutRef.current);
      imageModalTimeoutRef.current = null;
    }
    setImageModalOpen(false);
    setItemForImagePreview(null);
  };

  const handleMouseLeaveItemName = () => {
    // Add a small delay before closing to allow moving to modal
    imageModalTimeoutRef.current = setTimeout(() => {
      closeImageModal();
    }, 200);
  };

  const handleMouseEnterModal = () => {
    // Cancel close if mouse enters modal
    if (imageModalTimeoutRef.current) {
      clearTimeout(imageModalTimeoutRef.current);
      imageModalTimeoutRef.current = null;
    }
  };

  const handleMouseLeaveModal = () => {
    // Close modal when mouse leaves modal
    closeImageModal();
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

      // Build query parameters
      const params = {
        page,
        limit,
      };

      // Explicit scope from synced assigned businesses (same idea as Categories)
      if (Array.isArray(businessIds) && businessIds.length > 0) {
        params.businessIds = businessIds;
      } else {
        const assignedIds = businesses.map((business) => business._id).filter(Boolean);
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

      // Add search term if present and not empty after trimming
      if (search && search.trim() !== "") {
        params.search = search.trim();
      }

      // Add status filter if not "All" and not null
      if (status && status !== "All" && status !== null) {
        params.status = status;
      }

      // Add category filter if provided
      if (categoryId && categoryId !== "All" && categoryId !== null) {
        params.categoryId = categoryId;
      }

      const response = await axios.get(`${Base_URL}/items`, { params });
      if (checkTokenExpired(response)) return;

      // Handle different response structures
      let items = [];
      let total = 0;

      if (response.data) {
        // Check if response is paginated (has items and total properties)
        if (response.data.items !== undefined) {
          items = Array.isArray(response.data.items) ? response.data.items : [];
          total = typeof response.data.total === 'number' ? response.data.total : 0;
        }
        // Check if response is a direct array (no pagination)
        else if (Array.isArray(response.data)) {
          items = response.data;
          total = response.data.length;
        }
        // Check if response has data wrapper
        else if (response.data.data) {
          if (Array.isArray(response.data.data)) {
            items = response.data.data;
            total = response.data.data.length;
          } else if (response.data.data.items !== undefined) {
            items = Array.isArray(response.data.data.items) ? response.data.data.items : [];
            total = typeof response.data.data.total === 'number' ? response.data.data.total : 0;
          }
        }
      }

      console.log("Items fetched:", items.length, "Total:", total);
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
    // Trim search value to avoid issues with whitespace
    const trimmedSearch = searchValue ? searchValue.trim() : "";
    setSearchTerm(trimmedSearch);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchItems(
      selectedBusinesses,
      1,
      recordsPerPage,
      trimmedSearch,
      statusFilter || "All"
    );
  };

  const handleBusinessChange = (ids) => {
    setSelectedBusinesses(Array.isArray(ids) ? ids : []);
    setCategoryFilter(null); // Reset category when business changes so filter matches new category list
    setCurrentPage(1);
    currentPageRef.current = 1;
    // Fetch is triggered by useEffect when selectedBusinesses changes
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    // Fetch is triggered by useEffect when statusFilter changes
  };

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    // Fetch is triggered by useEffect when categoryFilter changes
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
    // Fetch is triggered by useEffect when recordsPerPage changes
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
        // Refresh the data after status update
        fetchItems(
          selectedBusinesses,
          currentPage,
          recordsPerPage,
          searchTerm,
          statusFilter || "All"
        );
      } else {
        notifyError("Failed to update status.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      notifyError("Something went wrong.");
    } finally {
      setLoading(false);
      closeStatusModal();
    }
  };

  // Delete item API handler
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
        // Refresh the data after deletion
        fetchItems(
          selectedBusinesses,
          currentPage,
          recordsPerPage,
          searchTerm,
          statusFilter || "All"
        );
      } else {
        notifyError("Failed to delete item.");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      notifyError("Something went wrong while deleting item.");
    } finally {
      setLoading(false);
      closeDeleteModal();
    }
  };

  const headers = [
    t("item.name"),
    t("Category"),
    t("Unit"),
    t("Stock") || "Stock",
    t("item.sellingPrice"),
    t("item.costPrice"),
    t("Business"),
    t("Status"),
    t("common.action"),
  ];

  const headersToHide = [];

  const clearAllFilters = () => {
    setStatusFilter(null);
    setCategoryFilter(null);
    setSelectedBusinesses([]);
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    // Fetch is triggered by useEffect when filters change (batched state includes searchTerm "")
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1); // ✅ reset page on clear
        },
      },
    },
    {
      isBusinessDropdown: true,
      businessDropdownProps: {
        selectionMode: "multiple",
        selectedBusinesses,
        onChange: handleBusinessChange,
        placeholder: t("item.selectBusinesses"),
      },
    },
    {
      value: statusFilter || "",
      onChange: (value) => {
        handleStatusFilterChange(value || null);
        setCurrentPage(1); // ✅ reset page on status change
      },
      placeholder: t("Status"),
      options: [
        { value: "", label: t("common.allStatuses") },
        { value: "Active", label: t("common.active") },
        { value: "Inactive", label: t("common.inactive") },
      ],
    },
    {
      value: categoryFilter || "",
      onChange: (value) => {
        handleCategoryFilterChange(value || null);
        setCurrentPage(1); // ✅ reset page on category change
      },
      placeholder: t("category.title"),
      options: [
        { value: "", label: t("item.allCategories") },
        ...categories.map((category) => ({
          value: category._id,
          label: category.name,
        })),
      ],
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t("item.title")}
              </h1>
              <p className="text-gray-600 mt-2">
                {t("item.catalogDescription")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              {canAdd && (
                <button
                  type="button"
                  onClick={() => history.push("/Add New Item", { from: "/items" })}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  {t("item.new")}
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
        headersToHide={headersToHide}
        tableWidths={{
          [headers[0]]: "150px",
          [headers[1]]: "150px",
        }}
        data={filteredItems}
        renderRow={(item) => {
          // Determine which image to show (featured image first, then first image)
          const displayImage = item.featuredImage || (item.images && item.images.length > 0 ? item.images[0] : null);
          const hasImages = displayImage !== null;
          const isFeaturedImage = !!item.featuredImage;
          
          return (
          <tr
            key={item._id}
            className="border-b"
            style={{ fontSize: "12px", fontWeight: "400" }}
          >
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400" }}
            >
              <div 
                className="relative group flex items-center gap-3 cursor-pointer"
                // Image preview modal on hover - commented out
                // onMouseEnter={() => hasImages && openImageModal(item)}
                // onMouseLeave={handleMouseLeaveItemName}
              >
                {/* Item Name with circular image */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {hasImages && (
                      <div className="relative">
                        <div className={`w-8 h-8 rounded-full overflow-hidden border-2 bg-gray-100 flex items-center justify-center flex-shrink-0 ${
                          isFeaturedImage ? 'border-yellow-400' : 'border-gray-200'
                        }`}>
                          <img
                            src={displayImage}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle"%3EImage%3C/text%3E%3C/svg%3E';
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
                      <div>{item.name}</div>
                      {item.type && (
                        <div style={{ color: "#374151", fontSize: "10px", marginTop: "4px" }}>
                          {item.type}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400" }}
            >
              {item.category?.name || "-"}
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400" }}
            >
              {item.unit || "-"}
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400" }}
            >
              {item.stockInformation?.enabled ? (
                <span className="font-semibold text-gray-900">
                  {formatStockQty(
                    item.stockInformation?.stock,
                    item.unit || item.uom,
                  )}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400" }}
            >
              {item.salesInformation?.enabled
                ? formatAmount(item.salesInformation.sellingPrice)
                : "-"}
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400" }}
            >
              {item.purchaseInformation?.enabled
                ? formatAmount(item.purchaseInformation.costPrice)
                : "-"}
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400" }}
            >
              {item?.business?.name}
            </td>
            <td className="py-2 px-4">
              <div className="flex items-center justify-center">
                <ToggleSwitch
                  isOn={item.status === "Active"}
                  handleToggle={() => {
                    if (!canUpdate) return;
                    handleStatusClick(item);
                  }}
                  disabled={!canUpdate}
                />
              </div>
            </td>
            <td className="py-2 px-4">
              <div className="flex space-x-2 items-center">
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
              </div>
            </td>
          </tr>
          );
        }}
        recordsPerPage={recordsPerPage}
        onRecordsPerPageChange={handleRecordsPerPageChange}
        totalResults={totalResults}
        totalPages={Math.ceil(totalResults / recordsPerPage)}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />
        </div>

      {/* Item Details Modal */}
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
                <p className="font-medium">{selectedItem.category?.name || "-"}</p>
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
                    <p className="text-sm text-[var(--p-blue)]">{t("item.sellingPrice")}:</p>
                    <p className="font-medium">
                      {formatAmount(selectedItem.salesInformation.sellingPrice) || "-"}
                    </p>
                  </div>
                  {selectedItem.salesInformation.taxOnItem && (
                    <div>
                      <p className="text-sm text-[var(--p-blue)]">{t("item.salesTax")}:</p>
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
                    <p className="text-sm text-[var(--p-blue)]">{t("item.costPrice")}:</p>
                    <p className="font-medium">
                      {formatAmount(selectedItem.purchaseInformation.costPrice) || "-"}
                    </p>
                  </div>
                  {selectedItem.purchaseInformation.taxOnItem && (
                    <div>
                      <p className="text-sm text-[var(--p-blue)]">{t("item.purchaseTax")}:</p>
                      <p className="font-medium">
                        {selectedItem.purchaseInformation.taxOnItem?.name 
                          ? `${selectedItem.purchaseInformation.taxOnItem.name} (${selectedItem.purchaseInformation.taxOnItem.percentage}%)`
                          : selectedItem.purchaseInformation.taxOnItem}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-[var(--p-blue)]">{t("item.inventoryEnabled")}:</p>
                    <p className="font-medium">
                      {selectedItem.stockInformation?.enabled ? t("Yes") : t("No")}
                    </p>
                  </div>
                  {selectedItem.stockInformation?.enabled && (
                    <div>
                      <p className="text-sm text-[var(--p-blue)]">{t("Stock") || "Stock"}:</p>
                      <p className="font-semibold text-lg text-gray-900">
                        {formatStockQty(
                          selectedItem.stockInformation?.stock,
                          selectedItem.unit || selectedItem.uom,
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

      {/* Status Update Modal */}
      <Modal
        style={{ width: "auto", padding: "24px" }}
        isOpen={statusModalOpen}
        onClose={closeStatusModal}
      >
        <ModalHeader style={{ marginTop: 0 }}>{t("common.updateStatus")}</ModalHeader>
        <ModalBody style={{ marginBottom: "12px" }}>
          {itemToUpdateStatus && (
            <div className="flex gap-4 py-2 pb-4 items-center">
              <p>
                {t("item.changeStatusFor")}{" "}
                <span className="font-semibold">{itemToUpdateStatus.name}</span>
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
                  itemToUpdateStatus.status === "Active" ? "Inactive" : "Active"
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

      {/* Delete Item Modal */}
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
                <span className="font-semibold">{itemToDelete.name}</span>
                ?
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

      {/* Image Preview Modal - commented out (was showing on hover/click on item image in list) */}
      {/* {imageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onMouseEnter={handleMouseEnterModal}
          onMouseLeave={handleMouseLeaveModal}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="fixed inset-0 bg-black bg-opacity-30" onClick={closeImageModal}></div>
          <div
            className="relative bg-white rounded-lg shadow-xl"
            style={{ maxWidth: "400px", width: "90%", maxHeight: "90vh" }}
            onMouseEnter={handleMouseEnterModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {itemForImagePreview?.name || t("item.imagePreview")}
                </span>
                {itemForImagePreview?.featuredImage === itemForImagePreview?.previewImage && (
                  <span className="ml-2 bg-yellow-400 text-yellow-900 text-xs font-semibold px-2 py-1 rounded">
                    ⭐ Featured
                  </span>
                )}
              </div>
            </div>
            <div className="p-4">
              {itemForImagePreview?.previewImage && (
                <div className="flex justify-center items-center">
                  <img
                    src={itemForImagePreview.previewImage}
                    alt={itemForImagePreview.name}
                    className="max-w-full max-h-[300px] object-contain rounded-lg"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle"%3EImage%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 px-4 py-3 flex justify-end">
              <Button onClick={closeImageModal} secondary style={{ padding: "6px 16px", fontSize: "14px" }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )} */}
      </div>
    </div>
  );
};

export default ItemListScreen;
