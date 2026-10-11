import React, { useState, useRef, useContext } from "react";
import axios from "axios";
import { FiUpload, FiPaperclip, FiEye, FiDownload, FiTrash2 } from "react-icons/fi";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];

const readableSize = (bytes) => {
  if (!bytes) return "";
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

/**
 * Supporting documents for a reconciliation — normally the bank's own statement.
 *
 * Files go to the shared Documents service first (the same route Credit Notes and
 * Expenses use) and only the returned reference is stored on the reconciliation.
 * Previews resolve a fresh URL through that service at click time rather than
 * trusting a link saved months earlier.
 */
const ReconciliationAttachments = ({
  reconciliationId,
  businessId,
  attachments = [],
  readOnly = false,
  onChange,
}) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removingId, setRemovingId] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      notifyError("Please upload only JPEG, PNG, or PDF files");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_SIZE) {
      notifyError("File size must be less than 5MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (attachments.length >= MAX_FILES) {
      notifyError(`A reconciliation can hold at most ${MAX_FILES} documents`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file_path", `BankReconciliation/${reconciliationId}`);
      formData.append("business_id", businessId || "");
      formData.append("customer_id", adminInfo?.id || "");
      formData.append("file_type", file.type);
      formData.append("file_size", file.size);
      formData.append("file", file);

      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            if (!event.total) return;
            setProgress(Math.round((event.loaded * 100) / event.total));
          },
        }
      );

      const uploaded = response.data?.file;
      if (!uploaded?._id) {
        notifyError("Upload did not return a document reference");
        return;
      }

      // The file exists in Documents at this point; record it against the period.
      const res = await BankReconciliationServices.attachDocument(
        reconciliationId,
        {
          fileId: uploaded._id,
          name: uploaded.name || file.name,
          url: uploaded.url || "",
          downloadUrl: uploaded.downloadUrl || "",
          size: file.size,
          type: file.type,
        }
      );

      onChange?.(res.attachments || []);
      notifySuccess("Document uploaded");
    } catch (error) {
      console.error("Reconciliation document upload error:", error);
      notifyError(
        error?.response?.data?.message || "File upload failed. Please try again."
      );
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePreview = async (fileId) => {
    if (!fileId) return;
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${fileId}`
      );
      const url = response.data?.data?.url;
      if (!url) {
        notifyError("This document has no viewable link");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening reconciliation document:", error);
      notifyError("Error opening file");
    }
  };

  /**
   * Prefers the service's downloadUrl, which is served with a Content-Disposition
   * attachment header. Falls back to the view URL through an anchor with the
   * download attribute, so a PDF saves rather than opening in a browser tab.
   */
  const handleDownload = async (file) => {
    if (!file?.fileId) return;
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${file.fileId}`
      );
      const data = response.data?.data || {};
      const url = data.downloadUrl || file.downloadUrl || data.url || file.url;
      if (!url) {
        notifyError("This document has no download link");
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name || "document";
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading reconciliation document:", error);
      notifyError("Error downloading file");
    }
  };

  const handleRemove = async (fileId) => {
    try {
      setRemovingId(fileId);
      const res = await BankReconciliationServices.removeDocument(
        reconciliationId,
        fileId
      );
      onChange?.(res.attachments || []);
      notifySuccess("Document removed");
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to remove this document"
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Supporting Documents
      </label>

      {!readOnly && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || attachments.length >= MAX_FILES}
            className="flex items-center justify-center gap-2 h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiUpload size={16} />
            {uploading ? `Uploading ${progress}%` : "Upload File"}
          </button>

          {uploading && (
            <div className="mt-2 w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--p-blue)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <p className="mt-1 text-xs text-gray-500">
            JPEG, PNG or PDF up to 5MB. Maximum {MAX_FILES} documents — the bank
            statement usually goes here.
          </p>
        </>
      )}

      {attachments.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">No documents attached yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {attachments.map((file) => (
            <li
              key={String(file.fileId)}
              className="flex items-center justify-between gap-3 bg-[#F9F9FA] border border-gray-200 rounded-lg px-3 py-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <FiPaperclip size={14} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 truncate" title={file.name}>
                  {file.name}
                </span>
                {file.size > 0 && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {readableSize(file.size)}
                  </span>
                )}
              </span>

              <span className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePreview(file.fileId)}
                  className="text-gray-600 hover:text-[var(--p-blue)]"
                  title="View document"
                >
                  <FiEye size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  className="text-gray-600 hover:text-[var(--p-blue)]"
                  title="Download document"
                >
                  <FiDownload size={16} />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(file.fileId)}
                    disabled={removingId === file.fileId}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    title="Remove document"
                  >
                    <FiTrash2 size={16} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReconciliationAttachments;
