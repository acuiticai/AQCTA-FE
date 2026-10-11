import React, { useState, useEffect } from "react";
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

const DocumentUpload = ({ customerId, businessId, vendorFirstName }) => {
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

  useEffect(() => {
    fetchUploadedFiles();
  }, [customerId, businessId]);

  const fetchUploadedFiles = async () => {
    try {
      const response = await axios.get(GET_FILES_API_URL);
      if (response.status === 200 && Array.isArray(response.data)) {
        setDocuments(
          response.data.map((file) => ({
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
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const handleDownload = (downloadURL) => {
    if (!downloadURL) {
      notifyError("Download link not available.");
      return;
    }

    console.log("Download URL:", downloadURL); // Debug log

    try {
      // Open in new tab - this is more reliable than forced download
      window.open(downloadURL, "_blank", "noopener,noreferrer");
      notifySuccess("File opened in new tab!");
    } catch (error) {
      console.error("Download error:", error);
      notifyError("Failed to open file. Please try again.");
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
          notifySuccess(response.data.message || "File uploaded successfully!");

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
            response.data.message || "File uploaded successfully!"
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
        notifyError("File upload failed. Please try again.");
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
    if (!selectedFileId) return;
    try {
      await axios.delete(`${DELETE_FILE_API_URL}${selectedFileId}`);

      // Remove deleted file instantly
      setDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc.fileId !== selectedFileId)
      );

      notifySuccess("File deleted successfully!");
    } catch (error) {
      console.error("Error deleting file:", error);
      notifyError("Failed to delete file. Please try again.");
    } finally {
      setIsModalOpen(false);
      setSelectedFileId(null);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-300">
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white ${
              uploading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[var(--p-blue)] cursor-pointer hover:bg-[#7db535]"
            }`}
          >
            <FiUpload className="text-lg" />
            {uploading ? "Uploading..." : "Upload"}
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

      {/* Document Table */}
      <table className="w-full border border-gray-300 border-collapse mt-4">
        <thead className="bg-[#F2F2F2]">
          <tr>
            <th className="text-left py-3 px-4 font-normal text-gray-600">
              Title
            </th>
            <th className="text-left py-3 px-4 font-normal text-gray-600">
              Date Uploaded
            </th>
            <th className="text-left py-3 px-4 font-normal text-gray-600">
              Uploaded By
            </th>
            <th className="text-left py-3 px-4 font-normal text-gray-600">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, index) => (
            <tr key={index} className="border border-gray-300">
              <td className="py-3 px-4 border border-gray-300">{doc.title}</td>
              <td className="py-3 px-4 border border-gray-300">
                {doc.dateUploaded}
              </td>
              <td className="py-3 px-4 border border-gray-300">
                {doc.uploadedBy}
              </td>
              <td className="py-3 px-4 flex gap-2 border border-gray-300">
                {/* View PDF */}
                {doc.fileURL && (
                  <a
                    href={doc.fileURL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <button className="p-1 text-gray-600 hover:text-gray-800">
                      <FiEye size={18} />
                    </button>
                  </a>
                )}

                {/* Instant Download */}
                {doc.downloadURL && (
                  <button
                    className="p-1 text-gray-600 hover:text-gray-800"
                    onClick={() => handleDownload(doc.downloadURL)}
                  >
                    <FiDownload size={18} />
                  </button>
                )}

                {/* Delete */}
                <button
                  className="p-1 text-red-500 hover:text-red-700"
                  onClick={() => confirmDelete(doc.fileId)}
                >
                  <FiTrash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default DocumentUpload;
