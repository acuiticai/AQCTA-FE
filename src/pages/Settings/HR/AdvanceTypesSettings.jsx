"use client";

import { useState, useEffect, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { ActionButtons, Loader } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import EpcListPage from "@/components/Epc/EpcListPage";
import Button from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;



const AddEditModal = ({ isOpen, onClose, item, onSubmit, canSubmit }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    status: "Active",
  });
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        code: item.code || "",
        description: item.description || "",
        status: item.status || "Active",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        status: "Active",
      });
    }
    setValidationErrors({});
  }, [item, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name) errors.name = t("accountsSettings.advanceTypes.nameRequired", "Name is required.");
    if (!formData.code) errors.code = t("accountsSettings.advanceTypes.codeRequired", "Code is required.");

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 m-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{item ? t("accountsSettings.advanceTypes.editModal", "Edit Advance Type") : t("accountsSettings.advanceTypes.addModal", "Add New Advance Type")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.name")}</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.name ? "border-red-500" : "border-gray-300"
                }`}
              />
              {validationErrors.name && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.code")}</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder={t("accountsSettings.advanceTypes.codePlaceholder", "e.g., ADVANCE_SALARY, SHORT_LOAN, EMERGENCY")}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.code ? "border-red-500" : "border-gray-300"
                }`}
              />
              {validationErrors.code && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.code}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accountsSettings.advanceTypes.descriptionOptional", "Description (Optional)")}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item ? t("accountsSettings.advanceTypes.updateBtn", "Update Advance Type") : t("accountsSettings.advanceTypes.addBtn", "Add Advance Type")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("accountsSettings.advanceTypes.deleteConfirmTitle", "Are you sure?")}</h2>
        <p className="text-sm text-gray-600">
          {t(
            "accountsSettings.advanceTypes.deleteConfirmText",
            "Do you really want to delete this advance type? This action cannot be undone."
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const AdvanceTypesSettings = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      fetchItems(organization, searchTerm, statusFilter);
    }
  }, [organization, isOrgLoaded, searchTerm, statusFilter]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const handleAddNew = () => {
    if (!canAdd) return;
    setEditItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    if (!canUpdate) return;
    setEditItem(item);
    setModalOpen(true);
  };

  const handleSubmit = async (formData) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    try {
      const payload = {
        business_id: organization,
        ...formData,
      };

      if (editItem) {
        await axios.put(
          `${BASE_URL}/daily-reports/advance-types/update/${editItem._id}`,
          payload,
          { headers }
        );
        notifySuccess(t("accountsSettings.advanceTypes.updateSuccess", "Advance type updated successfully"));
      } else {
        await axios.post(`${BASE_URL}/daily-reports/advance-types/add`, payload, { headers });
        notifySuccess(t("accountsSettings.advanceTypes.createSuccess", "Advance type created successfully"));
      }

      fetchItems(organization);
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save advance type", err?.response?.data?.message);
      notifyError(err?.response?.data?.message || t("accountsSettings.advanceTypes.errorOccurred", "An error occurred"));
    }
  };

  const fetchItems = async (selectedOrg, search = "", status = "") => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const payload = {
        business_id: selectedOrg,
        FilterStatus: status,
        FilterName: search,
      };
      const response = await axios.post(
        `${BASE_URL}/daily-reports/advance-types/get_all`,
        payload,
        { headers }
      );
      setItems(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(t("accountsSettings.advanceTypes.loadFailed", "Failed to load advance types"));
      notifyError(t("accountsSettings.advanceTypes.loadFailed", "Failed to load advance types"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (_id) => {
    if (!canDelete) return;
    setDeleteItemId(_id);
    setDeleteModalOpen(true);
  };

  const handleDeleteClick = async () => {
    if (!deleteItemId) return;
    if (!canDelete) return;

    try {
      await axios.delete(`${BASE_URL}/daily-reports/advance-types/delete/${deleteItemId}`, {
        headers,
      });
      notifySuccess(t("accountsSettings.advanceTypes.deleteSuccess", "Advance type deleted successfully"));
      fetchItems(organization);
    } catch (err) {
      notifyError(t("accountsSettings.advanceTypes.deleteFailed", "Failed to delete advance type"));
      setError(t("accountsSettings.advanceTypes.deleteFailed", "Failed to delete advance type"));
    } finally {
      setDeleteModalOpen(false);
      setDeleteItemId(null);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!canUpdate) return;
    try {
      const payload = {
        name: item.name,
        code: item.code,
        description: item.description,
        status: item.status === "Active" ? "Inactive" : "Active",
      };
      await axios.put(
        `${BASE_URL}/daily-reports/advance-types/update/${item._id}`,
        payload,
        { headers }
      );
      notifySuccess(t("accountsSettings.advanceTypes.statusUpdated", "Advance type status updated"));
      fetchItems(organization);
    } catch (err) {
      notifyError(t("accountsSettings.advanceTypes.statusFailed", "Failed to update advance type status"));
      setError(t("accountsSettings.advanceTypes.statusFailed", "Failed to update advance type status"));
    }
  };

  const paginatedItems = items.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: t("common.name"),
        render: (item) => (
          <span className="epc-cell__primary">{item.name}</span>
        ),
      },
      {
        key: "code",
        header: t("common.code"),
        render: (item) => item.code || "—",
      },
      {
        key: "description",
        header: t("common.description"),
        render: (item) => item.description || "—",
      },
      {
        key: "status",
        header: t("common.status"),
        render: (item) => (
          <ToggleSwitch
            isOn={item.status === "Active"}
            handleToggle={() => handleToggleStatus(item)}
            disabled={!canUpdate}
          />
        ),
      },
      {
        key: "actions",
        header: t("common.actions"),
        align: "right",
        render: (item) => (
          <ActionButtons
            rbac={{ canUpdate, canDelete }}
            items={[
              {
                tooltip: t("common.edit"),
                action: ACTION_BUTTON_TYPES.EDIT,
                onClick: () => handleEdit(item),
              },
              {
                tooltip: t("common.delete"),
                action: ACTION_BUTTON_TYPES.DELETE,
                onClick: () => handleDelete(item._id),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canUpdate, canDelete]
  );

  if (!isOrgLoaded && !organization) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Loader fullContainer={true} />
      </div>
    );
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <EpcListPage
      flush
      title={t("accountsSettings.advanceTypes.activeTitle", "Active advance types")}
      action={
        canAdd ? (
          <Button size="sm" onClick={handleAddNew}>
            <PlusIcon size={15} />
            {t("accountsSettings.advanceTypes.addNew", "Add New")}
          </Button>
        ) : null
      }
      searchValue={searchTerm}
      searchPlaceholder={t(
        "accountsSettings.advanceTypes.searchPlaceholder",
        "Search advance types..."
      )}
      onSearchChange={(value) => {
        setSearchTerm(value ? value.trim() : "");
        setCurrentPage(1);
      }}
      filterSubtitle={t(
        "accountsSettings.advanceTypes.filterSubtitle",
        "Filter by status or search by name."
      )}
      filters={[
        {
          key: "status",
          placeholder: t(
            "accountsSettings.advanceTypes.selectStatus",
            "Select Status"
          ),
          options: [
            { value: "Active", label: t("common.active") },
            { value: "Inactive", label: t("common.inactive") },
          ],
        },
      ]}
      filterValues={{ status: statusFilter }}
      onFilterChange={(key, value) => {
        if (key === "status") {
          setStatusFilter(value || "");
          setCurrentPage(1);
        }
      }}
      onFilterReset={() => {
        setSearchTerm("");
        setStatusFilter("");
        setCurrentPage(1);
      }}
      tableTitle={t("accountsSettings.advanceTypes.activeTitle", "Active advance types")}
      columns={columns}
      rows={paginatedItems}
      loading={loading}
      emptyMessage={t("No data available")}
      page={currentPage}
      pageSize={recordsPerPage}
      total={items.length}
      itemLabel="advance types"
      onPageChange={setCurrentPage}
      onPageSizeChange={(perPage) => {
        setRecordsPerPage(perPage);
        setCurrentPage(1);
      }}
    >
      <AddEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editItem}
        onSubmit={handleSubmit}
        canSubmit={editItem ? canUpdate : canAdd}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteClick}
      />
    </EpcListPage>
  );
};

export default AdvanceTypesSettings;
