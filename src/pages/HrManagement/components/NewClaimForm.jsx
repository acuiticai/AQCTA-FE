// NewClaimForm.jsx - Form for creating a new claim
import React, { useEffect, useState } from "react";
import { CalendarIcon } from "@heroicons/react/outline";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import CurrencyServices from "@/services/CurrencyServices";
import useAsync from "@/hooks/useAsync";
import axios from "axios";
import CustomDatePicker from "@/components/CustomDatePicker";
import { formatAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useHistory } from "react-router-dom";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";

const NewClaimForm = ({ employeeId = "", onSuccess }) => {
  const history = useHistory();
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();
  const [formData, setFormData] = useState({
    claimReference: "",
    employee: employeeId || "",
    employeeCode: "",
    claimGroup: "",
    claimType: "",
    currency: "",
    company: "",
    receiptNo: "",
    receiptDate: "",
    receiptAmount: "",
    claimableAmount: "",
    purpose: "",
    supportingDocuments: null,
  });

  const [businessName, setBusinessName] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [errors, setErrors] = useState({});

  const [adminInfo, setAdminInfo] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [claimTypes, setClaimTypes] = useState([]);
  const [claimGroups, setClaimGroups] = useState([]);
  const { data, loading, error } = useAsync(CurrencyServices.getAllCurrency);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.employee) newErrors.employee = "Employee name is required";
    if (!formData.employeeCode)
      newErrors.employeeCode = "Employee code is required";
    if (!formData.claimType) newErrors.claimType = "Claim type is required";
    if (!formData.currency) newErrors.currency = "Currency is required";
    if (!formData.company) newErrors.company = "Company is required";
    if (!formData.receiptNo) newErrors.receiptNo = "Receipt No is required";
    if (!formData.receiptDate)
      newErrors.receiptDate = "Receipt date is required";
    if (!formData.receiptAmount)
      newErrors.receiptAmount = "Receipt amount is required";
    if (!formData.claimableAmount)
      newErrors.claimableAmount = "Claimable amount is required";
    if (!formData.purpose)
      newErrors.purpose = "Purpose/Description is required";
    if (!formData.supportingDocuments)
      newErrors.supportingDocuments = "Supporting document is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchClaimTypesAndGroups = async (bid) => {
    if (!bid) {
      setClaimTypes([]);
      setClaimGroups([]);
      return;
    }
    try {
      const [typesResponse, groupsResponse] = await Promise.all([
        axios.get(`${Base_URL}/claim-types`, { params: { bid } }),
        axios.get(`${Base_URL}/claim-groups`, { params: { bid } }),
      ]);
      setClaimTypes(typesResponse.data);
      setClaimGroups(groupsResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchStaffList = async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management`);
      setStaffList(response.data.staffList || []);

      let bidForClaims = "";
      // If employeeId is provided, set employee data
      if (employeeId && response.data.staffList) {
        const employee = response.data.staffList.find(
          (staff) => staff._id === employeeId
        );
        if (employee) {
          bidForClaims = employee?.business?._id || "";
          setFormData((prev) => ({
            ...prev,
            employee: employeeId,
            employeeCode: employee.employeeId,
            company: bidForClaims,
          }));
          setEmployeeName(employee.displayName);
          setBusinessName(employee.business?.name);
        }
      }
      await fetchClaimTypesAndGroups(bidForClaims);
    } catch (err) {
      console.log("Error fetching staff list:", err);
    }
  };

  useEffect(() => {
    fetchStaffList();
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      setBusinesses(JSON.parse(storedBusinesses));
    }
    const storedAdminInfo = localStorage.getItem("adminInfo");
    if (storedAdminInfo) {
      try {
        const parsedAdminInfo = JSON.parse(storedAdminInfo);
        setAdminInfo(parsedAdminInfo);
      } catch (error) {
        console.error("Error parsing admin info from localStorage:", error);
      }
    }
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId && formData.company) {
      fetchClaimTypesAndGroups(formData.company);
    }
  }, [formData.company, employeeId]);

  useEffect(() => {
    if (isSingleBusiness && singleBusinessId && !formData.company) {
      setFormData((prev) => ({ ...prev, company: singleBusinessId }));
    }
  }, [isSingleBusiness, singleBusinessId, formData.company]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const res = await axios.post(`${Base_URL}/claims`, formData);

      if (res.data) {
        // Show success message
        notifySuccess("Claim submitted successfully!");
        setSuccessMessage("Claim submitted successfully!");
        setUploadSuccess(true);

        // Reset form or redirect
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1000);
      }
    } catch (err) {
      console.error("Error submitting claim:", err);
      const errorMsg =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";
      notifyError(errorMsg);
      setSuccessMessage("Error submitting claim");
      setUploadSuccess(false);
    }
  };

  const handleCancel = () => {
    if (onSuccess) onSuccess();
    history.goBack();
  };

  const handleEmployeeChange = (e) => {
    const employee = staffList.find((staff) => staff._id === e.target.value);
    const companyId = employee?.business?._id || "";
    setFormData((prev) => ({
      ...prev,
      employee: e.target.value,
      employeeCode: employee?.employeeId || "",
      company: companyId || prev.company,
    }));

    if (employee) {
      setEmployeeName(employee.displayName);
      if (employee.business?.name) {
        setBusinessName(employee.business.name);
      }
    }

    // Clear error when field is edited
    if (errors.employee) {
      setErrors({ ...errors, employee: "" });
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploading(true);
      setUploadSuccess(false);

      const formDataForUpload = new FormData();
      formDataForUpload.append("file_path", `Claims/${employeeName}`);
      formDataForUpload.append("business_id", formData.company);
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

          setSuccessMessage(
            response.data.message || "File uploaded successfully!"
          );
          setUploadSuccess(true);

          // Clear error when file is uploaded
          if (errors.supportingDocuments) {
            setErrors({ ...errors, supportingDocuments: "" });
          }

          setTimeout(() => {
            setUploadSuccess(false);
            setSuccessMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("File upload error:", error);
        setSuccessMessage("File upload failed. Please try again.");
        setUploadSuccess(false);
      } finally {
        setUploading(false);
      }
    }
  };

  const HandleOpenFile = async (documentId) => {
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error getting file:", error);
    }
  };

  return (
    <div className="bg-white">
      {uploadSuccess && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* <div>
            <label className="block text-gray-500 mb-1">Claim Reference</label>
            <div className="relative">
              <input
                type="text"
                name="claimReference"
                className="bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none"
                placeholder="Claim Reference"
                value={formData.claimReference}
                onChange={handleChange}
              />
            </div>
          </div> */}
          {!isSingleBusiness && (
          <div>
            <label className="block text-gray-500 mb-1">Business</label>
            <div className="relative">
              <select
                name="company"
                className={`bg-gray-100 rounded-md px-4 py-2 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                  errors.company ? "border border-red-500" : ""
                }`}
                value={formData.company}
                onChange={handleChange}
                disabled={formData.company}
              >
                <option value="">
                  {formData?.company && businessName
                    ? businessName
                    : "Select Business"}
                </option>
                {businesses?.map((business) => (
                  <option key={business._id} value={business._id}>
                    {business.name}
                  </option>
                ))}
              </select>
              {/* <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
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
              </div> */}
            </div>
            <div className="min-h-6">
              {errors.company && (
                <p className="text-red-500 text-sm mt-1">{errors.company}</p>
              )}
            </div>
          </div>
          )}
          <div>
            <label className="block text-gray-500 mb-1">Employee Name</label>
            <div className="relative">
              <select
                name="employee"
                className={`bg-gray-100 rounded-md px-4 py-2 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                  errors.employee ? "border border-red-500" : ""
                }`}
                value={formData.employee}
                onChange={handleEmployeeChange}
                disabled={employeeId !== ""}
              >
                <option value="">Select Employee</option>
                {staffList?.map((staff) => (
                  <option key={staff._id} value={staff._id}>
                    {staff.displayName}
                  </option>
                ))}
              </select>
              {/* <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
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
              </div> */}
            </div>
            <div className="min-h-6">
              {errors.employee && (
                <p className="text-red-500 text-sm mt-1">{errors.employee}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-gray-500 mb-1">Employee Code</label>
            <input
              type="text"
              name="employeeCode"
              className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                errors.employeeCode ? "border border-red-500" : ""
              }`}
              placeholder="Employee Code"
              value={formData.employeeCode}
              onChange={handleChange}
              disabled={true}
            />
            <div className="min-h-6">
              {errors.employeeCode && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.employeeCode}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-gray-500 mb-1">Claim Type</label>
            <div className="relative">
              <select
                name="claimType"
                className={`bg-gray-100 rounded-md px-4 py-2 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                  errors.claimType ? "border border-red-500" : ""
                }`}
                value={formData.claimType}
                onChange={handleChange}
              >
                <option value="">Select Claim Type</option>
                {claimTypes?.map((type) => (
                  <option key={type._id} value={type._id}>
                    {type.type}
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
              {errors.claimType && (
                <p className="text-red-500 text-sm mt-1">{errors.claimType}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-gray-500 mb-1">Currency</label>
            <div className="relative">
              <select
                name="currency"
                className={`bg-gray-100 rounded-md px-4 py-2 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                  errors.currency ? "border border-red-500" : ""
                }`}
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="">Select Currency</option>
                {data?.map((currency) => (
                  <option key={currency._id} value={currency._id}>
                    {currency.name}
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
              {errors.currency && (
                <p className="text-red-500 text-sm mt-1">{errors.currency}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-gray-500 mb-1">Receipt No.</label>
            <input
              type="text"
              name="receiptNo"
              className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                errors.receiptNo ? "border border-red-500" : ""
              }`}
              placeholder="Receipt No."
              value={formData.receiptNo}
              onChange={handleChange}
            />
            <div className="min-h-6">
              {errors.receiptNo && (
                <p className="text-red-500 text-sm mt-1">{errors.receiptNo}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-gray-500 mb-1">Receipt Date</label>
            <div className="relative">
              <CustomDatePicker
                type="date"
                name="receiptDate"
                className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                  errors.receiptDate ? "border border-red-500" : ""
                }`}
                bgColor="#F3F4F6"
                value={formData.receiptDate}
                onChange={(date) => {
                  setFormData((prev) => ({ ...prev, receiptDate: date }));
                  // Clear error when field is edited
                  if (errors.receiptDate) {
                    setErrors({ ...errors, receiptDate: "" });
                  }
                }}
              />
            </div>
            <div className="min-h-6">
              {errors.receiptDate && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.receiptDate}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-gray-500 mb-1">Receipt Amount</label>
            <input
              type="number"
              name="receiptAmount"
              className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                errors.receiptAmount ? "border border-red-500" : ""
              }`}
              placeholder="Receipt Amount"
              value={
                formData.receiptAmount && formatAmount(formData.receiptAmount)
              }
              onChange={handleChange}
              step="0.01"
              min="0"
            />
            <div className="min-h-6">
              {errors.receiptAmount && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.receiptAmount}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-gray-500 mb-1">Claimable Amount</label>
            <input
              type="number"
              name="claimableAmount"
              className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                errors.claimableAmount ? "border border-red-500" : ""
              }`}
              placeholder="Claimable Amount"
              value={
                formData.claimableAmount &&
                formatAmount(formData.claimableAmount)
              }
              onChange={handleChange}
              step="0.01"
              min="0"
            />
            <div className="min-h-6">
              {errors.claimableAmount && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.claimableAmount}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-gray-500 mb-1">
              Purpose/Description
            </label>
            <input
              type="text"
              name="purpose"
              className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                errors.purpose ? "border border-red-500" : ""
              }`}
              placeholder="Purpose/Description"
              value={formData.purpose}
              onChange={handleChange}
            />
            <div className="min-h-6">
              {errors.purpose && (
                <p className="text-red-500 text-sm mt-1">{errors.purpose}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-gray-500 mb-1">
            Supporting Documents
          </label>
          <div
            className={`border border-dashed rounded-md p-6 flex flex-col items-center justify-center ${
              errors.supportingDocuments
                ? "border-red-500"
                : "border-[var(--p-blue)]"
            }`}
          >
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
          <div className="min-h-6">
            {errors.supportingDocuments && (
              <p className="text-red-500 text-sm mt-1">
                {errors.supportingDocuments}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-[var(--p-blue)] text-white px-6 py-2 rounded-md"
          >
            Submit Claim
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewClaimForm;
