"use client";

import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, X } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { notifyError } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import ReactSelect from "react-select";
import reactSelectConfig from "@/utils/react-select-style-config";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemTable = ({ items, onEdit, onDelete, canUpdate, canDelete }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("groupName", "Group Name")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("wfhGroups.department", "Department")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("wfhGroups.staffCount", "Staff Count")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {thr("wfhGroups.allowedWfhDays", "Allowed WFH Days")}
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
              <td className="px-4 py-2">{item.department.name}</td>
              <td className="px-4 py-2">{item.staff?.length || 0}</td>
              <td className="px-4 py-2">{item.allowedWFH}</td>
              <td className="px-4 py-2 text-sm font-medium">
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
                    className="text-red-600 hover:text-red-900"
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

const AddEditModal = ({
  isOpen,
  onClose,
  type,
  item,
  departments,
  onSubmit,
  organization,
  canSubmit,
}) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    department: "",
    staff: [],
    allowedWFH: "",
  });

  const [staffList, setStaffList] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const fetchStaff = async (selectedOrg) => {
    if (!selectedOrg) return;

    try {
      const response = await axios.get(
        `${BASE_URL}/staff-management/staff-names`,
        {
          headers,
          params: {
            business: selectedOrg,
            department: formData.department,
          },
        }
      );
      setStaffList(response.data.data);
    } catch (err) {
      console.error("Failed to fetch staff", err);
    }
  };

  useEffect(() => {
    if (formData.department) {
      fetchStaff(organization);
    }
  }, [formData.department]);

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        department: item.department._id || "",
        staff: item.staff.map((e) => e._id) || [],
        allowedWFH: item.allowedWFH || "",
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        department: "",
        staff: [],
        allowedWFH: "",
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
    if (!formData.department)
      errors.department = thr(
        "wfhGroups.departmentRequired",
        "Department is required."
      );
    if (!formData.staff || formData.staff.length === 0)
      errors.staff = thr(
        "wfhGroups.atLeastOneStaffRequired",
        "At least one staff member is required."
      );
    if (!formData.allowedWFH)
      errors.allowedWFH = thr(
        "wfhGroups.allowedWfhDaysRequired",
        "Allowed WFH days is required."
      );

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
              ? thr("wfhGroups.editWfhGroup", "Edit WFH Group")
              : thr("wfhGroups.addNewWfhGroup", "Add New WFH Group")}
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
                {thr("groupName", "Group Name")}
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

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("wfhGroups.department", "Department")}
              </label>
              <ReactSelect
                value={
                  departments.find((dept) => dept._id === formData.department)
                    ? {
                        value: formData.department,
                        label: departments.find(
                          (dept) => dept._id === formData.department
                        ).name,
                      }
                    : null
                }
                onChange={(selectedOption) => {
                  setFormData((prev) => ({
                    ...prev,
                    department: selectedOption ? selectedOption.value : "",
                  }));
                  setValidationErrors((prev) => ({ ...prev, department: "" }));
                }}
                options={departments.map((dept) => ({
                  value: dept._id,
                  label: dept.name,
                }))}
                placeholder={thr(
                  "wfhGroups.selectDepartment",
                  "Select Department"
                )}
                isSearchable
                classNamePrefix="react-select"
                styles={{
                  ...reactSelectConfig,
                  control: (base, state) => ({
                    ...reactSelectConfig.control?.(base, state),
                    background: "white",
                    borderWidth: 1,
                    borderColor: validationErrors.department
                      ? "#ef4444"
                      : state.isFocused
                      ? "var(--p-blue)"
                      : "#d1d5db",
                    "&:hover": {
                      borderColor: "none",
                    },
                  }),
                }}
              />
              {validationErrors.department && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.department}
                </p>
              )}
            </div>

            {/* Staff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("wfhGroups.staffMembers", "Staff Members")}
              </label>
              <ReactSelect
                value={
                  formData.staff
                    ?.map((staffId) => {
                      const staffMember = staffList.find(
                        (s) => s._id === staffId
                      );
                      return staffMember
                        ? { value: staffId, label: staffMember.displayName }
                        : null;
                    })
                    .filter(Boolean) || []
                }
                onChange={(selectedOptions) => {
                  setFormData((prev) => ({
                    ...prev,
                    staff: selectedOptions
                      ? selectedOptions.map((opt) => opt.value)
                      : [],
                  }));
                  setValidationErrors((prev) => ({ ...prev, staff: "" }));
                }}
                options={staffList.map((staff) => ({
                  value: staff._id,
                  label: staff.displayName,
                }))}
                placeholder={thr(
                  "wfhGroups.selectStaffMembers",
                  "Select Staff Members"
                )}
                isMulti
                isSearchable
                classNamePrefix="react-select"
                styles={{
                  ...reactSelectConfig,
                  control: (base, state) => ({
                    ...reactSelectConfig.control?.(base, state),
                    background: "white",
                    borderWidth: 1,
                    borderColor: validationErrors.staff
                      ? "#ef4444"
                      : state.isFocused
                      ? "var(--p-blue)"
                      : "#d1d5db",
                    "&:hover": {
                      borderColor: "none",
                    },
                  }),
                }}
              />
              {validationErrors.staff && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.staff}
                </p>
              )}
            </div>

            {/* Allowed WFH Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("wfhGroups.allowedWfhDays", "Allowed WFH Days")}
              </label>
              <input
                min={1}
                max={7}
                type="number"
                name="allowedWFH"
                value={formData.allowedWFH}
                onChange={handleChange}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.allowedWFH
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
              />
              {validationErrors.allowedWFH && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.allowedWFH}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item
                ? thr("wfhGroups.updateWfhGroup", "Update WFH Group")
                : thr("wfhGroups.addWfhGroup", "Add WFH Group")}
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
            "wfhGroups.deleteConfirm",
            "Do you really want to delete this WFH group? This action cannot be undone."
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

const WFHGroupSettings = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locations, setLocation] = useState("All");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);

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
      fetchItems(organization);
      fetchDepartments(organization);
    }
  }, [organization, isOrgLoaded]);

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
        business_id: organization,
        name: item.name,
        department: item.department,
        staff: item.staff,
        allowedWFH: item.allowedWFH,
        status: item.status || "Active",
      };

      if (editItem) {
        await axios.put(
          `${BASE_URL}/wfh-groups/update/${editItem._id}`,
          payload,
          { headers }
        );
      } else {
        await axios.post(`${BASE_URL}/wfh-groups/add`, payload, { headers });
      }

      fetchItems(organization);
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save item", err);
      notifyError(
        err?.response?.data?.error ||
          thr("anErrorOccurred", "An error occurred")
      );
    }
  };

  const fetchItems = async (selectedOrg) => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };
      const response = await axios.post(
        `${BASE_URL}/wfh-groups/get_all`,
        payload,
        { headers }
      );
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError(thr("wfhGroups.fetchFailed", "Failed to fetch WFH groups"));
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async (selectedOrg) => {
    if (!selectedOrg) return;
    try {
      const payload = {
        business_id: selectedOrg,
      };
      const response = await axios.post(
        `${BASE_URL}/departments/get_all`,
        payload,
        { headers }
      );
      setDepartments(response.data.data);
    } catch (err) {
      console.error("Failed to fetch departments", err);
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
      await axios.delete(`${BASE_URL}/wfh-groups/delete/${deleteItemId}`, {
        headers,
      });
      fetchItems(organization);
    } catch (err) {
      setError(thr("wfhGroups.deleteFailed", "Failed to delete WFH group"));
    } finally {
      setDeleteModalOpen(false);
      setDeleteItemId(null);
    }
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

          <div className="bg-white rounded-lg shadow-sm">
            <ItemTable
              items={items}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          </div>
        </div>
      )}
      <AddEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type="WFH Group"
        organization={organization}
        item={editItem}
        departments={departments}
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

export default WFHGroupSettings;
