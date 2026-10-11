"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import request from "@/services/httpService"
import { notifySuccess, notifyError } from "@/utils/toast"
import { useHistory } from "react-router-dom"
import DropdownWithAddNewForm from "@/components/DropdownAddNewForm"
import useButtonColor from "@/hooks/useButtonColor"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

const contractNumberGenerate = (entityNumber, itemCode, runningNumber = 1003) => {
  const year = new Date().getFullYear().toString().slice(-2)
  const entity = entityNumber.toString().padStart(2, "0")
  const randomIncrement = Math.floor(Math.random() * 1000) + 1

  const incrementedRunningNumber = runningNumber + randomIncrement
  const running = incrementedRunningNumber.toString().padStart(4, "0")

  const contractNumber = `S${year}${entity}-${itemCode}${running}`
  return contractNumber
}

const initialState = {
  typeOfSaleContract: "",
  salesPerson: "",
  buyerCompanyName: "",
  agentName: "",
  // finalCustomerName: "",
  bankAccount: "",
  remarks: "",
  ETD_Port: "",
  origin_country: "",
  port_of_loading: "",
  port_of_discharge: "",
}

const BasicInfo = ({ businesses, selectedBusiness, setSelectedBusiness, onSave, contractId }) => {
  // State moved from useBasicInfo hook
  const [basicInfo, setBasicInfo] = useState(initialState)
  const [errors, setErrors] = useState({})
  const [isOpen, setIsOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // Additional state for data fetching
  const [customersData, setCustomersData] = useState([])
  const [agentsData, setAgentsData] = useState([])
  const [banksData, setBanksData] = useState([])
  const [salesData, setSalesData] = useState([])

  const buttonColor = useButtonColor()
  const history = useHistory()

  // Fetch contract data if contractId exists
  useEffect(() => {
    const fetchContractData = async () => {
      if (!contractId) return

      setIsLoading(true)
      try {
        const response = await request.get(`/sales-contracts/${contractId}`)
        const { basicInfo: contractBasicInfo, business } = response

        setBasicInfo(contractBasicInfo || initialState)

        if (business) {
          setSelectedBusiness(business)
        }
      } catch (error) {
        console.error("Error fetching contract:", error)
        notifyError("Error loading contract data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchContractData()
  }, [contractId, setSelectedBusiness])

  // Fetch related data when business changes
  useEffect(() => {
    if (selectedBusiness) {
      fetchCustomers()
      fetchAgents()
      fetchBanks()
      fetchSalePersons()
    }
  }, [selectedBusiness])

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/customers_by_business/${selectedBusiness}`)
      if (response.status === 200) {
        setCustomersData(response?.data)
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
        setAgentsData(response?.data?.data || [])
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
        setBanksData(response?.data || [])
      } else {
        console.error("Failed to fetch banks")
      }
    } catch (error) {
      console.error("❌ Error fetching banks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSalePersons = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${Base_URL}/staff-management/sales_staff/${selectedBusiness}`)
      if (response.status === 200) {
        setSalesData(response?.data?.staffList || [])
      } else {
        console.error("Failed to fetch sales persons")
      }
    } catch (error) {
      console.error("❌ Error fetching sales persons:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Form handling functions moved from useBasicInfo
  const handleInputChange = (e) => {
    const { name, value } = e.target

    // Log the update for debugging
    console.log("Updating field:", name, "with value:", value)

    setBasicInfo((prevState) => ({
      ...prevState,
      [name]: value,
    }))

    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: !value ? "This field is required" : "",
    }))
  }

  const handleSubmit = async () => {
    const newErrors = {}
    Object.keys(basicInfo).forEach((key) => {
      if (!basicInfo[key]) {
        newErrors[key] = "This field is required"
      }
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      const data = {
        basicInfo,
      }

      if (contractId) {
        await request.put(`/sales-contracts/${contractId}`, data)
        notifySuccess("Sales Contract Updated Successfully")
      } else {
        data.contractNo = contractNumberGenerate(10, "K")
        data.business = selectedBusiness
        const responseData = await request.post("/sales-contracts", data)
        notifySuccess("Sales Contract Basic Info Saved")
        setBasicInfo(initialState)
        console.log("Calling Sales Contract: ", contractId)

        onSave(responseData?._id)
      }
    } catch (error) {
      notifyError(contractId ? "Error updating contract" : "Error saving Sales Contract Basic Info")
      console.log("Error : ", error)
    }
  }

  const handleCancel = () => {
    setBasicInfo(initialState)
    setErrors({})
    setSelectedBusiness("")
    history.push("/sales")
  }

  // Selection handlers
  const handleCustomerSelect = (e) => {
    const value = e.target.value
    const selectedCustomer = customersData.find((customer) => customer._id === value)

    if (selectedCustomer) {
      handleInputChange({ target: { name: "selectedCustomerId", value: selectedCustomer._id } })
      handleInputChange({
        target: { name: "buyerCompanyName", value: selectedCustomer.basicInformation.companyName || "" },
      })
      // handleInputChange({
      //   target: { name: "finalCustomerName", value: selectedCustomer.basicInformation.customerDisplayName || "" },
      // })

      console.log("Selected Customer:", selectedCustomer)
    }
  }

  const handleAgentSelect = (e) => {
    const value = e.target.value
    const selectedAgent = agentsData.find((agent) => agent._id === value)

    if (selectedAgent) {
      handleInputChange({ target: { name: "selectedAgentId", value: selectedAgent._id } })
      handleInputChange({
        target: { name: "agentName", value: selectedAgent.basicInformation.vendorDisplayName || "" },
      })

      console.log("Selected Agent:", selectedAgent)
    }
  }

  const handleBankSelect = (e) => {
    const value = e.target.value
    const selectedBank = banksData.find((bank) => bank._id === value)

    if (selectedBank) {
      handleInputChange({ target: { name: "selectedBankId", value: selectedBank._id } })
      handleInputChange({ target: { name: "bankAccount", value: selectedBank.accountName || "" } })

      console.log("Selected Bank:", selectedBank)
    }
  }

  const handleSalesSelect = (e) => {
    const value = e.target.value
    const selectedSales_person = salesData.find((sales_person) => sales_person._id === value)

    if (selectedSales_person) {
      handleInputChange({ target: { name: "selectedSalesId", value: selectedSales_person._id } })
      handleInputChange({ target: { name: "salesPerson", value: selectedSales_person.displayName || "" } })

      console.log("Selected sales Person:", selectedSales_person)
    }
  }

  const handleBusinessChange = (event) => {
    setSelectedBusiness(event.target.value)
  }

  const renderField = (field) => {
    if (field.name === "typeOfSaleContract") {
      return selectedBusiness ? (
        <DropdownWithAddNewForm
          selectedValue={basicInfo[field.name]}
          onChange={(value) => handleInputChange({ target: { name: field.name, value } })}
          fetchUrl={`${Base_URL}/items/Contract Type/get_all`}
          addUrl={`${Base_URL}/items/Contract Type/add`}
          className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
          businessId={selectedBusiness}
          placeholder="Select Contract Type"
        />
      ) : (
        <select
          className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
          disabled
        >
          <option>Select Business First</option>
        </select>
      )
    }

    if (field.name === "buyerCompanyName") {
      return (
        <select
          name={field.name}
          defaultValue={basicInfo[field.name]}
          onChange={handleCustomerSelect}
          className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
          disabled={isLoading}
        >
          <option value="">Select Customer</option>
          {customersData.map((customer) => (
            <option key={customer._id} value={customer._id}>
              {customer.basicInformation.companyName || customer.basicInformation.customerDisplayName}
            </option>
          ))}
        </select>
      )
    }

    if (field.name === "agentName") {
      return (
        <select
          name={field.name}
          defaultValue={basicInfo[field.name]}
          onChange={handleAgentSelect}
          className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
          disabled={isLoading}
        >
          <option value="">Select Agent</option>
          {agentsData.map((agent) => (
            <option key={agent._id} value={agent._id}>
              {agent.basicInformation.vendorDisplayName}
            </option>
          ))}
        </select>
      )
    }
    if (field.name === "bankAccount") {
      return (
        <select
          name={field.name}
          defaultValue={basicInfo[field.name]}
          onChange={handleBankSelect}
          className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
          disabled={isLoading}
        >
          <option value="">Select Bank</option>
          {banksData.map((bank) => (
            <option key={bank._id} value={bank._id}>
              {bank.accountName}
            </option>
          ))}
        </select>
      )
    }
    if (field.name === "salesPerson") {
      return (
        <select
          name={field.name}
          defaultValue={basicInfo[field.name]}
          onChange={handleSalesSelect}
          className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
          disabled={isLoading}
        >
          <option value="">Select Sales Person</option>
          {salesData.map((sales_person) => (
            <option key={sales_person._id} value={sales_person._id}>
              {sales_person.displayName}
            </option>
          ))}
        </select>
      )
    }
    // if (field.name === "finalCustomerName") {
    //   return (
    //     <input
    //       type="text"
    //       name={field.name}
    //       value={basicInfo[field.name]}
    //       onChange={handleInputChange}
    //       placeholder={field.label}
    //       className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
    //       readOnly
    //     />
    //   )
    // }

    return (
      <input
        type="text"
        name={field.name}
        value={basicInfo[field.name]}
        onChange={handleInputChange}
        placeholder={field.label}
        className={`col-span-2 w-full p-2 rounded-md text-sm border ${errors[field.name] ? "border-red-500 bg-red-100" : "border-gray-300"}`}
      />
    )
  }

  const formFields = [
    { label: "Type of Sale Contract", name: "typeOfSaleContract" },
    { label: "Sales Person", name: "salesPerson" },
    { label: "Buyer Company Name", name: "buyerCompanyName" },
    { label: "Agent Name", name: "agentName" },
    // { label: "Final Customer Name", name: "finalCustomerName" },
    { label: "Bank Account", name: "bankAccount" },
    { label: "Remarks", name: "remarks" },
    { label: "ETD Port of Loading", name: "ETD_Port" },
    { label: "Country of origin", name: "origin_country" },
    { label: "Port of Loading", name: "port_of_loading" },
    { label: "Port of Discharge", name: "port_of_discharge" },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white shadow-md rounded-xl border mt-2 p-4 relative">
        {/* Business Selection */}
        <div className="grid grid-cols-3 items-center gap-4 mb-4">
          <label className="text-sm font-medium text-gray-700">
            Select Business <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedBusiness || ""}
            onChange={handleBusinessChange}
            className="col-span-2 w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="" disabled>
              Select a business
            </option>
            {businesses?.map((business) => (
              <option key={business._id} value={business._id}>
                {business.name}
              </option>
            ))}
          </select>
        </div>

        {isOpen && (
          <div className="mt-4 space-y-3">
            {formFields.map((field, index) => (
              <div key={index} className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm text-gray-600">
                  {field.label} <span className="text-red-500">*</span>
                </label>
                {renderField(field)}
                {errors[field.name] && <p className="col-span-3 text-sm text-red-500">{errors[field.name]}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="flex-1"></div>
        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            style={{ backgroundColor: buttonColor }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default BasicInfo
