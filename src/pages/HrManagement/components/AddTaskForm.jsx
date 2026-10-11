import { useState, useEffect } from "react";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { InputField } from "@/page-layouts";
import { PageHeader, TextAreaField } from "@/page-layouts/index";
import { useLocation } from "react-router-dom"; // Import useLocation

const CreateTaskForm = ({ onSubmit, onCancel }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const eventIdFromParams = searchParams.get("event");

  const [adminInfo, setAdminInfo] = useState(null);
  const [formData, setFormData] = useState({
    event: eventIdFromParams || "", // Initialize event from URL param
    taskName: "",
    description: "",
    weightage: "",
    documents: [],
  });
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState({});

  console.log("form data", formData);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  // Helper notification functions (replace with your actual implementation)
  const notifySuccess = (message) => {
    console.log("Success:", message);
  };

  const notifyError = (message) => {
    console.error("Error:", message);
  };

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

    // Optionally, you can add a check if eventIdFromParams is null or undefined
    // and handle that case (e.g., redirect or show an error message).
    if (!eventIdFromParams) {
      console.error("Event ID is missing in the URL parameters.");
      // You might want to set an error state or navigate the user.
    }
  }, [eventIdFromParams]); // Re-run if eventIdFromParams changes

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "taskName":
        error = value.trim() ? "" : "Please enter the task name";
        break;
      case "weightage":
        if (!value.trim()) {
          error = "Please enter the weightage";
        } else if (
          !/^\d+$/.test(value) ||
          parseInt(value) < 0 ||
          parseInt(value) > 100
        ) {
          error = "Weightage must be a number between 0 and 100";
        }
        break;
      default:
        break;
    }
    return error;
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    if (!formData.event) {
      newErrors.event = "Event ID is missing.";
      isValid = false;
    }

    if (!formData.taskName.trim()) {
      newErrors.taskName = "Please enter the task name";
      isValid = false;
    }

    if (!formData.weightage.trim()) {
      newErrors.weightage = "Please enter the weightage";
      isValid = false;
    } else if (
      !/^\d+$/.test(formData.weightage) ||
      parseInt(formData.weightage) < 0 ||
      parseInt(formData.weightage) > 100
    ) {
      newErrors.weightage = "Weightage must be a number between 0 and 100";
      isValid = false;
    }

    // if (formData.documents.length === 0) {
    //   newErrors.documents = "At least one document is required.";
    //   isValid = false;
    // }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    if (showErrors) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setErrors({ ...errors, documents: "" });
    setUploading(true);
    setUploadSuccess(false);
    setSuccessMessage("");

    const uploadedDocumentsInfo = [];
    let allUploadsSuccessful = true;

    for (const file of files) {
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `Tasks/${eventIdFromParams || "UnknownEvent"}`
      );
      formDataForUpload.append("event_id", eventIdFromParams);
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
    e.target.value = null;
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
      let Response = await axios.get(
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
      let response = await axios.get(
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
      const payload = {
        event: formData.event, // Use the event ID from the URL params
        taskName: formData.taskName,
        description: formData.description,
        weightage: parseInt(formData.weightage, 10),
        documents: formData.documents.map((doc) => ({
          fileId: doc.fileId,
          name: doc.name,
          url: doc.url,
          downloadUrl: doc.downloadUrl,
          uploadedAt: doc.uploadedAt,
          size: doc.size,
          type: doc.type,
        })),
      };
      console.log("Submitting task data:", payload);
      onSubmit(payload);
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

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm">
      <PageHeader title="Create New Task" />
      <form onSubmit={handleSubmit} className="p-6 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* The Event Dropdown has been removed */}
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">Task Name *</label>
            <InputField
              name="taskName"
              value={formData.taskName}
              onChange={handleChange}
              placeholder="Enter task name"
              className={
                errors.taskName && showErrors ? "border-red-500 border" : ""
              }
            />
            {errors.taskName && showErrors && (
              <p className="text-red-500 text-xs mt-1">{errors.taskName}</p>
            )}
          </div>
          <div className="flex flex-col">
            <label className="text-gray-500 mb-2 text-sm">
              Weightage (%) *
            </label>
            <InputField
              type="number"
              name="weightage"
              value={formData.weightage}
              onChange={handleChange}
              placeholder="Enter weightage (0-100)"
              className={
                errors.weightage && showErrors ? "border-red-500 border" : ""
              }
            />
            {errors.weightage && showErrors && (
              <p className="text-red-500 text-xs mt-1">{errors.weightage}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col mb-6">
          <label className="text-gray-500 mb-2 text-sm">
            Description (Optional)
          </label>
          <TextAreaField
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter description"
            className={
              errors.description && showErrors ? "border-red-500 border" : ""
            }
          />
          {errors.description && showErrors && (
            <p className="text-red-500 text-xs mt-1">{errors.description}</p>
          )}
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
              disabled={uploading}
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

          {errors.documents && showErrors && (
            <p className="text-red-500 text-xs mt-1">{errors.documents}</p>
          )}

          {successMessage && (
            <div
              className={`mt-2 text-sm ${
                uploadSuccess ? "text-green-600" : "text-red-600"
              }`}
            >
              {successMessage}
            </div>
          )}

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
            disabled={uploading}
          >
            {uploading ? "Uploading Documents..." : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTaskForm;
