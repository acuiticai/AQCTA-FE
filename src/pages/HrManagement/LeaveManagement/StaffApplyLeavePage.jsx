"use client";

import { useEffect, useState, useContext } from "react";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { CustomDatePicker } from "@/page-layouts/index";
import { notifyError, notifyWarning, notifySuccess } from "@/utils/toast";
import moment from "moment";
import { Calendar } from "lucide-react";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const StaffLeaveForm = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // Form data structure for leave
  const [formData, setFormData] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    remarks: "",
    supportingDocuments: null,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [staffInfo, setStaffInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  console.log("form data", formData);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.leaveType) newErrors.leaveType = "Leave type is required";
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.endDate) newErrors.endDate = "End date is required";

    // Validate date logic
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (startDate > endDate) {
        newErrors.endDate = "End date must be after start date";
      }

      // Check if start date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDate < today) {
        newErrors.startDate = "Leave cannot start in the past";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Fetch staff info and leave types on component mount
  const fetchStaffInfo = async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management`, {
        params: { id: adminInfo.id },
      });

      console.log("Staff Info Response:", response.data.staffList[0]);
      const staffData = response.data.staffList[0];
      setStaffInfo(staffData);

      if (staffData.business) {
        fetchLeaveTypes(
          staffData.business._id,
          staffData.leaveGroup.name,
          staffData._id // Pass staff_id
        );
      }
    } catch (err) {
      console.error("Error fetching staff info:", err);
      notifyError("Failed to load staff information");
    }
  };

  const fetchLeaveTypes = async (companyId, leaveGroup, staffId) => {
    try {
      console.log({ bid: companyId, leaveGroup, staff_id: staffId });
      const params = {
        bid: companyId,
        leaveGroup,
      };

      // Add staff_id if provided
      if (staffId) {
        params.staff_id = staffId;
      }

      const res = await axios.get(`${Base_URL}/leaveTypes`, { params });
      setLeaveTypes(res.data);
    } catch (error) {
      console.error("Error fetching leave types:", error);
    }
  };

  useEffect(() => {
    if (adminInfo?.token) {
      fetchStaffInfo();
    }
  }, [adminInfo]);

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      console.log("Form validation failed", errors);
      return;
    }

    try {
      setLoading(true);
      // Format date to YYYY-MM-DD string (without time)
      //   const formattedStartDate = new Date(formData.startDate).toISOString().split("T")[0]
      //   const formattedEndDate = new Date(formData.endDate).toISOString().split("T")[0]
      const formattedStartDate = moment(formData.startDate).format(
        "YYYY-MM-DD"
      );
      const formattedEndDate = moment(formData.endDate).format("YYYY-MM-DD");

      const payload = {
        ...formData,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      };

      const res = await axios.post(
        `${Base_URL}/leaves/staffCreateLeave`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      notifySuccess("Leave request submitted successfully.");
      setTimeout(() => {
        history.push("/staff-leave-management");
      }, 1000);
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";
      notifyWarning(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    history.goBack();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Start upload process
      setUploading(true);
      setUploadSuccess(false);

      // Prepare form data for upload
      const formDataForUpload = new FormData();
      formDataForUpload.append("file_path", `Leaves/${staffInfo?.displayName}`);
      formDataForUpload.append("business_id", staffInfo?.business?._id || "");
      formDataForUpload.append("customer_id", adminInfo?.id);
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      try {
        const response = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${adminInfo.token}`,
            },
          }
        );

        if (response.data.message === "File uploaded successfully") {
          console.log(response.data.message || "File uploaded successfully!");
          const uploadedFile = response.data.file;

          // Update form data with the uploaded document information
          handleChange("supportingDocuments", {
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          });

          // Show success message in UI
          setSuccessMessage(
            response.data.message || "File uploaded successfully!"
          );
          setUploadSuccess(true);

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setUploadSuccess(false);
            setSuccessMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyWarning("File upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    }
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      const Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  return (
    <div className="p-6 bg-white">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-50 z-10 flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">
            Apply for Leave
          </h1>
          <button
            onClick={() => history.push("/my-leave-balance")}
            className="flex items-center gap-2 bg-[var(--p-blue)] text-white px-4 py-2 rounded-lg hover:bg-[#9BC635] transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>My Leave Balance</span>
          </button>
        </div>

        {/* Staff Info Display */}
        {staffInfo && (
          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-medium text-gray-800 mb-2">
              Your Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Name: </span>
                <span className="font-medium">{staffInfo.displayName}</span>
              </div>
              <div>
                <span className="text-gray-600">Employee Code: </span>
                <span className="font-medium">{staffInfo.employeeId}</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
            <h3 className="text-md font-medium text-gray-700 mb-4">
              Leave Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              <div>
                <label className="block text-gray-500 mb-1">Leave Type</label>
                <div className="relative">
                  <select
                    name="leaveType"
                    className={`bg-gray-100 rounded-md px-4 py-2 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                      errors.leaveType ? "border-red-500" : ""
                    }`}
                    value={formData.leaveType}
                    onChange={(e) => handleChange("leaveType", e.target.value)}
                  >
                    <option value="">Select Leave Type</option>
                    {leaveTypes?.map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <div className="min-h-6">
                  {errors.leaveType && (
                    <p className="text-red-500 text-sm mt-1 pb-2">
                      {errors.leaveType}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-500 mb-1">Start Date</label>
                <div className="relative">
                  <CustomDatePicker
                    name="startDate"
                    className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                      errors.startDate ? "border border-red-500" : ""
                    }`}
                    placeholder="mm/dd/yyyy"
                    value={formData.startDate}
                    bgColor="#F3F4F6"
                    onChange={(date) => handleChange("startDate", date)}
                  />
                </div>
                <div className="min-h-6">
                  {errors.startDate && (
                    <p className="text-red-500 text-sm mt-1 pb-2">
                      {errors.startDate}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-500 mb-1">End Date</label>
                <div className="relative">
                  <CustomDatePicker
                    name="endDate"
                    className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                      errors.endDate ? "border border-red-500" : ""
                    }`}
                    placeholder="mm/dd/yyyy"
                    value={formData.endDate}
                    bgColor="#F3F4F6"
                    onChange={(date) => handleChange("endDate", date)}
                  />
                </div>
                <div className="min-h-6">
                  {errors.endDate && (
                    <p className="text-red-500 text-sm mt-1 pb-2">
                      {errors.endDate}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-gray-500 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  name="remarks"
                  className="bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none resize-none"
                  placeholder="Additional remarks or reason for leave"
                  rows="3"
                  value={formData.remarks}
                  onChange={(e) => handleChange("remarks", e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-gray-500 mb-1">
                Supporting Documents (Optional)
              </label>
              <div className="border border-dashed rounded-md p-6 flex flex-col items-center justify-center border-[var(--p-blue)]">
                <button
                  type="button"
                  className="flex items-center text-[var(--p-blue)]"
                  onClick={() => document.getElementById("fileUpload").click()}
                >
                  <svg
                    className="h-6 w-6 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  <span className="text-[var(--p-blue)]">
                    {uploading ? "Uploading..." : "Upload Supporting Documents"}
                  </span>
                </button>

                <input
                  id="fileUpload"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Display upload status */}
                {uploadSuccess && (
                  <div className="mt-2 text-sm text-green-600">
                    {successMessage}
                  </div>
                )}

                {/* Display uploaded document info if available */}
                {formData.supportingDocuments && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md w-full">
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
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[var(--p-blue)] text-white px-6 py-2 rounded-md hover:bg-[#9BC635] transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Leave Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffLeaveForm;
