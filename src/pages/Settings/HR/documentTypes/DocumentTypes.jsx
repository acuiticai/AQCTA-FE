import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineEdit, AiOutlineDelete, AiOutlinePlus } from "react-icons/ai";
import axios from "axios";
import AddDocumentType from "./AddDocumentType";
import EditDocumentType from "./EditDocumetType";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentTypes = ({ selectedOrg }) => {
  const { t } = useTranslation();
  const td = (key, fallback, options) =>
    t(`settingsPage.documentManager.${key}`, {
      defaultValue: fallback,
      ...options,
    });
  const tdt = (key, fallback, options) =>
    t(`settingsPage.documentManager.documentTypesPage.${key}`, {
      defaultValue: fallback,
      ...options,
    });

  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [documentTypes, setDocumentTypes] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentDocumentType, setCurrentDocumentType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/document-types`);
      setDocumentTypes(response.data);
    } catch (error) {
      console.error("Error fetching document types:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    if (!canUpdate) return;
    try {
      await axios.patch(`${Base_URL}/document-types/${id}`, {
        status: !currentStatus,
      });
      fetchData();
    } catch (error) {
      console.error("Error updating document type status:", error);
    }
  };

  const handleEdit = (documentType) => {
    if (!canUpdate) return;
    setCurrentDocumentType(documentType);
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (
      window.confirm(
        tdt(
          "deleteConfirm",
          "Are you sure you want to delete this document type?",
        ),
      )
    ) {
      try {
        await axios.delete(`${Base_URL}/document-types/${id}`);
        fetchData();
      } catch (error) {
        console.error("Error deleting document type:", error);
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 max-h-[90vh] overflow-y-auto pb-[120px]">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <a
              href="#"
              className="py-4 px-6 font-medium border-b-2 border-lime-500 text-lime-600"
            >
              {td("documentTypes", "Document Types")}
            </a>
          </nav>
        </div>

        <div className="mb-6 flex justify-end items-center p-4 border-b">
          {canAdd && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-lime-500 hover:bg-lime-600 text-white px-4 py-2 rounded flex items-center"
            >
              <AiOutlinePlus className="mr-2" />
              {td("addNew", "Add New")}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              {tdt("loading", "Loading document types...")}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {td("name", "Name")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {td("status", "Status")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {td("actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documentTypes.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500"
                    >
                      {tdt("empty", "No document types found")}
                    </td>
                  </tr>
                ) : (
                  documentTypes.map((documentType) => (
                    <tr key={documentType._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {documentType.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <label
                          className={`relative inline-flex items-center ${
                            canUpdate
                              ? "cursor-pointer"
                              : "cursor-not-allowed opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={documentType.status}
                            disabled={!canUpdate}
                            onChange={() =>
                              handleStatusChange(
                                documentType._id,
                                documentType.status,
                              )
                            }
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleEdit(documentType)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <AiOutlineEdit size={20} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(documentType._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <AiOutlineDelete size={20} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddDocumentType
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
          selectedOrg={selectedOrg}
        />
      )}

      {showEditModal && currentDocumentType && (
        <EditDocumentType
          documentType={currentDocumentType}
          onClose={() => {
            setShowEditModal(false);
            setCurrentDocumentType(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setCurrentDocumentType(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default DocumentTypes;
