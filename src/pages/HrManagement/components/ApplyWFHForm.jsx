import React, { useState, useEffect } from "react";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { CustomDatePicker } from "@/page-layouts/index";
import { PageHeader } from "@/page-layouts/index";
import { InputField, DropdownBasic } from "@/page-layouts";
import SingleBusinessField from "@/components/SingleBusinessField";

const ApplyWFHForm = ({ employeeId = "", onSubmit, onCancel }) => {
  const [adminInfo, setAdminInfo] = useState(null);
  const [formData, setFormData] = useState({
    company: "",
    employee: employeeId || "",
    reason: "",
    date_from: "",
    date_to: "",
  });
  const [staffList, setStaffList] = useState([]);
  const [staff, setStaff] = useState({});
  // Form validation state
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  console.log("form data", formData);

  const fetchStaffList = async (businessId) => {
    if (!businessId) {
      setStaffList([]);
      return;
    }

    try {
      const response = await axios.get(
        `${Base_URL}/staff-management/staff-names?page=1&limit=5000`,
        {
          params: {
            business: businessId,
            status: "Active",
          },
        }
      );
      console.log("staff!", response);
      setStaffList(response.data.data || []);
    } catch (err) {
      console.log("err", err);
    }
  };

  // Fetch admin info from localStorage on component mount
  useEffect(() => {
    const storedAdminInfo = localStorage.getItem("adminInfo");

    if (storedAdminInfo) {
      try {
        const parsedAdminInfo = JSON.parse(storedAdminInfo);
        setAdminInfo(parsedAdminInfo);
        console.log("Admin info loaded:", parsedAdminInfo);
      } catch (error) {
        console.error("Error parsing admin info from localStorage:", error);
      }
    } else {
      console.log("No admin info found in localStorage");
    }
  }, []);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      employee: employeeId ? prev.employee : "",
    }));
    setStaffList([]);

    if (formData.company) {
      fetchStaffList(formData.company);
    }
  }, [formData.company, employeeId]);

  useEffect(() => {
    if (employeeId) {
      const fetchStaffData = async () => {
        try {
          const response = await axios.get(
            `${Base_URL}/staff-management/${employeeId}`
          );
          console.log("staff response", response);
          setStaff(response.data);
          setFormData((prev) => ({
            ...prev,
            employee: response?.data?._id,
          }));
        } catch (error) {
          console.error("Error fetching staff data:", error);
        }
      };

      fetchStaffData();
    }
  }, []);

  // Validation function
  const validateField = (name, value) => {
    let error = "";

    switch (name) {
      case "company":
        error = value ? "" : "Please select a business";
        break;
      case "employee":
        error = value ? "" : "Please select an employee";
        break;
      case "reason":
        error = value.trim() ? "" : "Please enter a reason for WFH";
        break;
      case "date_from":
        if (!value) {
          error = "Please select a start date";
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (new Date(value) < today) {
            error = "Date cannot be in the past";
          }
        }
        break;
      case "date_to":
        if (!value) {
          error = "Please select an end date";
        } else if (
          formData.date_from &&
          new Date(value) < new Date(formData.date_from)
        ) {
          error = "End date cannot be before start date";
        }
        break;
      default:
        break;
    }

    return error;
  };

  const validateForm = () => {
    // Validate all fields at once
    const newErrors = {};
    let isValid = true;

    // Check each field
    Object.keys(formData).forEach((field) => {
      const value = formData[field] || "";
      const error = validateField(field, value);
      newErrors[field] = error;

      if (error) {
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error for this field when user makes changes
    if (showErrors) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Show validation errors
    setShowErrors(true);

    // Validate the form before submission
    const isValid = validateForm();

    if (isValid) {
      // Include admin info in the submission if available
      onSubmit({ ...formData, adminInfo });
    } else {
      // Scroll to the first error
      const firstErrorField = Object.keys(errors).find((key) => errors[key]);
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  };

  useEffect(() => {
    if (employeeId) {
      setFormData((prev) => ({ ...prev, employee: employeeId }));
    }
  }, []);

  const handleDateChange = (name, date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Remove time for accurate comparison

    let newErrors = { ...errors };

    const formattedDate =
      date instanceof Date
        ? date.toISOString().split("T")[0] // ensures "YYYY-MM-DD"
        : date;

    if (name === "date_from" && new Date(formattedDate) < today) {
      newErrors[name] = "Date cannot be in the past";
    } else {
      const error = validateField(name, formattedDate);
      newErrors[name] = error;
    }

    if (name === "date_from") {
      setFormData({
        ...formData,
        date_from: formattedDate,
        date_to: formattedDate,
      });
      newErrors["date_to"] = "";
    } else {
      setFormData({ ...formData, [name]: formattedDate });
    }

    setErrors(newErrors);
  };

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm">
      <PageHeader title="Apply Work From Home" />

      <form onSubmit={handleSubmit} className="p-6 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <SingleBusinessField
            className="flex flex-col"
            selectedValue={formData.company}
            onAutoSelect={(id) =>
              handleChange({ target: { name: "company", value: id } })
            }
          >
            <label className="text-gray-500 mb-2 text-sm">Business</label>
            <DropdownBasic
              name="company"
              type="select"
              isBusinessDropdown={true}
              businessDropdownProps={{
                selectedBusiness: formData.company,
                onChange: (val) =>
                  handleChange({ target: { name: "company", value: val } }),
                placeholder: "Select Business",
              }}
              className={
                errors.company && showErrors ? "border-red-500 border" : ""
              }
            />
            {errors.company && showErrors && (
              <p className="text-red-500 text-xs mt-1">{errors.company}</p>
            )}
          </SingleBusinessField>
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">Employee Name</label>
            <DropdownBasic
              name="employee"
              value={formData.employee}
              placeholder="Employee Name"
              onChange={(val) =>
                handleChange({ target: { name: "employee", value: val } })
              }
              options={[
                {
                  value: "",
                  label: employeeId ? staff?.displayName : "Employee Name",
                },
                ...staffList.map((staff) => ({
                  value: staff._id,
                  label: staff.displayName,
                })),
              ]}
              isDisabled={!formData.company}
              className={
                errors.employee && showErrors ? "border-red-500 border" : ""
              }
            />
            {errors.employee && showErrors && (
              <p className="text-red-500 text-xs mt-1">{errors.employee}</p>
            )}
          </div>
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">Date</label>
            <div className="relative">
              <CustomDatePicker
                name="date_from"
                value={formData.date_from}
                onChange={(date) => handleDateChange("date_from", date)}
                className={`w-full rounded-lg bg-gray-50 px-4 py-3 outline-none text-gray-500 ${
                  errors.date_from && showErrors ? "border-red-500 border" : ""
                }`}
                bgColor="#F3F4F6"
                onFocus={(e) => (e.target.type = "date")}
              />
            </div>
            {errors.date_from && showErrors && (
              <p className="text-red-500 text-xs mt-1">{errors.date_from}</p>
            )}
          </div>
          {/* <div className="flex flex-col">
                        <label className="text-gray-500 mb-2 text-sm">End Date</label>
                        <div className="relative">
                            <CustomDatePicker
                                name="date_to"
                                value={formData.date_to}
                                onChange={(date) => handleDateChange("date_to", date)}
                                className={`w-full rounded-lg bg-gray-50 px-4 py-3 outline-none text-gray-500 ${errors.date_to && showErrors ? "border-red-500 border" : ""
                                    }`}
                                bgColor="#F3F4F6"
                                onFocus={(e) => (e.target.type = "date")}
                            />
                        </div>
                        {errors.date_to && showErrors && (
                            <p className="text-red-500 text-xs mt-1">{errors.date_to}</p>
                        )}
                    </div> */}
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">Reason</label>
            <InputField
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Reason for WFH"
              className={
                errors.reason && showErrors ? "border-red-500 border" : ""
              }
            />
            {errors.reason && showErrors && (
              <p className="text-red-500 text-xs mt-1">{errors.reason}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-3 bg-gray-100 rounded-lg text-gray-700 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-8 py-3 bg-[var(--p-blue)] hover:bg-[#9aba33] rounded-lg text-white font-medium"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default ApplyWFHForm;
