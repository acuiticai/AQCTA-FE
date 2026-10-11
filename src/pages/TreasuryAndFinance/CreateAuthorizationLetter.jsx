import axios from "axios";
import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { useLocation } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifyError } from "@/utils/toast";

const CreateAuthorizationLetter = () => {
  const history = useHistory();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const requestId = queryParams.get("requestId");
  const businessId = queryParams.get("selectedBusiness");
  const authLetterId = queryParams.get("authLetterId");

  const [adminInfo, setAdminInfo] = useState(null);
  const [formData, setFormData] = useState({
    authLetter: requestId,
    authorizedPersonName: "",
    email: "",
    idNumber: "",
    phone: "",
    proformaInvoice: requestId,
    businessId: businessId,
    IDCardImage: null,
  });
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const storedAdminInfo = localStorage.getItem("adminInfo");
    if (storedAdminInfo) {
      try {
        const parsedAdminInfo = JSON.parse(storedAdminInfo);
        setAdminInfo(parsedAdminInfo);
      } catch (error) {
        console.error("Error parsing admin info from localStorage:", error);
      }
    }

    const fetchAuthLetterData = async () => {
      const authLetterResponse = await axios.get(
        `${Base_URL}/authorization-letter/${authLetterId}`
      );
      setFormData({ ...authLetterResponse.data });
      setIsSaved(true);
    };

    if (authLetterId) {
      fetchAuthLetterData();
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handleBack = () => {
    history.push("/treasury/authorization-requests");
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.authorizedPersonName.trim()) {
      newErrors.authorizedPersonName = "Authorized person name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.idNumber.trim()) {
      newErrors.idNumber = "ID Number is required";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone Number is required";
    }

    if (!formData.IDCardImage) {
      newErrors.IDCardImage = "ID Card image is required";
    }

    return newErrors;
  };

  const handleNext = () => {
    const newErrors = validateForm();

    if (Object.keys(newErrors).length === 0) {
      if (!isSaved) {
        // Create new authorization letter
        axios
          .post(`${Base_URL}/authorization-letter`, {
            ...formData,
            proformaInvoice: requestId,
          })
          .then((response) => {
            if (response.data.status) {
              history.push({
                pathname: `/treasury/authorization-templates`,
                search: `?requestId=${requestId}&businessId=${businessId}&authLetterId=${response.data.data._id}`,
              });
            }
          })
          .catch((error) => {
            console.error("Error:", error);
            notifyError("Failed to save authorization letter");
          });
      } else {
        // Update existing authorization letter
        axios
          .put(`${Base_URL}/authorization-letter/${authLetterId}`, formData)
          .then((response) => {
            if (response.data.status) {
              history.push({
                pathname: `/treasury/authorization-templates`,
                search: `?requestId=${requestId}&businessId=${businessId}&authLetterId=${authLetterId}`,
              });
            }
          })
          .catch((error) => {
            console.error("Error updating authorization letter:", error);
            notifyError("Failed to update authorization letter");
          });
      }
    } else {
      setErrors(newErrors);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);

    const formDataForUpload = new FormData();
    formDataForUpload.append("image", file);

    try {
      const uploadResponse = await axios.post(
        `${Base_URL}/upload`,
        formDataForUpload,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (uploadResponse.data.url) {
        const uploadedImageUrl = uploadResponse.data.url;

        setFormData({
          ...formData,
          IDCardImage: uploadedImageUrl,
        });

        setSuccessMessage("Image uploaded successfully!");
        setUploadSuccess(true);

        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);

        if (errors.IDCardImage) {
          setErrors({
            ...errors,
            IDCardImage: "",
          });
        }
      }
    } catch (error) {
      console.error("Image upload error:", error);
      notifyError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({
      ...formData,
      IDCardImage: null,
    });
  };

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
        onClick={handleBack}
      >
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          ></path>
        </svg>
        Back
      </button>

      <h1 className="text-lg font-semibold mb-8">
        Create Authorization Letter
      </h1>

      <div className="max-w-4xl">
        {/* Form layout with labels on left and inputs on right */}
        <div className="grid grid-cols-[180px_1fr] gap-x-6 gap-y-6">
          {/* Authorized Person Name */}
          <div className="pt-3">
            <label className="text-gray-700">Authorized Person Name</label>
          </div>
          <div>
            <input
              type="text"
              name="authorizedPersonName"
              placeholder="Authorized Person Name"
              className={`w-full px-4 py-3 bg-gray-100 border ${
                errors.authorizedPersonName
                  ? "border-red-500"
                  : "border-gray-200"
              } rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent`}
              value={formData.authorizedPersonName}
              onChange={handleChange}
            />
            {errors.authorizedPersonName && (
              <p className="text-red-500 text-sm mt-1">
                {errors.authorizedPersonName}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="pt-3">
            <label className="text-gray-700">Email</label>
          </div>
          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              className={`w-full px-4 py-3 bg-gray-100 border ${
                errors.email ? "border-red-500" : "border-gray-200"
              } rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent`}
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* ID Number */}
          <div className="pt-3">
            <label className="text-gray-700">ID Number</label>
          </div>
          <div>
            <input
              type="text"
              name="idNumber"
              placeholder="ID Number"
              className={`w-full px-4 py-3 bg-gray-100 border ${
                errors.idNumber ? "border-red-500" : "border-gray-200"
              } rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent`}
              value={formData.idNumber}
              onChange={handleChange}
            />
            {errors.idNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.idNumber}</p>
            )}
          </div>

          {/* ID Front */}
          <div className="pt-3">
            <label className="text-gray-700">ID Front</label>
          </div>
          <div>
            <div
              className={`border border-dashed ${
                errors.IDCardImage ? "border-red-500" : "border-[var(--p-blue)]"
              } rounded-md p-4 flex items-center justify-center h-16`}
              onClick={() => document.getElementById("fileUpload").click()}
            >
              {!formData.IDCardImage ? (
                <div className="flex items-center justify-center text-[var(--p-blue)] cursor-pointer">
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
                  <span>
                    {uploading ? "Uploading..." : "Upload ID Card Image"}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center w-full">
                  <span className="text-sm text-gray-600">
                    ID Card Image Uploaded
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <input
                id="fileUpload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {uploadSuccess && (
              <div className="mt-2 text-sm text-[var(--p-blue)]">
                {successMessage}
              </div>
            )}

            {errors.IDCardImage && (
              <p className="text-red-500 text-sm mt-1">{errors.IDCardImage}</p>
            )}

            {formData.IDCardImage && (
              <div className="mt-3 p-2 bg-gray-50 rounded-md">
                <div className="flex justify-center border border-gray-200 rounded-md p-2">
                  <img
                    src={`${formData.IDCardImage}`}
                    alt="ID Card"
                    className="max-h-36 object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Phone Number */}
          <div className="pt-3">
            <label className="text-gray-700">Phone Number</label>
          </div>
          <div>
            <input
              type="text"
              name="phone"
              placeholder="Phone Number"
              className={`w-full px-4 py-3 bg-gray-100 border ${
                errors.phone ? "border-red-500" : "border-gray-200"
              } rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent`}
              value={formData.phone}
              onChange={handleChange}
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end mt-8 space-x-4">
          <button
            className="px-6 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
            onClick={handleBack}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue)] transition-colors"
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAuthorizationLetter;
