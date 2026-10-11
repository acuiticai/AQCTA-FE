import React, { useState, useContext } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { AdminContext } from '../context/AdminContext';
import axios from 'axios';
import { notifySuccess, notifyError } from '../utils/toast';
import { FiUpload, FiFile, FiArrowLeft } from 'react-icons/fi';

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const UploadSignedDocument = () => {
  const { contractId } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [contractData, setContractData] = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  React.useEffect(() => {
    const fetchContractData = async () => {
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts/${contractId}`, { headers });
        setContractData(response.data);
      } catch (error) {
        console.error("Error fetching contract data:", error);
        notifyError("Failed to load contract data");
      } finally {
        setLoading(false);
      }
    };

    if (contractId) {
      fetchContractData();
    }
  }, [contractId]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check if file is PDF
      if (selectedFile.type !== 'application/pdf') {
        notifyError("Please select a PDF file");
        return;
      }
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        notifyError("File size should be less than 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      notifyError("Please select a file to upload");
      return;
    }

    setUploading(true);
    try {
      // First upload the file to get the document URL
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'signed-contracts');

      const uploadResponse = await axios.post(`${Base_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      if (uploadResponse.data?.data) {
        const documentData = uploadResponse.data.data;
        
        // Now update the contract with the signed document
        const updateResponse = await axios.put(
          `${Base_URL}/sales-contracts/upload-signed-document/${contractId}`,
          {
            document_url: documentData.s3Key,
            document_id: documentData._id,
          },
          { headers }
        );

        if (updateResponse.data?.status) {
          notifySuccess("Signed document uploaded successfully! Contract status updated to 'Approval waiting'");
          // Redirect back or to a success page
          setTimeout(() => {
            history.push('/');
          }, 2000);
        } else {
          notifyError("Failed to update contract status");
        }
      } else {
        notifyError("Failed to upload file");
      }
    } catch (error) {
      console.error("Error uploading signed document:", error);
      notifyError("Failed to upload signed document");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <button
              onClick={() => history.goBack()}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900"
            >
              <FiArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Upload Signed Contract
            </h1>
          </div>
          
          {contractData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">
                Contract Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Contract No:</span>
                  <span className="ml-2 text-gray-900">{contractData.contractNo}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Customer:</span>
                  <span className="ml-2 text-gray-900">{contractData.basicInfo?.finalCustomerName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="ml-2 text-gray-900">{contractData.status}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(contractData.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upload Signed Document
          </h2>
          
          <div className="space-y-6">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <FiFile className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">
                  {file ? file.name : "Select your signed contract"}
                </p>
                <p className="text-sm text-gray-500">
                  Upload the signed PDF document (max 10MB)
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  <FiUpload className="mr-2 h-4 w-4" />
                  Choose File
                </label>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">
                Instructions:
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Please ensure the document is signed by all required parties</li>
                <li>• Only PDF files are accepted</li>
                <li>• Maximum file size: 10MB</li>
                <li>• After upload, the contract status will be updated to "Approval waiting"</li>
              </ul>
            </div>

            {/* Upload Button */}
            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white ${
                  !file || uploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                }`}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <FiUpload className="mr-2 h-4 w-4" />
                    Upload Signed Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadSignedDocument; 