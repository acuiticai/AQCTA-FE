"use client";

import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, X, Filter } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { notifyError } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemTable = ({ items, onEdit, onDelete, onToggleStatus, canUpdate, canDelete }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("publicHolidays.holidayName", "Holiday Name")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("publicHolidays.date", "Date")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("description", "Description")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("status", "Status")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("actions", "Actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-4 py-2">{item.name}</td>
              <td className="px-4 py-2">
                {dayjs(item.date).format("DD/MM/YYYY")}
              </td>
              <td className="px-4 py-2">{item.description}</td>
              <td className="px-4 py-2">
                <ToggleSwitch
                  isOn={item.status === "Active"}
                  handleToggle={() => onToggleStatus(item)}
                  disabled={!canUpdate}
                />
              </td>
              <td className="px-4 py-2 text-sm font-medium">
                {dayjs(item.date).isAfter(dayjs(), "day") && (
                  <>
                    {canUpdate && (
                      <button
                        onClick={() => onEdit(item)}
                        className={` mr-2 ${
                          dayjs(item.date).isSameOrBefore(dayjs(), "day")
                            ? "text-blue-600 cursor-default"
                            : "text-blue-600 hover:text-blue-900 cursor-pointer"
                        }`}
                        disabled={dayjs(item.date).isSameOrBefore(dayjs(), "day")}
                      >
                        <FiEdit className="w-5 h-5" />
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => onDelete(item._id)}
                        className={`${
                          dayjs(item.date).isSameOrBefore(dayjs(), "day")
                            ? "text-red-600 cursor-default"
                            : "text-red-600 hover:text-red-900 cursor-pointer"
                        }`}
                        disabled={dayjs(item.date).isSameOrBefore(dayjs(), "day")}
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AddEditModal = ({ isOpen, onClose, type, item, onSubmit, canSubmit }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    date: null,
    description: "",
  });

  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        date: item.date ? new Date(item.date) : null,
        description: item.description || "",
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        date: null,
        description: "",
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
    if (!formData.name) errors.name = thr("nameIsRequired", "Name is required.");
    if (!formData.date)
      errors.date = thr("publicHolidays.dateRequired", "Date is required.");

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 m-6 max-w-3xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {item
              ? thr("publicHolidays.editPublicHoliday", "Edit Public Holiday")
              : thr(
                  "publicHolidays.addNewPublicHoliday",
                  "Add New Public Holiday"
                )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className="space-y-4 max-h-[70vh] overflow-y-auto"
            style={{ padding: "4px 4px" }}
          >
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("publicHolidays.holidayName", "Holiday Name")}
              </label>
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
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.name}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("publicHolidays.date", "Date")}
              </label>
              <DatePicker
                selected={formData.date}
                onChange={(date) => {
                  setFormData((prev) => ({ ...prev, date }));
                  setValidationErrors((prev) => ({ ...prev, date: "" }));
                }}
                dateFormat="dd/MM/yyyy"
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.date ? "border-red-500" : "border-gray-300"
                }`}
                placeholderText={thr("selectDate", "Select date")}
              />
              {validationErrors.date && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.date}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("description", "Description")}
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
              {item
                ? thr(
                    "publicHolidays.updatePublicHolidays",
                    "Update PublicHolidays"
                  )
                : thr(
                    "publicHolidays.addPublicHolidays",
                    "Add PublicHolidays"
                  )}
            </button>
          </div>
        </form>
      </div>
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
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {thr("areYouSure", "Are you sure?")}
        </h2>
        <p className="text-sm text-gray-600">
          {thr(
            "publicHolidays.deleteConfirm",
            "Do you really want to delete this holiday? This action cannot be undone."
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

const PublicHolidaysPage = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [activeTab, setActiveTab] = useState("PublicHolidays");
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

  const [filterValues, setFilterValues] = useState({
    year: "",
  });

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
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
    try {
      const payload = {
        name: item.name,
        business_id: organization,
        date: item.date,
        description: item.description,
        status: item.status || "Active",
      };

      if (editItem) {
        await axios.put(
          `${BASE_URL}/PublicHolidays/update/${editItem._id}`,
          payload,
          { headers }
        );
      } else {
        await axios.post(`${BASE_URL}/PublicHolidays/add`, payload, {
          headers,
        });
      }

      fetchItems(activeTab, organization);
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save item", err);
      notifyError(
        err?.response?.data?.error ||
          thr("anErrorOccurred", "An error occurred")
      );
    }
  };

  const fetchItems = async (
    ActiveTab,
    selectedOrg,
    filterMonth,
    filterYear
  ) => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };

      // Add month and year to payload if they exist
      if (filterMonth) {
        payload.month = filterMonth;
      }

      if (filterYear) {
        payload.year = filterYear;
      }

      const response = await axios.post(
        `${BASE_URL}/PublicHolidays/get_all`,
        payload,
        { headers }
      );
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError(thr("fetchFailed", "Failed to fetch items"));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilterValues({
      ...filterValues,
      [name]: value,
    });
  };

  const applyFilters = () => {
    if (!organization) return;
    fetchItems(activeTab, organization, null, filterValues.year);
  };

  const resetFilters = () => {
    setFilterValues({
      year: "",
    });

    // Fetch all items without filters
    fetchItems(activeTab, organization);
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
      await axios.delete(`${BASE_URL}/PublicHolidays/delete/${deleteItemId}`, {
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
      const payload = {
        name: item.name,
        status: item.status === "Active" ? "Inactive" : "Active",
        business_id: organization,
        date: item.date,
        description: item.description,
      };
      const response = await axios.put(
        `${BASE_URL}/PublicHolidays/update/${item._id}`,
        payload,
        { headers }
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(thr("statusUpdateFailed", "Failed to update item status"));
    }
  };

  // Get current year for default max year in input
  const currentYear = new Date().getFullYear();

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
          <div className="flex flex-wrap justify-between items-center w-full mb-6 gap-4">
            {/* Filter on the left */}
            <div className="flex items-end gap-2">
              <div>
                <input
                  type="number"
                  name="year"
                  value={filterValues.year}
                  onChange={handleFilterChange}
                  placeholder={thr(
                    "publicHolidays.yearFilterPlaceholder",
                    "e.g. 2026"
                  )}
                  min="1900"
                  max={currentYear + 10}
                  className="rounded-lg bg-gray-50 px-4 py-2 outline-none text-gray-500 border border-gray-300 w-[200px]"
                />
              </div>

              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                {thr("search", "Search")}
              </button>
              {/* <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reset
              </button> */}
            </div>

            {/* Add New button and dropdown on the right */}
            <div className="flex items-center gap-2">
              {canAdd && (
                <button
                  onClick={handleAddNew}
                  className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {thr("addNew", "Add New")}
                </button>
              )}
              <div className="relative">
                <select
                  value={locations}
                  onChange={(e) => setLocation(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg py-2 pl-4 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                >
                  <option value="All">{thr("all", "All")}</option>
                  <option value=""></option>
                  <option value=""></option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <ItemTable
              items={items}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
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

export default PublicHolidaysPage;
