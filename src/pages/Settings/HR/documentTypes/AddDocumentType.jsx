import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineClose } from "react-icons/ai";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddDocumentType = ({ onClose, onSuccess, selectedOrg }) => {
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

  const [formData, setFormData] = useState({
    name: "",
    status: true,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = tdt("nameRequired", "Document type name is required");
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${Base_URL}/document-types`, formData);
      onSuccess();
    } catch (error) {
      console.error("Error creating document type:", error);
      if (error.response && error.response.data) {
        if (error.response.data.message === "Document type already exists") {
          setErrors({
            name: tdt("alreadyExists", "Document type already exists"),
          });
        } else {
          setErrors({
            form:
              error.response.data.message ||
              tdt("createFailed", "Failed to create document type"),
          });
        }
      } else {
        setErrors({
          form: tdt(
            "createFailedRetry",
            "Failed to create document type. Try again later.",
          ),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">
            {tdt("addTitle", "Add Document Type")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <AiOutlineClose size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {errors.form && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                {errors.form}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {td("name", "Name")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full p-2 bg-gray-100 rounded border ${
                  errors.name ? "border-red-500" : "border-gray-200"
                }`}
                placeholder={tdt("namePlaceholder", "Enter document type name")}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div className="flex items-center">
              <label className="block text-sm font-medium text-gray-700 mr-4">
                {td("status", "Status")}
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="status"
                  className="sr-only peer"
                  checked={formData.status}
                  onChange={handleChange}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  {formData.status
                    ? tdt("active", "Active")
                    : tdt("inactive", "Inactive")}
                </span>
              </label>
            </div>
          </div>

          <div className="p-4 border-t flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700"
            >
              {td("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-lime-500 text-white rounded hover:bg-lime-600 disabled:bg-lime-300"
            >
              {isSubmitting
                ? tdt("creating", "Creating...")
                : tdt("create", "Create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDocumentType;
