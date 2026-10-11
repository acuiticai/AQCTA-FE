import React, { useState, useEffect } from "react";
import { AiOutlineClose } from "react-icons/ai";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EditAccountType = ({ accountType, selectedOrg, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    bid: accountType.bid,
    accountHeader: accountType.accountHeader,
    name: accountType.name,
    code: accountType.code,
    description: accountType.description || "",
    status: accountType.status,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep bid in sync with current business (read-only: cannot change business on edit)
  useEffect(() => {
    const bid = selectedOrg ?? accountType.bid;
    setFormData((prev) => ({ ...prev, bid }));
  }, [selectedOrg, accountType.bid]);

  const isWrongBusiness = selectedOrg && accountType.bid && accountType.bid !== selectedOrg;

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
    if (!formData.bid) newErrors.bid = "BID is required";
    if (!formData.accountHeader)
      newErrors.accountHeader = "Account Header is required";
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.code) newErrors.code = "Code is required";
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
      const params = formData.bid ? { bid: formData.bid } : {};
      await axios.put(`${Base_URL}/account-types/${accountType._id}`, formData, {
        params,
      });
      onSuccess();
    } catch (error) {
      console.error("Error updating account type:", error);
      if (error.response && error.response.data) {
        setErrors({
          form: error.response.data.message || "Failed to update account type",
        });
      } else {
        setErrors({ form: "Failed to update account type. Try again later." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Edit Account Type</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <AiOutlineClose size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {isWrongBusiness && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2 rounded text-sm">
                This account type belongs to another business. Changes may be limited.
              </div>
            )}
            {errors.form && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                {errors.form}
              </div>
            )}

            {/* BID */}
            {/* <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">
                BID <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <input
                  type="text"
                  name="bid"
                  value={formData.bid}
                  onChange={handleChange}
                  className={`w-full p-2 bg-gray-100 rounded border ${
                    errors.bid ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.bid && (
                  <p className="text-red-500 text-xs mt-1">{errors.bid}</p>
                )}
              </div>
            </div> */}

            {/* Account Header */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">
                Account Header <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <input
                  type="text"
                  name="accountHeader"
                  value={formData.accountHeader}
                  onChange={handleChange}
                  placeholder="Enter account header"
                  className={`w-full p-2 bg-gray-100 rounded border ${
                    errors.accountHeader ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.accountHeader && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.accountHeader}
                  </p>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">
                Name <span className="text-red-500">*</span>
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
                Code <span className="text-red-500">*</span>
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

            {/* Description */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">Description</label>
              <div className="col-span-2">
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-100 rounded border border-gray-200"
                  rows="3"
                />
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">Status</label>
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
                    {formData.status ? "Active" : "Inactive"}
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isWrongBusiness}
              className="px-4 py-2 bg-lime-500 text-white rounded hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAccountType;
