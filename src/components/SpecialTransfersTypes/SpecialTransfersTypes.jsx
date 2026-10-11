import React, { useState, useEffect, useContext } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import { formatDate } from "../formatAmount";
import AppLayout from "@/pages/Settings/app-layout";
import Header from "../header/Header";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { CustomModal } from "@/page-layouts/index";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function SpecialTransfersTypes() {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { canAdd, canUpdate, canDelete } = useRouteModulePermissions();

  // State management
  const [transferTypes, setTransferTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState("sortOrder");
  const [sortDirection, setSortDirection] = useState("asc");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    sortOrder: 0,
  });

  // Validation state
  const [errors, setErrors] = useState({});

  // Get business ID from URL parameter
  const searchParams = new URLSearchParams(window.location.search);
  const businessId = searchParams.get("selectedOrg");

  // Fetch transfer types
  const fetchTransferTypes = async (page = 1, search = "") => {
    if (!businessId) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/special-transfer-types/business/${businessId}`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
          params: {
            page,
            limit: 10,
            search,
          },
        }
      );

      if (response.data.success) {
        setTransferTypes(response.data.data);
        setTotalPages(response.data.pagination.pages);
        setCurrentPage(response.data.pagination.page);
      }
    } catch (error) {
      console.error("Error fetching transfer types:", error);
      notifyError(t("accountsSettings.specialTransfers.failedFetch", "Failed to fetch transfer types"));
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (businessId) {
      fetchTransferTypes();
    }
  }, [businessId]);

  // Auto-search when search term changes (including when cleared)
  useEffect(() => {
    if (!businessId) return;

    const handler = setTimeout(() => {
      fetchTransferTypes(1, searchTerm);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm, businessId]);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchTransferTypes(1, searchTerm);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t("accountsSettings.specialTransfers.nameRequired", "Name is required");
    }

    if (formData.sortOrder < 0) {
      newErrors.sortOrder = t("accountsSettings.specialTransfers.sortOrderInvalid", "Sort order must be 0 or greater");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((editingType && !canUpdate) || (!editingType && !canAdd)) return;

    if (!validateForm()) return;

    try {
      const payload = {
        business: businessId,
        name: formData.name.trim(),
        sortOrder: parseInt(formData.sortOrder) || 0,
      };

      if (editingType) {
        // Update existing type
        await axios.put(
          `${Base_URL}/special-transfer-types/${editingType._id}`,
          payload,
          {
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
            },
          }
        );
        notifySuccess(t("accountsSettings.specialTransfers.updateSuccess", "Transfer type updated successfully"));
      } else {
        // Create new type
        await axios.post(`${Base_URL}/special-transfer-types`, payload, {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        });
        notifySuccess(t("accountsSettings.specialTransfers.createSuccess", "Transfer type created successfully"));
      }

      // Reset form and close modal
      resetForm();
      setShowModal(false);
      fetchTransferTypes(currentPage, searchTerm);
    } catch (error) {
      console.error("Error saving transfer type:", error);
      const message =
        error.response?.data?.message || t("accountsSettings.specialTransfers.failedSave", "Failed to save transfer type");
      notifyError(message);
    }
  };

  // Handle edit
  const handleEdit = (type) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      sortOrder: type.sortOrder,
    });
    setShowModal(true);
  };

  // Open delete confirmation modal
  const handleDeleteClick = (type) => {
    setTypeToDelete(type);
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setTypeToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!typeToDelete) return;
    if (!canDelete) return;

    try {
      setDeleteLoading(true);
      await axios.delete(
        `${Base_URL}/special-transfer-types/${typeToDelete._id}`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      notifySuccess(t("accountsSettings.specialTransfers.deleteSuccess", "Transfer type deleted successfully"));
      handleCloseDeleteModal();
      fetchTransferTypes(currentPage, searchTerm);
    } catch (error) {
      console.error("Error deleting transfer type:", error);
      const message =
        error.response?.data?.message || t("accountsSettings.specialTransfers.failedDelete", "Failed to delete transfer type");
      notifyError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      sortOrder: 0,
    });
    setErrors({});
    setEditingType(null);
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort data
  const sortedData = [...transferTypes].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === "sortOrder") {
      aValue = parseInt(aValue) || 0;
      bValue = parseInt(bValue) || 0;
    } else {
      aValue = aValue?.toString().toLowerCase() || "";
      bValue = bValue?.toString().toLowerCase() || "";
    }

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp size={16} />
    ) : (
      <ChevronDown size={16} />
    );
  };

  if (!businessId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t("accountsSettings.specialTransfers.noOrgSelected", "No organization selected")}</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white rounded-lg shadow-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("accountsSettings.specialTransfers.title", "Special Transfer Types")}
            </h1>
            <p className="text-gray-600 mt-1">
              {t("accountsSettings.specialTransfers.subtitle", "Manage transfer types for your business")}
            </p>
          </div>
          {canAdd && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 bg-[var(--p-blue)] text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={20} />
              {t("accountsSettings.specialTransfers.addType", "Add Transfer Type")}
            </button>
          )}
        </div>
        <SettingsOrgBanner />

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <form onSubmit={(e) => e.preventDefault()} className="flex-1">
            <div className="relative">
              <Search
                className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder={t("accountsSettings.specialTransfers.searchPlaceholder", "Search transfer types...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th
                  className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("sortOrder")}
                >
                  <div className="flex items-center gap-2">
                    {t("accountsSettings.specialTransfers.sortOrder", "Sort Order")}
                    {getSortIcon("sortOrder")}
                  </div>
                </th>
                <th
                  className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    {t("accountsSettings.specialTransfers.name", "Name")}
                    {getSortIcon("name")}
                  </div>
                </th>
                <th
                  className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-2">
                    {t("accountsSettings.specialTransfers.createdAt", "Created At")}
                    {getSortIcon("createdAt")}
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-700">
                  {t("accountsSettings.specialTransfers.actions", "Actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="4"
                    className="border border-gray-200 px-4 py-8 text-center text-gray-500"
                  >
                    {t("Loading", "Loading...")}
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="border border-gray-200 px-4 py-8 text-center text-gray-500"
                  >
                    {t("accountsSettings.specialTransfers.noData", "No transfer types found")}
                  </td>
                </tr>
              ) : (
                sortedData.map((type) => (
                  <tr key={type._id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3 text-gray-900">
                      {type.sortOrder}
                    </td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-900">
                      {type.name}
                    </td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-600">
                      {formatDate(type.createdAt)}
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <button
                            onClick={() => handleEdit(type)}
                            className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                            title={t("accountsSettings.specialTransfers.edit", "Edit")}
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteClick(type)}
                            className="p-1 text-red-600 hover:text-red-800 transition-colors"
                            title={t("accountsSettings.specialTransfers.delete", "Delete")}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => fetchTransferTypes(currentPage - 1, searchTerm)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              {t("accountsSettings.specialTransfers.previous", "Previous")}
            </button>
            <span className="px-3 py-1 text-gray-600">
              {t("accountsSettings.specialTransfers.pageInfo", "Page {{currentPage}} of {{totalPages}}", { currentPage, totalPages })}
            </span>
            <button
              onClick={() => fetchTransferTypes(currentPage + 1, searchTerm)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              {t("accountsSettings.specialTransfers.next", "Next")}
            </button>
          </div>
        )}

        {/* Add / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold mb-4">
                {editingType ? t("accountsSettings.specialTransfers.editType", "Edit Transfer Type") : t("accountsSettings.specialTransfers.addType", "Add Transfer Type")}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("accountsSettings.specialTransfers.nameLabel", "Name *")}
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder={t("accountsSettings.specialTransfers.namePlaceholder", "Enter transfer type name")}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("accountsSettings.specialTransfers.sortOrderLabel", "Sort Order")}
                  </label>
                  <input
                    type="number"
                    name="sortOrder"
                    value={formData.sortOrder}
                    onChange={handleInputChange}
                    min="0"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.sortOrder ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="0"
                  />
                  {errors.sortOrder && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.sortOrder}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-[var(--p-blue)] text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={editingType ? !canUpdate : !canAdd}
                  >
                    {editingType ? t("accountsSettings.specialTransfers.update", "Update") : t("accountsSettings.specialTransfers.create", "Create")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    {t("accountsSettings.specialTransfers.cancel", "Cancel")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <CustomModal
          open={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          title={t("accountsSettings.specialTransfers.deleteTitle", "Delete Special Transfer Type")}
          width="500px"
          showActions={true}
          actions={[
            {
              label: t("accountsSettings.specialTransfers.cancel", "Cancel"),
              secondary: true,
              onClick: handleCloseDeleteModal,
            },
            {
              label: deleteLoading ? t("accountsSettings.specialTransfers.deleting", "Deleting...") : t("accountsSettings.specialTransfers.delete", "Delete"),
              primary: true,
              onClick: handleConfirmDelete,
              disabled: deleteLoading || !canDelete,
              danger: true,
            },
          ]}
        >
          {typeToDelete && (
            <p className="text-gray-700">
              {t("accountsSettings.specialTransfers.deleteConfirm", "Are you sure you want to delete <1>{{name}}</1>? This action cannot be undone.", { name: typeToDelete.name })}
            </p>
          )}
        </CustomModal>
      </div>
    </AppLayout>
  );
}
