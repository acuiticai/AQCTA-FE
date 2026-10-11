import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineClose } from "react-icons/ai";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EditClaimGroup = ({ claimGroup, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    bid: claimGroup.bid,
    name: claimGroup.name,
    code: claimGroup.code,
    status: claimGroup.status,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.bid) newErrors.bid = thr("bidIsRequired", "BID is required");
    if (!formData.name) newErrors.name = thr("claimGroups.nameRequired", "Claim Group Name is required");
    if (!formData.code) newErrors.code = thr("claimGroups.codeRequired", "Claim Group Code is required");
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
      await axios.put(`${Base_URL}/claim-groups/${claimGroup._id}`, formData);
      onSuccess();
    } catch (error) {
      console.error("Error updating claim group:", error);
      if (error.response && error.response.data) {
        setErrors({ form: error.response.data.message || thr("claimGroups.updateFailed", "Failed to update claim group") });
      } else {
        setErrors({ form: thr("claimGroups.updateFailedRetry", "Failed to update claim group. Try again later.") });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{thr("claimGroups.editClaimGroup", "Edit Claim Group")}</h2>
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

            {/* Name */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">
                {thr("claimGroups.claimGroupName", "Claim Group Name")} <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full p-2 bg-gray-100 rounded border ${
                    errors.name ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>
            </div>

            {/* Code */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">
                {thr("claimGroups.claimGroupCode", "Claim Group Code")} <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  className={`w-full p-2 bg-gray-100 rounded border ${
                    errors.code ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.code && (
                  <p className="text-red-500 text-xs mt-1">{errors.code}</p>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">{thr("status", "Status")}</label>
              <div className="col-span-2 flex items-center">
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
                    {formData.status ? thr("active", "Active") : thr("inactive", "Inactive")}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 border-t flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700"
            >
              {thr("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#A6C437] text-white rounded hover:bg-[#A6C437] disabled:bg-lime-300"
            >
              {isSubmitting ? thr("updating", "Updating...") : thr("update", "Update")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditClaimGroup;
