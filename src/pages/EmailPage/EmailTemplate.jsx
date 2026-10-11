import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { FiSearch, FiPlus, FiArrowLeft, FiTrash2 } from "react-icons/fi";
import useButtonColor from "@/hooks/useButtonColor";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import EmailTemplateServices from "@/services/EmailTemplateServices";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  templateName,
  deleting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Delete email template?
        </h2>
        <p className="text-sm text-gray-600">
          {templateName ? (
            <>
              Delete <strong>{templateName}</strong>? This action cannot be
              undone.
            </>
          ) : (
            "Do you really want to delete this template? This action cannot be undone."
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

const EmailTemplatesUI = () => {
  const [templates, setTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const buttonColor = useButtonColor();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const [businessId, setBusinessId] = useState(null); // Set initially as null
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedBusinessId = searchParams.get("selectedOrg");

    if (selectedBusinessId) {
      console.log("✅ Selected Business ID Retrieved:", selectedBusinessId);
      setBusinessId(selectedBusinessId);
    } else {
      console.warn("⚠️ No Business ID found in URL.");
    }
  }, [location]);

  useEffect(() => {
    if (businessId) {
      fetchTemplates(businessId);
    }
  }, [businessId]);

  const fetchTemplates = async (businessId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/email-template/templates`, {
        params: { business_id: businessId },
      });
      setTemplates(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching templates:", error);
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.temp_subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteClick = (template) => {
    if (!canDelete) return;
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!canDelete || !templateToDelete?._id) return;

    setDeleteLoading(true);
    try {
      await EmailTemplateServices.deleteTemplate(templateToDelete._id);
      notifySuccess("Email template deleted successfully.");
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
      if (businessId) {
        await fetchTemplates(businessId);
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete email template."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AppLayout>
      <Header />
      <div className="container mx-auto p-6 max-h-[90vh] overflow-y-auto pb-[120px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="bg-emerald-100 p-3 rounded-full">
              <FiSearch className="text-emerald-600 text-2xl" />
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-semibold">Email Templates</h1>
              <p className="text-gray-500">
                List of email templates for the selected business.
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <Link to="/dashboard">
              <button className="flex items-center gap-2 border  text-emerald-500 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all bg-gray-200 text-gray-700 ">
                <FiArrowLeft />
                Back
              </button>
            </Link>
            {canAdd && (
              <Link to={`/AddEmailTemplate?selectedOrg=${businessId}`}>
                <button
                  className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl bg-[var(--p-blue)] hover:bg-emerald-600 transition-all"
                  style={{ backgroundColor: buttonColor }}
                >
                  <FiPlus />
                  Add New
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Selected Business ID Display */}
        {/* <div className="bg-white p-4 shadow rounded-md mb-4">
          <h2 className="text-lg font-semibold text-gray-700">
            Selected Business ID:
          </h2>
          <p className="text-gray-500">
            {businessId ? businessId : "No business selected"}
          </p>
        </div> */}

        {/* Search Bar */}
        <div className="bg-white p-4 shadow rounded-md mb-4 flex items-center space-x-3">
          <input
            type="text"
            placeholder="Search Name/Subject"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={() => setSearchTerm("")}
            className="bg-[var(--p-blue)] text-white px-4 py-2 rounded-xl bg-[var(--p-blue)] transition-all flex items-center gap-2"
            style={{ backgroundColor: buttonColor }}
          >
            <FiSearch />
            Search
          </button>
          <button
            onClick={() => setSearchTerm("")}
            className="border  bg-gray-200 text-gray-700 px-4 py-2 rounded-xl bg-gray transition-all"
          >
            Reset
          </button>
        </div>

        {/* Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="text-center py-6 text-gray-500">Loading...</div>
          ) : (
            <table className="min-w-full table-auto">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">
                    Template Name
                  </th>
                  <th className="px-6 py-3 text-left font-medium">Subject</th>
                  <th className="px-6 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.length > 0 ? (
                  filteredTemplates.map((template) => (
                    <tr
                      key={template._id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-6 py-3">{template.template_name}</td>
                      <td className="px-6 py-3">{template.temp_subject}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-4">
                          {canUpdate && (
                            <Link
                              to={`/edit-template/${template._id}`}
                              className="text-emerald-500 hover:underline"
                            >
                              Edit
                            </Link>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(template)}
                              className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 hover:underline"
                            >
                              <FiTrash2 className="w-4 h-4" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-6 py-3 text-center text-gray-500"
                    >
                      No templates found for this business.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteModalOpen(false);
          setTemplateToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        templateName={templateToDelete?.template_name}
        deleting={deleteLoading}
      />
    </AppLayout>
  );
};

export default EmailTemplatesUI;
