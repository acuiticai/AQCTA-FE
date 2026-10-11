import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * "Add Payment Term" trigger that opens a modal to create a new payment term for the selected business.
 * @param {string} businessId - Selected business ID (required for create)
 * @param {function} onAdded - Callback (newTerm) after successful create; parent should add to list and optionally select
 * @param {object} headers - Auth headers for API
 * @param {boolean} disabled - Disable when no business selected
 * @param {string} size - 'sm' | 'md' (default 'sm') - only when displayMode !== 'dropdown'
 * @param {string} displayMode - 'standalone' (default) = button beside dropdown; 'dropdown' = compact trigger for inside dropdown footer
 * @param {string} tableName - Misc table name, e.g. 'Payment Terms' (default) or 'Vendor Payment Terms'
 */
const AddPaymentTermButton = ({
  businessId,
  onAdded,
  headers = {},
  disabled = false,
  size = "sm",
  displayMode = "standalone",
  tableName = "Payment Terms",
}) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [numberOfDays, setNumberOfDays] = useState("");
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setName("");
    setNumberOfDays("");
    setErrors({});
  };

  const handleOpen = () => {
    if (disabled || !businessId) return;
    resetForm();
    setOpen(true);
  };

  const handleClose = () => {
    if (!submitting) {
      setOpen(false);
      resetForm();
    }
  };

  const validate = () => {
    const next = {};
    if (!(name && name.trim())) next.name = "Name is required";
    const days = parseInt(numberOfDays, 10);
    if (!Number.isInteger(days) || days < 0) {
      next.numberOfDays = "Please enter the number of days";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitPaymentTerm = async () => {
    if (!validate() || !businessId) return;
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${Base_URL}/items/${tableName}/add`,
        {
          business_id: businessId,
          name: name.trim(),
          numberOfDays: parseInt(numberOfDays, 10),
          status: "active",
        },
        { headers }
      );
      if (res.data?.success && res.data?.data) {
        notifySuccess("Payment term added successfully");
        onAdded(res.data.data);
        handleClose();
      } else {
        notifyError(res.data?.message || "Failed to add payment term");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to add payment term";
      notifyError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const stopParentFormSubmit = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const isSm = size === "sm";
  const isDropdown = displayMode === "dropdown";

  return (
    <>
      {isDropdown ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpen();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={disabled || !businessId}
          title="Add payment term"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--p-blue)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] shadow-sm hover:bg-[var(--p-blue-dark)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-1 disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span>Add payment term</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled || !businessId}
          title="Add payment term"
          className={`
            inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white font-medium text-gray-700
            shadow-sm transition-colors hover:bg-gray-50 hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]
            focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-1
            disabled:pointer-events-none disabled:opacity-50
            ${isSm ? "gap-1 px-2 py-1.5 text-xs" : "gap-2 px-3 py-2 text-sm"}
          `}
        >
          <Plus className={isSm ? "h-4 w-4" : "h-5 w-5"} />
          <span>Add term</span>
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000000] flex items-center justify-center bg-black/50 p-4"
            data-modal-root="add-payment-term"
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b-2 border-[var(--p-blue)] bg-[#FFF8F0] px-5 py-4">
              <h3 className="text-lg font-semibold text-[#c96d08]">Add Payment Term</h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--p-blue-dark)]/10 hover:text-[#c96d08] disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                  }}
                  onKeyDown={(e) => {
                    stopParentFormSubmit(e);
                    if (e.key === "Enter") void submitPaymentTerm();
                  }}
                  placeholder="e.g. Net 15"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                  autoFocus
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Number of days <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={numberOfDays}
                  onChange={(e) => {
                    setNumberOfDays(e.target.value);
                    if (errors.numberOfDays) setErrors((p) => ({ ...p, numberOfDays: undefined }));
                  }}
                  onKeyDown={(e) => {
                    stopParentFormSubmit(e);
                    if (e.key === "Enter") void submitPaymentTerm();
                  }}
                  placeholder="e.g. 30"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                />
                {errors.numberOfDays && (
                  <p className="mt-1 text-xs text-red-500">{errors.numberOfDays}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitPaymentTerm()}
                  className="rounded-lg bg-[var(--p-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--p-blue-dark)] disabled:opacity-50"
                >
                  {submitting ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
};

export default AddPaymentTermButton;
