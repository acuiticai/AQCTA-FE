"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { useLocation } from "react-router-dom"
import useBasicInfo from "../hooks/useBasicInfo"
import useButtonColor from "@/hooks/useButtonColor"
import { Form } from "@/page-layouts/index"
import { usePurchaseContext } from "../context/PurchaseContractContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

// Helper function to get current month in YYYY-MM format for min attribute
const getCurrentMonthMin = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const BasicInfo = ({ businesses, selectedBusiness, setSelectedBusiness, onSave, isEditMode = false }) => {
  const location = useLocation()
  const salesContractData = location.state?.salesContractData
  const creatingForSales = location.state?.creating_For_Sales

  const { handleCancel, handleSubmit, basicInfo, errors, setErrors, handleInputChange, isOpen } = useBasicInfo(onSave)
  const { contractId } = usePurchaseContext()
  
  // Determine if in edit mode (contractId exists or isEditMode prop is true)
  const isInEditMode = isEditMode || !!contractId
  
  // Add selectedBusiness to errors if not selected
  useEffect(() => {
    if (!selectedBusiness && errors.selectedBusiness) {
      // Error already set by hook
    } else if (selectedBusiness && errors.selectedBusiness) {
      // Clear error when business is selected
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.selectedBusiness;
        return newErrors;
      });
    }
  }, [selectedBusiness, errors.selectedBusiness, setErrors])
  const { setCommissionPerMTS } = usePurchaseContext();

  const [vendorsData, setVendorsData] = useState([])
  const [agentsData, setAgentsData] = useState([])
  const [salesData, setSalesData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const buttonColor = useButtonColor()

  // Auto-fill basic info from sales contract data
  useEffect(() => {
    if (creatingForSales && salesContractData) {
      console.log("Auto-filling from sales contract:", salesContractData)

      // Auto-fill business if available
      if (salesContractData.business) {
        setSelectedBusiness(salesContractData.business)
      }

      // Auto-fill ETD Port if available
      if (salesContractData.basicInfo?.ETD_Port) {
        handleInputChange({
          target: { name: "ETD_Port", value: salesContractData.basicInfo.ETD_Port },
        })
      }

      // Auto-fill agent information if available
      if (salesContractData.basicInfo?.agentName) {
        handleInputChange({
          target: { name: "agentName", value: salesContractData.basicInfo.agentName },
        })
      }

      if (salesContractData.basicInfo?.selectedAgentId) {
        handleInputChange({
          target: { name: "selectedAgentId", value: salesContractData.basicInfo.selectedAgentId },
        })
      }

      if (salesContractData.basicInfo?.commissionPerMTS) {
        handleInputChange({
          target: { name: "commissionPerMTS", value: salesContractData.basicInfo.commissionPerMTS },
        })
      }

      // Note: Supplier information is intentionally left empty as it will be different for purchase
    }
  }, [creatingForSales, salesContractData])

  const fetchAgents = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/vendors/Agents/${selectedBusiness}`)
      if (response.status === 200) {
        // Filter out inactive agents - only show Active agents
        const activeAgents = Array.isArray(response?.data?.data) 
          ? response.data.data.filter(agent => agent.status === "Active")
          : []
        setAgentsData(activeAgents)
      } else {
        console.error("Failed to fetch agents")
      }
    } catch (error) {
      console.error("❌ Error fetching agents:", error)
} finally {
      setIsLoading(false)
    }
  }

  const fetchSupplier = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/vendors/Supplier/${selectedBusiness}`)
      if (response.status === 200) {
        // Filter out inactive vendors - only show Active vendors
        const activeVendors = Array.isArray(response?.data?.data) 
          ? response.data.data.filter(vendor => vendor.status === "Active")
          : []
        setVendorsData(activeVendors)
      } else {
        console.error("Failed to fetch suppliers")
      }
    } catch (error) {
      console.error("❌ Error fetching suppliers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSalePersons = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/vendors/all/${selectedBusiness}`)
      if (response.status === 200) {
        setSalesData(response?.data?.data || [])
      } else {
        console.error("Failed to fetch sales data")
      }
    } catch (error) {
      console.error("❌ Error fetching sales data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedBusiness) {
      fetchAgents()
      fetchSupplier()
      fetchSalePersons()
    }
  }, [selectedBusiness])

  // auto-select vendorId if name matches
  useEffect(() => {
    if (
      vendorsData.length > 0 &&
      basicInfo.SupplierName &&
      (!basicInfo.selectedVendorId || basicInfo.selectedVendorId === "")
    ) {
      const matchedVendor = vendorsData.find((v) => v.basicInformation.vendorDisplayName === basicInfo.SupplierName)
      if (matchedVendor) {
        handleInputChange({
          target: { name: "selectedVendorId", value: matchedVendor._id },
        })
      }
    }
  }, [vendorsData, basicInfo.SupplierName])

  const handleBusinessChange = (value) => {
    setSelectedBusiness(value)
    // Clear error when business is selected
    if (value && errors.selectedBusiness) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.selectedBusiness;
        return newErrors;
      });
    }
  }

  const handleSupplierSelect = (value) => {
    const selectedSupplier = vendorsData.find((v) => v._id === value)
    if (selectedSupplier) {
      handleInputChange({
        target: { name: "selectedVendorId", value: selectedSupplier._id },
      })
      handleInputChange({
        target: {
          name: "SupplierName",
          value: selectedSupplier.basicInformation.vendorDisplayName || "",
        },
      })
    } else {
      handleInputChange({ target: { name: "selectedVendorId", value: "" } })
      handleInputChange({ target: { name: "SupplierName", value: "" } })
    }
  }

  const handleAgentSelect = (value) => {
    console.log("handle Agent Select value", value)
    const selectedAgent = agentsData.find((v) => v.basicInformation.vendorDisplayName === value)
    if (selectedAgent) {
      handleInputChange({
        target: { name: "selectedAgentId", value: selectedAgent._id },
      })
      handleInputChange({
        target: {
          name: "agentName",
          value: selectedAgent.basicInformation.vendorDisplayName || "",
        },
      })
    } else {
      handleInputChange({ target: { name: "selectedAgentId", value: "" } })
      handleInputChange({ target: { name: "agentName", value: "" } })
    }

    if (!value) {
      handleInputChange({
        target: {
          name: "commissionPerMTS",
          value: "",
        },
      })
    }
  }

  const handleETDPort = (value) => {
    if (value) {
      const minValue = getCurrentMonthMin();
      // Ensure value is not below minimum
      const finalValue = value < minValue ? minValue : value;
      handleInputChange({
        target: { name: "ETD_Port", value: finalValue },
      })
    }
  }

  const formFields = [
    {
      label: "Select Business",
      name: "selectedBusiness",
      type: "select",
      required: true,
      options: businesses.map((business) => ({
        label: business.name,
        value: business._id,
      })),
      onChange: handleBusinessChange,
      value: selectedBusiness,
      placeholder: "Select Business",
      error: errors.selectedBusiness,
      shouldShowError: !!errors.selectedBusiness,
      disabled: isInEditMode,
    },
    {
      label: "Supplier Name",
      name: "selectedVendorId",
      type: "select",
      required: true,
      options: vendorsData.map((vendor) => ({
        label: vendor.basicInformation.vendorDisplayName,
        value: vendor._id,
      })),
      onChange: handleSupplierSelect,
      value: basicInfo.selectedVendorId || "",
      placeholder: "Select Supplier",
      error: errors.selectedVendorId,
      shouldShowError: !!errors.selectedVendorId,
    },
    {
      label: "Agent Name",
      name: "agentName",
      type: "select",
      value: basicInfo.agentName || "",
      onChange: handleAgentSelect,
      placeholder: "Select Agent",
      disabled: isLoading,
      options: agentsData.map((agent) => ({
        label: agent.basicInformation.vendorDisplayName,
        value: agent.basicInformation.vendorDisplayName,
      })),
      error: errors.agentName,
      shouldShowError: !!errors.agentName,
    },
    ...(basicInfo.agentName
      ? [
          {
            label: "Agent Commission (P/MTS)",
            name: "commissionPerMTS",
            type: "number",
            required: false,
            placeholder: "e.g. 10",
            value: basicInfo.commissionPerMTS || "",
            onChange: (e) => {
              handleInputChange({
                target: { name: "commissionPerMTS", value: e.target.value },
              });
              setCommissionPerMTS(e.target.value);
            },
            error: errors.commissionPerMTS,
            shouldShowError: !!errors.commissionPerMTS,
          },
        ]
      : []),
    {
      type: "month",
      label: "ETD Port of Loading",
      name: "ETD_Port",
      placeholder: "MM/YYYY",
      required: true,
      value: basicInfo.ETD_Port,
      onChange: (e) => handleETDPort(e.target.value),
      error: errors.ETD_Port,
      shouldShowError: !!errors.ETD_Port,
      min: getCurrentMonthMin(), // Prevent selecting previous months
    },
  ]

  return (
    <div>
      {creatingForSales && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 font-medium">
            Creating Purchase Contract for Sales Contract: {salesContractData?.contractNo || "N/A"}
          </p>
          <p className="text-blue-600 text-sm">Some fields have been auto-filled from the sales contract data.</p>
        </div>
      )}

      <Form
        formFields={formFields}
        handleSubmit={handleSubmit}
        handleCancel={handleCancel}
        buttonColor={buttonColor}
        isOpen={isOpen}
      />
    </div>
  )
}

export default BasicInfo
