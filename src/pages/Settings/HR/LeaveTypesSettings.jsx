import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, X, Edit, Search, Trash2, PlusCircle, MinusCircle } from 'lucide-react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { notifyError } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemTable = ({ items, onEdit, onToggleStatus, onDelete, canUpdate, canDelete }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  return (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{thr("leaveTypes.leaveName", "Leave Name")}</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{thr("leaveTypes.leaveCode", "Leave Code")}</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{thr("leaveTypes.groups", "Groups")}</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{thr("status", "Status")}</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{thr("action", "Action")}</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item) => (
          <tr key={item._id}>
            <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
            <td className="px-6 py-4 whitespace-nowrap">{item.code}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              {Array.isArray(item.groups) ? item.groups.join(', ') : item.group}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <ToggleSwitch
                isOn={item.status === "Active"}
                handleToggle={() => onToggleStatus(item)}
                disabled={!canUpdate}
              />
            </td>
            <td className="px-6 py-4 whitespace-nowrap flex space-x-2">
              {canUpdate && (
                <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-900">
                  <Edit className="w-5 h-5" />
                </button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(item._id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-5 h-5" />
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

const MultiSelect = ({ options, value, onChange }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [isOpen, setIsOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState(value || []);

  useEffect(() => {
    setSelectedOptions(value || []);
  }, [value]);

  const handleToggle = (option) => {
    let newSelection;
    if (selectedOptions.includes(option)) {
      newSelection = selectedOptions.filter(item => item !== option);
    } else {
      newSelection = [...selectedOptions, option];
    }
    setSelectedOptions(newSelection);
    onChange(newSelection);
  };

  return (
    <div className="relative">
      <div
        className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 text-gray-900 flex justify-between items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="truncate">
          {selectedOptions.length > 0
            ? selectedOptions.join(', ')
            : thr("leaveTypes.selectGroups", "Select groups")}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option, index) => (
            <div
              key={index}
              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
              onClick={() => handleToggle(option.name)}
            >
              <input
                type="checkbox"
                checked={selectedOptions.includes(option.name)}
                onChange={() => { }}
                className="mr-2"
              />
              <span>{option.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AddEditModal = ({ isOpen, onClose, type, item, onSubmit, LeaveGroups, canSubmit }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    groups: [],
    status: 'Active',
    eligibility_rules: [{ from_year: '0', to_year: '1', eligibility_days: '16', carryForwardDays: '0' }],
    carryForwardExpiryDays: 0
  });

  useEffect(() => {
    if (item) {
      // Handle existing item data
      const eligibilityRules = item.eligibility_rules || [{
        from_year: item.from_year || '0',
        to_year: item.to_year || '1',
        eligibility_days: item.eligibility_days || '16',
        carryForwardDays: '0'
      }];

      // Ensure carryForwardDays exists in each rule
      const rulesWithCarryForward = eligibilityRules.map(rule => ({
        ...rule,
        carryForwardDays: rule.carryForwardDays || '0'
      }));

      setFormData({
        code: item.code || '',
        name: item.name || '',
        groups: item.groups || [item.group] || [],
        status: item.status || 'Active',
        eligibility_rules: rulesWithCarryForward,
        carryForwardExpiryDays: item.carryForwardExpiryDays || 0
      });
    } else {
      // Reset form for new item
      setFormData({
        code: '',
        name: '',
        groups: [],
        status: 'Active',
        eligibility_rules: [{ from_year: '0', to_year: '1', eligibility_days: '16', carryForwardDays: '0' }],
        carryForwardExpiryDays: 0
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGroupsChange = (selectedGroups) => {
    setFormData(prev => ({ ...prev, groups: selectedGroups }));
  };

  const handleEligibilityChange = (index, field, value) => {
    const updatedRules = [...formData.eligibility_rules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    setFormData(prev => ({ ...prev, eligibility_rules: updatedRules }));
  };

  const addEligibilityRule = () => {
    setFormData(prev => ({
      ...prev,
      eligibility_rules: [...prev.eligibility_rules, { from_year: '0', to_year: '1', eligibility_days: '16', carryForwardDays: '0' }]
    }));
  };

  const removeEligibilityRule = (index) => {
    if (formData.eligibility_rules.length > 1) {
      const updatedRules = formData.eligibility_rules.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, eligibility_rules: updatedRules }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate for duplicate or overlapping eligibility rules
    const rules = formData.eligibility_rules.map(rule => ({
      from: parseFloat(rule.from_year),
      to: parseFloat(rule.to_year),
    }));

    let hasOverlap = false;
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const r1 = rules[i];
        const r2 = rules[j];
        if (
          // Check if they overlap
          r1.from < r2.to && r1.to > r2.from
        ) {
          hasOverlap = true;
          break;
        }
        // Check if they are duplicate
        if (
          r1.from === r2.from && r1.to === r2.to
        ) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    if (hasOverlap) {
      notifyError(thr("leaveTypes.eligibilityRulesOverlap", "Eligibility rules contain duplicate or overlapping year ranges."))
      return;
    }
// import { notifyError, notifySuccess } from "@/utils/toast";

    // If no overlap, proceed to submit
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const statusOptions = [
    { value: "Active", label: thr("active", "Active") },
    { value: "Inactive", label: thr("inactive", "Inactive") },
  ];

  const eligibilityFields = [
    { label: thr("leaveTypes.fromYear", "From Year"), name: "from_year", type: "number" },
    { label: thr("leaveTypes.toYear", "To Year"), name: "to_year", type: "number" },
    { label: thr("leaveTypes.eligibilityDays", "Eligibility Days"), name: "eligibility_days", type: "number", step: "0.01" },
    { label: thr("leaveTypes.carryForwardDays", "Carry Forward Days"), name: "carryForwardDays", type: "number", step: "0.01" },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[20px] p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-lg">
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {item
              ? thr("leaveTypes.editLeaveType", "Edit Leave Type")
              : thr("leaveTypes.addLeaveType", "Add Leave Type")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-600 mb-4 text-sm">
          {item
            ? thr("leaveTypes.editLeaveTypeDesc", "Edit details below to update leave type.")
            : thr("leaveTypes.addLeaveTypeDesc", "Add details below to create a new leave type.")}
        </p>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Leave Type Code */}
          <div className="space-y-2">
            <label className="block text-gray-500 text-sm">{thr("leaveTypes.leaveTypeCode", "Leave Type Code")}</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder={thr("leaveTypes.leaveTypeCode", "Leave Type Code")}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#A6C437]"
              required
            />
          </div>

          {/* Leave Type Name */}
          <div className="space-y-2">
            <label className="block text-gray-500 text-sm">{thr("leaveTypes.leaveTypeName", "Leave Type Name")}</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={thr("leaveTypes.leaveTypeName", "Leave Type Name")}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#A6C437]"
              required
            />
          </div>

          {/* Select Groups (Multi-select) */}
          <div className="space-y-2">
            <label className="block text-gray-500 text-sm">{thr("leaveTypes.selectGroupsLabel", "Select Groups")}</label>
            <MultiSelect
              options={LeaveGroups}
              value={formData.groups}
              onChange={handleGroupsChange}
            />
          </div>

          {/* Carry Forward Expiry Days */}
          <div className="space-y-2">
            <label className="block text-gray-500 text-sm">{thr("leaveTypes.carryForwardExpiryDays", "Carry Forward Expiry Days")}</label>
            <input
              type="number"
              name="carryForwardExpiryDays"
              value={formData.carryForwardExpiryDays}
              onChange={handleChange}
              min="0"
              placeholder="0"
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#A6C437]"
            />
            <p className="text-xs text-gray-500">{thr("leaveTypes.carryForwardExpiryHint", "0 = No carry forward, positive number = expiry days for carried forward leave")}</p>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="block text-gray-500 text-sm">{thr("status", "Status")}</label>
            <div className="flex gap-4">
              {statusOptions.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${formData.status === value ? "border-[#A6C437] bg-[#A6C437]" : "border-gray-300"}`}>
                    {formData.status === value && (
                      <div className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </div>
                  <input
                    type="radio"
                    name="status"
                    value={value}
                    checked={formData.status === value}
                    onChange={handleChange}
                    className="hidden"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Eligibility Rules */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-gray-500 text-sm font-medium">{thr("leaveTypes.eligibility", "Eligibility")}</label>
              <button
                type="button"
                onClick={addEligibilityRule}
                className="text-[#A6C437] hover:text-[#95b130] flex items-center text-sm"
              >
                <PlusCircle className="w-4 h-4 mr-1" />
                {thr("leaveTypes.addMore", "Add More")}
              </button>
            </div>

            {formData.eligibility_rules.map((rule, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium"></span>
                  {formData.eligibility_rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEligibilityRule(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <MinusCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {eligibilityFields.map(({ label, name, type, step }) => (
                    <div key={name} className="space-y-1">
                      <label className="block text-gray-500 text-xs">{label}</label>
                      <input
                        type={type}
                        step={step}
                        value={rule[name] || '0'}
                        onChange={(e) => handleEligibilityChange(index, name, e.target.value)}
                        className="w-full p-2 bg-white rounded border border-gray-300 text-gray-900 text-sm focus:ring-2 focus:ring-[#A6C437]"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="pt-4 space-y-3">
            <button
              type="submit"
              className="w-full py-3 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item
                ? thr("leaveTypes.updateLeaveType", "Update Leave Type")
                : thr("leaveTypes.addLeaveType", "Add Leave Type")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-gray-50 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              {thr("cancel", "Cancel")}
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
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{thr("areYouSure", "Are you sure?")}</h2>
        <p className="text-sm text-gray-600">{thr("deleteConfirmItem", "Do you really want to delete this item? This action cannot be undone.")}</p>

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

const LeaveTypesPage = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [activeTab, setActiveTab] = useState("Group");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [LeaveGroups, setLeaveGroups] = useState([]);
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
      fetchItems(activeTab, organization);
      fetchGroups(activeTab, organization);
    }
  }, [activeTab, organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const fetchGroups = async (ActiveTab, selectedOrg) => {
    if (!selectedOrg) return;
    try {
      let payload = {
        business_id: selectedOrg,
        FilterStatus: '',
        FilterName: '',
      };
      let response = await axios.post(`${BASE_URL}/LeaveGroups/get_all`, payload, { headers });
      setLeaveGroups(response.data.data);
    } catch (err) {
      console.error('Failed to fetch leave groups', err);
    }
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
      // Prepare the payload with the new structure
      const payload = {
        business_id: organization,
        name: formData.name,
        code: formData.code,
        groups: formData.groups,
        status: formData.status,
        eligibility_rules: formData.eligibility_rules,
        carryForwardExpiryDays: formData.carryForwardExpiryDays || 0
      };

      if (editItem) {
        await axios.put(`${BASE_URL}/LeaveTypes/update/${editItem._id}`, payload, { headers });
      } else {
        await axios.post(`${BASE_URL}/LeaveTypes/add`, payload, { headers });
      }

      setModalOpen(false);
      fetchItems(activeTab, organization);
    } catch (err) {
      console.error('Failed to save item', err);
    }
  };

  const fetchItems = async (ActiveTab, selectedOrg) => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      let payload = {
        business_id: selectedOrg,
        FilterStatus: '',
        FilterName: '',
      };
      let response = await axios.post(`${BASE_URL}/LeaveTypes/get_all`, payload, { headers });
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
      await axios.delete(`${BASE_URL}/LeaveTypes/delete/${deleteItemId}`, { headers });
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
      // Preserve the existing structure when toggling status
      const payload = {
        ...item,
        status: item.status === 'Active' ? 'Inactive' : 'Active',
        business_id: organization,
      };

      await axios.put(`${BASE_URL}/LeaveTypes/update/${item._id}`, payload, { headers });
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(thr("statusUpdateFailed", "Failed to update item status"));
    }
  };

  return (
    <>
      {!isOrgLoaded && !organization ? (
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <p className="text-gray-600">{thr("loadingOrganization", "Loading organization...")}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-600">{thr("loading", "Loading...")}</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg text-red-600">
          {thr("errorPrefix", "Error: {{error}}", { error })}
        </div>
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
                <option value="Location1">
                  {thr("leaveTypes.location1", "Location 1")}
                </option>
                <option value="Location2">
                  {thr("leaveTypes.location2", "Location 2")}
                </option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
        LeaveGroups={LeaveGroups}
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

export default LeaveTypesPage;
