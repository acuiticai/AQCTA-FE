import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  FiEye,
  FiTrash2,
  FiDownload,
  FiUpload,
  FiCheckCircle,
  FiLoader,
} from "react-icons/fi";
import ConfirmationModal from "../../../Customer/reusablecomponents/ConfirmationModalFile";
import { notifySuccess, notifyError } from "@/utils/toast";
import { formatDate, formatTime } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentUpload = ({ Data }) => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const fileInputRef = useRef(null);

  const UPLOAD_API_URL = `${Base_URL}/documents/uploadDocument`;
  const GET_FILES_API_URL = `${Base_URL}/documents/get_all_by_sales/${Data.contractNo}`;
  const DELETE_FILE_API_URL = `${Base_URL}/documents/files/`;

  useEffect(() => {
    fetchUploadedFiles();
  }, [Data.contractNo]);

  const fetchUploadedFiles = async () => {
    try {
      const response = await axios.get(GET_FILES_API_URL);
      console.log("Files response:", response.data); // Debug log
      if (Array.isArray(response.data)) {
        const mapped = response.data.map((file) => {
          console.log(
            "File:",
            file.name,
            "URL:",
            file.url,
            "DownloadURL:",
            file.downloadUrl
          ); // Debug log

          // If downloadURL is not available, use the same URL (it will work for both view and download)
          const downloadURL = file.downloadUrl || file.url;

          return {
            title: file.name,
            dateUploaded: file.uploadDate,
            uploadedBy: "You",
            fileURL: file.url,
            downloadURL: downloadURL,
            fileId: file._id,
          };
        });
        setDocuments(mapped);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    const Item = Data?.productInfo?.[0]?.title;
    const customer = Data?.basicInfo?.finalCustomerName;
    const path = `${Item}/${new Date().getFullYear()}/Customers/${customer}/${
      Data.contractNo
    }/Purchase Contracts`;

    formData.append("file_path", path);
    formData.append("business_id", Data?.business);
    formData.append("customer_id", Data?.basicInfo?.customer_id);
    formData.append("file_type", file.type);
    formData.append("file_size", file.size);
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await axios.post(UPLOAD_API_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.file) {
        const f = res.data.file;

        // Fetch the file with URLs to get view and download URLs
        try {
          const fileWithUrls = await axios.get(
            `${Base_URL}/documents/getFileWithAllData/${f._id}`
          );
          const fileData = fileWithUrls.data.data;

          console.log("File data from getFileWithAllData:", fileData); // Debug log
          console.log("URL:", fileData.url); // Debug log
          console.log("Download URL:", fileData.downloadUrl); // Debug log

          // If downloadURL is not available, use the same URL (it will work for both view and download)
          const downloadURL = fileData.downloadUrl || fileData.url;

          setDocuments((prev) => [
            ...prev,
            {
              title: f.name,
              dateUploaded: new Date().toLocaleString("en-GB"),
              uploadedBy: "You",
              fileURL: fileData.url,
              downloadURL: downloadURL,
              fileId: f._id,
            },
          ]);
        } catch (urlError) {
          console.error("Error fetching file URLs:", urlError);
          // Fallback: add document without URLs (only delete will be available)
          setDocuments((prev) => [
            ...prev,
            {
              title: f.name,
              dateUploaded: new Date().toLocaleString("en-GB"),
              uploadedBy: "You",
              fileURL: null,
              downloadURL: null,
              fileId: f._id,
            },
          ]);
        }

        setUploadSuccess(true);
        setSuccessMessage(res.data.message || "File uploaded successfully!");
        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 2000);
        notifySuccess(res.data.message);
      }
    } catch (err) {
      console.error("Upload error:", err);
      notifyError("File upload failed.");
    } finally {
      setUploading(false);
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const confirmDelete = (id) => {
    setSelectedFileId(id);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedFileId) return;
    setDeletingFileId(selectedFileId);
    try {
      await axios.delete(`${DELETE_FILE_API_URL}${selectedFileId}`);
      setDocuments((d) => d.filter((doc) => doc.fileId !== selectedFileId));
      notifySuccess("File deleted successfully");
    } catch (err) {
      console.error("Delete error:", err);
      notifyError("Failed to delete file");
    } finally {
      setDeletingFileId(null);
      setIsModalOpen(false);
      setSelectedFileId(null);
    }
  };

  const handleDownload = (url) => {
    if (!url) return notifyError("No download URL");

    console.log("Download URL:", url); // Debug log

    try {
      // Open in new tab - this is more reliable than forced download
      window.open(url, "_blank", "noopener,noreferrer");
      notifySuccess("File opened in new tab!");
    } catch (error) {
      console.error("Download error:", error);
      notifyError("Failed to open file. Please try again.");
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200 shadow">
      {/* Upload */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">
          Uploaded Documents
        </h2>
        <div>
          <input
            ref={fileInputRef}
            id="upload"
            type="file"
            className="hidden"
            accept="application/pdf,image/jpeg"
            onChange={handleFileChange}
          />
          <label
            htmlFor="upload"
            className={`inline-flex items-center px-4 py-2 rounded-md text-white ${
              uploading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[var(--p-blue)] hover:bg-[#7db535]"
            } cursor-pointer`}
          >
            <FiUpload className="mr-2" />
            {uploading ? "Uploading..." : "Upload"}
          </label>
        </div>
      </div>

      {/* Success Message */}
      {uploadSuccess && (
        <div className="text-green-600 mb-4 flex items-center">
          <FiCheckCircle className="mr-2" />
          {successMessage}
        </div>
      )}

      {/* Table */}
      <table className="w-full border border-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-4 text-left">Title</th>
            <th className="py-2 px-4 text-left">Date Uploaded</th>
            <th className="py-2 px-4 text-left">Uploaded By</th>
            <th className="py-2 px-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.length > 0 ? (
            [...documents]
              .sort((a, b) => {
                // Parse date strings to Date objects for comparison
                const dateA = new Date(a.dateUploaded);
                const dateB = new Date(b.dateUploaded);
                return dateB - dateA; // Most recent first
              })
              .map((doc, idx) => (
                <tr key={idx} className="border-t border-gray-200">
                  <td className="py-2 px-4">{doc.title}</td>
                  <td className="py-2 px-4">
                    {doc.dateUploaded && doc.dateUploaded !== "null"
                      ? `${formatDate(doc.dateUploaded)} ${formatTime(
                          doc.dateUploaded
                        )}`
                      : ""}
                  </td>
                  <td className="py-2 px-4">{doc.uploadedBy}</td>
                  <td className="py-2 px-4 flex space-x-3 items-center">
                    {doc.fileURL && (
                      <a href={doc.fileURL} target="_blank" rel="noreferrer">
                        <FiEye className="text-gray-600 hover:text-gray-800 cursor-pointer" />
                      </a>
                    )}
                    {doc.downloadURL && (
                      <FiDownload
                        className="text-gray-600 hover:text-gray-800 cursor-pointer"
                        onClick={() => handleDownload(doc.downloadURL)}
                      />
                    )}
                    {deletingFileId === doc.fileId ? (
                      <FiLoader className="text-red-500 animate-spin cursor-not-allowed" />
                    ) : (
                      <FiTrash2
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        onClick={() => confirmDelete(doc.fileId)}
                      />
                    )}
                  </td>
                </tr>
              ))
          ) : (
            <tr>
              <td colSpan="4" className="py-4 text-center text-gray-500">
                No documents uploaded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!deletingFileId) {
            setIsModalOpen(false);
          }
        }}
        onConfirm={handleDelete}
        isLoading={!!deletingFileId}
      />
    </div>
  );
};

export default DocumentUpload;
