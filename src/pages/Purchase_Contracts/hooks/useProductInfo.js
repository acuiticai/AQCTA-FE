"use client"

import { useEffect, useState } from "react"
import { notifySuccess, notifyError } from "@/utils/toast"
import { useSalesContext } from "../context/PurchaseContractContext"
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
  fclSize: "",
  toIssue: "",
  price: "",
  deposit: "",
  totalValue: "",

  selectedCurrency: null,
  conversionRate: 1,
  amountInSelectedCurrency: "0",

  productType: "",
  shippingTerms: "",
  packing: "",
  paymentTerms: "",
  grade: "",
  containerType: "",
  unitOfContainer: "",
  No_of_Packages: "",
  remarks: "",
})

function useProductInfo() {
  const [sections, setSections] = useState([createInitialSectionState("Item")])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
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
      item: info.title || "", // Using title as item name since that's how we save it
      itemId: info.item || "", // This is the actual item ID
      quantityMTS: info.quantityMTS?.toString() || "",
      quantityFCL: info.quantityFCL?.toString() || "",
      containerWeight: info.containerWeight?.toString() || "",
      fclSize: info.fclSize || "",
      toIssue: info.toIssue || "",
      price: info.price?.toString() || "",
      deposit: info.deposit?.toString() || "",
      totalValue: info.totalValue?.toString() || "",
      selectedCurrency: info.selectedCurrency || null,
      conversionRate: info.conversionRate?.toString() || "1",
      amountInSelectedCurrency: info.amountInSelectedCurrency?.toString() || "0",

      productType: info.productType || "",
      shippingTerms: info.shippingTerms || "",
      packing: info.packing || "",
      paymentTerms: info.paymentTerms || "",
      grade: info.grade || "",
      containerType: info.containerType || "",
      unitOfContainer: info.unitOfContainer || "",
      No_of_Packages: info.No_of_Packages || "",
      remarks: info.remarks || "",
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
  }, [contractId])

  // Fetch items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedBusiness) return

      setLoading(true)
      try {
        const response = await axios.get(`${Base_URL}/items/?businessId=${selectedBusiness}&active=true`)
        setItems(response?.data || [])
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
                price: selectedItem.price.toFixed(2),
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
      "title",
      "item",
      "quantityMTS",
      "quantityFCL",
      "containerWeight",
      "fclSize",
      "toIssue",
      "price",
      "deposit",
      "totalValue",
      "selectedCurrency",
      "conversionRate",
      "amountInSelectedCurrency",
      "productType",
      "shippingTerms",
      "packing",
      "paymentTerms",
    ]

    const emptyFieldsBySection = sections
      .map((section, index) => {
        const emptyFields = requiredFields.filter((field) => !section[field])
        return {
          sectionIndex: index + 1,
          emptyFields: emptyFields,
        }
      })
      .filter((section) => section.emptyFields.length > 0)

    if (emptyFieldsBySection.length > 0) {
      const errorMessage = emptyFieldsBySection
        .map((section) => {
          const fieldNames = section.emptyFields
            .map((field) => field.replace(/([A-Z])/g, " $1").toLowerCase())
            .join(", ")
          return `Section ${section.sectionIndex}: Missing ${fieldNames}`
        })
        .join("\n")

      notifyError(`Please fill in all required fields:\n${errorMessage}`)
      return
    }

    const formattedSections = sections.map((section) => ({
      title: section.item,
      purchaseContract: section.purchaseContract || "",
      item: section.itemId,
      itemId: section.itemId || "",
      quantityMTS: Number(section.quantityMTS),
      quantityFCL: Number(section.quantityFCL),
      containerWeight: Number(section.containerWeight),
      fclSize: section.fclSize || "",
      toIssue: section.toIssue || "",
      price: Number(section.price),
      deposit: Number(section.deposit),
      totalValue: Number(section.totalValue),
      conversionRate: Number(section.conversionRate),
      amountInSelectedCurrency: Number(section.amountInSelectedCurrency),
      selectedCurrency: section.selectedCurrency || null,
      productType: section.productType || "",
      shippingTerms: section.shippingTerms || "",
      packing: section.packing || "",
      paymentTerms: section.paymentTerms || "",
      grade: section.grade || "",
      containerType: section.containerType || "",
      unitOfContainer: section.unitOfContainer || "",
      No_of_Packages: section.No_of_Packages || "",
      remarks: section.remarks || "",
    }))

    try {
      if (!contractId) {
        notifyError("Contract ID is missing")
        return
      }

      const response = await axios.put(`${Base_URL}/purchase-contracts/${contractId}/add-product-info`, {
        productInfo: formattedSections,
      })
      notifySuccess("Product Info Saved")
      history.push("/purchase_contracts")
    } catch (error) {
      console.error("Error saving product info:", error)
      notifyError(error.response?.data?.error || "Failed to save product info")
    }
  }

  const handleCancel = () => {
    setSections([createInitialSectionState("Item")])
    history.push("/purchase_contracts")
  }

  return {
    sections,
    items,
    loading,
    setSections,
    addSection,
    removeSection,
    updateSection,
    handleSave,
    handleCancel,
  }
}

export default useProductInfo

