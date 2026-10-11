import { useState, useEffect, useContext } from "react";
import { Plus, ChevronDown, X, Edit, Trash2, Eye } from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiUploadCloud,
  FiXCircle,
  FiEye,
} from "react-icons/fi";
import { useTableSorting, SortIcon } from "@/utils/tableSorting.jsx";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const ItemTable = ({
  items,
  onEdit,
  onDelete,
  onToggleStatus,
  onView,
  sortKey,
  sortDirection,
  handleSort,
  activeTab,
  canUpdate,
  canDelete,
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
              <span>Name</span>
              <SortIcon
                sortKey="name"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
              />
            </div>
          </th>
          {activeTab === "Vendor Payment Terms" && (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Number of Days
            </th>
          )}
          <th
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onClick={() => handleSort("status")}
          >
            <div className="flex items-center space-x-1">
              <span>Status</span>
              <SortIcon
                sortKey="status"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
              />
            </div>
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item) => (
          <tr key={item._id}>
            {console.log("item", item)}
            <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
            {activeTab === "Vendor Payment Terms" && (
              <td className="px-6 py-4 whitespace-nowrap">
                {item.numberOfDays ?? 0}
              </td>
            )}
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

const AddEditModal = ({ isOpen, onClose, type, item, onSubmit, items }) => {
  const isVendorPaymentTerms = type === "Vendor Payment Terms";
  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    status: "active",
    numberOfDays: isVendorPaymentTerms ? 0 : undefined,
  });
  const [errors, setErrors] = useState({});

  // Update form data when the modal opens or item changes
  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        status: item.status || "active",
        numberOfDays:
          isVendorPaymentTerms && item.numberOfDays != null
            ? item.numberOfDays
            : isVendorPaymentTerms
            ? 0
            : undefined,
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        status: "active",
        numberOfDays: isVendorPaymentTerms ? 0 : undefined,
      }); // Reset fields when adding a new item
    }
    setErrors({});
  }, [item, isOpen, isVendorPaymentTerms]); // Runs when item changes or modal opens

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (isVendorPaymentTerms) {
      // Number of Days required and unique
      const days = parseInt(formData.numberOfDays, 10);
      if (!Number.isInteger(days) || days < 0) {
        nextErrors.numberOfDays = "Please enter the number of days";
      }
      if (Array.isArray(items)) {
        const daysVal = parseInt(formData.numberOfDays, 10);
        const hasDuplicateDays = items.some(
          (it) =>
            it._id !== formData._id &&
            it.numberOfDays != null &&
            parseInt(it.numberOfDays, 10) === daysVal
        );
        if (hasDuplicateDays) {
          nextErrors.numberOfDays =
            "This number of days is already used. Please enter a different value.";
        }
      }

      // Name must also be unique (same behavior as sales Payment Terms)
      const nameTrimmed = (formData.name || "").trim().toLowerCase();
      if (nameTrimmed && Array.isArray(items)) {
        const hasDuplicateName = items.some(
          (it) =>
            it._id !== formData._id &&
            (it.name || "").trim().toLowerCase() === nameTrimmed
        );
        if (hasDuplicateName) {
          nextErrors.name = "Term Name must be unique";
        }
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {item ? "Edit" : "Add New"} {type}
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
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {isVendorPaymentTerms && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Days <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="numberOfDays"
                min={0}
                value={formData.numberOfDays}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                required
              />
              {errors.numberOfDays && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.numberOfDays}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              {item ? "Update" : "Add"} {type}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Are you sure?
        </h2>
        <p className="text-sm text-gray-600">
          Do you really want to delete this item? This action cannot be undone.
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const EstimatesPage = () => {
  const [activeTab, setActiveTab] = useState("Vendor Payment Terms");
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
  const checkTokenExpired = useCheckTokenExpired(); // ✅ hook used properly
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
    if (isOrgLoaded && organization) {
      // Ensure organization is loaded before fetching items
      fetchItems(activeTab, organization);
    }
  }, [activeTab, organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const tabs = [
    "Vendor Payment Terms",
    "Purchase Delivery Terms",
    "Purchase Status",
    "Vendor Type",
    "Business Nature",
    "Business Presence",
    "ETD Ports",
  ];

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
          ...(activeTab === "Vendor Payment Terms" &&
            item.numberOfDays !== undefined && {
              numberOfDays: parseInt(item.numberOfDays, 10),
            }),
        };
        console.log("payload", payload);
        const response = await axios.put(
          `${BASE_URL}/items/${activeTab}/update/${editItem._id}`,
          payload,
          { headers }
        );
        if (checkTokenExpired(response)) return;
        fetchItems(activeTab, organization);
      } else {
        let payload = {
          name: item.name,
          status: item.status,
          business_id: organization,
          ...(activeTab === "Vendor Payment Terms" &&
            item.numberOfDays !== undefined && {
              numberOfDays: parseInt(item.numberOfDays, 10),
            }),
        };
        console.log("payload", payload);
        let response = await axios.post(
          `${BASE_URL}/items/${activeTab}/add`,
          payload,
          { headers }
        );
        if (checkTokenExpired(response)) return;
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
      if (checkTokenExpired(response)) return;
      console.log("response", response);
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch items");
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
      if (checkTokenExpired(response)) return;
      fetchItems(activeTab, organization);
    } catch (err) {
      setError("Failed to delete item");
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
      if (checkTokenExpired(response)) return;
      fetchItems(activeTab, organization);
    } catch (err) {
      setError("Failed to update item status");
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
            Misc. Data Types
          </h1>
          {canAdd && (
            <button
              onClick={handleAddNew}
              className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add New
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
          </nav>
        </div>

        {!isOrgLoaded && !organization ? (
          <div className="fixed inset-0 flex items-center justify-center bg-white">
            <p className="text-gray-600">Loading organization...</p>
          </div>
        ) : loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div>Error: {error}</div>
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
                  <option value="All">All</option>
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
                activeTab={activeTab}
                canUpdate={canUpdate}
                canDelete={canDelete}
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
          items={items}
        />
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteClick}
        />
      </div>
    </AppLayout>
  );
};

export default EstimatesPage;
