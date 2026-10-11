import { useState, useEffect } from "react";
import request from "@/services/httpService";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import { useSalesContext } from "../context/SalesContractContext";
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

  const contractNumber = `S${year}${entity}-${itemCode}${running}`;
  return contractNumber;
};

const submitBasicInfoData = async (data) => {
  console.log(data);
  const response = await request.post("/sales-contracts", data);
  return response;
};

// Helper function to get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to get current month in YYYY-MM format
const getCurrentMonth = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// Function to get initial state with current date
const getInitialState = () => ({
  typeOfSaleContract: "",
  salesPerson: "",
  buyerCompanyName: "",
  ETD_Port: getCurrentMonth(), // Auto-fill with current month/year to prevent previous month default
  bankAccount: "",
  selectedBankId: "",
  port_of_loading: "",
  port_of_discharge: "",
  origin_country: "",
  finalCustomerName: "",
  selectedFinalCustomerId: "",
  finalCustomerId: "",
  salesContractNumberByFirstCustomer: "",
  ref: "",
  contractCreationDate: getCurrentDate(), // Auto-fill with current date
  contractDate: "",
  agentName: "",
  selectedAgentId: "",
  commissionPerMTS: "",
});

function useBasicInfo(onSave, documents = []) {
  const [basicInfo, setBasicInfo] = useState(getInitialState());
  const [errors, setErrors] = useState({});
  const { selectedBusiness, setSelectedBusiness, contractId, setContractId } =
    useSalesContext();
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const history = useHistory();

  useEffect(() => {
    console.log("🔄 basicInfo state changed:", basicInfo);
  }, [basicInfo]);

  useEffect(() => {
    const fetchContractData = async () => {
      if (!contractId) return;

      setIsLoading(true);
      try {
        const response = await request.get(`/sales-contracts/${contractId}`);
        const { basicInfo: contractBasicInfo = {}, business } = response;
        console.log("🧾 Contract fetch response:", response);
        console.log("📦 Contract basicInfo:", contractBasicInfo);

        if (response?.bankInfo) {
          if (response.bankInfo.accountName) {
            contractBasicInfo.bankAccount = response.bankInfo.accountName;
          }

          if (response.bankInfo._id) {
            contractBasicInfo.selectedBankId = response.bankInfo._id;
          }
        }
        if (response?.Account_Info) {
          contractBasicInfo.bankAccount =
            response?.Account_Info.accountName || "";
          contractBasicInfo.selectedBankId =
            response?.Account_Info.bankAccount || ""; // ← this is the bank ID
        }
        console.log("📦 Final basicInfo before set:", contractBasicInfo);

        // Ensure all fields are properly set
        const updatedBasicInfo = { ...getInitialState(), ...contractBasicInfo };
        
        // If ETD_Port is empty/null/undefined when editing, set to current month to prevent previous month default
        if (!updatedBasicInfo.ETD_Port || updatedBasicInfo.ETD_Port === "") {
          updatedBasicInfo.ETD_Port = getCurrentMonth();
        }
        
        console.log("📦 Updated basicInfo to set:", updatedBasicInfo);

        setBasicInfo(updatedBasicInfo);

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
  }, [contractId, setSelectedBusiness]);

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
    } else {
      // Set error only for required fields
      const requiredFields = [
        "typeOfSaleContract",
        "salesPerson",
        "buyerCompanyName",
        "ETD_Port",
        "port_of_loading",
        "port_of_discharge",
        "origin_country",
        "contractCreationDate",
        "contractDate",
      ];

      // Additional required fields for Profit Sharing
      if (basicInfo.typeOfSaleContract === "Profit Sharing") {
        if (
          name === "finalCustomerName" ||
          name === "salesContractNumberByFirstCustomer"
        ) {
          setErrors((prevErrors) => ({
            ...prevErrors,
            [name]: "This field is required for Profit Sharing contracts",
          }));
        }
      }

      // Set error for other required fields
      if (requiredFields.includes(name)) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: "This field is required",
        }));
      }
    }
  };
  const handleSubmit = async () => {
    const newErrors = {};

    // Validate selectedBusiness (from context)
    if (!selectedBusiness) {
      newErrors.selectedBusiness = "This field is required";
    }

    // Define required fields for all contract types
    const requiredFields = [
      "typeOfSaleContract",
      "salesPerson",
      "buyerCompanyName",
      "ETD_Port",
      "port_of_loading",
      "port_of_discharge",
      "origin_country",
      "contractCreationDate",
      "contractDate",
    ];

    // Validate required fields
    requiredFields.forEach((field) => {
      if (!basicInfo[field] || basicInfo[field] === "") {
        newErrors[field] = "This field is required";
      }
    });

    // Additional validation for Profit Sharing type
    if (basicInfo.typeOfSaleContract === "Profit Sharing") {
      if (!basicInfo.finalCustomerName) {
        newErrors.finalCustomerName =
          "Final Customer is required for Profit Sharing contracts";
      }
      if (!basicInfo.salesContractNumberByFirstCustomer) {
        newErrors.salesContractNumberByFirstCustomer =
          "Sales Contract Number by First Customer is required for Profit Sharing contracts";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Validate ref uniqueness if provided
    if (basicInfo.ref && basicInfo.ref.trim() !== "") {
      try {
        const checkRefResponse = await request.get(
          `/sales-contracts?businessId=${selectedBusiness}&ref=${encodeURIComponent(basicInfo.ref.trim())}`
        );
        const existingContracts = checkRefResponse?.contracts || checkRefResponse?.data || [];
        const contractWithSameRef = existingContracts.find(
          (contract) =>
            contract.basicInfo?.ref?.trim() === basicInfo.ref.trim() &&
            contract._id !== contractId
        );
        if (contractWithSameRef) {
          newErrors.ref = "A contract with this REF already exists for this business.";
          setErrors(newErrors);
          return;
        }
      } catch (checkError) {
        console.error("Error checking ref uniqueness:", checkError);
        // Continue with submission if check fails (backend will validate)
      }
    }

    try {
      const data = {
        basicInfo,
      };

      console.log("🚀 Submitting basicInfo data:", data);
      console.log("🚀 Current basicInfo state:", basicInfo);

      if (contractId) {
        const response = await request.put(
          `/sales-contracts/${contractId}`,
          data
        );
        console.log("✅ Update response:", response);
        notifySuccess("Sales Contract Updated Successfully");
        // showPopup("success", "Sales Contract Updated Successfully!", () => {})
      } else {
        // Contract number will be generated on backend
        data.business = selectedBusiness;
        const responseData = await submitBasicInfoData(data);
        notifySuccess("Sales Contract Basic Info Saved");
        // showPopup("success", "Sales Contract Basic Info Saved!", () => {})
        setBasicInfo(getInitialState());
        console.log("Calling Sales Contract: ", contractId);

        // Save documents to the document management system
        console.log('📄 Checking documents before saving:', { 
          documentsCount: documents.length, 
          documents: documents.map(d => ({ name: d.name, hasUrl: !!d.url }))
        });
        
        if (documents && documents.length > 0) {
          console.log('💾 Saving documents to system...');
          await saveDocumentsToSystem(
            responseData?._id,
            responseData?.contractNo
          );
        } else {
          console.warn('⚠️ No documents to save - documents array is empty');
        }

        onSave(responseData?._id);
      }
    } catch (error) {
      console.error("❌ Error in handleSubmit:", error);
      // Handle uniqueness validation errors from backend
      if (error.response?.data?.error?.includes("REF already exists")) {
        setErrors((prev) => ({
          ...prev,
          ref: "A contract with this REF already exists for this business.",
        }));
        return;
      }
      notifyError(
        contractId
          ? "Error updating contract"
          : "Error saving Sales Contract Basic Info"
      );
      console.log("Error : ", error);
    }
  };

  const saveDocumentsToSystem = async (contractId, contractNo) => {
    try {
      // Get the full contract data to build the file path
      const contractResponse = await request.get(
        `/sales-contracts/${contractId}`
      );
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
          // Build file path similar to DocumentsTable.jsx pattern
          const item = contractData?.productInfo?.[0]?.title || "Sales Contract";
          const year = new Date().getFullYear();
          const customerName =
            contractData?.basicInfo?.selectedCustomerId?.basicInformation
              ?.customerDisplayName || "Customer";
          const filePath = `${item}/${year}/Customers/${customerName}/${contractNo}/Sales Contracts`;

          const formData = new FormData();
          formData.append("file", fileToUpload);
          formData.append("file_path", filePath); // Required for folder structure
          formData.append("business_id", selectedBusiness); // Required field

          // Only append customer_id if it exists and is valid
          const customerId = contractData?.basicInfo?.selectedCustomerId?._id;
          if (customerId) {
            formData.append("customer_id", customerId);
          }

          formData.append("file_type", fileToUpload.type);
          formData.append("file_size", fileToUpload.size);
          formData.append("isContractDocument", "true"); // Mark as contract document

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
              "Content-Type": "multipart/form-data",
            },
          });

          // Get the file URL
          if (uploadResponse?.data?.file?._id) {
            try {
              const fileDetailsResponse = await request.get(
                `/documents/getFileWithAllData/${uploadResponse.data.file._id}`
              );
              
              if (fileDetailsResponse?.data?.data?.url) {
                fileUrl = fileDetailsResponse.data.data.url;
              }
            } catch (urlError) {
              console.error('Error getting file URL:', urlError);
            }
          }

          savedDocuments.push({
            name: doc.name,
            url: fileUrl,
            type: doc.type,
            size: doc.size,
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          });
        }
      }

      // Save document metadata to contract's initialDocuments
      if (savedDocuments.length > 0) {
        await request.put(`/sales-contracts/initial-documents/${contractId}`, {
          documents: savedDocuments,
        });
      }

      console.log(`Successfully saved ${documents.length} documents to system and contract`);
    } catch (error) {
      console.error("Error saving documents to system:", error);
      // Don't show error to user as the contract was already created successfully
    }
  };

  const handleCancel = () => {
    setBasicInfo(getInitialState());
    setErrors({});
    setSelectedBusiness("");
    setContractId("");
    history.push("/sales");
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
