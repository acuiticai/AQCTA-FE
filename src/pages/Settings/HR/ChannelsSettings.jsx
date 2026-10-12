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



const AddEditModal = ({
  isOpen,
  onClose,
  item,
  onSubmit,
  organization,
  adminInfo,
  canSubmit,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    status: "Active",
    displayOrder: 0,
    paymentMethods: [],
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        code: item.code || "",
        description: item.description || "",
        status: item.status || "Active",
        displayOrder: item.displayOrder || 0,
        paymentMethods: item.paymentMethods ? item.paymentMethods.map(pm => pm._id || pm) : [],
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        status: "Active",
        displayOrder: 0,
        paymentMethods: [],
      });
    }
    setValidationErrors({});
  }, [item, isOpen]);

  useEffect(() => {
    if (isOpen && organization) {
      fetchPaymentMethods();
    }
  }, [isOpen, organization]);

  const fetchPaymentMethods = async () => {
    if (!organization) return;
    setLoadingPaymentMethods(true);
    try {
      const response = await axios.post(
        `${BASE_URL}/daily-reports/payment-methods/get_all`,
        {
          business_id: organization,
          FilterStatus: "Active",
          FilterName: "",
        },
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo?.token}`,
          },
        }
      );
      setAvailablePaymentMethods(response.data.data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      setAvailablePaymentMethods([]);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePaymentMethodToggle = (paymentMethodId) => {
    setFormData((prev) => {
      const currentMethods = prev.paymentMethods || [];
      if (currentMethods.includes(paymentMethodId)) {
        return { ...prev, paymentMethods: currentMethods.filter(id => id !== paymentMethodId) };
      } else {
        return { ...prev, paymentMethods: [...currentMethods, paymentMethodId] };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name) errors.name = t("accountsSettings.channels.nameRequired", "Name is required.");
    if (!formData.code) errors.code = t("accountsSettings.channels.codeRequired", "Code is required.");

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 m-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{item ? t("accountsSettings.channels.editModal", "Edit Channel") : t("accountsSettings.channels.addModal", "Add New Channel")}</h2>
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
                placeholder={t("accountsSettings.channels.codePlaceholder", "e.g., GRABFOOD, COUNTER")}
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
                {t("accountsSettings.channels.descriptionOptional", "Description (Optional)")}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accountsSettings.channels.displayOrder", "Display Order")}
              </label>
              <input
                type="number"
                name="displayOrder"
                value={formData.displayOrder}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">{t("accountsSettings.channels.displayOrderHelp", "Lower numbers appear first")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("accountsSettings.channels.paymentMethodsLabel", "Payment Methods")}
              </label>
              {loadingPaymentMethods ? (
                <p className="text-sm text-gray-500">{t("accountsSettings.channels.loadingPaymentMethods", "Loading payment methods...")}</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                  {availablePaymentMethods.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("accountsSettings.channels.noPaymentMethods", "No payment methods available")}</p>
                  ) : (
                    availablePaymentMethods.map((pm) => (
                      <label key={pm._id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.paymentMethods.includes(pm._id)}
                          onChange={() => handlePaymentMethodToggle(pm._id)}
                          className="rounded border-gray-300 text-[#A6C437] focus:ring-[#A6C437]"
                        />
                        <span className="text-sm text-gray-700">{pm.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          pm.type === "Cash" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {pm.type === "Cash"
                            ? t("accountsSettings.paymentMethods.typeCash", "Cash")
                            : t("accountsSettings.channels.typeOnlineShort", "Online")}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item ? t("accountsSettings.channels.updateBtn", "Update Channel") : t("accountsSettings.channels.addBtn", "Add Channel")}
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("accountsSettings.channels.deleteConfirmTitle", "Are you sure?")}</h2>
        <p className="text-sm text-gray-600">
          {t(
            "accountsSettings.channels.deleteConfirmText",
            "Do you really want to delete this channel? This action cannot be undone."
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

const ChannelsSettings = () => {
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
  const [seedingDefaults, setSeedingDefaults] = useState(false);

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
          `${BASE_URL}/daily-reports/channels/update/${editItem._id}`,
          payload,
          { headers }
        );
        notifySuccess(t("accountsSettings.channels.updateSuccess", "Channel updated successfully"));
      } else {
        await axios.post(`${BASE_URL}/daily-reports/channels/add`, payload, { headers });
        notifySuccess(t("accountsSettings.channels.createSuccess", "Channel created successfully"));
      }

      fetchItems(organization);
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save channel", err?.response?.data?.message);
      notifyError(err?.response?.data?.message || t("accountsSettings.channels.errorOccurred", "An error occurred"));
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
        `${BASE_URL}/daily-reports/channels/get_all`,
        payload,
        { headers }
      );
      setItems(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(t("accountsSettings.channels.loadFailed", "Failed to load channels"));
      notifyError(t("accountsSettings.channels.loadFailed", "Failed to load channels"));
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
      await axios.delete(`${BASE_URL}/daily-reports/channels/delete/${deleteItemId}`, {
        headers,
      });
      notifySuccess(t("accountsSettings.channels.deleteSuccess", "Channel deleted successfully"));
      fetchItems(organization);
    } catch (err) {
      notifyError(t("accountsSettings.channels.deleteFailed", "Failed to delete channel"));
      setError(t("accountsSettings.channels.deleteFailed", "Failed to delete channel"));
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
        displayOrder: item.displayOrder || 0,
        paymentMethods: item.paymentMethods ? item.paymentMethods.map(pm => pm._id || pm) : [],
      };
      await axios.put(
        `${BASE_URL}/daily-reports/channels/update/${item._id}`,
        payload,
        { headers }
      );
      notifySuccess(t("accountsSettings.channels.statusUpdated", "Channel status updated"));
      fetchItems(organization);
    } catch (err) {
      notifyError(t("accountsSettings.channels.statusFailed", "Failed to update channel status"));
      setError(t("accountsSettings.channels.statusFailed", "Failed to update channel status"));
    }
  };

  const handleSeedMalaysianDefaults = async () => {
    if (!organization || seedingDefaults || !canAdd) return;
    setSeedingDefaults(true);
    try {
      await axios.post(
        `${BASE_URL}/daily-reports/channels/seed-malaysian`,
        { business_id: organization },
        { headers },
      );
      notifySuccess(t("accountsSettings.channels.seedSuccess", "Malaysian default channels seeded"));
      fetchItems(organization);
    } catch (err) {
      notifyError(err?.response?.data?.message || t("accountsSettings.channels.seedFailed", "Failed to seed defaults"));
    } finally {
      setSeedingDefaults(false);
    }
  };

  const paginatedItems = items.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const columns = useMemo(
    () => [
      {
        key: "order",
        header: t("accountsSettings.channels.order"),
        width: "8%",
        render: (item) => item.displayOrder || 0,
      },
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
        key: "paymentMethods",
        header: t("accountsSettings.channels.paymentMethodsLabel"),
        render: (item) =>
          item.paymentMethods && item.paymentMethods.length > 0 ? (
            <span>
              {t("accountsSettings.channels.methodsCount", {
                count: item.paymentMethods.length,
                defaultValue: "{{count}} methods",
              })}
            </span>
          ) : (
            <span className="epc-cell__secondary">
              {t("accountsSettings.channels.none", "None")}
            </span>
          ),
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
      title={t("accountsSettings.channels.activeTitle", "Active channels")}
      action={
        canAdd ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSeedMalaysianDefaults}
              disabled={seedingDefaults}
              loading={seedingDefaults}
            >
              {seedingDefaults
                ? t("accountsSettings.channels.seeding", "Seeding...")
                : t(
                    "accountsSettings.channels.seedMalaysian",
                    "Seed Malaysian Channels"
                  )}
            </Button>
            <Button size="sm" onClick={handleAddNew}>
              <PlusIcon size={15} />
              {t("accountsSettings.channels.addNew", "Add New")}
            </Button>
          </div>
        ) : null
      }
      searchValue={searchTerm}
      searchPlaceholder={t(
        "accountsSettings.channels.searchPlaceholder",
        "Search channels..."
      )}
      onSearchChange={(value) => {
        setSearchTerm(value ? value.trim() : "");
        setCurrentPage(1);
      }}
      filterSubtitle={t(
        "accountsSettings.channels.filterSubtitle",
        "Filter by status or search by name."
      )}
      filters={[
        {
          key: "status",
          placeholder: t(
            "accountsSettings.channels.selectStatus",
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
      tableTitle={t("accountsSettings.channels.activeTitle", "Active channels")}
      columns={columns}
      rows={paginatedItems}
      loading={loading}
      emptyMessage={t("No data available")}
      page={currentPage}
      pageSize={recordsPerPage}
      total={items.length}
      itemLabel="channels"
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
        organization={organization}
        adminInfo={adminInfo}
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

export default ChannelsSettings;
