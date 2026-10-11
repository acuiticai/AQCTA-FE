"use client"

import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { notifySuccess, notifyError } from "@/utils/toast"
import { usePurchaseContext } from "../context/PurchaseContractContext"
import axios from "axios"
import { useHistory } from "react-router-dom"
import { useParams } from "react-router-dom/cjs/react-router-dom.min"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

const createInitialSectionState = (title = "Item Name") => ({
  id: Date.now(),
  title,
  salesContract: "",
  item: "",
  itemId: "",
  quantityMTS: "",
  quantityFCL: "",
  containerWeight: "",
  containerType: "",
  unitOfContainer: "",
  grade: "",
  No_of_Packages: "",
  fclSize: "",
  toIssue: "",
  price: "",
  additionalCharges: "",
  deposit: "",
  totalValue: "",
  breakEvenValue: "",
  portOfDestination: "",
  portOfLanding: "",
  estimatedDeparture: "",
  remarks: "",
  selectedCurrency: null,
  conversionRate: 1,
  amountInSelectedCurrency: "0",
  productType: "",
  shippingTerms: "",
  packing: "",
  paymentTerms: "",
  commissionPerMTS: "",
  totalAgentCommission: "",
  totalQuantity: "",
})

function usePurchaseProductInfo() {
  const [sections, setSections] = useState([createInitialSectionState("Item")])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({}) // Track errors per section: { sectionId: { fieldName: "error message" } }
  const [autoFillApplied, setAutoFillApplied] = useState(false)
  const [pendingAutoFillData, setPendingAutoFillData] = useState(null)
  const [pendingBasicData, setPendingBasicData] = useState(null)
  const { contractId: editContractId } = useParams()
  const { selectedBusiness, contractId, setContractId, commissionPerMTS: contextCommissionPerMTS } = usePurchaseContext();
  const location = useLocation()
  const history = useHistory()

  // Get sales contract data from location state
  const salesContractData = location.state?.salesContractData
  const creatingForSales = location.state?.creating_For_Sales

  console.log("Hook - Sales contract data:", salesContractData)
  console.log("Hook - Creating for sales:", creatingForSales)

  // Store auto-fill data when component mounts, but wait for items to be fetched
  useEffect(() => {
    if (creatingForSales && salesContractData && salesContractData.productInfo && !autoFillApplied) {
      console.log("Storing pending auto-fill data:", salesContractData.productInfo)
      setPendingAutoFillData(salesContractData.productInfo)
      setPendingBasicData(salesContractData.basicInfo)
    }
  }, [creatingForSales, salesContractData, autoFillApplied])

  // Auto-fill sections after items are fetched
  useEffect(() => {
    if (pendingAutoFillData && items.length > 0 && !autoFillApplied) {
      console.log("Auto-filling product sections with items available:", pendingAutoFillData)
      console.log("Auto-filling pending Basic Data:", pendingBasicData)

      const autoFilledSections = pendingAutoFillData.map((productItem, index) => {
        // Try to find matching item by different criteria
        let matchedItem = null

        // First try to match by itemId
        if (productItem.item) {
          matchedItem = items.find(
            (item) => item._id.toString() === productItem.item.toString() || item._id === productItem.item,
          )
        }

        // If not found, try to match by item name
        if (!matchedItem && (productItem.item || productItem.title)) {
          const itemName = productItem.item || productItem.title
          matchedItem = items.find(
            (item) => item.name === itemName || item.name.toLowerCase() === itemName.toLowerCase(),
          )
        }

        // If still not found, try partial matching
        if (!matchedItem && (productItem.item || productItem.title)) {
          const itemName = (productItem.item || productItem.title).toLowerCase()
          matchedItem = items.find(
            (item) => item.name.toLowerCase().includes(itemName) || itemName.includes(item.name.toLowerCase()),
          )
        }

        console.log(`Section ${index + 1}:`, {
          searchingFor: productItem.item || productItem.title,
          searchingById: productItem.itemId,
          matchedItem: matchedItem ? matchedItem.name : "No match found",
        })

        return {
          id: Date.now() + index + Math.random(), // Ensure unique IDs
          title: productItem.title || productItem.item || "Item",

          // Auto-fill item selection
          item: matchedItem ? matchedItem.name : productItem.item || productItem.title || "",
          itemId: matchedItem ? matchedItem._id.toString() : productItem.itemId?.toString() || "",

          // Auto-fill other available fields from sales contract
          salesContract: salesContractData.contractNo || "",
          grade: productItem.grade || (matchedItem ? matchedItem.grade : "") || "",
          containerType: productItem.containerType || (matchedItem ? matchedItem.container_type : "") || "",
          fclSize: productItem.fclSize || "",
          quantityMTS: productItem.quantityMTS?.toString() || "",
          quantityFCL: productItem.quantityFCL?.toString() || "",
          containerWeight: productItem.containerWeight?.toString() || "",
          unitOfContainer: productItem.unitOfContainer || "",
          No_of_Packages: productItem.No_of_Packages || "",
          packing: productItem.packing || (matchedItem ? matchedItem.packing : "") || "",
          remarks: productItem.remarks || (matchedItem ? matchedItem.remarks : "") || "",

          // Shipping and location info - copy from sales
          portOfLanding: pendingBasicData.port_of_loading || "",
          portOfDestination: pendingBasicData.port_of_discharge || "",
          estimatedDeparture: productItem.estimatedDeparture || "",
          shippingTerms: productItem.shippingTerms || "",
          paymentTerms: productItem.paymentTerms || "",

          // Pricing fields - leave empty as these will be different for purchase
          price: "",
          additionalCharges: "",
          deposit: "",
          totalValue: "",
          selectedCurrency: null,
          conversionRate: 1,
          amountInSelectedCurrency: "0",
          breakEvenValue: "",

          // Forecast fields - leave empty
          toIssue: "",

          productType: productItem.productType || "",
          commissionPerMTS: "",
          totalAgentCommission: "",
          totalQuantity: "",
        }
      })

      setSections(autoFilledSections)
      setAutoFillApplied(true)
      setPendingAutoFillData(null) // Clear pending data
      console.log("Auto-filled sections with item selection:", autoFilledSections)
    }
  }, [pendingAutoFillData, items, autoFillApplied, salesContractData])

  // Convert API data to section format
  const convertToSectionFormat = (productInfo) => {
    return productInfo.map((info) => ({
      id: Date.now() + Math.random(),
      title: info.title || "",
      salesContract: info.salesContract || "",
      item: info.title || "",
      itemId: info.item?.toString() || "",
      quantityMTS: info.quantityMTS?.toString() || "",
      quantityFCL: info.quantityFCL?.toString() || "",
      containerWeight: info.containerWeight?.toString() || "",
      containerType: info.containerType || "",
      unitOfContainer: info.unitOfContainer || "",
      grade: info.grade || "",
      No_of_Packages: info.No_of_Packages || "",
      fclSize: info.fclSize || "",
      toIssue: info.toIssue || "",
      price: info.price?.toString() || "",
      additionalCharges: info.additionalCharges?.toString() || "",
      deposit: info.deposit?.toString() || "",
      totalValue: info.totalValue?.toString() || "",
      breakEvenValue: info.breakEvenValue?.toString() || "",
      portOfDestination: info.portOfDestination || "",
      portOfLanding: info.portOfLanding || "",
      origin_country: info.origin_country || "",
      estimatedDeparture: info.estimatedDeparture || "",
      remarks: info.remarks || "",
      selectedCurrency: info.selectedCurrency || null,
      conversionRate: info.conversionRate?.toString() || "1",
      amountInSelectedCurrency: info.amountInSelectedCurrency?.toString() || "0",
      productType: info.productType || "",
      shippingTerms: info.shippingTerms || "",
      packing: info.packing || "",
      paymentTerms: info.paymentTerms || "",
      commissionPerMTS: info.commissionPerMTS || "",
      totalAgentCommission: info.totalAgentCommission || "",
      totalQuantity: info.totalQuantity || "",
    }))
  }

  useEffect(() => {
    if (editContractId) setContractId(editContractId)
  }, [editContractId])

  // Fetch existing contract data (only if not creating from sales)
  useEffect(() => {
    const fetchContractData = async () => {
      if (!contractId || creatingForSales) return // Skip if creating from sales

      setLoading(true)
      try {
        const response = await axios.get(`${Base_URL}/purchase-contracts/${contractId}`)
        const contract = response.data

        if (contract && contract.productInfo && contract.productInfo.length > 0) {
          const formattedSections = convertToSectionFormat(contract.productInfo)
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
  }, [contractId, creatingForSales])

  // Fetch items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedBusiness) {
        // Clear items and reset sections when business is removed
        setItems([])
        setSections([createInitialSectionState("Item")])
        setErrors({})
        setAutoFillApplied(false)
        setPendingAutoFillData(null)
        setPendingBasicData(null)
        return
      }

      setLoading(true)
      try {
        const response = await axios.get(`${Base_URL}/items/?businessId=${selectedBusiness}&active=true`)
        setItems(response?.data || [])
        console.log("Fetched items:", response?.data?.length || 0)
        // Clear sections when business changes (but not if contractId exists or creating from sales - editing/auto-fill mode)
        if (!contractId && !creatingForSales) {
          setSections([createInitialSectionState("Item")])
          setErrors({})
          setAutoFillApplied(false)
          setPendingAutoFillData(null)
          setPendingBasicData(null)
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
                itemId: selectedItem._id.toString(),
                // Preserve existing price in edit mode; only set from item if empty
                ...(section.price
                  ? {}
                  : { price: selectedItem.price?.toFixed(2) || "" }),
                grade: selectedItem.grade || section.grade,
                packing: selectedItem.packing || section.packing,
                containerType: selectedItem.container_type || section.containerType,
                remarks: selectedItem.remarks || section.remarks,
              }
            }
          }

          if (field === "itemId") {
            const selectedItem = items.find((item) => item._id.toString() === value.toString())
            if (selectedItem) {
              updates = {
                ...updates,
                itemId: selectedItem._id.toString(),
                item: selectedItem.name,
                title: selectedItem.name,
                // Preserve existing price in edit mode; only set from item if empty
                ...(section.price
                  ? {}
                  : { price: selectedItem.price?.toFixed(2) || "" }),
                grade: selectedItem.grade || section.grade,
                packing: selectedItem.packing || section.packing,
                containerType: selectedItem.container_type || section.containerType,
                remarks: selectedItem.remarks || section.remarks,
              }
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
      "item",
      "quantityMTS",
      "quantityFCL",
      "totalQuantity",
      "No_of_Packages",
      "price",
      "totalValue",
      "packing",
      "paymentTerms",
      "selectedCurrency",
      "origin_country",
      "portOfLanding",
      "portOfDestination",
    ]

    const emptyFieldsBySection = sections
      .map((section, index) => {
        const emptyFields = requiredFields.filter((field) => {
          // Special handling for totalQuantity - it can be calculated from quantityMTS * quantityFCL
          if (field === "totalQuantity") {
            const hasValue = section[field] && section[field] !== "" && section[field] !== "0"
            const canCalculate = section.quantityMTS && section.quantityFCL && 
                                Number(section.quantityMTS) > 0 && Number(section.quantityFCL) > 0
            return !hasValue && !canCalculate
          }
          return !section[field]
        })
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

    if (Object.keys(priceValidationErrors).length > 0) {
      setErrors(priceValidationErrors)
      return
    }

    // Clear all errors if validation passes
    setErrors({})

    const formattedSections = sections.map((section) => {
      const quantityMTS = Number(section.quantityMTS) || 0;
      const quantityFCL = Number(section.quantityFCL) || 0;
      // Always use commissionPerMTS from context
      const commissionPerMTS = Number(contextCommissionPerMTS) || 0;
      const totalQuantity = quantityFCL * quantityMTS;
      const totalAgentCommission = commissionPerMTS * quantityMTS * quantityFCL;
      return {
        title: section.title,
        salesContract: section.salesContract || "",
        item: section.itemId,
        quantityMTS,
        quantityFCL,
        containerWeight: Number(section.containerWeight),
        containerType: section.containerType || "",
        unitOfContainer: section.unitOfContainer || "",
        grade: section.grade || "",
        No_of_Packages: section.No_of_Packages || "",
        fclSize: section.fclSize || "",
        toIssue: section.toIssue || "",
        price: Number(section.price),
        additionalCharges: Number(section.additionalCharges || 0),
        deposit: Number(section.deposit || 0),
        totalValue: Number(section.totalValue),
        breakEvenValue: Number(section.breakEvenValue || 0),
        portOfDestination: section.portOfDestination || "",
        portOfLanding: section.portOfLanding || "",
        estimatedDeparture: section.estimatedDeparture || "",
        remarks: section.remarks || "",
        supportingDocuments: section.supportingDocuments || [],
        conversionRate: Number(section.conversionRate),
        amountInSelectedCurrency: Number(section.amountInSelectedCurrency),
        selectedCurrency: section.selectedCurrency || null,
        productType: section.productType || "",
        shippingTerms: section.shippingTerms || "",
        packing: section.packing || "",
        paymentTerms: section.paymentTerms || "",
        commissionPerMTS,
        totalAgentCommission,
        totalQuantity,
        origin_country: section.origin_country || "", // <-- Ensure this is included
      }
    })

    try {
      if (!contractId) {
        notifyError("Contract ID is missing")
        return
      }

      console.log("Hook - Sales contract data:", salesContractData)
      console.log("Hook - Creating for sales:", creatingForSales)
      let response
      if (creatingForSales && salesContractData) {
        response = await axios.put(`${Base_URL}/purchase-contracts/${contractId}/add-product-info-and-assign-to-sales-contract`, {
          productInfo: formattedSections, // <-- Use updated form state
          salesContractId: salesContractData._id,
        })
        notifySuccess("Purchase Contract Info Saved Successfully and Assigned to Sales Contract")
      } else {
        response = await axios.put(`${Base_URL}/purchase-contracts/${contractId}/add-product-info`, {
          productInfo: formattedSections,
        })
        notifySuccess("Product Info Saved Successfully")
      }
      // Clear the location state to prevent auto-fill on future visits
      location.state = null

      if (creatingForSales) {
        history.push({
          pathname: "/view-sales-contract",
          state: { contractId: salesContractData._id },
        })
      } else {
        history.push("/purchase_contracts")
      }
    } catch (error) {
      console.error("Error saving product info:", error)
      notifyError(error.response?.data?.error || "Failed to save product info")
    }
  }

  const handleCancel = () => {
    setSections([createInitialSectionState("Item")])

    // Clear the location state when canceling
    if (creatingForSales) {
      history.replace("/purchase_contracts", {})
    } else {
      history.push("/purchase_contracts")
    }
  }

  // Function to clear auto-filled data (utility function)
  const clearAutoFill = () => {
    setSections([createInitialSectionState("Item")])
    setAutoFillApplied(false)
    setPendingAutoFillData(null)
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
    clearAutoFill,
    creatingForSales,
    salesContractData,
  }
}

export default usePurchaseProductInfo
