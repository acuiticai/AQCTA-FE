import React, { useState, useRef } from "react";
import { X, UserPlus } from "lucide-react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";

/**
 * Minimal modal to add a vendor quickly (e.g. while creating or editing a vendor invoice).
 * Requires business to be selected. On success, returns the created vendor so parent can select it.
 */
const QuickAddVendorModal = ({
  isOpen,
  onClose,
  businessId,
  baseUrl,
  headers,
  onSuccess,
}) => {
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const [formData, setFormData] = useState({
    vendorDisplayName: "",
    vendorEmail: "",
    mobile: "",
    icNumber: "",
    areaGoogleLocation: "",
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!formData.vendorDisplayName?.trim()) {
      next.vendorDisplayName = "Display name is required.";
    }
    if (!formData.vendorEmail?.trim()) {
      next.vendorEmail = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.vendorEmail.trim())) {
      next.vendorEmail = "Invalid email format.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!businessId) {
      notifyError("Please select a business first.");
      return;
    }
    if (!validate()) return;

    submittingRef.current = true;
    setSaving(true);
    setErrors({});
    try {
      const displayName = formData.vendorDisplayName?.trim() || "";
      const nameParts = displayName.split(/\s+/);
      const firstName = nameParts[0] || displayName;
      const lastName = nameParts.slice(1).join(" ") || "";

      const payload = {
        business: businessId,
        basicInformation: {
          companyName: "",
          vendorDisplayName: displayName,
          primaryContact: {
            salutation: "",
            firstName,
            lastName,
          },
          vendorEmail: formData.vendorEmail?.trim(),
          vendorPhone: formData.mobile?.trim()
            ? { workPhone: "", mobile: formData.mobile.trim() }
            : undefined,
          vendorType: "Individual",
        },
        riderDetails: {
          icNumber: formData.icNumber?.trim() || "",
          googleLocation: formData.areaGoogleLocation?.trim() || "",
        },
      };

      const response = await axios.post(`${baseUrl}/vendors`, payload, {
        headers: headers || { "Content-Type": "application/json" },
      });

      const createdId = response?.data?._id || response?.data?.data?._id;
      if (!createdId) {
        notifyError("Vendor was created but could not be loaded.");
        resetAndClose();
        return;
      }

      // Fetch full vendor so parent gets same shape as list (basicInformation etc.)
      const getRes = await axios.get(`${baseUrl}/vendors/${createdId}`, {
        headers: headers || { "Content-Type": "application/json" },
      });
      const newVendor = getRes?.data?.data || getRes?.data;

      if (newVendor && typeof onSuccess === "function") {
        onSuccess(newVendor);
      }
      notifySuccess("Vendor added. You can add more details later from the vendor profile.");
      resetAndClose();
    } catch (err) {
        const message =
          err?.response?.data?.message || err?.message || "Failed to add vendor.";
        notifyError(message);
        if (err?.response?.data?.field) {
          setErrors((prev) => ({ ...prev, [err.response.data.field]: message }));
        }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setFormData({
      vendorDisplayName: "",
      vendorEmail: "",
      mobile: "",
      icNumber: "",
      areaGoogleLocation: "",
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={resetAndClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--p-blue)]" />
            <h2 className="text-lg font-semibold text-gray-900">Quick add vendor</h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.vendorDisplayName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  vendorDisplayName: e.target.value,
                }))
              }
              placeholder="Name shown on invoices"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
            {errors.vendorDisplayName && (
              <p className="mt-1 text-xs text-red-500">{errors.vendorDisplayName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.vendorEmail}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, vendorEmail: e.target.value }))
              }
              placeholder="vendor@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
            {errors.vendorEmail && (
              <p className="mt-1 text-xs text-red-500">{errors.vendorEmail}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={formData.mobile}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, mobile: e.target.value }))
              }
              placeholder="Optional"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IC Number
            </label>
            <input
              type="text"
              value={formData.icNumber}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, icNumber: e.target.value }))
              }
              placeholder="Optional"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area (Google Location)
            </label>
            <input
              type="text"
              value={formData.areaGoogleLocation}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  areaGoogleLocation: e.target.value,
                }))
              }
              placeholder="Optional"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Adding…" : "Add vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default QuickAddVendorModal;
