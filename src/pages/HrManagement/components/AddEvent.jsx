// ApplyEventForm.jsx
"use client";

import { useState, useEffect, useRef } from "react"; // Import useRef
import axios from "axios";
// Import LoadScript and Autocomplete from Google Maps API library
import { LoadScript, Autocomplete } from "@react-google-maps/api"; // Import Autocomplete
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { CustomDatePicker } from "@/page-layouts/index";
import { PageHeader } from "@/page-layouts/index";
import { InputField, DropdownBasic } from "@/page-layouts/index";
import SingleBusinessField from "@/components/SingleBusinessField";

const ApplyEventForm = ({ onSubmit, onCancel }) => {
  const [adminInfo, setAdminInfo] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [formData, setFormData] = useState({
    business: "",
    eventName: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    attendees: [],
    location: "", // This will hold the formatted address string
    locationDetails: {
      // NEW: To store structured address details
      formattedAddress: "",
      streetAddress: "",
      unitHouseInfo: "",
      suburb: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      latitude: null,
      longitude: null,
      googlePlaceId: "",
    },
    documents: [], // This will store uploaded document details (fileId, name, url)
  });
  const [staffList, setStaffList] = useState([]);
  const [selectedAttendees, setSelectedAttendees] = useState([]); // This state might be redundant, consider removing if formData.attendees is always current.
  const [uploading, setUploading] = useState(false); // To track if files are currently uploading
  const [uploadSuccess, setUploadSuccess] = useState(false); // To indicate overall upload success
  const [successMessage, setSuccessMessage] = useState("");
  const [filesToUpload, setFilesToUpload] = useState([]); // Temporary state for files selected by user

  // Form validation state
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  // Ref for Google Autocomplete
  const autocompleteRef = useRef(null);

  console.log("form data", formData);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  // Helper notification functions (assuming these are placeholders for actual toast notifications)
  const notifySuccess = (message) => {
    console.log("Success:", message);
    // Replace with your actual notification implementation (e.g., toast.success(message))
  };

  const notifyError = (message) => {
    console.error("Error:", message);
    // Replace with your actual notification implementation (e.g., toast.error(message))
  };

  useEffect(() => {
    setStaffList([]); // Reset staff list when component mounts or business changes
    const fetchStaffList = async () => {
      try {
        const response = await axios.get(
          `${Base_URL}/staff-management/staff-names?business=${formData.business}&status=Active`
        );
        console.log("staff list:", response.data);
        setStaffList(response.data.data || []);
      } catch (err) {
        console.error("Error fetching staff list:", err);
      }
    };
    if (formData.business) fetchStaffList();
  }, [formData.business]); // Fetch staff list whenever business changes

  const isTimeAfter = (start, end) => {
    return start < end;
  };

  // Fetch admin info and businesses from localStorage on component mount
  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      const data = JSON.parse(storedBusinesses).map((business) => ({
        value: business._id,
        label: business.name,
      }));
      setBusinesses(data);
    }
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

  // Validation function
  const validateField = (name, value) => {
    let error = "";

    switch (name) {
      case "business":
        error = value.trim() ? "" : "Please select a business";
        break;
      case "eventName":
        error = value.trim() ? "" : "Please enter an event name";
        break;
      case "eventDate":
        if (!value) {
          error = "Please select an event date";
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (new Date(value) < today) {
            error = "Event date cannot be in the past";
          }
        }
        break;
      case "attendees":
        error = value.length > 0 ? "" : "Please select at least one attendee";
        break;
      case "location":
        error = value.trim() ? "" : "Please enter event location";
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
      // Skip documents and locationDetails from direct string validation
      if (field === "documents" || field === "locationDetails") return;

      const value = formData[field] || (field === "attendees" ? [] : "");
      const error = validateField(field, value);
      newErrors[field] = error;

      if (error) {
        isValid = false;
      }
    });

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);

      if (end < start) {
        newErrors.endDate = "End date cannot be before start date";
        isValid = false;
      }
    }

    if (formData.startTime && formData.endTime) {
      if (formData.endTime <= formData.startTime) {
        newErrors.endTime = "End time must be after start time";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // Generic change handler for InputFields that are NOT Autocomplete
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

  const handleAttendeesChange = (selectedValues) => {
    setSelectedAttendees(selectedValues); // This state might be redundant if formData.attendees is the source of truth for display
    setFormData({
      ...formData,
      attendees: selectedValues,
    });

    // Clear error for attendees field
    if (showErrors) {
      const error = validateField("attendees", selectedValues);
      setErrors((prev) => ({ ...prev, attendees: error }));
    }
  };

  // *** Google Places Autocomplete handler ***
  const handlePlaceSelect = () => {
    const place = autocompleteRef.current.getPlace();

    if (!place || !place.address_components) {
      console.warn(
        "No place details available from Google Autocomplete. Clearing location."
      );
      // Clear location if user selects nothing valid or types and doesn't select
      setFormData((prev) => ({
        ...prev,
        location: "", // Clear the main location string
        locationDetails: {
          // Clear structured details
          formattedAddress: "",
          streetAddress: "",
          unitHouseInfo: "",
          suburb: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
          latitude: null,
          longitude: null,
          googlePlaceId: "",
        },
      }));
      // Also clear validation error if it exists
      if (showErrors) {
        setErrors((prev) => ({
          ...prev,
          location: "Please enter event location",
        }));
      }
      return;
    }

    console.log("Place selected:", place);

    // 1. Update the main 'location' field with the full formatted address string
    const formattedAddress = place.formatted_address || "";
    setFormData((prev) => ({
      ...prev,
      location: formattedAddress,
    }));

    // Clear location validation error if it was present
    if (showErrors) {
      setErrors((prev) => ({ ...prev, location: "" }));
    }

    // 2. Extract detailed components for structured storage in 'locationDetails'
    const extractedAddressComponents = {
      street_number: "",
      route: "",
      sublocality: "",
      locality: "",
      administrative_area_level_1: "",
      postal_code: "",
      country: "",
      unitHouseInfo: "",
      latitude: place.geometry?.location?.lat() || null,
      longitude: place.geometry?.location?.lng() || null,
      place_id: place.place_id || "",
    };

    place.address_components.forEach((component) => {
      const types = component.types;
      if (types.includes("street_number"))
        extractedAddressComponents.street_number = component.long_name;
      if (types.includes("route"))
        extractedAddressComponents.route = component.long_name;
      if (types.includes("subpremise") || types.includes("premise"))
        extractedAddressComponents.unitHouseInfo = component.long_name;
      if (
        types.includes("sublocality") ||
        types.includes("sublocality_level_1") ||
        types.includes("neighborhood")
      )
        extractedAddressComponents.sublocality = component.long_name;
      if (types.includes("locality"))
        extractedAddressComponents.locality = component.long_name;
      if (types.includes("administrative_area_level_1"))
        extractedAddressComponents.administrative_area_level_1 =
          component.long_name;
      if (types.includes("postal_code"))
        extractedAddressComponents.postal_code = component.long_name;
      if (types.includes("country"))
        extractedAddressComponents.country = component.long_name;
    });

    const structuredLocationDetails = {
      formattedAddress: formattedAddress,
      streetAddress: [
        extractedAddressComponents.street_number,
        extractedAddressComponents.route,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      unitHouseInfo: extractedAddressComponents.unitHouseInfo,
      suburb: extractedAddressComponents.sublocality,
      city: extractedAddressComponents.locality,
      state: extractedAddressComponents.administrative_area_level_1,
      zipCode: extractedAddressComponents.postal_code,
      country: extractedAddressComponents.country,
      latitude: extractedAddressComponents.latitude,
      longitude: extractedAddressComponents.longitude,
      googlePlaceId: extractedAddressComponents.place_id,
    };

    console.log("Structured Location Details:", structuredLocationDetails);
    setFormData((prev) => ({
      ...prev,
      locationDetails: structuredLocationDetails,
    }));
  };

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadSuccess(false);
    setSuccessMessage("");

    const uploadedDocumentsInfo = [];
    let allUploadsSuccessful = true;

    for (const file of files) {
      const formDataForUpload = new FormData();
      const eventNameForPath = formData.eventName || "Event";
      formDataForUpload.append("file_path", `Events/${eventNameForPath}`);
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
          const uploadedFile = response.data.file;
          uploadedDocumentsInfo.push({
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          });
        } else {
          allUploadsSuccessful = false;
          notifyError(`Failed to upload ${file.name}`);
        }
      } catch (error) {
        allUploadsSuccessful = false;
        console.error(`Error uploading ${file.name}:`, error);
        notifyError(`Error uploading ${file.name}. Please try again.`);
      }
    }

    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...uploadedDocumentsInfo],
    }));

    if (allUploadsSuccessful && uploadedDocumentsInfo.length > 0) {
      setSuccessMessage("All selected documents uploaded successfully!");
      setUploadSuccess(true);
    } else if (uploadedDocumentsInfo.length > 0) {
      setSuccessMessage("Some documents uploaded successfully.");
      setUploadSuccess(true);
    } else {
      setSuccessMessage("No documents were uploaded.");
      setUploadSuccess(false);
    }

    setTimeout(() => {
      setUploadSuccess(false);
      setSuccessMessage("");
    }, 3000);

    setUploading(false);
    e.target.value = null; // Clear the file input
  };

  const removeDocument = (fileIdToRemove) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((doc) => doc.fileId !== fileIdToRemove),
    }));
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

  const handleDownload = async (documentId) => {
    console.log("Downloading document_id", documentId);
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );

      if (response.data && response.data.data && response.data.data.url) {
        const link = document.createElement("a");
        link.href = response.data.data.url;
        const fileName = response.data.data.name || "document";
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notifySuccess("Download started");
      } else {
        notifyError("Error: File URL not found");
      }
    } catch (error) {
      notifyError("Error downloading file");
      console.error("Download error:", error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    setShowErrors(true);
    const isValid = validateForm();

    if (isValid) {
      // Pass both location and locationDetails to the parent component
      onSubmit({ ...formData, adminInfo });
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

  const handleDateChange = (name, date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newErrors = { ...errors };

    if (name === "eventDate" && new Date(date) < today) {
      newErrors[name] = "Event date cannot be in the past";
    } else if (showErrors) {
      const error = validateField(name, date);
      newErrors[name] = error;
    }

    setFormData({ ...formData, [name]: date });
    setErrors(newErrors);
  };

  return (
    // LoadScript must wrap the components that use Google Maps APIs
    <LoadScript
      googleMapsApiKey={"AIzaSyDlKtLygdyr4XpjVE1WcyR7yHuigyq_agw"}
      libraries={["places"]}
    >
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm">
        <PageHeader title="Create New Event" />

        <form onSubmit={handleSubmit} className="p-6 pt-0">
          {/* Event Name and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <SingleBusinessField
              className="flex flex-col"
              selectedValue={formData.business}
              onAutoSelect={(id) =>
                handleChange({ target: { name: "business", value: id } })
              }
            >
              <label className="text-gray-500 mb-2 text-sm">Business *</label>
              <DropdownBasic
                name="business"
                type="select"
                isBusinessDropdown={true}
                businessDropdownProps={{
                  adminId: adminInfo?.id,
                  selectedBusiness: formData.business,
                  onChange: (val) =>
                    handleChange({ target: { name: "business", value: val } }),
                  placeholder: "Select Business",
                }}
                className={
                  errors.business && showErrors ? "border-red-500 border" : ""
                }
              />
              {errors.business && showErrors && (
                <p className="text-red-500 text-xs mt-1">{errors.business}</p>
              )}
            </SingleBusinessField>
            <div className="flex flex-col">
              <label className="text-gray-500 mb-2 text-sm">Event Name *</label>
              <InputField
                name="eventName"
                value={formData.eventName}
                onChange={handleChange}
                placeholder="Enter event name"
                className={
                  errors.eventName && showErrors ? "border-red-500 border" : ""
                }
              />
              {errors.eventName && showErrors && (
                <p className="text-red-500 text-xs mt-1">{errors.eventName}</p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-gray-500 mb-2 text-sm">Event Date *</label>
              <div className="relative">
                <CustomDatePicker
                  name="eventDate"
                  value={formData.eventDate}
                  onChange={(date) => handleDateChange("eventDate", date)}
                  className={`w-full rounded-lg bg-gray-50 px-4 py-3 outline-none text-gray-500 ${
                    errors.eventDate && showErrors
                      ? "border-red-500 border"
                      : ""
                  }`}
                  bgColor="#F3F4F6"
                  onFocus={(e) => (e.target.type = "date")}
                />
              </div>
              {errors.eventDate && showErrors && (
                <p className="text-red-500 text-xs mt-1">{errors.eventDate}</p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-gray-500 mb-2 text-sm">Start Time</label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className={
                  errors.startTime && showErrors
                    ? "border-red-500 border"
                    : "rounded-[12px] shadow-sm px-[16px] py-[8px]" +
                      " bg-gray-100"
                }
              />
              {errors.startTime && showErrors && (
                <p className="text-red-500 text-xs mt-1">{errors.startTime}</p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-gray-500 mb-2 text-sm">End Time</label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className={
                  errors.endTime && showErrors
                    ? "border-red-500 border"
                    : "rounded-[12px] shadow-sm px-[16px] py-[8px]" +
                      " bg-gray-100"
                }
              />
              {errors.endTime && showErrors && (
                <p className="text-red-500 text-xs mt-1">{errors.endTime}</p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-gray-500 mb-2 text-sm">Attendees *</label>
              <DropdownBasic
                isMulti
                name="attendees"
                value={formData.attendees} // Use formData.attendees directly
                placeholder="Select Attendees"
                onChange={(val) => handleAttendeesChange(val)} // Ensure this handles the array correctly
                options={staffList.map((staff) => ({
                  label: staff.displayName,
                  value: staff._id,
                }))}
                className={
                  errors.attendees && showErrors ? "border-red-500 border" : ""
                }
              />
              {errors.attendees && showErrors && (
                <p className="text-red-500 text-xs mt-1">{errors.attendees}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div className="flex flex-col">
              <label className="text-gray-500 mb-2 text-sm">Location *</label>
              {/* This is where Autocomplete is integrated */}
              <Autocomplete
                onLoad={(autocomplete) => {
                  autocompleteRef.current = autocomplete;
                }}
                onPlaceChanged={handlePlaceSelect}
                options={{
                  types: ["address"],
                  componentRestrictions: { country: [] }, // You can specify countries, e.g., { country: ["pk"] } for Pakistan
                  fields: [
                    "address_components",
                    "formatted_address",
                    "geometry.location", // Request lat/lng
                    "place_id", // Request place ID
                  ],
                }}
              >
                <InputField
                  name="location"
                  value={formData.location} // This is the field that will be updated by Autocomplete
                  onChange={handleChange} // This allows manual typing and updates formData.location
                  placeholder="Enter event location"
                  className={
                    errors.location && showErrors ? "border-red-500 border" : ""
                  }
                />
              </Autocomplete>
              {errors.location && showErrors && (
                <p className="text-red-500 text-xs mt-1">{errors.location}</p>
              )}
            </div>
          </div>

          {/* Documents Upload */}
          <div className="mb-6">
            <label className="text-gray-500 mb-2 text-sm block">
              Documents (Optional)
            </label>
            <div
              className={`border-2 border-dashed ${
                uploading ? "border-gray-400" : "border-gray-300"
              } rounded-lg p-6`}
            >
              <input
                type="file"
                multiple
                onChange={handleDocumentUpload}
                className="hidden"
                id="document-upload"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                disabled={uploading} // Disable input during upload
              />
              <label
                htmlFor="document-upload"
                className={`cursor-pointer flex flex-col items-center justify-center ${
                  uploading ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                <div className="text-gray-400 mb-2">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">
                  {uploading ? "Uploading..." : "Click to upload documents"}
                </p>
                <p className="text-gray-400 text-xs">
                  PDF, DOC, DOCX, TXT, JPG, PNG
                </p>
              </label>
            </div>

            {/* Display upload status */}
            {successMessage && (
              <div
                className={`mt-2 text-sm ${
                  uploadSuccess ? "text-green-600" : "text-red-600"
                }`}
              >
                {successMessage}
              </div>
            )}

            {/* Display uploaded files */}
            {formData.documents.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Uploaded Documents:
                </h4>
                <div className="space-y-2">
                  {formData.documents.map((doc) => (
                    <div
                      key={doc.fileId}
                      className="flex items-center justify-between bg-gray-50 p-2 rounded"
                    >
                      <span className="text-sm text-gray-600">{doc.name}</span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => HandleOpenFile(doc.fileId)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.fileId)}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.fileId)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              disabled={uploading} // Disable save button during upload
            >
              {uploading ? "Uploading Documents..." : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </LoadScript>
  );
};

export default ApplyEventForm;
