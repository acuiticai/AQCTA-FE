import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  FiEye,
  FiTrash,
  FiDownload,
  FiUpload,
  FiCheckCircle,
  FiPlus,
} from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModalFile";
import { notifySuccess, notifyError } from "@/utils/toast";
import { formatDate } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const cellInputClass =
  "w-full min-w-[120px] border-0 rounded-none p-2 bg-transparent text-gray-900 placeholder:text-gray-400 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:bg-gray-50";

const thClass =
  "py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800";

const tdClass = "py-2 px-4 border-b border-gray-200 align-middle";

const emptyPendingRow = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  file: null,
});

const mapApiFileToDoc = (file) => {
  const downloadURL = file.downloadUrl || file.url || null;
  const viewURL = file.url || file.downloadUrl || null;
  const title =
    (file.documentTitle && String(file.documentTitle).trim()) ||
    file.name ||
    "";

  return {
    title,
    fileName: file.name || "",
    dateUploaded: file.uploadDate
      ? new Date(file.uploadDate).toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : new Date().toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
    uploadedBy: "You",
    fileURL: viewURL,
    downloadURL,
    fileId: file._id,
  };
};

const DocumentUpload = ({ customerId, businessId, customerFirstName }) => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [pendingRows, setPendingRows] = useState([emptyPendingRow()]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const fileInputRefs = useRef({});

  const UPLOAD_API_URL = `${Base_URL}/documents/uploadDocument`;
  const GET_FILES_API_URL = `${Base_URL}/documents/getallbyuser/${customerId}`;
  const DELETE_FILE_API_URL = `${Base_URL}/documents/files/`;

  useEffect(() => {
    fetchUploadedFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, businessId]);

  const fetchUploadedFiles = async () => {
    if (!customerId) return;
    try {
      const response = await axios.get(GET_FILES_API_URL);
      if (response.status === 200 && Array.isArray(response.data)) {
        setDocuments(response.data.map(mapApiFileToDoc));
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const updatePendingRow = (rowId, patch) => {
    setPendingRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  };

  const addPendingRow = () => {
    setPendingRows((rows) => [...rows, emptyPendingRow()]);
  };

  const removePendingRow = (rowId) => {
    setPendingRows((rows) => {
      const next = rows.filter((row) => row.id !== rowId);
      return next.length === 0 ? [emptyPendingRow()] : next;
    });
  };

  const pendingRowIsRemovable = (row) =>
    pendingRows.length > 1 || Boolean(row.file) || Boolean(String(row.title || "").trim());

  const uploadOneFile = async (file, documentTitle) => {
    const formData = new FormData();
    formData.append(
      "file_path",
      `Customers/${customerFirstName || customerId || "Customer"}`
    );
    formData.append("business_id", businessId);
    formData.append("customer_id", customerId);
    formData.append("file_type", file.type);
    formData.append("file_size", file.size);
    formData.append("file", file);
    if (documentTitle) {
      formData.append("documentTitle", documentTitle);
    }

    const response = await axios.post(UPLOAD_API_URL, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (response.data.message !== "File uploaded successfully") {
      throw new Error(response.data.message || "Upload failed");
    }

    const uploadedFile = response.data.file;
    try {
      const fileWithUrls = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${uploadedFile._id}`
      );
      const fileData = fileWithUrls.data?.data || {};
      return mapApiFileToDoc({
        ...uploadedFile,
        documentTitle:
          uploadedFile.documentTitle || documentTitle || fileData.documentTitle,
        url: fileData.url,
        downloadUrl: fileData.downloadUrl,
      });
    } catch {
      return mapApiFileToDoc({
        ...uploadedFile,
        documentTitle: uploadedFile.documentTitle || documentTitle,
      });
    }
  };

  const handleUpload = async () => {
    const rowsToUpload = pendingRows.filter((row) => row.file);
    if (!rowsToUpload.length) {
      notifyError(t("customer.documents.selectFileFirst"));
      return;
    }
    if (!customerId || !businessId) {
      notifyError(t("customer.documents.uploadFailed"));
      return;
    }

    setUploading(true);
    setUploadSuccess(false);

    try {
      const uploadedDocs = [];
      for (const row of rowsToUpload) {
        const doc = await uploadOneFile(
          row.file,
          String(row.title || "").trim()
        );
        uploadedDocs.push(doc);
      }

      setDocuments((prev) => [...uploadedDocs, ...prev]);
      setPendingRows([emptyPendingRow()]);
      notifySuccess(t("customer.documents.uploadSuccess"));
      setSuccessMessage(t("customer.documents.uploadSuccess"));
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
        setSuccessMessage("");
      }, 2000);
    } catch (error) {
      console.error("File upload error:", error);
      notifyError(t("customer.documents.uploadFailed"));
    } finally {
      setUploading(false);
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

  const handleDownload = (downloadURL) => {
    if (!downloadURL) {
      notifyError(t("customer.documents.downloadLinkUnavailable"));
      return;
    }
    try {
      const link = document.createElement("a");
      link.href = downloadURL;
      link.setAttribute("download", "");
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      notifyError(t("customer.documents.downloadFailed"));
    }
  };

  const handleView = (viewURL) => {
    if (!viewURL) {
      notifyError(t("customer.documents.viewLinkUnavailable"));
      return;
    }
    try {
      window.open(viewURL, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("View error:", error);
      notifyError(t("customer.documents.openDocumentFailed"));
    }
  };

  const resolveUploadedBy = (uploadedBy) =>
    uploadedBy === "You" ? t("customer.documents.you") : uploadedBy;

  const canUpload = pendingRows.some((row) => row.file) && !uploading;

  return (
    <div>
      <div className="mb-5 pb-4 border-b border-gray-100 dark:border-gray-600">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("customer.documents.companyDocuments")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl mt-1">
          {t("customer.documents.companyDocumentsHint")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse border border-gray-200">
          <thead>
            <tr className="text-left">
              <th className={thClass}>{t("customer.documents.documentTitle")}</th>
              <th className={thClass}>{t("customer.documents.documentFile")}</th>
              <th className={`${thClass} w-[72px] text-center`}>
                {t("customer.documents.action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pendingRows.map((row) => (
              <tr key={row.id} className="bg-white">
                <td className={`${tdClass} align-top`}>
                  <input
                    id={`doc-title-${row.id}`}
                    type="text"
                    value={row.title}
                    onChange={(e) =>
                      updatePendingRow(row.id, { title: e.target.value })
                    }
                    placeholder={t("customer.documents.enterDocumentTitle")}
                    className={cellInputClass}
                  />
                </td>
                <td className={`${tdClass} align-top`}>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[row.id] = el;
                    }}
                    id={`doc-file-${row.id}`}
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      updatePendingRow(row.id, { file });
                    }}
                  />
                  <div className="flex items-center gap-2 min-w-0 px-1">
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[row.id]?.click()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <FiUpload className="text-base" />
                      {row.file
                        ? t("customer.documents.changeFile", {
                            defaultValue: "Change File",
                          })
                        : t("customer.documents.chooseFile", {
                            defaultValue: "Choose File",
                          })}
                    </button>
                    {row.file ? (
                      <span
                        className="text-xs text-gray-500 truncate min-w-0"
                        title={row.file.name}
                      >
                        {row.file.name}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className={`${tdClass} text-center`}>
                  {pendingRowIsRemovable(row) ? (
                    <button
                      type="button"
                      onClick={() => removePendingRow(row.id)}
                      className="inline-flex text-red-500 hover:text-red-700"
                      aria-label={t("customer.documents.removeRow")}
                    >
                      <FiTrash />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={3}
                className="py-2 px-4 border-b border-gray-200 text-left"
              >
                <button
                  type="button"
                  onClick={addPendingRow}
                  className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium cursor-pointer bg-transparent border-0 p-0"
                >
                  <FiPlus className="shrink-0" />
                  <span>{t("customer.shared.addMore")}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!canUpload}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${
            canUpload
              ? "bg-[var(--p-blue)] cursor-pointer hover:opacity-95"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          <FiUpload className="text-lg" />
          {uploading
            ? t("customer.documents.uploading")
            : t("customer.documents.upload")}
        </button>
      </div>

      {uploadSuccess && (
        <div className="flex items-center text-green-600 mt-3 transition-opacity duration-500 text-sm">
          <FiCheckCircle className="mr-2 shrink-0" />
          {successMessage || t("customer.documents.uploadSuccess")}
        </div>
      )}

      <div className="mt-6">
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">{t("customer.documents.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse border border-gray-200">
              <thead>
                <tr className="text-left">
                  <th className={thClass}>{t("customer.documents.titleCol")}</th>
                  <th className={thClass}>{t("customer.documents.fileCol")}</th>
                  <th className={thClass}>{t("customer.documents.uploadedCol")}</th>
                  <th className={`${thClass} w-[100px] text-center`}>
                    {t("customer.documents.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.fileId} className="bg-white">
                    <td className={tdClass}>
                      <span className="text-sm text-gray-900 font-medium truncate block max-w-[220px]">
                        {doc.title || doc.fileName}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className="text-sm text-gray-600 truncate block max-w-[260px]">
                        {doc.fileName &&
                        doc.title &&
                        doc.title !== doc.fileName
                          ? doc.fileName
                          : doc.fileName || "—"}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className="text-sm text-gray-500">
                        {t("customer.documents.uploadedBy", {
                          user: resolveUploadedBy(doc.uploadedBy),
                          date: formatDate(doc.dateUploaded, false, true),
                        })}
                      </span>
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <div className="inline-flex items-center justify-center gap-3">
                        {doc.fileURL ? (
                          <button
                            type="button"
                            onClick={() => handleView(doc.fileURL)}
                            className="inline-flex text-gray-500 hover:text-gray-800"
                            aria-label={t("customer.documents.view")}
                            title={t("customer.documents.view")}
                          >
                            <FiEye size={16} />
                          </button>
                        ) : null}
                        {doc.downloadURL ? (
                          <button
                            type="button"
                            className="inline-flex text-gray-500 hover:text-gray-800"
                            onClick={() => handleDownload(doc.downloadURL)}
                            aria-label={t("customer.documents.download")}
                            title={t("customer.documents.download")}
                          >
                            <FiDownload size={16} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="inline-flex text-red-500 hover:text-red-700"
                          onClick={() => confirmDelete(doc.fileId)}
                          aria-label={t("customer.documents.removeRow")}
                          title={t("customer.documents.removeRow")}
                        >
                          <FiTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default DocumentUpload;
