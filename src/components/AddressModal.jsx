import React, { useState, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddressModal = ({
  isOpen,
  onClose,
  addressType, // "Billing" or "Shipping"
  customerId,
  vendorId,
  businessId,
  existingAddress,
  debugInfo,
  onSaveSuccess,
  onDeleteSuccess,
}) => {
  console.log("AddressModal props:", { customerId, vendorId, businessId, debugInfo });
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  const [formData, setFormData] = useState({
    addressType: addressType || "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
    fax: "",
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const lockedAddressType = addressType || existingAddress?.addressType || "";
  const isAddressTypeLocked = Boolean(lockedAddressType);

  useEffect(() => {
    if (isOpen) {
      // If editing existing address, populate form
      if (existingAddress) {
        setFormData({
          addressType: lockedAddressType || existingAddress.addressType || addressType || "",
          addressLine1: existingAddress.addressLine1 || "",
          addressLine2: existingAddress.addressLine2 || "",
          city: existingAddress.city || "",
          state: existingAddress.state || "",
          zipCode: existingAddress.zipCode || "",
          country: existingAddress.country || "",
          phone: existingAddress.phone || "",
          fax: existingAddress.fax || "",
        });
      } else {
        // Reset form for new address
        setFormData({
          addressType: lockedAddressType || addressType || "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
          phone: "",
          fax: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, existingAddress, addressType, lockedAddressType]);

  const addressTypeOptions = isAddressTypeLocked
    ? [{ value: lockedAddressType, label: lockedAddressType }]
    : [
        { value: "", label: "Select Address Type" },
        { value: "Billing", label: "Billing" },
        { value: "Shipping", label: "Shipping" },
        { value: "Delivery", label: "Delivery" },
        { value: "Registered", label: "Registered" },
        { value: "Mailing", label: "Mailing" },
        { value: "Other", label: "Other" },
      ];

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.addressType) {
      newErrors.addressType = "Address Type is required";
    }
    if (!formData.addressLine1 || formData.addressLine1.trim() === "") {
      newErrors.addressLine1 = "Address Line 1 is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    // When this modal is opened from a specific context (e.g. Delivery),
    // lock addressType so it can't be changed to another type.
    if (field === "addressType" && isAddressTypeLocked) return;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleSave = async () => {
    console.log("AddressModal handleSave called");
    console.log("Form data:", formData);
    console.log("customerId:", customerId, "vendorId:", vendorId);
    
    if (!validateForm()) {
      console.log("Form validation failed");
      return;
    }

    if (!customerId && !vendorId && !businessId) {
      console.log("No customer ID, vendor ID, or business ID found");
      notifyError("Customer ID, Vendor ID, or Business ID is required");
      return;
    }

    setIsSaving(true);

    try {
      let entity, entityEndpoint, entityType;
      
      if (businessId) {
        entity = "business";
        entityEndpoint = `/Business/${businessId}`;
        entityType = "Business";
      } else if (customerId) {
        entity = "customer";
        entityEndpoint = `/customers/${customerId}`;
        entityType = "Customer";
      } else if (vendorId) {
        entity = "vendor";
        entityEndpoint = `/vendors/${vendorId}`;
        entityType = "Vendor";
      }

      if (entity === "business") {
        const addressPayload = { ...formData };
        let response;
        if (existingAddress?._id) {
          response = await axios.put(
            `${Base_URL}${entityEndpoint}/addresses/${existingAddress._id}`,
            addressPayload,
            { headers }
          );
        } else {
          response = await axios.post(
            `${Base_URL}${entityEndpoint}/addresses`,
            addressPayload,
            { headers }
          );
        }
        const saved = response?.data?.data || addressPayload;
        notifySuccess(`${addressType || "Address"} address saved successfully!`);
        onSaveSuccess && onSaveSuccess(saved);
        onClose();
        return;
      }

      // Existing customer/vendor behavior (read-modify-write)
      const entityResponse = await axios.get(`${Base_URL}${entityEndpoint}`, { headers });
      let entityData;
      if (entity === "vendor") {
        entityData = entityResponse.data?.data || entityResponse.data;
      } else {
        entityData = entityResponse.data;
      }
      const existingAddresses = Array.isArray(entityData.addresses) ? entityData.addresses : [];
      let updatedAddresses;

      if (existingAddress?._id) {
        updatedAddresses = existingAddresses.map((addr) =>
          addr._id?.toString() === existingAddress._id?.toString() ? { ...formData, _id: addr._id } : addr
        );
      } else {
        const existingAddressOfType = existingAddresses.find(
          (addr) => addr.addressType === formData.addressType
        );
        updatedAddresses = existingAddressOfType?._id
          ? existingAddresses.map((addr) =>
              addr._id?.toString() === existingAddressOfType._id?.toString()
                ? { ...formData, _id: addr._id }
                : addr
            )
          : [...existingAddresses, formData];
      }

      await axios.put(`${Base_URL}${entityEndpoint}`, { addresses: updatedAddresses }, { headers });
      notifySuccess(`${addressType || "Address"} address saved successfully!`);
      onSaveSuccess && onSaveSuccess(formData);
      onClose();
    } catch (error) {
      console.error("Error saving address:", error);
      notifyError(
        error.response?.data?.message || "Failed to save address. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingAddress?._id || !businessId) return;
    setIsSaving(true);
    try {
      await axios.delete(
        `${Base_URL}/Business/${businessId}/addresses/${existingAddress._id}`,
        { headers }
      );
      notifySuccess("Address deleted successfully!");
      onDeleteSuccess && onDeleteSuccess(existingAddress);
      onClose();
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to delete address.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000000] flex items-center justify-center bg-black/50 p-4"
      data-modal-root="address-modal"
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {existingAddress ? "Edit" : "Add"} {addressType || "Address"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Address Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.addressType}
              onChange={(e) => handleChange("addressType", e.target.value)}
              disabled={isAddressTypeLocked}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                errors.addressType ? "border-red-500" : "border-gray-300"
              }`}
            >
              {addressTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.addressType && (
              <p className="mt-1 text-xs text-red-500">{errors.addressType}</p>
            )}
          </div>

          {/* Address Line 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address Line 1 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.addressLine1}
              onChange={(e) => handleChange("addressLine1", e.target.value)}
              placeholder="Enter Address Line 1"
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                errors.addressLine1 ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.addressLine1 && (
              <p className="mt-1 text-xs text-red-500">{errors.addressLine1}</p>
            )}
          </div>

          {/* Address Line 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address Line 2
            </label>
            <input
              type="text"
              value={formData.addressLine2}
              onChange={(e) => handleChange("addressLine2", e.target.value)}
              placeholder="Enter Address Line 2"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>

          {/* City, State, Zip Code Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="Enter City"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
                placeholder="Enter State"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zip Code
              </label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={(e) => handleChange("zipCode", e.target.value)}
                placeholder="Enter Zip Code"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Country
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => handleChange("country", e.target.value)}
              placeholder="Enter Country"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>

          {/* Phone and Fax Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                  handleChange("phone", phoneValue);
                }}
                placeholder="Enter Phone"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fax
              </label>
              <input
                type="tel"
                value={formData.fax}
                onChange={(e) => {
                  const faxValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                  handleChange("fax", faxValue);
                }}
                placeholder="Enter Fax"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          {businessId && existingAddress?._id && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              "Save Address"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AddressModal;
