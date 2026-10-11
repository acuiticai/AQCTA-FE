import React, { useState, useContext, useMemo, useEffect } from "react";
import axios from "axios";
import { X } from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import { notifySuccess } from "@/utils/toast";

const EmploymentHistoryModal = ({
  isOpen,
  onClose,
  recordData,
  staffId,
  onRecordUpdated,
}) => {
  const isEditMode = Boolean(recordData);
  const [formData, setFormData] = useState({
    companyName: "",
    position: "",
    startDate: "",
    endDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  const { state } = useContext(AdminContext);
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${state?.adminInfo?.token || ""}`,
    }),
    [state]
  );

  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  useEffect(() => {
    if (recordData) {
      setFormData(recordData);
    } else {
      setFormData({
        companyName: "",
        position: "",
        startDate: "",
        endDate: "",
      });
    }
    // Clear errors when modal opens/closes or recordData changes
    setErrors({});
  }, [recordData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.companyName || formData.companyName.trim() === "") {
      newErrors.companyName = "Company Name is required";
    }

    if (!formData.position || formData.position.trim() === "") {
      newErrors.position = "Position is required";
    }

    // Validate start date - check for null, undefined, or empty string
    if (
      !formData.startDate ||
      formData.startDate === "" ||
      formData.startDate === null
    ) {
      newErrors.startDate = "Start Date is required";
    }

    // Validate end date - check for null, undefined, or empty string
    if (
      !formData.endDate ||
      formData.endDate === "" ||
      formData.endDate === null
    ) {
      newErrors.endDate = "End Date is required";
    } else if (formData.startDate && formData.endDate) {
      // Validate that end date is after start date
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate < startDate) {
        newErrors.endDate = "End Date must be after Start Date";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditMode
        ? `${Base_URL}/staff-management/past-work/${staffId}/${recordData._id}`
        : `${Base_URL}/staff-management/past-work/${staffId}`;

      const method = isEditMode ? "put" : "post";

      const response = await axios[method](
        url,
        { past_work: formData },
        { headers }
      );

      onRecordUpdated(response.data.past_work); // Refresh list
      notifySuccess(response.data.message);
      setErrors({}); // Clear errors on success
      onClose();
    } catch (err) {
      console.error("Submission error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEditMode ? "Edit Past Work" : "Add Past Work"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-red-600">{error}</div>}

          <div>
            <label className="block text-sm text-gray-600">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              className={`w-full p-2 bg-gray-100 border rounded-md ${
                errors.companyName
                  ? "border-red-500 border-2"
                  : "border-gray-300"
              }`}
            />
            {errors.companyName && (
              <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600">
              Position <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="position"
              value={formData.position}
              onChange={handleChange}
              className={`w-full p-2 bg-gray-100 border rounded-md ${
                errors.position ? "border-red-500 border-2" : "border-gray-300"
              }`}
            />
            {errors.position && (
              <p className="text-red-500 text-sm mt-1">{errors.position}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600">
              Start Date <span className="text-red-500">*</span>
            </label>
            <CustomDatePicker
              name="startDate"
              value={formData.startDate}
              onChange={(date) => {
                setFormData({ ...formData, startDate: date });
                // Clear error when date is selected
                if (errors.startDate) {
                  setErrors((prev) => ({
                    ...prev,
                    startDate: "",
                  }));
                }
                // Validate end date if it exists and start date is now after end date
                if (date && formData.endDate) {
                  const startDate = new Date(date);
                  const endDate = new Date(formData.endDate);
                  if (endDate < startDate) {
                    setErrors((prev) => ({
                      ...prev,
                      endDate: "End Date must be after Start Date",
                    }));
                  } else if (
                    errors.endDate &&
                    errors.endDate === "End Date must be after Start Date"
                  ) {
                    setErrors((prev) => ({
                      ...prev,
                      endDate: "",
                    }));
                  }
                }
              }}
              bgColor="#F3F4F6"
              error={errors.startDate}
              shouldShowError={!!errors.startDate}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600">
              End Date <span className="text-red-500">*</span>
            </label>
            <CustomDatePicker
              name="endDate"
              value={formData.endDate}
              onChange={(date) => {
                setFormData({ ...formData, endDate: date });
                // Clear error when date is selected
                if (errors.endDate) {
                  setErrors((prev) => ({
                    ...prev,
                    endDate: "",
                  }));
                }
              }}
              bgColor="#F3F4F6"
              error={errors.endDate}
              shouldShowError={!!errors.endDate}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-md text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md"
            >
              {isSubmitting ? "Saving..." : isEditMode ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmploymentHistoryModal;
