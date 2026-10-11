import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useHistory, useLocation } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { FiEdit, FiTrash2, FiEye } from "react-icons/fi";
import { notifyError, notifySuccess } from "@/utils/toast";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import AppLayout from "../app-layout";
import Header from "@/components/header/Header";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TAX_TYPE_LABELS = {
  exclusive: "Exclusive",
  inclusive: "Inclusive",
  zero_rated: "Zero-Rated",
  exempt: "Exempt",
};

const TAX_TYPE_COLORS = {
  exclusive: "bg-blue-50 text-blue-700",
  inclusive: "bg-purple-50 text-purple-700",
  zero_rated: "bg-amber-50 text-amber-700",
  exempt: "bg-gray-100 text-gray-600",
};

const TaxClassTable = ({ taxClasses, onEdit, onDelete, onView, canUpdate, canDelete }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Name
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Rate
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Type
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Business
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {taxClasses.map((taxClass) => (
          <tr key={taxClass._id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {taxClass.name}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {taxClass.percentage}%
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TAX_TYPE_COLORS[taxClass.type] || TAX_TYPE_COLORS.exclusive}`}>
                {TAX_TYPE_LABELS[taxClass.type] || "Exclusive"}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${taxClass.isActive !== false ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {taxClass.isActive !== false ? "Active" : "Inactive"}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {taxClass.business?.name || "-"}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button
                onClick={() => onView(taxClass)}
                className="text-indigo-600 hover:text-indigo-900 mr-2"
              >
                <FiEye className="w-5 h-5" />
              </button>
              {canUpdate && (
                <button
                  onClick={() => onEdit(taxClass._id)}
                  className="text-blue-600 hover:text-blue-900 mr-2"
                >
                  <FiEdit className="w-5 h-5" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(taxClass)}
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

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, taxClass }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Are you sure?
        </h2>
        <p className="text-sm text-gray-600">
          {taxClass
            ? `Do you really want to delete the tax class "${taxClass.name}"? This action cannot be undone.`
            : "Do you really want to delete this item? This action cannot be undone."}
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

const ViewDetailsModal = ({ isOpen, onClose, taxClass }) => {
  if (!isOpen || !taxClass) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Tax Class Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <p className="text-sm text-gray-900">{taxClass.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate</label>
              <p className="text-sm text-gray-900">{taxClass.percentage}%</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TAX_TYPE_COLORS[taxClass.type] || TAX_TYPE_COLORS.exclusive}`}>
                {TAX_TYPE_LABELS[taxClass.type] || "Exclusive"}
              </span>
            </div>
          </div>
          {taxClass.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-sm text-gray-500">{taxClass.description}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${taxClass.isActive !== false ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {taxClass.isActive !== false ? "Active" : "Inactive"}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business</label>
            <p className="text-sm text-gray-900">{taxClass.business?.name || "-"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
            <p className="text-sm text-gray-900">
              {taxClass.createdAt ? new Date(taxClass.createdAt).toLocaleString() : "-"}
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const TaxClasses = () => {
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const checkTokenExpired = useCheckTokenExpired();
  const [filteredTaxClasses, setFilteredTaxClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedTaxClass, setSelectedTaxClass] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taxClassToDelete, setTaxClassToDelete] = useState(null);

  const history = useHistory();
  const location = useLocation();

  // Get selectedOrg from URL query params
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");
    if (selectedOrg) {
      setSelectedBusiness(selectedOrg);
      fetchTaxClasses(selectedOrg);
    }
  }, [location.search]);

  const fetchTaxClasses = async (businessId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      let url = `${Base_URL}/tax-classes`;
      if (businessId) {
        url += `?businessId=${businessId}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        setFilteredTaxClasses(response.data.taxClasses || response.data);
      }
    } catch (err) {
      console.error("Error fetching tax classes:", err);
      if (err.response?.status === 401) {
        checkTokenExpired();
      } else {
        setError(err.response?.data?.message || "Failed to fetch tax classes");
        notifyError(err.response?.data?.message || "Failed to fetch tax classes");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (taxClassId) => {
    if (!canUpdate) return;
    history.push(`/edit-tax-class/${taxClassId}?selectedOrg=${selectedBusiness}`);
  };

  const handleViewDetails = (taxClass) => {
    setSelectedTaxClass(taxClass);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTaxClass(null);
  };

  const openDeleteModal = (taxClass) => {
    if (!canDelete) return;
    setTaxClassToDelete(taxClass);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setTaxClassToDelete(null);
    setDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!taxClassToDelete) return;
    if (!canDelete) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${Base_URL}/tax-classes/${taxClassToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      notifySuccess("Tax class deleted successfully!");
      closeDeleteModal();
      fetchTaxClasses(selectedBusiness);
    } catch (err) {
      console.error("Error deleting tax class:", err);
      if (err.response?.status === 401) {
        checkTokenExpired();
      } else {
        notifyError(err.response?.data?.message || "Failed to delete tax class");
      }
    }
  };

  const handleAddNew = () => {
    if (!canAdd) return;
    history.push(`/Add New Tax Class?selectedOrg=${selectedBusiness}`);
  };

  return (
    // <AppLayout>
    //   <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
    //     <div className="flex justify-between items-center mb-8">
    //       <h1 className="text-xl font-semibold text-gray-900">Tax Classes</h1>
    //       <button
    //         onClick={handleAddNew}
    //         className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
    //         disabled={!selectedBusiness}
    //       >
    //         <Plus className="w-5 h-5 mr-2" />
    //         Add New
    //       </button>
    //     </div>
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

        {!selectedBusiness ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Please select a business from settings</p>
          </div>
        ) : loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div>Error: {error}</div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="bg-white rounded-lg shadow-sm">
              {filteredTaxClasses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No tax classes found</p>
                </div>
              ) : (
                <TaxClassTable
                  taxClasses={filteredTaxClasses}
                  onEdit={handleEdit}
                  onDelete={openDeleteModal}
                  onView={handleViewDetails}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                />
              )}
            </div>
          </div>
        )}

        <ViewDetailsModal
          isOpen={isModalOpen}
          onClose={closeModal}
          taxClass={selectedTaxClass}
        />

        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
          taxClass={taxClassToDelete}
        />
      </div>
    </AppLayout>
  );
};

export default TaxClasses;
