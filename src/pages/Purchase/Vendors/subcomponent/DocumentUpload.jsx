import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  FiEye,
  FiTrash2,
  FiDownload,
  FiUpload,
  FiCheckCircle,
} from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModalFile";
import { notifySuccess, notifyError } from "@/utils/toast";
import { useParams, useHistory } from "react-router-dom";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentUpload = ({
  customerId,
  businessId,
  vendorFirstName,
  documentSeedData = [],
}) => {
  const { t } = useTranslation();
  const history = useHistory();

  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);

  // API URLs
  const UPLOAD_API_URL = `${Base_URL}/documents/uploadDocument`;
  const GET_FILES_API_URL = `${Base_URL}/documents/getallbyuser/${customerId}`;
  const DELETE_FILE_API_URL = `${Base_URL}/documents/files/`;

  const normalizeSeedDocuments = (seedData = []) => {
    if (!Array.isArray(seedData)) return [];
    return seedData
      .filter((doc) => doc && doc.filePath)
      .map((doc) => ({
        title: doc.documentName || "Document",
        dateUploaded: doc.uploadDate
          ? new Date(doc.uploadDate).toLocaleString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : "-",
        uploadedBy: doc.uploadedBy || "Rider",
        fileURL: doc.filePath,
        downloadURL: doc.filePath,
        fileId: null,
      }));
  };

  const mergeDocuments = (apiDocs = [], seedDocs = []) => {
    const merged = [...apiDocs];
    const existingKeySet = new Set(
      apiDocs.map((d) => `${d.title}::${d.fileURL || d.downloadURL || ""}`)
    );
    seedDocs.forEach((doc) => {
      const key = `${doc.title}::${doc.fileURL || doc.downloadURL || ""}`;
      if (!existingKeySet.has(key)) {
        merged.push(doc);
      }
    });
    return merged;
  };

  useEffect(() => {
    fetchUploadedFiles();
  }, [customerId, businessId, documentSeedData]);

  const fetchUploadedFiles = async () => {
    try {
      const response = await axios.get(GET_FILES_API_URL);
      if (response.status === 200 && Array.isArray(response.data)) {
        const apiDocs = response.data.map((file) => ({
            title: file.name,
            dateUploaded: new Date(file.uploadDate).toLocaleString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            uploadedBy: "You",
            fileURL: file.url,
            downloadURL: file.downloadUrl, // ✅ Correct download link
            fileId: file._id,
          }));
        const seedDocs = normalizeSeedDocuments(documentSeedData);
        setDocuments(mergeDocuments(apiDocs, seedDocs));
      } else {
        setDocuments(normalizeSeedDocuments(documentSeedData));
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      setDocuments(normalizeSeedDocuments(documentSeedData));
    }
  };

  const handleDownload = (downloadURL) => {
    if (!downloadURL) {
      notifyError(t("customer.documents.downloadLinkUnavailable"));
      return;
    }

    console.log("Download URL:", downloadURL); // Debug log

    try {
      // Open in new tab - this is more reliable than forced download
      window.open(downloadURL, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Download error:", error);
      notifyError(t("customer.documents.openDocumentFailed"));
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];

    if (file) {
      const formData = new FormData();
      formData.append("file_path", `Vendors/${vendorFirstName}`);
      formData.append("business_id", businessId);
      formData.append("customer_id", customerId);
      formData.append("file_type", file.type);
      formData.append("file_size", file.size);
      formData.append("file", file);

      setUploading(true);
      setUploadSuccess(false);

      try {
        const response = await axios.post(UPLOAD_API_URL, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data.message === "File uploaded successfully") {
          notifySuccess(response.data.message || t("customer.documents.uploadSuccess"));

          const uploadedFile = response.data.file;

          // Fetch the file with URLs to get view and download URLs
          try {
            const fileWithUrls = await axios.get(
              `${Base_URL}/documents/getFileWithAllData/${uploadedFile._id}`
            );
            const fileData = fileWithUrls.data.data;

            // Update the document list instantly
            setDocuments((prevDocs) => [
              ...prevDocs,
              {
                title: uploadedFile.name,
                dateUploaded: new Date().toLocaleString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }),
                uploadedBy: "You",
                fileURL: fileData.url,
                downloadURL: fileData.downloadUrl,
                fileId: uploadedFile._id,
              },
            ]);
          } catch (urlError) {
            console.error("Error fetching file URLs:", urlError);
            // Fallback: add document without URLs (only delete will be available)
            setDocuments((prevDocs) => [
              ...prevDocs,
              {
                title: uploadedFile.name,
                dateUploaded: new Date().toLocaleString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }),
                uploadedBy: "You",
                fileURL: null,
                downloadURL: null,
                fileId: uploadedFile._id,
              },
            ]);
          }

          // Show success message in UI
          setSuccessMessage(
            response.data.message || t("customer.documents.uploadSuccess")
          );
          setUploadSuccess(true);

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setUploadSuccess(false);
            setSuccessMessage("");
          }, 100);
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError(t("customer.documents.uploadFailed"));
      } finally {
        setUploading(false);
      }
    }
  };

  const confirmDelete = (fileId) => {
    setSelectedFileId(fileId);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedFileId) {
      setIsModalOpen(false);
      setSelectedFileId(null);
      return;
    }
    try {
      await axios.delete(`${DELETE_FILE_API_URL}${selectedFileId}`);

      // Remove deleted file instantly
      setDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc.fileId !== selectedFileId)
      );

      notifySuccess(t("customer.documents.deleteSuccess"));
    } catch (error) {
      console.error("Error deleting file:", error);
      notifyError(t("customer.documents.deleteFailed"));
    } finally {
      setIsModalOpen(false);
      setSelectedFileId(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 sm:p-5 bg-white">
      {/* Upload Button */}
      <div className="flex justify-end mb-4">
        <div className="relative">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/jpeg, application/pdf"
            onChange={handleFileChange}
          />
          <label
            htmlFor="file-upload"
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white ${
              uploading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[var(--p-blue)] cursor-pointer hover:opacity-95"
            }`}
          >
            <FiUpload className="text-base" />
            {uploading ? t("customer.documents.uploading") : t("customer.documents.upload")}
          </label>
        </div>
      </div>

      {/* Success Message with Animation */}
      {uploadSuccess && (
        <div className="flex items-center text-green-600 mt-2 transition-opacity duration-500 animate-fadeIn">
          <FiCheckCircle className="mr-2" />
          {successMessage}
        </div>
      )}

      <div className="space-y-3 mt-4">
        {documents.map((doc, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t("customer.documents.uploadedBy", {
                  user: doc.uploadedBy,
                  date: doc.dateUploaded,
                })}
              </p>
            </div>
            <div className="flex gap-2">
              {doc.fileURL && (
                <a href={doc.fileURL} target="_blank" rel="noopener noreferrer">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-800">
                    <FiEye size={15} />
                  </button>
                </a>
              )}
              {doc.downloadURL && (
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                  onClick={() => handleDownload(doc.downloadURL)}
                >
                  <FiDownload size={15} />
                </button>
              )}
              {doc.fileId ? (
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => confirmDelete(doc.fileId)}
                >
                  <FiTrash2 size={15} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedFileId(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default DocumentUpload;
