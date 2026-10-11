import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { FiDownload, FiUpload } from "react-icons/fi";
import { CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Above nested CustomModal forms (default stack ~20001) */
const IMPORT_MODAL_Z_INDEX = 21000;

/**
 * @param {'parse'|'append'|'list-append'} mode - parse: return rows to parent; append: add to campaign; list-append: add to saved list
 */
const BroadcastImportModal = ({
  open,
  onClose,
  onRecipientsParsed,
  announcementId,
  listId,
  mode = "parse",
  adminToken,
}) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setImportResult(null);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/broadcasts/import/recipients-template`,
        {
          responseType: "blob",
          headers: adminToken ? { authorization: `Bearer ${adminToken}` } : {},
        },
      );
      const blob = new Blob([response.data], {
        type:
          response.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = "marketing_announcement_recipients_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObj);
      notifySuccess("Template downloaded");
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to download template");
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    const ext = selectedFile.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      notifyError("Please select a CSV or Excel file");
      return;
    }
    setFile(selectedFile);
    setImportResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      notifyError("Please select a file");
      return;
    }

    setIsUploading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const url =
        mode === "list-append" && listId
          ? `${Base_URL}/broadcasts/lists/${listId}/members/import`
          : mode === "append" && announcementId
            ? `${Base_URL}/broadcasts/${announcementId}/recipients/import`
            : `${Base_URL}/broadcasts/recipients/parse`;

      const response = await axios.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}),
        },
      });

      setImportResult(response.data);

      if (mode === "append" || mode === "list-append") {
        const { added = 0, skipped = 0, failed = 0 } = response.data;
        if (added > 0) {
          const parts = [`Added ${added} recipient(s)`];
          if (skipped > 0) parts.push(`skipped ${skipped} duplicate(s)`);
          notifySuccess(parts.join(", "));
          onRecipientsParsed?.(null, response.data);
          onClose();
        } else if (skipped > 0 && failed === 0) {
          notifySuccess(
            mode === "list-append"
              ? `All ${skipped} row(s) were already on this list — no changes made.`
              : `All ${skipped} row(s) were already on this campaign — no changes made.`,
          );
          onRecipientsParsed?.(null, response.data);
          onClose();
        } else {
          notifyError("No recipients were added. Check errors.");
        }
        return;
      }

      const recipients = response.data.recipients || [];
      if (recipients.length > 0) {
        notifySuccess(`Loaded ${recipients.length} recipient(s)`);
        onRecipientsParsed?.(recipients, response.data);
        onClose();
      } else {
        notifyError("No valid recipients in file");
      }
    } catch (error) {
      notifyError(error.response?.data?.error || "Import failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title="Import recipients"
      width="560px"
      zIndex={IMPORT_MODAL_Z_INDEX}
      showActions
      confirmText="Import recipients"
      savingText="Importing…"
      loading={isUploading}
      onConfirm={handleUpload}
      disabled={isUploading}
      actions={[
        {
          label: "Cancel",
          secondary: true,
          onClick: onClose,
          disabled: isUploading,
        },
        {
          label: isUploading ? "Importing…" : "Import recipients",
          primary: true,
          onClick: handleUpload,
          disabled: isUploading,
        },
      ]}
    >
      <p className="text-sm text-gray-600 mb-4">
        Upload a CSV or Excel file with one row per person. Columns:{" "}
        <strong>Name</strong>, <strong>WhatsApp Number</strong>, and/or{" "}
        <strong>Email</strong>.
        {mode === "append" || mode === "list-append" ? (
          <>
            {" "}
            Contacts already on this {mode === "list-append" ? "list" : "campaign"} are
            skipped automatically.
          </>
        ) : null}
      </p>

      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-5 mb-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50"
          >
            <FiDownload /> Download template
          </button>
          <span className="text-xs text-gray-400">or</span>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--p-blue)] text-white rounded-lg text-sm cursor-pointer hover:opacity-90">
            <FiUpload />
            {file ? file.name : "Choose file"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
        {file && (
          <p className="text-xs text-center text-gray-500 mt-3">
            Ready to import — click <strong>Import recipients</strong> below.
          </p>
        )}
      </div>

      {importResult && (
        <div className="text-sm border rounded-lg p-3 bg-gray-50">
          {mode === "append" || mode === "list-append" ? (
            <p>
              Added: {importResult.added ?? 0} · Skipped duplicates:{" "}
              {importResult.skipped ?? 0} · Failed: {importResult.failed ?? 0}
              {mode === "list-append"
                ? ` · Total now: ${importResult.memberCount ?? "—"}`
                : ` · Total now: ${importResult.recipientCount ?? "—"}`}
            </p>
          ) : (
            <p>
              Parsed: {importResult.recipients?.length ?? 0} · Failed:{" "}
              {importResult.failed ?? 0}
            </p>
          )}
          {importResult.errors?.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-red-600 list-disc pl-4">
              {importResult.errors.map((err, idx) => (
                <li key={idx}>
                  Row {err.row}: {err.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CustomModal>
  );
};

export default BroadcastImportModal;
