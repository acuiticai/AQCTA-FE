import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Quick-add "Invoice recurrence" preset (Sales > Misc. Data Types) from recurring invoice form.
 */
const AddInvoiceRecurrenceButton = ({
  businessId,
  onAdded,
  headers = {},
  disabled = false,
  displayMode = "standalone",
}) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [repeatInterval, setRepeatInterval] = useState("1");
  const [repeatUnit, setRepeatUnit] = useState("month");
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setName("");
    setRepeatInterval("1");
    setRepeatUnit("month");
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
    const ri = parseInt(repeatInterval, 10);
    if (!Number.isInteger(ri) || ri < 1) {
      next.repeatInterval = "Enter a whole number ≥ 1";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitRecurrence = async () => {
    if (!validate() || !businessId) return;
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${Base_URL}/items/Invoice Recurrence/add`,
        {
          business_id: businessId,
          name: name.trim(),
          repeatInterval: parseInt(repeatInterval, 10),
          repeatUnit,
          status: "active",
        },
        { headers }
      );
      if (res.data?.success && res.data?.data) {
        notifySuccess("Recurrence schedule added");
        onAdded(res.data.data);
        handleClose();
      } else {
        notifyError(res.data?.message || "Failed to add schedule");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to add schedule";
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
          title="Add recurrence schedule"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--p-blue)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] shadow-sm hover:bg-[var(--p-blue-dark)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-1 disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span>Add recurrence schedule</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled || !businessId}
          title="Add recurrence schedule"
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>Add schedule</span>
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000000] flex items-center justify-center bg-black/50 p-4"
            data-modal-root="add-invoice-recurrence"
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b-2 border-[var(--p-blue)] bg-[#FFF8F0] px-5 py-4">
                <h3 className="text-lg font-semibold text-[#c96d08]">
                  Add recurrence schedule
                </h3>
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
                      if (e.key === "Enter") void submitRecurrence();
                    }}
                    placeholder="e.g. Every 2 months"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                    autoFocus
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500">{errors.name}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Every <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={repeatInterval}
                      onChange={(e) => {
                        setRepeatInterval(e.target.value);
                        if (errors.repeatInterval)
                          setErrors((p) => ({ ...p, repeatInterval: undefined }));
                      }}
                      onKeyDown={(e) => {
                        stopParentFormSubmit(e);
                        if (e.key === "Enter") void submitRecurrence();
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                    />
                    {errors.repeatInterval && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.repeatInterval}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={repeatUnit}
                      onChange={(e) => setRepeatUnit(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                    >
                      <option value="day">Day(s)</option>
                      <option value="week">Week(s)</option>
                      <option value="month">Month(s)</option>
                      <option value="year">Year(s)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                </p>
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
                    onClick={() => void submitRecurrence()}
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

export default AddInvoiceRecurrenceButton;
