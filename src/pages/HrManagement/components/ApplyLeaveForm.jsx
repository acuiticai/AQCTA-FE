"use client";

import { useState, useEffect, useContext } from "react";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

import { CustomDatePicker } from "@/page-layouts/index";
import { PageHeader } from "@/page-layouts/index";
import { InputField, DropdownBasic } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import moment from "moment";
import SingleBusinessField from "@/components/SingleBusinessField";

const ApplyLeaveForm = ({ employeeId = "", onSubmit, onCancel }) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const [formData, setFormData] = useState({
    business: "",
    employee: employeeId || "",
    leaveType: "",
    startDate: "",
    endDate: "",
    remarks: "",
    supportingDocuments: null,
  });

  const [businessName, setBusinessName] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [staff, setStaff] = useState({});
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Form validation state
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  console.log("form data", formData);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  console.log("staff list", staffList);

  // Helper notification functions
  const notifySuccess = (message) => {
    console.log("Success:", message);
    // Replace with your actual notification implementation
  };

  const notifyError = (message) => {
    console.error("Error:", message);
    // Replace with your actual notification implementation
  };

  console.log("businessId", formData.business);
  console.log("customerId", adminInfo?.id);

  // Fetch staff list based on selected business
  const fetchStaffList = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/staff-management/staff-names?page=1&limit=5000`,
        {
          params: {
            business: formData.business,
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

  // Fetch leave types based on selected business and employee
  const fetchLeaveTypes = async () => {
    try {
      // If we have both business and employee selected
      if (formData.business && formData.employee) {
        // Find the selected employee to get their specific attributes
        const selectedEmployee =
          staffList.find((emp) => emp._id === formData.employee) || staff;

        console.log("Selected employee for leave types:", selectedEmployee);
        const params = {
          bid: formData.business,
          leaveGroup: selectedEmployee?.leaveName || "",
          staff_id: formData.employee, // Add staff_id parameter
        };

        console.log("Fetching leave types with params:", params);

        const res = await axios.get(`${Base_URL}/leaveTypes`, { params });
        setLeaveTypes(res.data);
      } else if (formData.business) {
        // If only business is selected, fetch all leave types for that business
        const res = await axios.get(`${Base_URL}/leaveTypes`, {
          params: { bid: formData.business },
        });
        setLeaveTypes(res.data);
      }
    } catch (error) {
      console.error("Error fetching leave types:", error);
    }
  };

  // Effect for business change - reset dependent fields and fetch data
  useEffect(() => {
    // Reset dependent fields when business changes
    if (!employeeId) {
      // Only reset if not pre-selected employee
      setFormData((prev) => ({
        ...prev,
        employee: "",
        leaveType: "",
      }));
    }
    setStaffList([]);
    setLeaveTypes([]);

    if (formData.business) {
      fetchStaffList();
      // Don't fetch leave types here, wait for employee selection
    }
  }, [formData.business]);

  // Effect for employee change - fetch leave types based on selected employee
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      leaveType: "", // Reset leave type when employee changes
    }));
    setLeaveTypes([]);

    if (formData.employee && formData.business) {
      fetchLeaveTypes();
    }
  }, [formData.employee, formData.business, staffList]);

  // Load businesses on mount
  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      setBusinesses(JSON.parse(storedBusinesses));
    }
  }, []);

  // Handle pre-selected employee (when employeeId is provided)
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
            business: response?.data?.business?._id,
          }));
          setBusinessName(response?.data?.business?.name);
        } catch (error) {
          console.error("Error fetching staff data:", error);
        }
      };

      fetchStaffData();
    }
  }, [employeeId]);

  // Validation function
  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "business":
        error = value ? "" : "Please select a business";
        break;
      case "employee":
        error = value ? "" : "Please select an employee";
        break;
      case "leaveType":
        error = value ? "" : "Please select a leave type";
        break;
      case "startDate":
        if (!value) {
          error = "Please select a start date";
        } else {
          // Check if start date is in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startDate = new Date(value);
          if (startDate < today) {
            error = "Leave cannot start in the past";
          }
        }
        break;
      case "endDate":
        if (!value) {
          error = "Please select an end date";
        } else if (
          formData.startDate &&
          new Date(value) < new Date(formData.startDate)
        ) {
          error = "End date cannot be before start date";
        }
        break;
      case "remarks":
        // Remarks is optional, so no validation needed
        break;
      default:
        break;
    }
    return error;
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Check each field
    Object.keys(formData).forEach((field) => {
      if (field === "supportingDocuments") {
        // Supporting documents is optional, skip validation
        return;
      }

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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploading(true);
      setUploadSuccess(false);

      // Get employee name for file path
      const selectedEmployee =
        staffList.find((s) => s._id === formData.employee) || staff;
      const employeeName = selectedEmployee?.displayName || "Employee";

      const formDataForUpload = new FormData();
      formDataForUpload.append("file_path", `Leaves/${employeeName}`);
      formDataForUpload.append("business_id", formData.business);
      formDataForUpload.append("customer_id", adminInfo?.id);
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      try {
        const response = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (response.data.message === "File uploaded successfully") {
          notifySuccess(response.data.message || "File uploaded successfully!");
          const uploadedFile = response.data.file;

          setFormData({
            ...formData,
            supportingDocuments: {
              fileId: uploadedFile._id,
              name: uploadedFile.name,
              url: uploadedFile.url || "#",
              downloadUrl: uploadedFile.downloadUrl || "#",
              uploadedAt: new Date().toISOString(),
              size: file.size,
              type: file.type,
            },
          });

          if (showErrors) {
            setErrors((prev) => ({ ...prev, supportingDocuments: "" }));
          }

          setSuccessMessage(
            response.data.message || "File uploaded successfully!"
          );
          setUploadSuccess(true);

          setTimeout(() => {
            setUploadSuccess(false);
            setSuccessMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError("File upload failed. Please try again.");
        if (showErrors) {
          setErrors((prev) => ({
            ...prev,
            supportingDocuments: "File upload failed",
          }));
        }
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowErrors(true);

    const isValid = validateForm();
    if (isValid) {
      const formattedData = {
        ...formData,
        adminId: adminInfo.id,
        startDate: formData.startDate
          ? moment(formData.startDate).format("YYYY-MM-DD")
          : null,
        endDate: formData.endDate
          ? moment(formData.endDate).format("YYYY-MM-DD")
          : null,
      };

      onSubmit(formattedData);
    } else {
      const firstErrorField = Object.keys(errors).find((key) => errors[key]);
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      const Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  const handleDateChange = (name, date) => {
    setFormData({ ...formData, [name]: date });

    if (showErrors) {
      const error = validateField(name, date);
      setErrors((prev) => ({ ...prev, [name]: error }));

      if (name === "startDate" && formData.endDate) {
        const endDateError =
          new Date(formData.endDate) < new Date(date)
            ? "End date cannot be before start date"
            : "";
        setErrors((prev) => ({ ...prev, endDate: endDateError }));
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm">
      <PageHeader title="Apply Leave" />

      <form onSubmit={handleSubmit} className="p-6 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <SingleBusinessField
            className="flex flex-col"
            selectedValue={formData.business}
            onAutoSelect={(id) =>
              handleChange({ target: { name: "business", value: id } })
            }
          >
            <label className="text-gray-500 mb-2 text-sm">Business</label>
            <DropdownBasic
              name="business"
              type="select"
              isBusinessDropdown={true}
              businessDropdownProps={{
                selectedBusiness: formData.business,
                onChange: (val) =>
                  handleChange({ target: { name: "business", value: val } }),
                error: errors.business,
                shouldShowError: showErrors,
              }}
            />
          </SingleBusinessField>

          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">Employee Name</label>
            <DropdownBasic
              name="employee"
              value={formData.employee}
              onChange={(val) =>
                handleChange({ target: { name: "employee", value: val } })
              }
              options={[
                {
                  value: "",
                  label: employeeId ? staff?.displayName : "Select Employee",
                },
                ...staffList.map((staff) => ({
                  value: staff._id,
                  label: staff.displayName,
                })),
              ]}
              error={errors.employee}
              shouldShowError={showErrors}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">Leave Type</label>
            <DropdownBasic
              name="leaveType"
              value={formData.leaveType}
              onChange={(val) =>
                handleChange({ target: { name: "leaveType", value: val } })
              }
              options={[
                { value: "", label: "Select Leave Type" },
                ...leaveTypes.map((type) => ({
                  value: type._id,
                  label: type.name,
                })),
              ]}
              error={errors.leaveType}
              shouldShowError={showErrors}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">Start Date</label>
            <div className="relative">
              <CustomDatePicker
                error={errors.startDate}
                shouldShowError={showErrors}
                name="startDate"
                value={formData.startDate}
                onChange={(date) => handleDateChange("startDate", date)}
                bgColor="#F3F4F6"
                onFocus={(e) => (e.target.type = "date")}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">End Date</label>
            <div className="relative">
              <CustomDatePicker
                name="endDate"
                error={errors.endDate}
                shouldShowError={showErrors}
                value={formData.endDate}
                onChange={(date) => handleDateChange("endDate", date)}
                bgColor="#F3F4F6"
                onFocus={(e) => (e.target.type = "date")}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">
              Remarks (Optional)
            </label>
            <InputField
              name="remarks"
              value={formData.remarks}
              error={errors.remarks}
              shouldShowError={showErrors}
              onChange={handleChange}
              placeholder="Additional remarks or reason for leave"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 mb-6">
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">
              Supporting Documents (Optional)
            </label>
            <div
              className={`border border-dashed ${
                errors.supportingDocuments && showErrors
                  ? "border-red-500"
                  : "border-[var(--p-blue)]"
              } rounded-lg p-4 text-center cursor-pointer`}
            >
              <input
                type="file"
                name="supportingDocuments"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex items-center justify-center"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-2"
                >
                  <path
                    d="M10.0003 13.3333V1.66666M10.0003 1.66666L5.83366 5.83332M10.0003 1.66666L14.167 5.83332"
                    stroke="var(--p-blue)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M1.66699 14.1667L2.22533 16.3583C2.27627 16.5793 2.38868 16.7841 2.55118 16.9485C2.71368 17.1129 2.91952 17.2308 3.14199 17.2883C3.54199 17.4 4.25033 17.5 5.00033 17.5H15.0003C15.7503 17.5 16.4587 17.4 16.8587 17.2883C17.0811 17.2308 17.287 17.1129 17.4495 16.9485C17.612 16.7841 17.7244 16.5793 17.7753 16.3583L18.3337 14.1667"
                    stroke="var(--p-blue)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className={`${
                    errors.supportingDocuments && showErrors
                      ? "text-red-500"
                      : "text-[var(--p-blue)]"
                  }`}
                >
                  {uploading ? "Uploading..." : "Upload Supporting Documents"}
                </span>
              </label>
            </div>

            {errors.supportingDocuments && showErrors && (
              <p className="text-red-500 text-xs mt-1">
                {errors.supportingDocuments}
              </p>
            )}

            {uploadSuccess && (
              <div className="mt-2 text-sm text-green-600">
                {successMessage}
              </div>
            )}

            {formData.supportingDocuments && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    {formData.supportingDocuments.name}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        HandleOpenFile(formData.supportingDocuments.fileId)
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
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
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Submit Leave Request"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ApplyLeaveForm;
