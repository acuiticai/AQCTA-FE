import React, { useState, useRef, useEffect } from "react";
import {
  AiOutlineClose,
  AiOutlineUpload,
  AiOutlinePlus,
  AiOutlineDownload,
} from "react-icons/ai";
import axios from "axios";
import * as XLSX from "xlsx";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddAccountType = ({ onClose, onSuccess, selectedOrg }) => {
  const [activeTab, setActiveTab] = useState("single"); // 'single' or 'import'
  const [formData, setFormData] = useState({
    bid: selectedOrg,
    accountHeader: "",
    name: "",
    code: "",
    description: "",
    status: true,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, bid: selectedOrg ?? prev.bid }));
  }, [selectedOrg]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.bid) newErrors.bid = "BID is required";
    if (!formData.accountHeader)
      newErrors.accountHeader = "Account Header is required";
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.code) newErrors.code = "Code is required";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${Base_URL}/account-types`, formData);
      onSuccess();
    } catch (error) {
      console.error("Error creating account type:", error);
      if (error.response && error.response.data) {
        setErrors({
          form: error.response.data.message || "Failed to create account type",
        });
      } else {
        setErrors({ form: "Failed to create account type. Try again later." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Add Account Type</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <AiOutlineClose size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("single")}
            className={`px-4 py-2 font-medium ${
              activeTab === "single"
                ? "border-b-2 border-lime-500 text-lime-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <AiOutlinePlus size={16} />
              Single Entry
            </div>
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`px-4 py-2 font-medium ${
              activeTab === "import"
                ? "border-b-2 border-lime-500 text-lime-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <AiOutlineUpload size={16} />
              Bulk Import
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "single" ? (
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {errors.form && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                  {errors.form}
                </div>
              )}

              {/* Account Header */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="col-span-1">
                  Account Header <span className="text-red-500">*</span>
                </label>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="accountHeader"
                    value={formData.accountHeader}
                    onChange={handleChange}
                    placeholder="Enter account header"
                    className={`w-full p-2 bg-gray-100 rounded border ${
                      errors.accountHeader
                        ? "border-red-500"
                        : "border-gray-200"
                    }`}
                  />
                  {errors.accountHeader && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.accountHeader}
                    </p>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="col-span-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full p-2 bg-gray-100 rounded border ${
                      errors.name ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                  )}
                </div>
              </div>

              {/* Code */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="col-span-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    className={`w-full p-2 bg-gray-100 rounded border ${
                      errors.code ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                  {errors.code && (
                    <p className="text-red-500 text-xs mt-1">{errors.code}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="col-span-1">Description</label>
                <div className="col-span-2">
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-100 rounded border border-gray-200"
                    rows="3"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="col-span-1">Status</label>
                <div className="col-span-2 flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="status"
                      className="sr-only peer"
                      checked={formData.status}
                      onChange={handleChange}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {formData.status ? "Active" : "Inactive"}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-lime-500 text-white rounded hover:bg-lime-600 disabled:bg-lime-300"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <ImportAccountTypesTab
            onClose={onClose}
            onSuccess={onSuccess}
            selectedOrg={selectedOrg}
          />
        )}
      </div>
    </div>
  );
};

// Import Tab Component
const ImportAccountTypesTab = ({ onClose, onSuccess, selectedOrg }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const fileType = selectedFile.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(fileType)) {
      setErrors(["Please select a CSV or Excel file (.csv, .xlsx, .xls)"]);
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    parseFile(selectedFile);
  };

  const parseFile = (file) => {
    setIsProcessing(true);
    const fileType = file.name.split(".").pop().toLowerCase();

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let data = [];

        if (fileType === "csv") {
          // Parse CSV
          const text = e.target.result;
          const lines = text.split("\n").filter((line) => line.trim());
          if (lines.length < 2) {
            setErrors([
              "File must contain at least a header row and one data row",
            ]);
            setIsProcessing(false);
            return;
          }

          const headers = lines[0]
            .split(",")
            .map((h) => h.trim().replace(/"/g, ""));
          data = lines.slice(1).map((line) => {
            const values = line
              .split(",")
              .map((v) => v.trim().replace(/"/g, ""));
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = values[index] || "";
            });
            return obj;
          });
        } else {
          // Parse Excel (.xlsx, .xls)
          const workbook = XLSX.read(e.target.result, { type: "binary" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convert to JSON
          data = XLSX.utils.sheet_to_json(worksheet, {
            raw: false, // Get formatted strings instead of raw values
            defval: "", // Default value for empty cells
          });

          if (data.length === 0) {
            setErrors(["File must contain at least one data row"]);
            setIsProcessing(false);
            return;
          }
        }

        processData(data);
        setIsProcessing(false);
      } catch (error) {
        console.error("Parse error:", error);
        setErrors([`Error parsing file: ${error.message}`]);
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrors(["Error reading file"]);
      setIsProcessing(false);
    };

    // Read file based on type
    if (fileType === "csv") {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const processData = (data) => {
    const validationErrors = [];
    const processedData = [];
    const seenCodes = new Set();

    data.forEach((row, index) => {
      const rowNumber = index + 2;

      // Skip completely empty rows
      const isEmpty =
        !row.accountHeader &&
        !row["Account Header"] &&
        !row.name &&
        !row["Name"] &&
        !row.code &&
        !row["Code"];

      if (isEmpty) {
        return; // Skip this row
      }

      let code = (row.code || row["Code"] || "").trim();
      let description = (row.description || row["Description"] || "").trim();

      // Auto-detect and swap if code and description appear to be reversed
      // Code typically has pattern like ABC-123, while description is longer text
      const codePattern = /^[A-Z]{3,4}-\d{3,4}$/i;
      if (
        description &&
        codePattern.test(description) &&
        code &&
        !codePattern.test(code)
      ) {
        // Swap them
        [code, description] = [description, code];
      }

      const processedRow = {
        bid: selectedOrg,
        accountHeader: (
          row.accountHeader ||
          row["Account Header"] ||
          ""
        ).trim(),
        name: (row.name || row["Name"] || "").trim(),
        code: code,
        description: description,
        status:
          row.status === "true" ||
          row.status === "TRUE" ||
          row.status === true ||
          row.status === "Active" ||
          row["Status"] === "Active" ||
          row["Status"] === "TRUE" ||
          row["Status"] === "true" ||
          true,
        rowNumber,
      };

      const rowErrors = [];
      if (!processedRow.accountHeader) {
        rowErrors.push("Account Header is required");
      }

      if (!processedRow.name) rowErrors.push("Name is required");
      if (!processedRow.code) {
        rowErrors.push("Code is required");
      } else if (seenCodes.has(processedRow.code)) {
        rowErrors.push(`Duplicate code '${processedRow.code}' found in file`);
      } else {
        seenCodes.add(processedRow.code);
      }

      if (rowErrors.length > 0) {
        validationErrors.push(`Row ${rowNumber}: ${rowErrors.join(", ")}`);
      } else {
        processedData.push(processedRow);
      }
    });

    setErrors(validationErrors);
    setParsedData(processedData);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) return;

    setIsUploading(true);
    try {
      const dataToUpload = parsedData.map(({ rowNumber, ...rest }) => rest);

      const response = await axios.post(
        `${Base_URL}/account-types/bulk-import`,
        {
          accountTypes: dataToUpload,
        },
      );

      onSuccess();
    } catch (error) {
      console.error("Error uploading data:", error);
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        // Check if there are detailed errors array
        if (errorData.errors && Array.isArray(errorData.errors)) {
          setErrors(errorData.errors);
        } else {
          setErrors([errorData.message || "Failed to upload data"]);
        }
      } else {
        setErrors(["Failed to upload data. Please try again."]);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `accountHeader,name,code,description,status
Assets,Cash,ACC-001,Cash on hand and in bank,true
Liability,Accounts Payable,LIA-001,Amount owed to suppliers,true
Equity,Owner Capital,EQU-001,Owner investment in business,true
Income,Sales Revenue,INC-001,Revenue from sales,true
Expense,Office Supplies,EXP-001,Office supplies and materials,true
Expense,Utilities,EXP-002,Utility expenses,true`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "account_types_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
      {/* Template Download */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          Download Template
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          Download the CSV template with sample data to ensure proper
          formatting.
        </p>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          <AiOutlineDownload size={16} />
          Download Template
        </button>
      </div>

      {/* File Upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!file ? (
          <div>
            <AiOutlineUpload size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              Click to select a CSV or Excel file
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported formats: CSV, XLSX, XLS
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-lime-500 text-white rounded hover:bg-lime-600"
            >
              Select File
            </button>
          </div>
        ) : (
          <div>
            <p className="text-green-600 mb-2">✓ File selected: {file.name}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Choose Different File
            </button>
          </div>
        )}
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
          <p className="mt-2 text-gray-600">Processing file...</p>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-4 max-h-32 overflow-y-auto">
          <h3 className="text-sm font-medium text-red-800 mb-2">
            Validation Errors
          </h3>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Data Preview */}
      {parsedData.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <h3 className="text-sm font-medium text-green-800 mb-2">
            Data Preview ({parsedData.length} valid records)
          </h3>
          <div className="overflow-x-auto max-h-32">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-green-100">
                  <th className="px-2 py-1 text-left">Account Header</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Code</th>
                  <th className="px-2 py-1 text-left">Description</th>
                  <th className="px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.map((row, index) => (
                  <tr key={index} className="border-t border-green-200">
                    <td className="px-2 py-1">{row.accountHeader}</td>
                    <td className="px-2 py-1">{row.name}</td>
                    <td className="px-2 py-1">{row.code}</td>
                    <td className="px-2 py-1">{row.description}</td>
                    <td className="px-2 py-1">
                      {row.status ? "Active" : "Inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Required Fields Info */}
      <div className="bg-gray-50 border border-gray-200 rounded p-4">
        <h3 className="text-sm font-medium text-gray-800 mb-2">
          Required Fields
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">accountHeader:</span> Any text value
            (required)
          </p>
          <p>
            <span className="font-medium">name:</span> Account type name
            (required)
          </p>
          <p>
            <span className="font-medium">code:</span> Unique account code
            (required)
          </p>
          <p>
            <span className="font-medium">description:</span> Optional
            description
          </p>
          <p>
            <span className="font-medium">status:</span> true/false or
            Active/Inactive (defaults to true)
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={parsedData.length === 0 || errors.length > 0 || isUploading}
          className="px-4 py-2 bg-lime-500 text-white rounded hover:bg-lime-600 disabled:bg-lime-300"
        >
          {isUploading ? "Uploading..." : `Upload ${parsedData.length} Records`}
        </button>
      </div>
    </div>
  );
};

export default AddAccountType;
