"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import axios from "axios"
import { countries } from "countries-list"
import worldPorts from "@/data/world-ports"
import { Form } from "@/page-layouts/index"
import useBasicInfo from "../hooks/useBasicInfo"
import { useSalesContext } from "../context/SalesContractContext"
import DocumentUpload from "@/components/DocumentUpload"
import { FiBriefcase, FiHash, FiCalendar, FiFileText, FiUser, FiUsers, FiPercent, FiDollarSign, FiGlobe, FiMapPin, FiMap, FiCreditCard, FiLoader } from "react-icons/fi";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

// Helper function to get current month in YYYY-MM format for min attribute
const getCurrentMonthMin = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const BasicInfo = ({ businesses, selectedBusiness, setSelectedBusiness, onSave, isEditMode = false }) => {
  const { t } = useTranslation();
  // State declarations first
  const [customersData, setCustomersData] = useState([])
  const [agentsData, setAgentsData] = useState([])
  const [banksData, setBanksData] = useState([])
  const [salesData, setSalesData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [documents, setDocuments] = useState([])

  const { handleCancel, handleSubmit, basicInfo, Account_Info, errors, setErrors, handleInputChange, isOpen } =
    useBasicInfo(onSave, documents)
  const { contractId } = useSalesContext()
  
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
  console.log("businesses", businesses)
  // Track previous business to detect changes
  const prevBusinessRef = React.useRef(selectedBusiness)

  useEffect(() => {
    // Clear fields when business changes or is removed
    const businessChanged = prevBusinessRef.current !== selectedBusiness
    const businessRemoved = !selectedBusiness && prevBusinessRef.current
    
    if (businessChanged || businessRemoved) {
      // Clear relevant basicInfo fields when business changes or is removed
      if (prevBusinessRef.current) {
        handleInputChange({ target: { name: "buyerCompanyName", value: "" } })
        handleInputChange({ target: { name: "selectedCustomerId", value: "" } })
        handleInputChange({ target: { name: "salesPerson", value: "" } })
        handleInputChange({ target: { name: "selectedSalesId", value: "" } })
        handleInputChange({ target: { name: "bankAccount", value: "" } })
        handleInputChange({ target: { name: "selectedBankId", value: "" } })
        handleInputChange({ target: { name: "agentName", value: "" } })
        handleInputChange({ target: { name: "selectedAgentId", value: "" } })
        handleInputChange({ target: { name: "commissionPerMTS", value: "" } })
        handleInputChange({ target: { name: "finalCustomerName", value: "" } })
        handleInputChange({ target: { name: "selectedFinalCustomerId", value: "" } })
      }
      prevBusinessRef.current = selectedBusiness
    }

    if (selectedBusiness) {
      fetchCustomers()
      fetchAgents()
      fetchBanks()
      fetchSalePersons()
    } else {
      // Clear all data when business is removed
      setCustomersData([])
      setAgentsData([])
      setBanksData([])
      setSalesData([])
    }
  }, [selectedBusiness])

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/customers_by_business/${selectedBusiness}`)
      if (response.status === 200) {
        // Filter out inactive customers - only show Active customers
        const activeCustomers = Array.isArray(response?.data) 
          ? response.data.filter(customer => customer.status === "Active")
          : []
        setCustomersData(activeCustomers)
      } else {
        console.error("Failed to fetch customers")
      }
    } catch (error) {
      console.error("❌ Error fetching customers:", error)
    } finally {
      setIsLoading(false)
    }
  }
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

  const fetchBanks = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/bank-management/account/Bank Account/${selectedBusiness}`)
      if (response.status === 200) {
        console.log("Bank Account Response:", response.data)
        setBanksData(response?.data || []) // ✅ Ensure `data` exists
      } else {
        console.error("Failed to fetch agents")
      }
    } catch (error) {
      console.error("❌ Error fetching agents:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSalePersons = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/staff-management/sales_staff/${selectedBusiness}`)
      if (response.status === 200) {
        setSalesData(response?.data?.staffList || []) // ✅ Ensure `data` exists
      } else {
        console.error("Failed to fetch agents")
      }
    } catch (error) {
      console.error("❌ Error fetching agents:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCustomerSelect = (value) => {
    const selectedCustomer = customersData.find((customer) => customer.basicInformation.companyName === value)

    if (selectedCustomer) {
      handleInputChange({
        target: { name: "selectedCustomerId", value: selectedCustomer._id },
      })
      handleInputChange({
        target: {
          name: "buyerCompanyName",
          value: selectedCustomer.basicInformation.companyName || "",
        },
      })
      handleInputChange({
        target: {
          name: "finalCustomerName",
          value: selectedCustomer.basicInformation.customerDisplayName || "",
        },
      });

      console.log("Selected Customer:", selectedCustomer)
    }
  }

  const handleAgentSelect = (value) => {
    const selectedAgent = agentsData.find((agent) => agent.basicInformation.vendorDisplayName === value)

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

      console.log("Selected Agent:", selectedAgent)
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

      console.log("Selected ETD Port:", finalValue)
    }
  }

  const handleBankSelect = (value) => {
    const selectedBank = banksData.find((bank) => bank.accountName === value)
    console.log("selectedBank", selectedBank)
    if (selectedBank) {
      handleInputChange({
        target: { name: "selectedBankId", value: selectedBank._id },
      })
      handleInputChange({
        target: { name: "bankAccount", value: selectedBank.accountName || "" },
      })

      console.log("Selected Bank:", selectedBank)
    }
  }



  const handleSalesSelect = (value) => {
    const selectedSales_person = salesData.find((sales_person) => sales_person.displayName === value)

    if (selectedSales_person) {
      handleInputChange({
        target: { name: "selectedSalesId", value: selectedSales_person.displayName },
      })
      handleInputChange({
        target: {
          name: "salesPerson",
          value: selectedSales_person.displayName || "",
        },
      })

      console.log("Selected sales Person:", selectedSales_person)
    }
  }


  const formatDateToISO = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return ""; // invalid date
    return d.toISOString().split("T")[0];
  };



  useEffect(() => {
    console.log("Banks Loaded:", banksData);
    console.log("basicInfo:", basicInfo);
    // console.log("Loaded Contract ID:", contractId);
    // console.log("Fetched basicInfo from server:", contractBasicInfo);
    console.log("Banks Fetched:", banksData);
    console.log("Selected Bank ID:", basicInfo.selectedBankId);
    console.log("Mapped bankAccount:", basicInfo.bankAccount);

  }, [banksData, basicInfo]);



  useEffect(() => {
    if (!basicInfo.selectedBankId && basicInfo.bankAccount && banksData.length > 0) {
      const matched = banksData.find(
        (bank) => bank.accountName === basicInfo.bankAccount
      );
      if (matched) {
        console.log("🔁 Fallback matched bank by name:", matched);
        handleInputChange({
          target: {
            name: "selectedBankId",
            value: matched._id,
          },
        });
      }
    }
  }, [banksData, basicInfo.bankAccount]);

  const defaultTextFieldProps = (field) => {
    return {
      ...field,
      type: "text",
      name: field.name,
      value: basicInfo[field.name],
      onChange: handleInputChange,
      placeholder: field.label,
    }
  }

  const handleBusinessChange = (value) => {
    console.log("value", value)
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

  const handleContractCreationDateChange = (date) => {
    console.log("📅 Contract Creation Date changed:", date);
    handleInputChange({
      target: { name: "contractCreationDate", value: date }
    });
  };

  const handleContractDateChange = (date) => {
    console.log("📅 Contract Date changed:", date);
    handleInputChange({
      target: { name: "contractDate", value: date }
    });
  };

  const formFields = useMemo(() => [
    {
      label: t("sales.selectBusiness"),
      name: "selectedBusiness",
      type: "select",
      required: true,
      value: selectedBusiness || "",
      onChange: handleBusinessChange,
      placeholder: t("sales.selectABusiness"),
      options: businesses.map((business) => ({
        label: business.name,
        value: business._id,
        key: business._id,
      })),
      error: errors.selectedBusiness,
      shouldShowError: !!errors.selectedBusiness,
      disabled: isInEditMode,
      icon: <FiBriefcase />,
    },
    {
      label: t("sales.ref"),
      name: "ref",
      type: "text",
      required: false, // Make REF optional
      placeholder: t("sales.enterRef"),
      value: basicInfo.ref || "",
      onChange: handleInputChange,
      error: errors.ref,
      shouldShowError: !!errors.ref,
      disabled: isLoading,
      icon: <FiHash />,
    },
    {
      label: t("sales.contractCreationDate"),
      name: "contractCreationDate",
      type: "date",
      required: true,
      placeholder: t("sales.selectContractCreationDate"),
      value: basicInfo.contractCreationDate || "",
      onChange: handleContractCreationDateChange,
      error: errors.contractCreationDate,
      shouldShowError: !!errors.contractCreationDate,
      disabled: true, // Always disabled - auto-filled with current date
      icon: <FiCalendar />,
    },
    {
      label: t("sales.contractDate"),
      name: "contractDate",
      type: "date",
      required: true,
      placeholder: t("sales.selectContractDate"),
      value: basicInfo.contractDate || "",
      onChange: handleContractDateChange,
      error: errors.contractDate,
      shouldShowError: !!errors.contractDate,
      disabled: isLoading,
      icon: <FiCalendar />,
      className: "contract-date-field",
    },
    {
      label: t("sales.typeOfSaleContract"),
      name: "typeOfSaleContract",
      type: "select",
      required: true,
      defaultValue: basicInfo.typeOfSaleContract,
      onChange: (value) =>
        handleInputChange({
          target: { name: "typeOfSaleContract", value },
        }),
      error: errors.typeOfSaleContract,
      shouldShowError: !!errors.typeOfSaleContract,
      disabled: isLoading,
      value: basicInfo.typeOfSaleContract,
      placeholder: t("sales.selectTypeOfSaleContract"),
      options: [{
        label: t("salesContract.types.nominal", { defaultValue: "Nominal" }),
        value: 'Nominal',
        key: 'Nominal',
      },
      {
        label: t("salesContract.types.confirmed", { defaultValue: "Confirmed" }),
        value: 'Confirmed',
        key: 'Confirmed',
      },
      {
        label: t("salesContract.types.profitSharing", { defaultValue: "Profit Sharing" }),
        value: 'Profit Sharing',
        key: 'Profit Sharing',
      },
      ],
      icon: <FiFileText />,
    },

    {
      label: t("sales.salesPerson"),
      name: "salesPerson",
      type: "select",
      required: true,
      defaultValue: basicInfo.salesPerson,
      onChange: handleSalesSelect,
      error: errors.salesPerson,
      shouldShowError: !!errors.salesPerson,
      disabled: isLoading,
      value: basicInfo.salesPerson,
      placeholder: t("sales.selectSalesPerson"),
      options: salesData.map((sales_person) => ({
        label: sales_person.displayName,
        value: sales_person.displayName,
        key: sales_person.displayName,
      })),
      icon: <FiUser />,
    },
    {
      label: t("sales.buyerCompanyName"),
      name: "buyerCompanyName",
      type: "select",
      required: true,
      defaultValue: basicInfo.buyerCompanyName,
      onChange: handleCustomerSelect,
      error: errors.buyerCompanyName,
      shouldShowError: !!errors.buyerCompanyName,
      value: basicInfo.buyerCompanyName,
      disabled: isLoading,
      placeholder: t("sales.selectCustomer"),
      options: customersData.map((customer) => ({
        label: customer.basicInformation.companyName || customer.basicInformation.customerDisplayName,
        value: customer.basicInformation.companyName || customer.basicInformation.customerDisplayName,
        key: customer.basicInformation.companyName || customer.basicInformation.customerDisplayName,
      })),
      icon: <FiUsers />,
    },
    // New fields for Profit Sharing type
    ...(basicInfo.typeOfSaleContract === "Profit Sharing" ? [
      {
        label: t("salesContract.fields.finalCustomer", { defaultValue: "Final Customer" }),
        name: "finalCustomerName",
        type: "select",
        required: true,
        defaultValue: basicInfo.finalCustomerName,
        onChange: (value) => {
          const selectedCustomer = customersData.find((customer) => customer.basicInformation.companyName === value)
          if (selectedCustomer) {
            handleInputChange({
              target: { name: "selectedFinalCustomerId", value: selectedCustomer._id },
            })
            handleInputChange({
              target: { name: "finalCustomerName", value: selectedCustomer.basicInformation.companyName || "" },
            })
            handleInputChange({
              target: { name: "finalCustomerId", value: selectedCustomer._id },
            })
          }
        },
        error: errors.finalCustomerName,
        shouldShowError: !!errors.finalCustomerName,
        value: basicInfo.finalCustomerName,
        disabled: isLoading,
        placeholder: t("salesContract.fields.selectFinalCustomer", {
          defaultValue: "Select Final Customer",
        }),
        options: customersData.map((customer) => ({
          label: customer.basicInformation.companyName || customer.basicInformation.customerDisplayName,
          value: customer.basicInformation.companyName || customer.basicInformation.customerDisplayName,
          key: customer.basicInformation.companyName || customer.basicInformation.customerDisplayName,
        })),
        icon: <FiUsers />,
      },
      {
        label: t("salesContract.fields.firstCustomerContractNumber", {
          defaultValue: "Sales Contract Number (by First Customer)",
        }),
        name: "salesContractNumberByFirstCustomer",
        type: "text",
        required: true,
        placeholder: t("salesContract.fields.enterContractNumber", {
          defaultValue: "Enter Sales Contract Number",
        }),
        value: basicInfo.salesContractNumberByFirstCustomer || "",
        onChange: handleInputChange,
        error: errors.salesContractNumberByFirstCustomer,
        shouldShowError: !!errors.salesContractNumberByFirstCustomer,
        disabled: isLoading,
        icon: <FiHash />,
      },
    ] : []),
    {
      label: t("sales.agentNameLabel"),
      name: "agentName",
      type: "select",
      defaultValue: basicInfo.agentName,
      onChange: handleAgentSelect,
      error: errors.agentName,
      shouldShowError: !!errors.agentName,
      disabled: isLoading,
      value: basicInfo.agentName,
      placeholder: t("sales.selectAgent"),
      options: agentsData.map((agent) => ({
        label: agent.basicInformation.vendorDisplayName,
        value: agent.basicInformation.vendorDisplayName,
        key: agent.basicInformation.vendorDisplayName,
      })),
      icon: <FiUser />,
    },
    ...(basicInfo.agentName
      ? [
        {
          label: t("salesContract.fields.agentCommissionPerMts", {
            defaultValue: "Agent Commission (P/MTS)",
          }),
          name: "commissionPerMTS",
          type: "number",
          required: false,
          placeholder: "e.g. 5",
          value: basicInfo.commissionPerMTS || "",
          onChange: (e) =>
            handleInputChange({
              target: { name: "commissionPerMTS", value: e.target.value },
            }),
          error: errors.commissionPerMTS,
          shouldShowError: !!errors.commissionPerMTS,
          icon: <FiDollarSign />,
        },
      ]
      : []),

    // {
    //   label: "Final Customer Name",
    //   name: "finalCustomerName",
    //   type: "text",
    //   required: true,
    //   defaultValue: basicInfo.finalCustomerName,
    //   onChange: handleInputChange,
    //   errors: errors.finalCustomerName,
    //   placeholder: "Final Customer Name",
    //   disabled: isLoading,
    //   readOnly: true,
    //   value: basicInfo.finalCustomerName,
    // },
    {
      label: t("sales.bankAccount"),
      name: "bankAccount",
      type: "select",
      required: false,
      onChange: handleBankSelect,
      value: basicInfo.bankAccount,
      placeholder: t("sales.selectBankAccount"),
      options: banksData.map((bank) => ({
        label: `${bank.accountName} | ${bank.accountNumber} | ${bank.currencyType} | ${bank.bankName}`,
        value: bank.accountName,
        key: bank._id,
      })),
      error: errors.bankAccount,
      shouldShowError: !!errors.bankAccount,
      disabled: isLoading,
      icon: <FiCreditCard />,
    },
    // defaultTextFieldProps({
    //   name: "remarks",
    //   label: "Remarks",
    //   required: true,
    // }),

    {
      type: "month",
      label: t("sales.etdPortOfLoading"),
      name: "ETD_Port",
      placeholder: "MM/YYYY",
      required: true,
      value: basicInfo.ETD_Port,
      onChange: (e) => handleETDPort(e.target.value),
      error: errors.ETD_Port,
      shouldShowError: !!errors.ETD_Port,
      icon: <FiMap />,
      min: getCurrentMonthMin(), // Prevent selecting previous months
    },


    {
      label: t("sales.countryOfOrigin"),
      name: "origin_country",
      type: "select",
      value: basicInfo.origin_country,
      required: true,
      onChange: (value) => handleInputChange({ target: { name: "origin_country", value } }),
      error: errors.origin_country,
      shouldShowError: !!errors.origin_country,
      placeholder: t("sales.selectCountryOfOrigin"),
      options: Object.entries(countries).map(([code, country]) => ({
        label: country.name,
        value: code,
        key: code,
      })),
      disabled: !selectedBusiness,
      icon: <FiGlobe />,
    },
    {
      label: t("sales.portOfLoading"),
      name: "port_of_loading",
      type: "select",
      value: basicInfo.port_of_loading,
      required: true,
      onChange: (value) => handleInputChange({ target: { name: "port_of_loading", value } }),
      error: errors.port_of_loading,
      shouldShowError: !!errors.port_of_loading,
      placeholder: t("sales.selectPortOfLoading"),
      options: [
        { label: t("salesContract.fields.anyPort", { defaultValue: "ANY PORT" }), value: "Any", key: "Any", first: true },
        ...worldPorts.map((port) => ({
          label: `${port.name} (${port.country})`,
          value: port.id,
          key: port.id,
        })),
      ],
      disabled: !selectedBusiness,
      icon: <FiMapPin />,
    },
    {
      label: t("sales.portOfDischarge"),
      name: "port_of_discharge",
      type: "select",
      value: basicInfo.port_of_discharge,
      required: true,
      onChange: (value) => handleInputChange({ target: { name: "port_of_discharge", value } }),
      error: errors.port_of_discharge,
      shouldShowError: !!errors.port_of_discharge,
      placeholder: t("sales.selectPortOfDischarge"),
      options: [
        { label: t("salesContract.fields.anyPort", { defaultValue: "ANY PORT" }), value: "Any", key: "Any", first: true },
        ...worldPorts.map((port) => ({
          label: `${port.name} (${port.country})`,
          value: port.id,
          key: port.id,
        })),
      ],
      disabled: !selectedBusiness,
      icon: <FiMapPin />,
    },
    // Only show document upload in add mode, not in edit/update mode
    ...(!contractId ? [{
      label: t("sales.initialContractDocuments"),
      name: "initialDocuments",
      type: "custom",
      required: false,
      component: () => (
        <DocumentUpload
          documents={documents}
          onDocumentsChange={setDocuments}
          allowMultiple={true}
          acceptedTypes=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          maxSizeMB={10}
          contractType="sales"
        />
      ),
    }] : []),
  ], [basicInfo, businesses, selectedBusiness, customersData, agentsData, banksData, salesData, isLoading, handleInputChange, handleBusinessChange, handleCustomerSelect, handleAgentSelect, handleETDPort, handleBankSelect, handleSalesSelect, handleContractCreationDateChange, handleContractDateChange, errors, documents, setDocuments, contractId])

  const handleFormSubmit = async (e) => {
    setIsSubmitting(true)
    try {
      await handleSubmit(e)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-3 text-gray-600">
            <FiLoader className="animate-spin text-2xl text-green-500" />
            <span className="text-lg font-medium">{t("common.loading")}</span>
          </div>
        </div>
      )}
      {isSubmitting && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-3 text-gray-600">
            <FiLoader className="animate-spin text-2xl text-green-500" />
            <span className="text-lg font-medium">
              {t("salesContract.saving", { defaultValue: "Saving contract..." })}
            </span>
          </div>
        </div>
      )}
      <Form
        formFields={formFields}
        handleSubmit={handleFormSubmit}
        handleCancel={handleCancel}
        isOpen={isOpen}
        isLoading={isSubmitting}
      />
    </div>
  )
}

export default BasicInfo
