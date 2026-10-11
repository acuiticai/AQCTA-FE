import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifySuccess, notifyError } from "@/utils/toast";

const ContractContext = createContext(null);

export const ContractProvider = ({ children }) => {
  const [contractData, setContractData] = useState({
    businessId: "",
    basicInfo: [],
    productInfo: [],
    contractSales: [],
    contractShipment: [],
  });

  const [businesses, setBusinesses] = useState([]);

  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      setBusinesses(JSON.parse(storedBusinesses));
    }
  }, []);

  const updateContractData = (field, value) => {
    setContractData((prevData) => {
      let updatedValue = value;
      
      if (field === "basicInfo") {
        updatedValue = value.map((info) => ({
          ...info,
          contractNumber: info.contractNumber || "", 
        }));
      }

      const updatedData = { ...prevData, [field]: updatedValue };
      localStorage.setItem("contractData", JSON.stringify(updatedData));
      return updatedData;
    });
  };

  /** ✅ Fetch contract by ID (for edit mode) **/
  const fetchContract = async (contractId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/contracts/contract-by-id/${contractId}`
      );
      console.log("✅ Contract fetched:", response.data);
      setContractData(response.data);
    } catch (error) {
      console.error("❌ Error fetching contract:", error);
      notifyError("Failed to fetch contract.");
    }
  };

  /** ✅ Save or Update Contract **/
  const saveContract = async (contractId = null) => {
    try {
      if (!contractData.businessId || contractData.businessId.length !== 24) {
        notifyError("⚠️ Invalid Business ID. Please select a valid business.");
        return;
      }

      if (!contractData.basicInfo || contractData.basicInfo.length === 0) {
        notifyError("⚠️ Basic information is required");
        return;
      }

      const firstBasicInfo = contractData.basicInfo[0];

      if (!firstBasicInfo.contractNumber) {
        notifyError("⚠️ Contract Number is required");
        return;
      }

      const dataForApi = {
        businessId: contractData.businessId,
        basicInfo: {
          purchasingCompany: firstBasicInfo.purchasingCompany || "",
          supplierName: firstBasicInfo.supplierName || "",
          contractDate: firstBasicInfo.contractDate || "",
          contractNumber: firstBasicInfo.contractNumber || "",
        },
        productInfo: contractData.productInfo || [],
        contractSales: contractData.contractSales || [],
        contractShipment: contractData.contractShipment || [],
      };

      let response;
      if (contractId) {
        // ✅ UPDATE EXISTING CONTRACT
        response = await axios.put(
          `${Base_URL}/contracts/update-contract/${contractId}`,
          dataForApi
        );
        notifySuccess("Contract updated successfully!");
      } else {
        // ✅ CREATE NEW CONTRACT
        response = await axios.post(
          `${Base_URL}/contracts/add-contract`,
          dataForApi
        );
        notifySuccess("Contract saved successfully!");
      }

      console.log("✅ Contract saved/updated:", response.data);
    } catch (error) {
      console.error("❌ Error saving/updating contract:", error);
      const errorMessage = error.response?.data?.message || error.message;
      notifyError(`Failed to save contract: ${errorMessage}`);
    }
  };

  return (
    <ContractContext.Provider value={{ contractData, updateContractData, saveContract, fetchContract, businesses }}>
      {children}
    </ContractContext.Provider>
  );
};

export const useContractContext = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContractContext must be used within a ContractProvider");
  }
  return context;
};
