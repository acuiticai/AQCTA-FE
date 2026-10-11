import { useState, useEffect } from "react";
import request from "@/services/httpService";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import { usePurchaseContext } from "../context/PurchaseContractContext";
import { useHistory } from "react-router-dom";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
export const contractNumberGenerate = (
  entityNumber,
  itemCode,
  runningNumber = 1003
) => {
  const year = new Date().getFullYear().toString().slice(-2);
  const entity = entityNumber.toString().padStart(2, "0");
  const randomIncrement = Math.floor(Math.random() * 1000) + 1;

  const incrementedRunningNumber = runningNumber + randomIncrement;
  const running = incrementedRunningNumber.toString().padStart(4, "0");

  const contractNumber = `PC${year}${entity}-${itemCode}${running}`;
  return contractNumber;
};

const submitBasicInfoData = async (data) => {
  console.log(data);
  const response = await request.post("/purchase-contracts", data);
  return response;
};

const initialState = {
  // typeOfSaleContract: "",
  // salesPerson: "",
  // buyerCompanyName: "",
  // agentName: "",
  // finalCustomerName: "",

};

function useBasicInfo(onSave, documents = []) {
  const [basicInfo, setBasicInfo] = useState({});
  const { selectedBusiness, setSelectedBusiness, contractId, setContractId, setCommissionPerMTS } = usePurchaseContext();
  const [isOpen, setIsOpen] = useState(true);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const history = useHistory();


  // Helper function to get current month in YYYY-MM format
  const getCurrentMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  // Auto-fill Contract Date, Supplier Contract Date, and ETD_Port with today's date/month when creating a new contract
  useEffect(() => {
    if (!contractId) {
      const today = new Date().toISOString().split("T")[0];
      const currentMonth = getCurrentMonth();
      setBasicInfo((prevState) => ({
        ...prevState,
        contractDate: !prevState.contractDate ? today : prevState.contractDate,
        supplierContractDate: !prevState.supplierContractDate ? today : prevState.supplierContractDate,
        ETD_Port: !prevState.ETD_Port ? currentMonth : prevState.ETD_Port,
      }));
    }
  }, [contractId]);

  useEffect(() => {
    const fetchContractData = async () => {
      if (!contractId) return;

      setIsLoading(true);
      try {
        const response = await request.get(`/purchase-contracts/${contractId}`);
        const { basicInfo: contractBasicInfo, business } = response;

        // Fix: transform selectedVendorId from object to string ID
        const normalizedBasicInfo = {
          ...contractBasicInfo,
          selectedVendorId:
            contractBasicInfo?.selectedVendorId?._id || "",  // <-- extract ID here
          SupplierName:
            contractBasicInfo?.selectedVendorId?.basicInformation?.vendorDisplayName ||
            "",
        };

        // If ETD_Port is empty/null/undefined when editing, set to current month to prevent previous month default
        if (!normalizedBasicInfo.ETD_Port || normalizedBasicInfo.ETD_Port === "") {
          normalizedBasicInfo.ETD_Port = getCurrentMonth();
        }

        setBasicInfo(normalizedBasicInfo);
        if (normalizedBasicInfo.commissionPerMTS) {
          setCommissionPerMTS(normalizedBasicInfo.commissionPerMTS);
        }

        if (business) {
          setSelectedBusiness(business);
        }
      } catch (error) {
        console.error("Error fetching contract:", error);
        notifyError("Error loading contract data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchContractData();
  }, [contractId, setSelectedBusiness, setCommissionPerMTS]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Log the update for debugging
    console.log("Updating field:", name, "with value:", value);

    setBasicInfo((prevState) => ({
      ...prevState,
      [name]: value,
    }));

    // Clear error for this field if it has a value
    if (value) {
      setErrors((prevErrors) => ({
        ...prevErrors,
        [name]: "",
      }));
    }
  };
  const handleSubmit = async () => {
    console.log("handleSubmit")
    const newErrors = {};

    // Validate selectedBusiness (from context)
    if (!selectedBusiness) {
      newErrors.selectedBusiness = "This field is required";
    }

    // Define required fields
    const requiredFields = ["selectedVendorId", "ETD_Port", "supplierContractDate"];

    // Validate required fields
    requiredFields.forEach((field) => {
      if (!basicInfo[field] || basicInfo[field] === "") {
        newErrors[field] = "This field is required";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Validate supplierContractNo uniqueness if provided
    if (basicInfo.supplierContractNo && basicInfo.supplierContractNo.trim() !== "") {
      try {
        const checkSupplierNoResponse = await request.get(
          `/purchase-contracts?businessId=${selectedBusiness}`
        );
        const existingContracts = checkSupplierNoResponse?.contracts || checkSupplierNoResponse?.data || [];
        const contractWithSameSupplierNo = existingContracts.find(
          (contract) =>
            contract.basicInfo?.supplierContractNo?.trim() === basicInfo.supplierContractNo.trim() &&
            contract._id !== contractId
        );
        if (contractWithSameSupplierNo) {
          newErrors.supplierContractNo = "A contract with this Supplier Contract No. already exists for this business.";
          setErrors(newErrors);
          return;
        }
      } catch (checkError) {
        console.error("Error checking supplierContractNo uniqueness:", checkError);
        // Continue with submission if check fails (backend will validate)
      }
    }

    // Clear all errors if validation passes
    setErrors({});

    try {
      const data = {
        basicInfo,
      };
      console.log("handleSubmit data", data)

      if (contractId) {
        await request.put(`/purchase-contracts/${contractId}`, data);
        console.log("handleSubmit contractId", contractId)
        notifySuccess("Purchase Contract Updated Successfully");
        // showPopup("success", "Purchase Contract Updated Successfully!", () => {})
      } else {
        // Contract number will be generated on backend
        data.business = selectedBusiness;
        // If creating from a Sales, include salesContractId collected in BasicInfo_Sales
        if (basicInfo?.salesContractId) {
          data.salesContractId = basicInfo.salesContractId;
        }
        const responseData = await submitBasicInfoData(data);
        console.log("handleSubmit responseData", responseData)
        notifySuccess("Purchase Contract Basic Info Saved");
        // showPopup("success", "Purchase Contract Basic Info Saved!", () => {})
        setBasicInfo(initialState);
        console.log("Calling Purchase Contract: ", contractId);

        // Save documents to the document management system
        console.log('📄 Checking documents before saving:', { 
          documentsCount: documents.length, 
          documents: documents.map(d => ({ name: d.name, hasUrl: !!d.url }))
        });
        
        if (documents && documents.length > 0) {
          console.log('💾 Saving documents to system...');
          await saveDocumentsToSystem(responseData?._id, responseData?.contractNo);
        } else {
          console.warn('⚠️ No documents to save - documents array is empty');
        }

        onSave(responseData?._id);
      }
      console.log("handleSubmit end")
    } catch (error) {
      // Handle uniqueness validation errors from backend
      if (error.response?.data?.error?.includes("Supplier Contract No. already exists")) {
        setErrors((prev) => ({
          ...prev,
          supplierContractNo: "A contract with this Supplier Contract No. already exists for this business.",
        }));
        return;
      }
      notifyError(
        contractId
          ? "Error updating contract"
          : "Error saving Purchase Contract Basic Info"
      );
      console.log("Error : ", error);
    }
  };

  const saveDocumentsToSystem = async (contractId, contractNo) => {
    try {
      console.log('📄 Starting to save documents to system:', { contractId, contractNo, documentCount: documents.length });
      
      if (!documents || documents.length === 0) {
        console.log('⚠️ No documents to save');
        return;
      }

      // Get the full contract data to build the file path
      const contractResponse = await request.get(`/purchase-contracts/${contractId}`);
      const contractData = contractResponse.data;

      const savedDocuments = [];

      for (const doc of documents) {
        console.log('📄 Processing document:', { name: doc.name, url: doc.url?.substring(0, 50) + '...' });
        
        let fileUrl = doc.url;
        let fileToUpload = null;

        // Check if this is an S3 URL from temporary upload (needs to be saved to document system)
        // S3 URLs from /upload endpoint contain 'barena-docs.s3' or 's3.amazonaws.com' or 'AWSAccessKeyId'
        const isS3TemporaryUrl = doc.url && (
          doc.url.includes('barena-docs.s3') || 
          doc.url.includes('s3.amazonaws.com') ||
          doc.url.includes('AWSAccessKeyId') // S3 signed URL indicator
        );

        // Check if already in document system (has document ID in URL or is from document system)
        const isInDocumentSystem = doc.url && (
          doc.url.includes('/documents/getFileWithAllData') ||
          doc.url.includes('/documents/')
        );

        // If it's an S3 temporary URL, we need to upload it to document system to create DB entry
        if (isS3TemporaryUrl && !isInDocumentSystem) {
          try {
            console.log('📥 Fetching S3 document to upload to document system...');
            const response = await fetch(doc.url);
            if (!response.ok) {
              throw new Error(`Failed to fetch document: ${response.statusText}`);
            }
            const blob = await response.blob();
            fileToUpload = new File([blob], doc.name, { type: doc.type || blob.type });
            console.log('✅ Document fetched from S3 successfully');
          } catch (fetchError) {
            console.error('❌ Error fetching document from S3:', fetchError);
            // If we can't fetch, use the S3 URL directly (fallback)
            console.warn('⚠️ Using S3 URL directly as fallback:', doc.name);
            savedDocuments.push({
              name: doc.name,
              url: doc.url,
              type: doc.type,
              size: doc.size,
              uploadedAt: doc.uploadedAt || new Date().toISOString(),
            });
            continue;
          }
        } else if (isInDocumentSystem || (doc.url && doc.url.trim() !== '' && !isS3TemporaryUrl)) {
          // Document already in system or has a valid non-S3 URL, use it directly
          console.log('✅ Document already in system or has valid URL, using existing URL');
          savedDocuments.push({
            name: doc.name,
            url: doc.url,
            type: doc.type,
            size: doc.size,
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          });
          continue;
        } else {
          // No URL, skip this document
          console.warn('⚠️ Document has no URL, skipping:', doc.name);
          continue;
        }

        if (fileToUpload) {
          // Build file path similar to DocumentsTable.jsx
          const item = contractData?.productInfo?.[0]?.title || "Purchase Contract";
          const year = new Date().getFullYear();
          const vendorName = contractData?.basicInfo?.selectedVendorId?.basicInformation?.vendorDisplayName || "Vendor";
          const filePath = `${item}/${year}/Vendors/${vendorName}/${contractNo}/Purchase Contracts`;

          console.log('📤 Uploading document to system:', { filePath, fileName: doc.name });

          const formData = new FormData();
          formData.append('file', fileToUpload);
          formData.append('file_path', filePath); // Required for folder structure
          formData.append('business_id', selectedBusiness); // Required field
          
          // Only append customer_id if it exists and is valid
          const vendorId = contractData?.basicInfo?.selectedVendorId?._id;
          if (vendorId) {
            formData.append('customer_id', vendorId);
          }
          
          formData.append('file_type', fileToUpload.type);
          formData.append('file_size', fileToUpload.size);
          formData.append('isContractDocument', 'true'); // Mark as contract document

          console.log('📤 FormData prepared:', {
            hasFile: fileToUpload instanceof File,
            fileName: fileToUpload.name,
            fileSize: fileToUpload.size,
            fileType: fileToUpload.type,
            filePath,
            businessId: selectedBusiness
          });

          // Use axios directly for file uploads as request service might not handle FormData correctly
          const uploadResponse = await axios.post(`${Base_URL}/documents/uploadDocument`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          console.log('📤 Upload response:', uploadResponse?.data);

          // Get the file URL
          if (uploadResponse?.data?.file?._id) {
            try {
              const fileDetailsResponse = await request.get(
                `/documents/getFileWithAllData/${uploadResponse.data.file._id}`
              );
              
              if (fileDetailsResponse?.data?.data?.url) {
                fileUrl = fileDetailsResponse.data.data.url;
                console.log('✅ Got file URL from document system');
              }
            } catch (urlError) {
              console.error('❌ Error getting file URL:', urlError);
            }
          }

          savedDocuments.push({
            name: doc.name,
            url: fileUrl,
            type: doc.type,
            size: doc.size,
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          });
          
          console.log('✅ Document saved to system:', doc.name);
        }
      }

      // Save document metadata to contract's initialDocuments
      if (savedDocuments.length > 0) {
        console.log('💾 Saving documents to contract initialDocuments:', savedDocuments.length);
        const saveResponse = await request.put(`/purchase-contracts/initial-documents/${contractId}`, {
          documents: savedDocuments,
        });
        console.log('✅ Documents saved to contract:', saveResponse);
      } else {
        console.warn('⚠️ No documents to save to contract initialDocuments');
      }

      console.log(`✅ Successfully saved ${savedDocuments.length} out of ${documents.length} documents to system and contract`);
    } catch (error) {
      console.error('❌ Error saving documents to system:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Don't show error to user as the contract was already created successfully
    }
  };

  const handleCancel = () => {
    setBasicInfo(initialState);
    setErrors({});
    setSelectedBusiness("");
    setContractId("");
    history.push("/purchase_contracts");
  };

  return {
    handleCancel,
    handleSubmit,
    handleInputChange,
    basicInfo,
    errors,
    setErrors,
    isOpen,
    setIsOpen,
    isLoading,
  };
}

export default useBasicInfo;
