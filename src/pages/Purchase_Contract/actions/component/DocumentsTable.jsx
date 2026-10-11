import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FiEye,
  FiTrash2,
  FiDownload,
  FiMail,
  FiUpload,
  FiCheckCircle,
  FiLoader,
} from "react-icons/fi";
import ConfirmationModal from "../../../Customer/reusablecomponents/ConfirmationModalFile";
import { notifySuccess, notifyError } from "@/utils/toast";
import { formatDate, formatTime } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DocumentUpload = ({ Data }) => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);

  // New: modal for name + file
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  // Proper state for isContractDocument
  const [isContractDocument, setIsContractDocument] = useState(true);

  const UPLOAD_API_URL = `${Base_URL}/documents/uploadDocument`;
  const GET_FILES_API_URL = `${Base_URL}/documents/get_all_by_sales/${Data.contractNo}`;
  const DELETE_FILE_API_URL = `${Base_URL}/documents/files/`;
  const RENAME_FILE_API_URL = `${Base_URL}/documents/files/rename/`;

  const [sendEmailLoadingId, setSendEmailLoadingId] = useState(null);
  const [sendEmailModal, setSendEmailModal] = useState({
    open: false,
    file: null,
  });
  const [toEmail, setToEmail] = useState("");
  const [ccEmails, setCcEmails] = useState([]);
  const [bccEmails, setBccEmails] = useState([]);
  const [availableEmails, setAvailableEmails] = useState([]);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [ccEmailError, setCcEmailError] = useState("");
  const normalizeEmail = (value) => (value || "").trim().toLowerCase();

  const openSendEmailModal = (file) => {
    // Get vendor email and key contact emails
    const vendor = Data?.basicInfo?.selectedVendorId;
    const vendorEmail = vendor?.basicInformation?.vendorEmail;
    const keyContacts = vendor?.keyContacts || [];

    // Build available emails list with labels
    const available = [];
    if (vendorEmail && vendorEmail.trim() !== "") {
      available.push({
        email: vendorEmail,
        label: `${
          vendor?.basicInformation?.vendorDisplayName || "Vendor"
        } (Primary)`,
        type: "vendor",
      });
    }

    keyContacts.forEach((contact, idx) => {
      if (contact.email && contact.email.trim() !== "") {
        available.push({
          email: contact.email,
          label: `${contact.name || `Contact ${idx + 1}`} - ${
            contact.designation || ""
          }`,
          type: "contact",
        });
      }
    });

    setAvailableEmails(available);
    setToEmail(available.find((a) => a.type === "vendor")?.email || available[0]?.email || "");
    setCcEmails([]);
    setBccEmails([]);
    setToInput("");
    setCcInput("");
    setBccInput("");
    setCcEmailError("");
    setSendEmailModal({ open: true, file });
  };

  const closeSendEmailModal = () => {
    setSendEmailModal({ open: false, file: null });
    setToEmail("");
    setCcEmails([]);
    setBccEmails([]);
    setToInput("");
    setCcInput("");
    setBccInput("");
    setCcEmailError("");
  };

  const isAlreadySelectedElsewhere = (email, target) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    if (target !== "to" && normalizeEmail(toEmail) === normalized) return true;
    if (target !== "cc" && ccEmails.map(normalizeEmail).includes(normalized)) return true;
    if (target !== "bcc" && bccEmails.map(normalizeEmail).includes(normalized)) return true;
    return false;
  };

  const addRecipient = (target, rawEmail) => {
    const email = normalizeEmail(rawEmail);
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setCcEmailError(`Invalid email format: ${rawEmail}`);
      return;
    }
    if (isAlreadySelectedElsewhere(email, target)) {
      setCcEmailError(`Email already selected in another field: ${email}`);
      return;
    }
    setCcEmailError("");
    if (target === "to") {
      setToEmail(email);
      setToInput("");
      return;
    }
    if (target === "cc") {
      if (!ccEmails.map(normalizeEmail).includes(email)) setCcEmails((prev) => [...prev, email]);
      setCcInput("");
      return;
    }
    if (target === "bcc") {
      if (!bccEmails.map(normalizeEmail).includes(email)) setBccEmails((prev) => [...prev, email]);
      setBccInput("");
    }
  };

  const removeRecipient = (target, email) => {
    if (target === "cc") setCcEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
    if (target === "bcc") setBccEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
  };

  const getSuggestedContacts = (target, inputValue) => {
    const q = (inputValue || "").trim().toLowerCase();
    return availableEmails
      .filter((item) => !isAlreadySelectedElsewhere(item.email, target))
      .filter((item) =>
        !q
          ? true
          : item.email.toLowerCase().includes(q) ||
            item.label.toLowerCase().includes(q)
      )
      .slice(0, 8);
  };

  const handleSendEmail = async () => {
    if (!sendEmailModal.file) return;

    if (!toEmail) {
      setCcEmailError("Please select at least one To email");
      return;
    }

    // Validate all selected emails
    const allRecipients = [toEmail, ...ccEmails, ...bccEmails];
    const invalid = allRecipients.find((e) => !EMAIL_REGEX.test(normalizeEmail(e)));
    if (invalid) {
      setCcEmailError(`Invalid email: ${invalid}`);
      return;
    }
    if (new Set(allRecipients.map(normalizeEmail)).size !== allRecipients.length) {
      setCcEmailError("Duplicate emails found across To / CC / BCC");
      return;
    }

    try {
      setSendEmailLoadingId(sendEmailModal.file.fileId);
      const templateId =
        Data?.template_id || Data?.templateId || Data?.template?._id || "";
      await axios.put(
        `${Base_URL}/purchase-contracts/SendVendorEmailWithAttachment/${Data._id}`,
        {
          template_id: templateId,
          file_id: sendEmailModal.file.fileId,
          toEmail: normalizeEmail(toEmail),
          ccEmails: ccEmails.map(normalizeEmail),
          bccEmails: bccEmails.map(normalizeEmail),
        }
      );
      notifySuccess("Email sent to vendor.");
      closeSendEmailModal();
    } catch (err) {
      console.error(err);
      notifyError("Failed to send email.");
    } finally {
      setSendEmailLoadingId(null);
    }
  };

  useEffect(() => {
    fetchUploadedFiles();
  }, [Data.contractNo]);

  const fetchUploadedFiles = async () => {
    try {
      const response = await axios.get(GET_FILES_API_URL);
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

  const openUploadModal = () => {
    setUploadName("");
    setUploadFile(null);
    setIsContractDocument(true); // Reset to default when opening modal
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (isSubmittingUpload) return;
    setIsUploadModalOpen(false);
    setUploadName("");
    setUploadFile(null);
    setIsContractDocument(true);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    // if (!uploadName?.trim()) {
    //   notifyError("Please enter a document name");
    //   return;
    // }
    if (!uploadFile) {
      notifyError("Please select a file");
      return;
    }

    // Build form data
    const formData = new FormData();
    const item = Data?.productInfo?.[0]?.title;
    const vendorName =
      Data?.basicInfo?.selectedVendorId?.basicInformation?.vendorDisplayName;
    const year = new Date().getFullYear();

    formData.append(
      "file_path",
      `${item}/${year}/Vendors/${vendorName}/${Data.contractNo}/Purchase Contracts`
    );
    formData.append("business_id", Data?.business);
    formData.append("customer_id", Data?.basicInfo?.selectedVendorId?._id);
    formData.append("file_type", uploadFile.type);
    formData.append("file_size", uploadFile.size);
    formData.append("file", uploadFile);
    // Send isContractDocument to backend
    formData.append(
      "isContractDocument",
      isContractDocument ? "true" : "false"
    );

    setIsSubmittingUpload(true);
    setUploading(true);
    try {
      const res = await axios.post(UPLOAD_API_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.file) {
        let savedFile = res.data.file;
        // If a custom name was provided, rename the file record (and S3 key) to reflect it
        try {
          if (uploadName && savedFile?._id) {
            const renameRes = await axios.put(
              `${RENAME_FILE_API_URL}${savedFile._id}`,
              {
                newName: uploadName,
              }
            );
            if (renameRes.data?.file) {
              savedFile = renameRes.data.file;
            }
          }
          console.log("savedFile", savedFile);
          if (isContractDocument) {
            try {
              await axios.post(
                `${Base_URL}/purchase-contracts/ModifyDocument`,
                {
                  contractId: Data?._id,
                  document: savedFile,
                  fileId: savedFile?._id,
                  isContractDocument: true,
                }
              );
            } catch (attachErr) {
              console.error(
                "Error attaching document to purchase contract:",
                attachErr
              );
            }
          }
        } catch (renameErr) {
          console.error("Rename error:", renameErr);
          // Proceed without failing the whole flow
        }

        // Fetch the file with URLs to get view and download URLs
        try {
          const fileWithUrls = await axios.get(
            `${Base_URL}/documents/getFileWithAllData/${savedFile._id}`
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
              title: savedFile.name,
              dateUploaded: new Date().toLocaleString("en-GB"),
              uploadedBy: "You",
              fileURL: fileData.url,
              downloadURL: downloadURL,
              fileId: savedFile._id,
            },
          ]);
        } catch (urlError) {
          console.error("Error fetching file URLs:", urlError);
          // Fallback: add document without URLs (only delete will be available)
          setDocuments((prev) => [
            ...prev,
            {
              title: savedFile.name,
              dateUploaded: new Date().toLocaleString("en-GB"),
              uploadedBy: "You",
              fileURL: null,
              downloadURL: null,
              fileId: savedFile._id,
            },
          ]);
        }

        setUploadSuccess(true);
        setSuccessMessage(res.data.message || "File uploaded successfully!");
        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 2000);

        notifySuccess("File uploaded successfully");
        closeUploadModal();
      }
    } catch (err) {
      console.error("Upload error:", err);
      notifyError("File upload failed.");
    } finally {
      setIsSubmittingUpload(false);
      setUploading(false);
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
      {/* Upload Section */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">
          Uploaded Documents
        </h2>
        <div>
          <button
            type="button"
            onClick={openUploadModal}
            className={`inline-flex items-center px-4 py-2 rounded-md text-white ${
              uploading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[var(--p-blue)] hover:bg-[#7db535]"
            }`}
            disabled={uploading}
          >
            <FiUpload className="mr-2" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      {/* Success Alert */}
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
            documents.map((doc, idx) => (
              <tr key={idx} className="border-t border-gray-200">
                <td className="py-2 px-4">{doc.title}</td>
                <td className="py-2 px-4">{`${formatDate(
                  doc.dateUploaded
                )} ${formatTime(doc.dateUploaded)}`}</td>
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
                  <button
                    type="button"
                    className={`flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm ${
                      sendEmailLoadingId === doc.fileId
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                    onClick={() => openSendEmailModal(doc)}
                    disabled={sendEmailLoadingId === doc.fileId}
                  >
                    {sendEmailLoadingId === doc.fileId ? (
                      <>
                        <FiMail className="animate-spin" />
                      </>
                    ) : (
                      <>
                        <FiMail />
                      </>
                    )}
                  </button>
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

      {/* Upload Modal: Name + File */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50 transition-opacity duration-300">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 animate-fadeIn">
            <h2 className="text-lg font-semibold text-gray-800">
              Upload Document
            </h2>
            <form className="mt-4 space-y-4" onSubmit={handleUploadSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Enter document name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File
                </label>
                <input
                  id="modal-file-input"
                  type="file"
                  accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="modal-file-input"
                  className="flex items-center justify-between w-full border rounded-md px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-600 truncate">
                    {uploadFile ? uploadFile.name : "Choose file..."}
                  </span>
                  <span className="ml-3 inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm">
                    Browse
                  </span>
                </label>
              </div>
              <div>
                <label className="inline-flex items-center mt-1">
                  <input
                    type="checkbox"
                    checked={isContractDocument}
                    onChange={(e) => setIsContractDocument(e.target.checked)}
                    className="form-checkbox h-4 w-4 text-[var(--p-blue)] border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    This is a contract document
                  </span>
                </label>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  onClick={closeUploadModal}
                  disabled={isSubmittingUpload}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-md text-white ${
                    isSubmittingUpload
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[var(--p-blue)] hover:bg-[#7db535]"
                  }`}
                  disabled={isSubmittingUpload}
                >
                  {isSubmittingUpload ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {sendEmailModal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50 transition-opacity duration-300">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[500px] animate-fadeIn">
            <h2 className="text-lg font-semibold text-gray-800">
              Send Email to Vendor
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              This will send the selected file as an email attachment with a
              sign link.
            </p>
            <div className="mt-4 text-sm">
              <div className="text-gray-700">
                <strong>File:</strong> {sendEmailModal.file?.title}
              </div>
            </div>

            {/* To */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={toInput || toEmail}
                  onChange={(e) => {
                    setToInput(e.target.value);
                    setCcEmailError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient("to", toInput || toEmail);
                    }
                  }}
                  autoComplete="off"
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  placeholder="Type email or select contact..."
                />
                {getSuggestedContacts("to", toInput).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getSuggestedContacts("to", toInput).map((item, idx) => (
                      <button
                        key={`${item.email}-${idx}`}
                        type="button"
                        onClick={() => addRecipient("to", item.email)}
                        className="px-2 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200"
                      >
                        {item.label} ({item.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CC */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CC
              </label>
              <div className="border rounded-md p-2 min-h-[60px] mb-2 bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {ccEmails.map((email, idx) => (
                    <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-[var(--p-blue)] text-white">
                      {email}
                      <button type="button" onClick={() => removeRecipient("cc", email)} className="ml-2 hover:text-red-200">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => {
                    setCcInput(e.target.value);
                    setCcEmailError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient("cc", ccInput);
                    }
                  }}
                  autoComplete="off"
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  placeholder="Add CC email"
                />
                {getSuggestedContacts("cc", ccInput).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getSuggestedContacts("cc", ccInput).map((item, idx) => (
                      <button
                        key={`${item.email}-${idx}`}
                        type="button"
                        onClick={() => addRecipient("cc", item.email)}
                        className="px-2 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200"
                      >
                        {item.label} ({item.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BCC */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BCC
              </label>
              <div className="border rounded-md p-2 min-h-[60px] mb-2 bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {bccEmails.map((email, idx) => (
                    <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-[var(--p-blue)] text-white">
                      {email}
                      <button type="button" onClick={() => removeRecipient("bcc", email)} className="ml-2 hover:text-red-200">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={bccInput}
                  onChange={(e) => {
                    setBccInput(e.target.value);
                    setCcEmailError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient("bcc", bccInput);
                    }
                  }}
                  autoComplete="off"
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  placeholder="Add BCC email"
                />
                {getSuggestedContacts("bcc", bccInput).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getSuggestedContacts("bcc", bccInput).map((item, idx) => (
                      <button
                        key={`${item.email}-${idx}`}
                        type="button"
                        onClick={() => addRecipient("bcc", item.email)}
                        className="px-2 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200"
                      >
                        {item.label} ({item.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {ccEmailError && (
                <div className="text-red-500 text-xs mt-1">{ccEmailError}</div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                onClick={closeSendEmailModal}
                disabled={sendEmailLoadingId === sendEmailModal.file?.fileId}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-md text-white ${
                  sendEmailLoadingId === sendEmailModal.file?.fileId
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[var(--p-blue)] hover:bg-[#7db535]"
                }`}
                onClick={handleSendEmail}
                disabled={sendEmailLoadingId === sendEmailModal.file?.fileId}
              >
                {sendEmailLoadingId === sendEmailModal.file?.fileId
                  ? "Sending..."
                  : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
