import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, X } from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import { Loader } from "@/page-layouts";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { useTableSorting, SortIcon } from "@/utils/tableSorting.jsx";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
import Currency from "./Currency";

const ItemTable = ({
  items,
  onEdit,
  onDelete,
  onToggleStatus,
  onView,
  sortKey,
  sortDirection,
  handleSort,
  canUpdate,
  canDelete,
  t,
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onClick={() => handleSort("name")}
          >
            <div className="flex items-center space-x-1">
              <span>{t("settingsPage.finance.name", "Name")}</span>
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
              <span>{t("settingsPage.finance.status", "Status")}</span>
              <SortIcon
                sortKey="status"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
              />
            </div>
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            {t("settingsPage.finance.actions", "Actions")}
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item) => (
          <tr key={item._id}>
            {console.log("item", item)}
            <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              {" "}
              <ToggleSwitch
                isOn={item.status === "active"}
                handleToggle={() => {
                  if (canUpdate) onToggleStatus(item);
                }}
              />
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
              {/* <button onClick={() => onView(item)} className="text-indigo-600 hover:text-indigo-900 mr-2">
                <Eye className="w-5 h-5" />
              </button> */}
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

const AddEditModal = ({ isOpen, onClose, type, item, onSubmit, t }) => {
  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    status: "active",
  });

  // Update form data when the modal opens or item changes
  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        status: item.status || "active",
      });
    } else {
      setFormData({ _id: "", name: "", status: "active" }); // Reset fields when adding a new item
    }
  }, [item, isOpen]); // Runs when item changes or modal opens

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
              ? t("settingsPage.finance.modalEditTitle", "Edit {{type}}", {
                  type,
                })
              : t(
                  "settingsPage.finance.modalAddTitle",
                  "Add New {{type}}",
                  { type }
                )}
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
              {t("settingsPage.finance.name", "Name")}
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
                ? t("settingsPage.finance.modalUpdateBtn", "Update {{type}}", {
                    type,
                  })
                : t("settingsPage.finance.modalAddBtn", "Add {{type}}", {
                    type,
                  })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, t }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t("settingsPage.finance.areYouSure", "Are you sure?")}
        </h2>
        <p className="text-sm text-gray-600">
          {t(
            "settingsPage.finance.deleteItemConfirm",
            "Do you really want to delete this item? This action cannot be undone."
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {t("settingsPage.finance.cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {t("settingsPage.finance.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const EstimatesPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("Currency");
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

  const [organization, setOrganization] = useState(null); // Set initially as null
  const [isOrgLoaded, setIsOrgLoaded] = useState(false); // To track when organization is loaded
  const location = useLocation();

  // Sorting functionality
  const { sortedData, sortKey, sortDirection, handleSort } =
    useTableSorting(items);
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true); // Organization has been fetched
  }, [location]);

  useEffect(() => {
    if (!isOrgLoaded || !organization) return;
    if (activeTab === "Currency") {
      // Currency tab manages its own data fetching; don't gate it on misc-items loading
      setLoading(false);
      return;
    }
    // Ensure organization is loaded before fetching items
    fetchItems(activeTab, organization);
  }, [activeTab, organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const tabs = [];

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
        console.log("item", item);
        let payload = {
          name: item.name,
          status: item.status,
          business_id: organization,
        };
        console.log("payload", payload);
        const response = await axios.put(
          `${BASE_URL}/items/${activeTab}/update/${editItem._id}`,
          payload,
          { headers }
        );
        fetchItems(activeTab, organization);
      } else {
        let payload = {
          name: item.name,
          status: item.status,
          business_id: organization,
        };
        console.log("payload", payload);
        let response = await axios.post(
          `${BASE_URL}/items/${activeTab}/add`,
          payload,
          { headers }
        );
        fetchItems(activeTab, organization);
      }
      setModalOpen(false);
      // Refresh the list
      setActiveTab((prevTab) => prevTab); // This will trigger a re-render and re-fetch
    } catch (err) {
      console.error("Failed to save item", err);
    }
  };

  const fetchItems = async (ActiveTab, selectedOrg) => {
    console.log("response");
    if (!selectedOrg) return;
    setLoading(true);
    try {
      let payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };
      console.log("payload", payload);

      let response = await axios.post(
        `${BASE_URL}/items/${ActiveTab}/get_all`,
        payload,
        { headers }
      );
      console.log("response", response);
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError(t("settingsPage.finance.fetchFailed", "Failed to fetch items"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (_id) => {
    if (!canDelete) return;
    setDeleteItemId(_id); // Store the item ID for deletion
    setDeleteModalOpen(true); // Open the delete confirmation modal
  };

  const handleDeleteClick = async () => {
    if (!canDelete) return;
    if (!deleteItemId) return; // Safety check

    try {
      await axios.delete(
        `${BASE_URL}/items/${activeTab}/delete/${deleteItemId}`,
        { headers }
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(t("settingsPage.finance.deleteFailed", "Failed to delete item"));
    } finally {
      setDeleteModalOpen(false); // Close modal after deleting
      setDeleteItemId(null); // Reset item ID
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
      console.log("payload", payload);
      const response = await axios.put(
        `${BASE_URL}/items/${activeTab}/update/${item._id}`,
        payload,
        { headers }
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(
        t("settingsPage.finance.statusUpdateFailed", "Failed to update item status")
      );
    }
  };

  const handleView = (item) => {
    // Implement view functionality
    console.log("View", item);
  };

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">
            {activeTab === "Currency"
              ? t("settingsPage.finance.title", "Currency")
              : t("settingsPage.finance.miscTitle", "Misc. Data Types")}
          </h1>
          {activeTab !== "Currency" && canAdd && (
            <button
              onClick={handleAddNew}
              className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t("settingsPage.finance.addNew", "Add New")}
            </button>
          )}
        </div>
        <SettingsOrgBanner />

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  fetchItems(tab, organization);
                }}
                className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? "border-[#A6C437] text-[#A6C437]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
            <button
              key={"Currency"}
              onClick={() => {
                setActiveTab("Currency");
              }}
              className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "Currency"
                  ? "border-[#A6C437] text-[#A6C437]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t("settingsPage.finance.title", "Currency")}
            </button>
          </nav>
        </div>

        {!isOrgLoaded && !organization ? (
          <Loader fullContainer={true} />
        ) : activeTab === "Currency" ? (
          <Currency organization={organization} headers={headers} />
        ) : loading ? (
          <Loader fullContainer={true} />
        ) : error ? (
          <div>{t("settingsPage.finance.errorPrefix", "Error: {{error}}", { error })}</div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <label className="text-sm font-medium text-gray-700">
                {activeTab}
              </label>
              <div className="relative">
                <select
                  value={locations}
                  onChange={(e) => setLocation(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg py-2 pl-4 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                >
                  <option value="All">{t("settingsPage.finance.all", "All")}</option>
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
                onView={handleView}
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
          type={activeTab}
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
