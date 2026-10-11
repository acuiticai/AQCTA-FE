import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiDownload, FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';
import { notifyError, notifySuccess } from '@/utils/toast';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@windmill/react-ui';

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemsCSVImport = ({ open, onClose, onSuccess, businesses = [] }) => {
  const [file, setFile] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Auto-select business if only one is available
  useEffect(() => {
    if (businesses.length === 1 && !selectedBusiness) {
      setSelectedBusiness(businesses[0]._id);
    }
  }, [businesses, selectedBusiness]);

  // Reset state when modal closes so it's fresh when reopened
  useEffect(() => {
    if (!open) {
      setFile(null);
      setSelectedBusiness("");
      setImportResult(null);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  const handleDownloadTemplate = async () => {
    // Require business selection before downloading template
    if (!selectedBusiness) {
      notifyError("Please select a business first to download template with tax classes");
      return;
    }

    try {
      // Always include businessId in query
      const url = `${Base_URL}/items/csv/sample?businessId=${selectedBusiness}`;
      
      console.log("Downloading template with businessId:", selectedBusiness);
      
      const response = await axios.get(url, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = 'items_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObj);
      notifySuccess("Template downloaded successfully with tax classes!");
    } catch (error) {
      console.error("Error downloading template:", error);
      notifyError(error.response?.data?.message || "Failed to download template");
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const fileType = selectedFile.name.split('.').pop().toLowerCase();
    const allowedTypes = ['csv', 'xlsx', 'xls'];
    
    if (!allowedTypes.includes(fileType)) {
      notifyError("Please select a CSV or Excel file (CSV, XLSX, or XLS)");
      return;
    }

    setFile(selectedFile);
    setImportResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      notifyError("Please select a CSV or Excel file");
      return;
    }

    if (!selectedBusiness) {
      notifyError("Please select a business");
      return;
    }

    setIsUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('business', selectedBusiness);

      const response = await axios.post(`${Base_URL}/items/csv/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult(response.data);
      
      if (response.data.success > 0) {
        notifySuccess(`Successfully imported ${response.data.success} item(s)!`);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        notifyError("No items were imported. Please check the errors.");
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      notifyError(error.response?.data?.message || "Failed to import items from CSV");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setSelectedBusiness("");
    setImportResult(null);
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={handleClose}>
      <ModalHeader>Import Items from CSV</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          {/* Business Selection - Must be selected first */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Business <span className="text-red-500">*</span>
              {businesses.length === 1 && (
                <span className="text-xs text-gray-500 ml-2">(Auto-selected)</span>
              )}
            </label>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isUploading || businesses.length === 1}
            >
              <option value="">Select Business</option>
              {businesses.map((business) => (
                <option key={business._id} value={business._id}>
                  {business.name}
                </option>
              ))}
            </select>
            {businesses.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No businesses available. Please contact administrator.</p>
            )}
          </div>

          {/* Download Template Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Step 1: Download Excel Template</h3>
            <p className="text-sm text-blue-700 mb-3">
              {selectedBusiness 
                ? "Download the Excel template (.xlsx) with dropdowns for tax classes, units, and types. Tax classes will be pre-filled for the selected business."
                : "Please select a business above to download template with available tax classes."}
            </p>
            <button
              onClick={handleDownloadTemplate}
              disabled={isUploading || !selectedBusiness}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiDownload size={16} />
              Download Excel Template {selectedBusiness ? "" : "(Select Business First)"}
            </button>
            {selectedBusiness && (
              <p className="text-xs text-blue-600 mt-2">
                ✓ Excel file includes dropdowns for: Category, Type, Unit, Tax Classes (Sales & Purchase), and Enable Inventory
              </p>
            )}
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Step 2: Upload CSV/Excel File <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                file
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              } ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              
              {!file ? (
                <div>
                  <FiUpload className="mx-auto text-4xl text-gray-400 mb-3" />
                  <p className="text-gray-600 mb-2">Click to select a CSV or Excel file</p>
                  <p className="text-sm text-gray-500">Supported formats: CSV, XLSX, XLS</p>
                </div>
              ) : (
                <div>
                  <FiCheckCircle className="mx-auto text-3xl text-green-500 mb-2" />
                  <p className="text-green-600 font-medium mb-2">✓ File selected: {file.name}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      fileInputRef.current.value = '';
                    }}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 mx-auto"
                  >
                    <FiX size={14} />
                    Remove file
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Upload Status */}
          {isUploading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">Uploading and processing file...</p>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                {importResult.success > 0 ? (
                  <FiCheckCircle className="text-green-500 text-xl" />
                ) : (
                  <FiAlertCircle className="text-red-500 text-xl" />
                )}
                <h3 className="font-medium text-gray-800">
                  Import Results: {importResult.success} successful, {importResult.failed} failed
                </h3>
              </div>

              {importResult.successItems && importResult.successItems.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-green-700 mb-1">Successfully imported:</p>
                  <div className="max-h-32 overflow-y-auto text-sm text-gray-600">
                    {importResult.successItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <FiCheckCircle className="text-green-500 text-xs" />
                        <span>Row {item.row}: {item.name} ({item.itemCode})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">Errors:</p>
                  <div className="max-h-32 overflow-y-auto text-sm text-red-600">
                    {importResult.errors.map((error, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <FiAlertCircle className="text-red-500 text-xs mt-0.5" />
                        <span>{error.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {importResult ? 'Close' : 'Cancel'}
          </button>
          {!importResult && (
            <button
              onClick={handleUpload}
              disabled={!file || !selectedBusiness || isUploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Import Items'}
            </button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default ItemsCSVImport;
