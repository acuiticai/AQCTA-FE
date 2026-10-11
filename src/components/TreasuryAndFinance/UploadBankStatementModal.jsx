import React, { useState, useEffect, useRef } from "react";
import { FiX, FiUpload } from "react-icons/fi";
import axios from "axios";
import useAsync from "@/hooks/useAsync";
import BankManagementServices from "@/services/BankManagementServices";
import { notifyError } from "@/utils/toast";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { readAssignedBusinessesFallback } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const UploadBankStatementModal = ({ onClose, onSuccess }) => {
  const { data } = useAsync(BankManagementServices.getAllAccounts);

  const bankAccounts = data?.accounts || [];
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const list = readAssignedBusinessesFallback();
      setBusinesses(list);
      if (list.length === 1) {
        setSelectedBusiness(String(list[0]._id));
      }
    } catch (error) {
      console.error("Failed to fetch businesses:", error);
      notifyError("Failed to load businesses");
    }
  };

  const isValidFileType = (file) => {
    const name = (file.name || "").toLowerCase();
    return (
      name.endsWith(".csv") ||
      name.endsWith(".txt") ||
      name.endsWith(".xls") ||
      name.endsWith(".xlsx")
    );
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!isValidFileType(selectedFile)) {
        notifyError("Please upload a CSV, TXT or Excel file");
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!isValidFileType(droppedFile)) {
        notifyError("Please upload a CSV, TXT or Excel file");
        return;
      }
      setFile(droppedFile);
      setFileName(droppedFile.name);
    }
  };

  const handleDropzoneClick = () => {
    // Programmatically click the hidden file input when dropzone is clicked
    fileInputRef.current.click();
  };

  const handleCloseModal = (e) => {
    // Close modal when clicking outside the modal content
    if (e.target.classList.contains("modal-overlay")) {
      onClose();
    }
  };

  const handleEscapeKey = (e) => {
    // Close modal when pressing Escape key
    if (e.key === "Escape") {
      onClose();
    }
  };

  useEffect(() => {
    // Add event listener for Escape key
    document.addEventListener("keydown", handleEscapeKey);

    // Cleanup event listener
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const handleUpload = async () => {
    if (!file) {
      notifyError("Please select a file to upload");
      return;
    }

    if (!selectedAccount) {
      notifyError("Please select a bank account");
      return;
    }

    if (!selectedBusiness) {
      notifyError("Please select a business");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("statement", file);
      formData.append("account", selectedAccount);
      formData.append("business", selectedBusiness);

      const response = await axios.post(
        `${Base_URL}/bank-statements/import`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setLoading(false);
      // Hand the real import result up so the parent can report an honest count
      // (imported X of Y) rather than a blanket "uploaded".
      onSuccess(response.data);
    } catch (error) {
      setLoading(false);
      console.error("Failed to upload bank statement:", error);
      notifyError(
        error.response?.data?.message || "Failed to upload bank statement"
      );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay"
      onClick={handleCloseModal}
    >
      <div
        className="bg-white rounded-lg w-full max-w-lg mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        <div className="flex justify-between items-center border-b p-4 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">Upload Bank Statement</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <p className="text-gray-600 mb-6">
            Enter the details below to complete the process.
          </p>
          <SingleBusinessField
            selectedValue={selectedBusiness}
            onAutoSelect={(id) => setSelectedBusiness(String(id))}
          >
          <label className="block text-gray-600 mb-2">Select Business</label>
          <SearchableDropdown
            value={selectedBusiness}
            onChange={(e) => setSelectedBusiness(e.target.value)}
            placeholder="Select Business"
            searchPlaceholder="Search businesses..."
            options={businesses.map((business) => ({
              value: business._id,
              label: business?.name,
            }))}
          />
          </SingleBusinessField>

          <div className="mt-4">
            <div className="mb-4">
              <label className="block text-gray-600 mb-2">
                Relevant Bank Account
              </label>
              <SearchableDropdown
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                placeholder="Select Bank Account"
                searchPlaceholder="Search bank accounts..."
                options={
                  bankAccounts && bankAccounts?.length > 0
                    ? bankAccounts?.map((account) => ({
                        value: account._id,
                        label: `${account.iban} - ${account.accountName}`,
                      }))
                    : []
                }
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-gray-600 mb-2">Upload Statement</label>
            <div
              className={`border-2 border-dashed ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
              } rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-all duration-200`}
              onClick={handleDropzoneClick}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              role="button"
              tabIndex="0"
              aria-label="Upload file area. Click or drag and drop files here"
            >
              {!fileName ? (
                <div>
                  <FiUpload
                    className={`mx-auto h-10 w-10 sm:h-12 sm:w-12 ${
                      isDragging ? "text-blue-500" : "text-gray-400"
                    } mb-4 transition-colors duration-200`}
                  />
                  <p className="text-sm text-gray-500 mb-2">
                    Choose File or Drag & Drop
                  </p>
                  <p className="text-xs text-gray-400">
                    (CSV, TXT or Excel — .csv, .txt, .xls, .xlsx)
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">
                    {fileName}
                  </p>
                  <button
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the file input click
                      setFile(null);
                      setFileName("");
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                type="file"
                accept=".csv,.txt,.xls,.xlsx"
                className="hidden"
                id="file-upload"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              className="flex-1 py-3 rounded-md font-medium text-center border border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className={`flex-1 py-3 rounded-md font-medium text-center ${
                loading
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-[var(--p-blue)] hover:bg-opacity-90 text-white"
              }`}
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? "Uploading..." : "Upload Statement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadBankStatementModal;
