import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
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
import { notifyError } from "@/utils/toast";
import { useTableSorting, SortIcon } from "@/utils/tableSorting.jsx";
import AddBranchLocationModal from "./AddBranchLocationModal";
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
  canUpdate,
  canDelete,
}) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

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
                <span>{thr("branches.branchLocation", "Branch / Location")}</span>
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
                <span>{thr("status", "Status")}</span>
                <SortIcon
                  sortKey="status"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {thr("actions", "Actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{item.name}</div>
                {item.googleLocation?.formattedAddress || item.areaName ? (
                  <div className="text-xs text-gray-500">
                    {item.googleLocation?.formattedAddress || item.areaName}
                  </div>
                ) : null}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <ToggleSwitch
                  isOn={item.status === "Active"}
                  handleToggle={() => onToggleStatus(item)}
                  disabled={!canUpdate}
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

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {thr("areYouSure", "Are you sure?")}
        </h2>
        <p className="text-sm text-gray-600">
          {thr(
            "deleteConfirmItem",
            "Do you really want to delete this item? This action cannot be undone."
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {thr("cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {thr("delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const EstimatesPage = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [activeTab, setActiveTab] = useState("Branches");
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

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  // Sorting functionality
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
    if (isOrgLoaded && organization) {
      fetchItems(activeTab, organization);
    }
  }, [activeTab, organization, isOrgLoaded]);

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

  const handleSubmit = async (item) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    console.log(`${BASE_URL}/branches/update/$editItem._id`);
    try {
      if (editItem) {
        let payload = {
          name: item.name,
          status: item.status,
          areaName: item.areaName || "",
          attendanceRadiusMeters:
            item.attendanceRadiusMeters === "" ||
            item.attendanceRadiusMeters == null
              ? 200
              : Number(item.attendanceRadiusMeters),
          googleLocation: {
            lat: item.googleLocation?.lat ?? "",
            lng: item.googleLocation?.lng ?? "",
            placeId: item.googleLocation?.placeId || "",
            formattedAddress: item.googleLocation?.formattedAddress || "",
            city: item.googleLocation?.city || "",
            state: item.googleLocation?.state || "",
            country: item.googleLocation?.country || "",
            postalCode: item.googleLocation?.postalCode || "",
          },
          business_id: organization,
        };
        const response = await axios.put(
          `${BASE_URL}/branches/update/${editItem._id}`,
          payload,
          { headers }
        );
        fetchItems(activeTab, organization);
      } else {
        let payload = {
          name: item.name,
          status: item.status,
          areaName: item.areaName || "",
          attendanceRadiusMeters:
            item.attendanceRadiusMeters === "" ||
            item.attendanceRadiusMeters == null
              ? 200
              : Number(item.attendanceRadiusMeters),
          googleLocation: {
            lat: item.googleLocation?.lat ?? "",
            lng: item.googleLocation?.lng ?? "",
            placeId: item.googleLocation?.placeId || "",
            formattedAddress: item.googleLocation?.formattedAddress || "",
            city: item.googleLocation?.city || "",
            state: item.googleLocation?.state || "",
            country: item.googleLocation?.country || "",
            postalCode: item.googleLocation?.postalCode || "",
          },
          business_id: organization,
        };
        const response = await axios.post(`${BASE_URL}/branches/add`, payload, {
          headers,
        });
        fetchItems(activeTab, organization);
      }
      setModalOpen(false);
      setActiveTab((prevTab) => prevTab);
    } catch (err) {
      console.error("Failed to save item", err);
      notifyError(err.response.data.error);
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
      let response = await axios.post(`${BASE_URL}/branches/get_all`, payload, {
        headers,
      });
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError(thr("fetchFailed", "Failed to fetch items"));
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
      await axios.delete(`${BASE_URL}/branches/delete/${deleteItemId}`, {
        headers,
      });
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(thr("deleteFailed", "Failed to delete item"));
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
        status: item.status === "Active" ? "Inactive" : "Active",
        areaName: item.areaName || "",
        attendanceRadiusMeters:
          item.attendanceRadiusMeters === "" ||
          item.attendanceRadiusMeters == null
            ? 200
            : Number(item.attendanceRadiusMeters),
        googleLocation: {
          lat: item.googleLocation?.lat ?? "",
          lng: item.googleLocation?.lng ?? "",
          placeId: item.googleLocation?.placeId || "",
          formattedAddress: item.googleLocation?.formattedAddress || "",
          city: item.googleLocation?.city || "",
          state: item.googleLocation?.state || "",
          country: item.googleLocation?.country || "",
          postalCode: item.googleLocation?.postalCode || "",
        },
        business_id: organization,
      };
      const response = await axios.put(
        `${BASE_URL}/branches/update/${item._id}`,
        payload,
        { headers }
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(thr("statusUpdateFailed", "Failed to update item status"));
    }
  };

  const handleView = (item) => {
    console.log("View", item);
  };

  return (
    <>
      {!isOrgLoaded && !organization ? (
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <p className="text-gray-600">
            {thr("loadingOrganization", "Loading organization...")}
          </p>
        </div>
      ) : loading ? (
        <div>{thr("loading", "Loading...")}</div>
      ) : error ? (
        <div>{thr("errorPrefix", "Error: {{error}}", { error })}</div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex justify-end items-end w-full mb-6 space-x-4">
            {canAdd && (
              <button
                onClick={handleAddNew}
                className="flex items-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                style={{ backgroundColor: "var(--p-blue)" }}
              >
                <Plus className="w-5 h-5 mr-2" />
                {thr("addNew", "Add New")}
              </button>
            )}
            <div className="relative">
              <select
                value={locations}
                onChange={(e) => setLocation(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg py-2 pl-4 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent"
              >
                <option value="All">{thr("all", "All")}</option>
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
            />
          </div>
        </div>
      )}
      <AddBranchLocationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={activeTab}
        item={editItem}
        onSubmit={handleSubmit}
        canSubmit={editItem ? canUpdate : canAdd}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteClick}
      />
    </>
  );
};

export default EstimatesPage;
