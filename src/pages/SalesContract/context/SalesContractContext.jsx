import React, { createContext, useState, useContext, useEffect } from "react";
import request from "@/services/httpService";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
// Create SalesContext
const SalesContext = createContext();
const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

// SalesContext Provider Component
export const SalesContractProvider = ({ children }) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {}; // Destructure and provide a fallback in case state is undefined

  // Check if adminInfo and adminInfo.token exist before constructing headers
  const headers = adminInfo?.token
    ? {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo.token}`,
    }
    : {
      "Content-Type": "application/json",
    };

  // States for the sales contract flow
  const [selectedOrganization, setSelectedOrganization] = useState(
    "677e06924894f890dc21d583"
  ); // To store the selected organization
  const [selectedBusiness, setSelectedBusiness] = useState();
  const [isMovingFurther, setIsMovingFurther] = useState(false); // To track if the user is proceeding further
  const [contractId, setContractId] = useState(null); // To store the sales contract ID
  const [businesses, setBusinesses] = useState([]); // State to store fetched businesses

  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    console.log("storedBusinesses", storedBusinesses)
    if (storedBusinesses) {
      const business = JSON.parse(storedBusinesses);
      setBusinesses(business);
    }
  }, []);

  return (
    <SalesContext.Provider
      value={{
        selectedOrganization,
        setSelectedOrganization,
        isMovingFurther,
        setIsMovingFurther,
        contractId,
        setContractId,
        businesses, // Provide the businesses state
        selectedBusiness,
        setSelectedBusiness,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};

// Custom hook to use the SalesContext
export const useSalesContext = () => {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error("useSalesContext must be used within a SalesProvider");
  }
  return context;
};
