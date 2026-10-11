import { useState, useEffect, useContext } from "react";
import { Plus, ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import GeneralSettings from "./GeneralSettings";
import { useTableSorting, SortIcon } from "@/utils/tableSorting.jsx";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import CustomFieldsSettings from "../CustomFieldsSettings";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** API tab ids — must stay English (used in API paths). */
const TAB_FIXED_FOLDERS = "Fixed Folders";
const TAB_GENERAL = "General";
const TAB_CUSTOM_FIELDS = "Custom fields";

const ItemTable = ({
  items,
  onEdit,
  onDelete,
  onToggleStatus,
  sortKey,
  sortDirection,
  handleSort,
  canUpdate,
  canDelete,
  t,
}) => {
  const td = (key, fallback, options) =>
    t(`settingsPage.documentManager.${key}`, { defaultValue: fallback, ...options });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort("name")}
            >
              <div className="flex items-center space-x-1">
                <span>{td("name", "Name")}</span>
                <SortIcon
                  sortKey="name"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                />
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort("status")}
            >
              <div className="flex items-center space-x-1">
                <span>{td("status", "Status")}</span>
                <SortIcon
                  sortKey="status"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {td("actions", "Actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <ToggleSwitch
                  isOn={item.status === "active"}
                  handleToggle={() => {
                    if (canUpdate) onToggleStatus(item);
                  }}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {canUpdate && (
                  <button
                    onClick={() => onEdit(item)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                  >
                    <FiEdit className="w-5 h-5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDelete(item._id)}
                    className="text-red-600 hover:text-red-900 mr-2"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AddEditModal = ({ isOpen, onClose, typeLabel, item, onSubmit, t }) => {
  const td = (key, fallback, options) =>
    t(`settingsPage.documentManager.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    status: "active",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        status: item.status || "active",
      });
    } else {
      setFormData({ _id: "", name: "", status: "active" });
    }
  }, [item, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {item
              ? td("modalEditTitle", "Edit {{type}}", { type: typeLabel })
              : td("modalAddTitle", "Add New {{type}}", { type: typeLabel })}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {td("name", "Name")}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              {item
                ? td("modalUpdateBtn", "Update {{type}}", { type: typeLabel })
                : td("modalAddBtn", "Add {{type}}", { type: typeLabel })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, t }) => {
  const td = (key, fallback, options) =>
    t(`settingsPage.documentManager.${key}`, { defaultValue: fallback, ...options });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {td("areYouSure", "Are you sure?")}
        </h2>
        <p className="text-sm text-gray-600">
          {td(
            "deleteConfirm",
            "Do you really want to delete this item? This action cannot be undone.",
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {td("cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {td("delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const EstimatesPage = () => {
  const { t } = useTranslation();
  const td = (key, fallback, options) =>
    t(`settingsPage.documentManager.${key}`, { defaultValue: fallback, ...options });

  const tabs = [
    { id: TAB_FIXED_FOLDERS, label: td("tabs.fixedFolders", "Fixed Folders") },
    { id: TAB_GENERAL, label: td("tabs.general", "General") },
    { id: TAB_CUSTOM_FIELDS, label: td("tabs.customFields", "Custom fields") },
  ];

  const [activeTab, setActiveTab] = useState(TAB_FIXED_FOLDERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locations, setLocation] = useState("All");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();

  const { sortedData, sortKey, sortDirection, handleSort } =
    useTableSorting(items);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization && isDataTab(activeTab)) {
      fetchItems(activeTab, organization);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const isDataTab = (tab) => tab === TAB_FIXED_FOLDERS;

  const getTabLabel = (tabId) =>
    tabs.find((tab) => tab.id === tabId)?.label || tabId;

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

  const handleSubmit = async (item) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    try {
      if (editItem) {
        let payload = {
          name: item.name,
          status: item.status,
          business_id: organization,
        };
        await axios.put(
          `${BASE_URL}/items/${activeTab}/update/${editItem._id}`,
          payload,
          { headers },
        );
        fetchItems(activeTab, organization);
      } else {
        let payload = {
          name: item.name,
          status: item.status,
          business_id: organization,
        };
        await axios.post(`${BASE_URL}/items/${activeTab}/add`, payload, {
          headers,
        });
        fetchItems(activeTab, organization);
      }
      setModalOpen(false);
      setActiveTab((prevTab) => prevTab);
    } catch (err) {
      console.error("Failed to save item", err);
    }
  };

  const fetchItems = async (ActiveTab, selectedOrg) => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      let payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };

      let response = await axios.post(
        `${BASE_URL}/items/${ActiveTab}/get_all`,
        payload,
        { headers },
      );
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError(td("fetchFailed", "Failed to fetch items"));
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
    if (!canDelete) return;
    if (!deleteItemId) return;

    try {
      await axios.delete(
        `${BASE_URL}/items/${activeTab}/delete/${deleteItemId}`,
        { headers },
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(td("deleteFailed", "Failed to delete item"));
    } finally {
      setDeleteModalOpen(false);
      setDeleteItemId(null);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!canUpdate) return;
    try {
      let payload = {
        name: item.name,
        status: item.status === "active" ? "inactive" : "active",
        business_id: organization,
      };
      await axios.put(
        `${BASE_URL}/items/${activeTab}/update/${item._id}`,
        payload,
        { headers },
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(td("statusUpdateFailed", "Failed to update item status"));
    }
  };

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">
            {td("miscTitle", "Misc. Data Types")}
          </h1>
          {isDataTab(activeTab) && canAdd && (
            <button
              onClick={handleAddNew}
              className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              {td("addNew", "Add New")}
            </button>
          )}
        </div>
        <SettingsOrgBanner />

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex -mb-px flex-wrap gap-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (isDataTab(tab.id) && organization) {
                    fetchItems(tab.id, organization);
                  }
                }}
                className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-[#A6C437] text-[#A6C437]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {!isOrgLoaded && !organization ? (
          <div className="fixed inset-0 flex items-center justify-center bg-white">
            <p className="text-gray-600">
              {td("loadingOrganization", "Loading organization...")}
            </p>
          </div>
        ) : activeTab === TAB_GENERAL ? (
          <GeneralSettings organization={organization} headers={headers} />
        ) : activeTab === TAB_CUSTOM_FIELDS ? (
          <CustomFieldsSettings embedded />
        ) : loading ? (
          <div>{td("loading", "Loading...")}</div>
        ) : error ? (
          <div>
            {td("errorPrefix", "Error: {{error}}", { error })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <label className="text-sm font-medium text-gray-700">
                {getTabLabel(activeTab)}
              </label>
              <div className="relative">
                <select
                  value={locations}
                  onChange={(e) => setLocation(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg py-2 pl-4 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                >
                  <option value="All">{td("all", "All")}</option>
                  <option value=""></option>
                  <option value=""></option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <ItemTable
                items={sortedData}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                sortKey={sortKey}
                sortDirection={sortDirection}
                handleSort={handleSort}
                canUpdate={canUpdate}
                canDelete={canDelete}
                t={t}
              />
            </div>
          </div>
        )}
        <AddEditModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          typeLabel={getTabLabel(activeTab)}
          organization={organization}
          item={editItem}
          onSubmit={handleSubmit}
          t={t}
        />
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteClick}
          t={t}
        />
      </div>
    </AppLayout>
  );
};

export default EstimatesPage;
