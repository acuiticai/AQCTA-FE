"use client"

import { useEffect, useState } from "react"
import { notifySuccess, notifyError } from "@/utils/toast"
import { useSalesContext } from "../context/SalesContractContext"
import axios from "axios"
import { useHistory } from "react-router-dom"
import { useParams } from "react-router-dom/cjs/react-router-dom.min"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

const createInitialSectionState = (title = "Item Name") => ({
  id: Date.now(),
  title,
  purchaseContract: "",
  item: "",
  itemId: "",
  quantityMTS: "",
  quantityFCL: "",
  containerWeight: "",
  fclSize: "20ft",
  // toIssue: "",
  price: "",
  deposit: "",
  totalValue: "",
  totalQuantity: "",
  agentCommission: "",
  commissionPerMTS: "",

  selectedCurrency: null,
  conversionRate: 1,
  amountInSelectedCurrency: "0",

  productType: "",
  shippingTerms: "",
  packing: "",
  paymentTerms: "",
  priceForFinalCustomer: "",
  contractType: "",
  forecastCostDescription: "",
  forecastCost: "",
  forecastTotalCost: "",
})

function useProductInfo() {
  const [sections, setSections] = useState([createInitialSectionState("Item")])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({}) // Track errors per section: { sectionId: { fieldName: "error message" } }
  const { contractId: editContractId } = useParams()
  const { selectedBusiness, contractId, setContractId } = useSalesContext()
  console.log(contractId)
 
  const history = useHistory()
  // New function to convert API data to section format
  const convertToSectionFormat = (productInfo) => {
    return productInfo.map((info) => ({
      id: Date.now() + Math.random(), // Ensure unique ID
      title: info.title || "",
      purchaseContract: info.purchaseContract || "",
      // item: info.title || "",
      // itemId: info.item || "",
      item: info.item?.toString() || "",
      itemId: info.item?.toString() || "",

      quantityMTS: info.quantityMTS
        ? Number.parseFloat(info.quantityMTS).toFixed(2)
        : "",
      quantityFCL: info.quantityFCL?.toString() || "",
      containerWeight: info.containerWeight?.toString() || "",
      fclSize: info.fclSize || "",
      price: info.price?.toString() || "",
      deposit: info.deposit?.toString() || "",
      totalValue: info.totalValue?.toString() || "",
      selectedCurrency: info.selectedCurrency || null,
      conversionRate: info.conversionRate?.toString() || "1",
      amountInSelectedCurrency: info.amountInSelectedCurrency?.toString() || "0",
      grade: info.grade || "",
      containerType: info.containerType || "",
      unitOfContainer: info.unitOfContainer || "",
      No_of_Packages: info.No_of_Packages || "",
      remarks: info.remarks || "",
      forecasted_shipment_cost: info.forecasted_shipment_cost || "",

      productType: info.productType || "",
      shippingTerms: info.shippingTerms || "",
      packing: info.packing || "",
      paymentTerms: info.paymentTerms || "",
      // New fields for Profit Sharing
      priceForFinalCustomer: info.priceForFinalCustomer?.toString() || "",
      contractType: info.contractType || "",
      // New fields for total quantity and agent commission
      totalQuantity: info.totalQuantity?.toString() || "",
      agentCommission: info.agentCommission?.toString() || "",
      commissionPerMTS: info.commissionPerMTS?.toString() || "",
      // Forecast cost fields
      forecastCostDescription: info.forecastCostDescription || "",
      forecastCost: info.forecastCost?.toString() || "",
      forecastTotalCost: info.forecastTotalCost?.toString() || "",
    }))
  }

  useEffect(() => {
    if (editContractId) setContractId(editContractId)
  }, [editContractId])

  // Fetch existing contract data
  useEffect(() => {
    const fetchContractData = async () => {
      if (!contractId) return

      setLoading(true)
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts/${contractId}`)
        const contract = response.data

        if (contract && contract.productInfo && contract.productInfo.length > 0) {
          // Add contract type to each product info item
          const productInfoWithContractType = contract.productInfo.map(info => ({
            ...info,
            contractType: contract.basicInfo?.typeOfSaleContract || ""
          }))
          
          const formattedSections = convertToSectionFormat(productInfoWithContractType)
          setSections(formattedSections)
        }
      } catch (error) {
        console.error("Error fetching contract data:", error)
        notifyError("Failed to fetch contract details")
      } finally {
        setLoading(false)
      }
    }

    fetchContractData()
  }, [contractId])

  // Fetch items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedBusiness) {
        // Clear items and reset sections when business is removed
        setItems([])
        setSections([createInitialSectionState("Item")])
        setErrors({})
        return
      }

      setLoading(true)
      try {
        const response = await axios.get(`${Base_URL}/items/?businessId=${selectedBusiness}&active=true`)
        setItems(response?.data || [])
        // Clear sections when business changes (but not if contractId exists - editing mode)
        if (!contractId) {
          setSections([createInitialSectionState("Item")])
          setErrors({})
        }
      } catch (err) {
        notifyError("Failed to fetch item details.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [selectedBusiness])

  const addSection = () => {
    setSections((prev) => [...prev, createInitialSectionState()])
  }

  const removeSection = (id) => {
    setSections((prev) => prev.filter((section) => section.id !== id))
  }

  const updateSection = (id, field, value) => {
    if (!id) {
      console.error("No id provided to updateSection")
      return
    }

    // Clear error for this field when value is provided
    if (value) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        if (newErrors[id] && newErrors[id][field]) {
          delete newErrors[id][field]
          if (Object.keys(newErrors[id]).length === 0) {
            delete newErrors[id]
          }
        }
        return newErrors
      })
    }

    setSections((prev) =>
      prev.map((section) => {
        if (section.id === id) {
          let updates = { [field]: value }

          if (field === "item") {
            const selectedItem = items.find((item) => item.name === value)
            if (selectedItem) {
              updates = {
                ...updates,
                itemId: selectedItem._id,
              }
            }
          }
          if (field === "itemId") {
            const selectedItem = items.find((item) => item._id === value);
            console.log("selectedItem", selectedItem)
            if (selectedItem) {
              updates = {
                ...updates,
                itemId: selectedItem._id,
                item: selectedItem._id, // show name in title
                title: selectedItem.name, // ✅ update title for display
              };
            }
          }


          // Update amountInSelectedCurrency when relevant fields change
          if (["totalValue", "selectedCurrency", "conversionRate"].includes(field)) {
            const totalValue = field === "totalValue" ? value : section.totalValue
            const selectedCurrency = field === "selectedCurrency" ? value : section.selectedCurrency
            const conversionRate = field === "conversionRate" ? value : section.conversionRate

            if (totalValue && conversionRate) {
              const amount = Number.parseFloat(totalValue) * Number.parseFloat(conversionRate)
              updates.amountInSelectedCurrency = amount.toFixed(2)
            }
          }

          return { ...section, ...updates }
        }
        return section
      }),
    )
  }

  const handleSave = async () => {
    const requiredFields = [
      "title",
      "item",
      "quantityMTS",
      "quantityFCL",
      // "containerWeight",
      "fclSize",
      // "toIssue",
      "price",
      "deposit",
      "totalValue",
      "selectedCurrency",
      "conversionRate",
      "amountInSelectedCurrency",
      // "productType",
      "shippingTerms",
      "packing",
      "paymentTerms",
    ]

    // Add Profit Sharing specific required fields
    const profitSharingRequiredFields = [
      "priceForFinalCustomer",
    ]

    const emptyFieldsBySection = sections
      .map((section, index) => {
        const baseEmptyFields = requiredFields.filter((field) => !section[field])
        
        // Add Profit Sharing specific validation
        let additionalEmptyFields = []
        if (section.contractType === "Profit Sharing") {
          additionalEmptyFields = profitSharingRequiredFields.filter((field) => !section[field])
        }
        
        const emptyFields = [...baseEmptyFields, ...additionalEmptyFields]
        
        return {
          sectionIndex: index + 1,
          emptyFields: emptyFields,
        }
      })
      .filter((section) => section.emptyFields.length > 0)

    if (emptyFieldsBySection.length > 0) {
      // Set errors for each section and field
      const newErrors = {}
      emptyFieldsBySection.forEach((sectionError) => {
        const section = sections[sectionError.sectionIndex - 1]
        if (section) {
          newErrors[section.id] = {}
          sectionError.emptyFields.forEach((field) => {
            newErrors[section.id][field] = "This field is required"
          })
        }
      })
      setErrors(newErrors)
      return
    }

    // Validate price is greater than 0
    const priceValidationErrors = {}
    sections.forEach((section) => {
      if (section.price !== undefined && section.price !== null && section.price !== "") {
        const priceValue = Number(section.price)
        if (isNaN(priceValue) || priceValue <= 0) {
          if (!priceValidationErrors[section.id]) {
            priceValidationErrors[section.id] = {}
          }
          priceValidationErrors[section.id].price = "Price must be greater than 0"
        }
      }
    })

    // Validate priceForFinalCustomer for Profit Sharing contracts
    sections.forEach((section) => {
      if (section.contractType === "Profit Sharing" && section.priceForFinalCustomer !== undefined && section.priceForFinalCustomer !== null && section.priceForFinalCustomer !== "") {
        const priceValue = Number(section.priceForFinalCustomer)
        if (isNaN(priceValue) || priceValue <= 0) {
          if (!priceValidationErrors[section.id]) {
            priceValidationErrors[section.id] = {}
          }
          priceValidationErrors[section.id].priceForFinalCustomer = "Price must be greater than 0"
        }
      }
    })

    if (Object.keys(priceValidationErrors).length > 0) {
      setErrors(priceValidationErrors)
      return
    }

    // Clear all errors if validation passes
    setErrors({})

    const formattedSections = sections.map((section) => ({
      title: section.title,
      purchaseContract: section.purchaseContract || "",
      item: section.itemId,
      itemId: section.itemId || "",
      quantityMTS: Number(section.quantityMTS),
      quantityFCL: Number(section.quantityFCL),
      containerWeight: Number(section.containerWeight),
      fclSize: section.fclSize || "",
      // toIssue: section.toIssue || "",
      price: Number(section.price),
      deposit: Number(section.deposit),
      totalValue: Number(section.totalValue),
      conversionRate: Number(section.conversionRate),
      amountInSelectedCurrency: Number(section.amountInSelectedCurrency),
      selectedCurrency: section.selectedCurrency || null,
      productType: section.productType || "",
      remarks: section.remarks || "",
      forecasted_shipment_cost: section.forecasted_shipment_cost || "",
      shippingTerms: section.shippingTerms || "",
      No_of_Packages: section.No_of_Packages || "",
      packing: section.packing || "",
      paymentTerms: section.paymentTerms || "",
      // New fields for Profit Sharing
      priceForFinalCustomer: section.priceForFinalCustomer ? Number(section.priceForFinalCustomer) : undefined,
      contractType: section.contractType || "",
      // Additional fields that were missing
      grade: section.grade || "",
      containerType: section.containerType || "",
      unitOfContainer: section.unitOfContainer || "",
      // New fields for total quantity and agent commission
      totalQuantity: section.totalQuantity ? Number(section.totalQuantity) : undefined,
      totalAgentCommission: section.totalAgentCommission ? Number(section.totalAgentCommission) : undefined,
      agentCommission: section.agentCommission ? Number(section.agentCommission) : undefined,
      commissionPerMTS: section.commissionPerMTS ? Number(section.commissionPerMTS) : undefined,
      // Forecast cost fields
      forecastCostDescription: section.forecastCostDescription || "",
      forecastCost: section.forecastCost ? Number(section.forecastCost) : undefined,
      forecastTotalCost: section.forecastTotalCost ? Number(section.forecastTotalCost) : undefined,
    }))

    try {
      if (!contractId) {
        notifyError("Contract ID is missing")
        return
      }

      const response = await axios.put(`${Base_URL}/sales-contracts/${contractId}/add-product-info`, {
        productInfo: formattedSections,
      })
      notifySuccess("Product Info Saved")
      history.push("/sales")
    } catch (error) {
      console.error("Error saving product info:", error)
      notifyError(error.response?.data?.error || "Failed to save product info")
    }
  }

  const handleCancel = () => {
    setSections([createInitialSectionState("Item")])
    history.push("/sales")
  }

  return {
    sections,
    items,
    loading,
    errors,
    setSections,
    addSection,
    removeSection,
    updateSection,
    handleSave,
    handleCancel,
  }
}

export default useProductInfo