import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiFile, FiX, FiEye, FiDownload } from 'react-icons/fi';
import axios from 'axios';
import { notifyError, notifySuccess } from '@/utils/toast';
import request from '@/services/httpService';

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentUpload = ({ 
  contractId, 
  documents = [], 
  onDocumentsChange, 
  allowMultiple = true,
  acceptedTypes = ".pdf,.doc,.docx,.png,.jpg,.jpeg",
  maxSizeMB = 10,
  contractType = "sales" // "sales" or "purchase"
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Save documents to backend when contractId changes and documents have valid URLs
  useEffect(() => {
    if (contractId && documents.length > 0) {
      // Only save if documents have valid URLs (not empty strings)
      const validDocuments = documents.filter(doc => doc.url && doc.url.trim() !== '');
      if (validDocuments.length > 0) {
        saveDocumentsToBackend(validDocuments);
      }
    }
  }, [contractId, documents]);

  const saveDocumentsToBackend = async (docsToSave = documents) => {
    try {
      const endpoint = contractType === "sales" 
        ? `/sales-contracts/initial-documents/${contractId}`
        : `/purchase-contracts/initial-documents/${contractId}`;
      
      await request.put(endpoint, { documents: docsToSave });
    } catch (error) {
      console.error("Error saving documents to backend:", error);
      // Don't show error to user as this is background operation
    }
  };

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    
    // Validate file types and sizes
    const validFiles = fileArray.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      const acceptedArray = acceptedTypes.split(',').map(type => type.trim());
      
      if (!acceptedArray.includes(fileExtension)) {
        notifyError(`File ${file.name} has an unsupported format. Accepted: ${acceptedTypes}`);
        return false;
      }
      
      if (file.size > maxSizeMB * 1024 * 1024) {
        notifyError(`File ${file.name} is too large. Maximum size: ${maxSizeMB}MB`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  };

  const uploadFiles = async (files) => {
    setUploading(true);
    const uploadedDocs = [];

    try {
      console.log('📤 Starting file upload:', { 
        fileCount: files.length, 
        contractId, 
        contractType,
        currentDocumentsCount: documents.length 
      });

      for (const file of files) {
        console.log('📄 Processing file:', { name: file.name, size: file.size, type: file.type });
        
        // If we have a contractId, save to document management system
        if (contractId) {
          console.log('✅ Contract ID exists, uploading to document system');
          const docInfo = await uploadToDocumentSystem(file);
          if (docInfo) {
            uploadedDocs.push(docInfo);
            console.log('✅ Document uploaded to system:', docInfo.name);
          } else {
            console.warn('⚠️ Document upload returned no info:', file.name);
          }
        } else {
          // If no contractId yet, just upload to temporary storage
          console.log('📤 No contract ID, uploading to temporary storage');
          const formData = new FormData();
          formData.append('image', file);

          try {
            // Base_URL already includes /api, so just use /upload
            const uploadUrl = `${Base_URL}/upload`;
            console.log('📤 Uploading to:', uploadUrl);
            const response = await axios.post(uploadUrl, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            console.log('📤 Upload response:', response.data);

            if (response.data && response.data.url) {
              const docInfo = {
                name: file.name,
                url: response.data.url,
                s3Key: response.data.s3Key, // Store s3Key for later use
                type: file.type,
                size: file.size,
                uploadedAt: new Date().toISOString(),
              };
              uploadedDocs.push(docInfo);
              console.log('✅ Document uploaded to temporary storage:', docInfo.name, 'URL:', docInfo.url.substring(0, 80) + '...');
            } else {
              console.error('❌ Upload response missing URL:', response.data);
              notifyError(`Failed to upload ${file.name}: No URL in response`);
            }
          } catch (uploadError) {
            console.error('❌ Error uploading file to temporary storage:', uploadError);
            console.error('Error details:', {
              message: uploadError.message,
              response: uploadError.response?.data,
              status: uploadError.response?.status,
            });
            notifyError(`Failed to upload ${file.name}: ${uploadError.response?.data?.message || uploadError.message}`);
          }
        }
      }

      console.log('📊 Upload summary:', { 
        uploadedCount: uploadedDocs.length, 
        totalFiles: files.length 
      });

      if (uploadedDocs.length > 0) {
        const newDocuments = allowMultiple ? [...documents, ...uploadedDocs] : uploadedDocs;
        console.log('💾 Updating documents state:', { 
          oldCount: documents.length, 
          newCount: newDocuments.length 
        });
        onDocumentsChange(newDocuments);
        notifySuccess(`${uploadedDocs.length} file(s) uploaded successfully`);
      } else if (contractId) {
        notifySuccess(`${files.length} file(s) uploaded and saved to documents`);
      } else {
        console.warn('⚠️ No documents were uploaded successfully');
        if (uploadedDocs.length === 0 && files.length > 0) {
          notifyError('Failed to upload files. Please check console for details.');
        }
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      notifyError('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const uploadToDocumentSystem = async (file) => {
    try {
      // Get contract details to get contract number and business
      const contractData = await getContractData();
      if (!contractData?.contractNo) {
        throw new Error('Contract number not found');
      }
      if (!contractData?.business) {
        throw new Error('Business ID not found');
      }

      // Build file path similar to DocumentsTable.jsx
      const item = contractType === "sales" 
        ? contractData?.productInfo?.[0]?.title || "Sales Contract"
        : contractData?.productInfo?.[0]?.title || "Purchase Contract";
      const year = new Date().getFullYear();
      const clientName = contractType === "sales"
        ? contractData?.basicInfo?.selectedCustomerId?.basicInformation?.customerDisplayName || "Customer"
        : contractData?.basicInfo?.selectedVendorId?.basicInformation?.vendorDisplayName || "Vendor";
      const contractTypePath = contractType === "sales" ? "Sales Contracts" : "Purchase Contracts";

      const filePath = `${item}/${year}/${contractType === "sales" ? "Customers" : "Vendors"}/${clientName}/${contractData.contractNo}/${contractTypePath}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_path', filePath); // Required for folder structure
      formData.append('business_id', contractData.business); // Required field
      
      // Only append customer_id if it exists and is valid
      const customerId = contractType === "sales" 
        ? contractData?.basicInfo?.selectedCustomerId?._id 
        : contractData?.basicInfo?.selectedVendorId?._id;
      
      if (customerId) {
        formData.append('customer_id', customerId);
      }
      
      formData.append('file_type', file.type);
      formData.append('file_size', file.size);
      formData.append('isContractDocument', 'true'); // Mark as contract document

      const response = await axios.post(`${Base_URL}/documents/uploadDocument`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Document uploaded to system:', response.data);

      // Get the file URL by calling getFileWithAllData
      if (response.data?.file?._id) {
        try {
          const fileDetailsResponse = await request.get(
            `/documents/getFileWithAllData/${response.data.file._id}`
          );
          
          if (fileDetailsResponse?.data?.data?.url) {
            // Return document info to be added to initialDocuments
            return {
              name: file.name,
              url: fileDetailsResponse.data.data.url,
              type: file.type,
              size: file.size,
              uploadedAt: new Date().toISOString(),
            };
          }
        } catch (urlError) {
          console.error('Error getting file URL:', urlError);
          // Fallback: use a placeholder URL that will be fetched later
          return {
            name: file.name,
            url: `${Base_URL}/documents/getFileWithAllData/${response.data.file._id}`,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          };
        }
      }

      // If we can't get the URL, still return document info
      // The URL will be fetched when needed
      return {
        name: file.name,
        url: '', // Will be fetched when needed
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error uploading to document system:', error);
      throw error;
    }
  };

  const getContractData = async () => {
    try {
      const endpoint = contractType === "sales" 
        ? `/sales-contracts/${contractId}`
        : `/purchase-contracts/${contractId}`;
      
      const response = await request.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Error fetching contract data:', error);
      return null;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeDocument = (index) => {
    const newDocuments = documents.filter((_, i) => i !== index);
    onDocumentsChange(newDocuments);
    notifySuccess('Document removed');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const iconClass = "text-xl";
    
    switch (extension) {
      case 'pdf':
        return <FiFile className={`${iconClass} text-red-500`} />;
      case 'doc':
      case 'docx':
        return <FiFile className={`${iconClass} text-blue-500`} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <FiFile className={`${iconClass} text-green-500`} />;
      default:
        return <FiFile className={`${iconClass} text-gray-500`} />;
    }
  };

  return (
    <div className="w-full">       

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={allowMultiple}
          accept={acceptedTypes}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <FiUpload className={`text-4xl ${dragOver ? 'text-green-500' : 'text-gray-400'}`} />
          
          {uploading ? (
            <div className="text-gray-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto mb-2"></div>
              Uploading files...
            </div>
          ) : (
            <>
              <div className="text-gray-600">
                <p className="font-medium">
                  {dragOver ? 'Drop files here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Accepted: {acceptedTypes} (Max: {maxSizeMB}MB each)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-700 mb-3">
            Uploaded Documents ({documents.length})
          </h4>
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(doc.name)}
                  <div>
                    <p className="font-medium text-gray-800 truncate max-w-xs">
                      {doc.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.size)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(doc.url, '_blank')}
                    className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                    title="View document"
                  >
                    <FiEye className="text-sm" />
                  </button>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = doc.url;
                      link.download = doc.name;
                      link.click();
                    }}
                    className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                    title="Download document"
                  >
                    <FiDownload className="text-sm" />
                  </button>
                  <button
                    onClick={() => removeDocument(index)}
                    className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                    title="Remove document"
                  >
                    <FiX className="text-sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
