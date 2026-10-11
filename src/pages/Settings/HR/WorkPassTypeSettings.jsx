import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, X as CloseIcon } from 'lucide-react';
import axios from 'axios';
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {thr("workPassTypes.passTypeName", "Pass Type Name")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {thr("description", "Description")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {thr("status", "Status")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {thr("actions", "Actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{item.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm truncate max-w-xs">
                {item.description || thr("workPassTypes.emptyDescription", "-")}
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
                  <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-900 mr-2">
                    <FiEdit className="w-5 h-5" />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(item._id)} className="text-red-600 hover:text-red-900">
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                {thr("workPassTypes.noWorkPassTypesFound", "No work pass types found.")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const AddEditModal = ({ isOpen, onClose, item, onSubmit, canSubmit }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    _id: '',
    name: '',
    description: '',
    status: 'Active',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || '',
        name: item.name || '',
        description: item.description || '',
        status: item.status || 'Active',
      });
    } else {
      setFormData({ _id: '', name: '', description: '', status: 'Active' });
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
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%] shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {item
              ? thr("workPassTypes.editWorkPassType", "Edit Work Pass Type")
              : thr("workPassTypes.addNewWorkPassType", "Add New Work Pass Type")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("workPassTypes.passTypeName", "Pass Type Name")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder={thr(
                "workPassTypes.passTypeNamePlaceholder",
                "e.g. S Pass, Employment Pass",
              )}
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("description", "Description")}
            </label>
            <textarea
              name="description"
              placeholder={thr(
                "workPassTypes.descriptionPlaceholder",
                "Optional description...",
              )}
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent resize-none"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {thr("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-[var(--p-blue)] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item
                ? thr("workPassTypes.updatePassType", "Update Pass Type")
                : thr("workPassTypes.addPassType", "Add Pass Type")}
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
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%] shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <FiTrash2 className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {thr("areYouSure", "Are you sure?")}
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            {thr(
              "workPassTypes.deleteConfirm",
              "Do you really want to delete this work pass type? This action cannot be undone.",
            )}
          </p>
        </div>

        <div className="flex justify-center space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {thr("cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {thr("delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkPassTypeSettings = ({ organization, headers }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);

  useEffect(() => {
    if (organization) {
      fetchItems();
    }
  }, [organization]);

  const fetchItems = async () => {
    if (!organization) return;
    setLoading(true);
    try {
      let response = await axios.get(`${BASE_URL}/work-pass-types/get?business=${organization}`, { headers });
      setItems(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(thr("fetchFailed", "Failed to fetch items"));
    } finally {
      setLoading(false);
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

  const handleSubmit = async (item) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    try {
      let payload = {
        name: item.name,
        description: item.description,
        status: item.status,
        business_id: organization,
      };

      if (editItem) {
        await axios.put(`${BASE_URL}/work-pass-types/update/${editItem._id}`, payload, { headers });
      } else {
        await axios.post(`${BASE_URL}/work-pass-types/add`, payload, { headers });
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      console.error('Failed to save item', err);
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
      await axios.delete(`${BASE_URL}/work-pass-types/delete/${deleteItemId}`, { headers });
      fetchItems();
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
        description: item.description,
        status: item.status === 'Active' ? 'Inactive' : 'Active',
        business_id: organization,
      };
      await axios.put(`${BASE_URL}/work-pass-types/update/${item._id}`, payload, { headers });
      fetchItems();
    } catch (err) {
      setError(thr("statusUpdateFailed", "Failed to update item status"));
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        {thr("workPassTypes.loading", "Loading Work Pass Types...")}
      </div>
    );
  }
  if (error) return <div className="p-6 text-red-500 text-center">{error}</div>;

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="flex justify-end items-center w-full mb-6">
        {canAdd && (
          <button
            onClick={handleAddNew}
            className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            {thr("workPassTypes.addNewPassType", "Add New Pass Type")}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <ItemTable
          items={items}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      </div>

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
    </div>
  );
};

export default WorkPassTypeSettings;
