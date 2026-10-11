"use client"

import { useState, useEffect } from "react"
import { FiPlus } from "react-icons/fi"
import ProductSection from "./sub-components/product-section"
import FooterButtons from "./sub-components/FooterButtons"
import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import { notifySuccess, notifyError } from "@/utils/toast"
import request from "@/services/httpService"
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

export default function ProductInfo({ selectedBusiness, contractId }) {
  // State moved from useProductInfo hook
  const [sections, setSections] = useState([
    {
      id: uuidv4(),
      title: "",
      item: "",
      quantityMTS: "",
      quantityFCL: "",
      containerWeight: "",
      itemId: '',
      fclSize: "",
      toIssue: "",
      price: "",
      deposit: "",
      totalValue: "",
      selectedCurrency: null,
      conversionRate: "",
      amountInSelectedCurrency: "",
      productType: "",
      packing: "",
      shippingTerms: "",
      paymentTerms: "",
      grade: "",
      containerType: "",
      unitOfContainer: "",
      No_of_Packages: "",
      remarks: "",
    },
  ])
  const [items, setItems] = useState([])

  // Fetch items when component mounts or selectedBusiness changes
  useEffect(() => {
    if (selectedBusiness) {
      fetchItems()
    }
  }, [selectedBusiness])

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${Base_URL}/items?businessId=${selectedBusiness}&active=true`)
      if (response.status === 200) {
        setItems(response.data || [])
      }
    } catch (error) {
      console.error("Error fetching items:", error)
      notifyError("Failed to load items")
    }
  }

  // Section management functions
  const addSection = () => {
    setSections([
      ...sections,
      {
        id: uuidv4(),
        title: ``,
        item: "",
        quantityMTS: "",
        quantityFCL: "",
        containerWeight: "",
        fclSize: "",
        itemId: '',
        toIssue: "",
        price: "",
        deposit: "",
        totalValue: "",
        selectedCurrency: null,
        conversionRate: "",
        amountInSelectedCurrency: "",
        productType: "",
        packing: "",
        shippingTerms: "",
        paymentTerms: "",
        grade: "",
        containerType: "",
        unitOfContainer: "",
        No_of_Packages: "",
        remarks: "",
      },
    ])
  }

  const removeSection = (id) => {
    setSections(sections.filter((section) => section.id !== id))
  }

  const updateSection = (id, field, value) => {
    setSections(sections.map((section) => (section.id === id ? { ...section, [field]: value } : section)))
  }

  // Save and cancel handlers

  const handleSave = async () => {
    const requiredFields = [
      // "title",
      // "item",
      "quantityMTS",
      "quantityFCL",
      "containerWeight",
      "itemId",
      "fclSize",
      "toIssue",
      "price",
      "deposit",
      "totalValue",
      // "selectedCurrency",
      // "conversionRate",
      // "amountInSelectedCurrency",
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

    // if (emptyFieldsBySection.length > 0) {
    //   const errorMessage = emptyFieldsBySection
    //     .map((section) => {
    //       const fieldNames = section.emptyFields
    //         .map((field) => field.replace(/([A-Z])/g, " $1").toLowerCase())
    //         .join(", ")
    //       return `Section ${section.sectionIndex}: Missing ${fieldNames}`
    //     })
    //     .join("\n")

    //   notifyError(`Please fill in all required fields:\n${errorMessage}`)
    //   return
    // }

    const formattedSections = sections.map((section) => ({
      title: section.item,
      purchaseContract: section.purchaseContract || "",
      item: section.itemId,
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
      console.log("formattedSections",formattedSections)
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
    // Reset form or navigate back
    setSections([
      {
        id: uuidv4(),
        title: "Product 1",
        item: "",
        quantityMTS: "",
        quantityFCL: "",
        containerWeight: "",
        fclSize: "",
        itemId: '',
        toIssue: "",
        price: "",
        deposit: "",
        totalValue: "",
        selectedCurrency: null,
        conversionRate: "",
        amountInSelectedCurrency: "",
        productType: "",
        packing: "",
        shippingTerms: "",
        paymentTerms: "",
        grade: "",
        containerType: "",
        unitOfContainer: "",
        No_of_Packages: "",
        remarks: "",
      },
    ])
  }

  // Filter out items with status "Inactive"
  const activeItems = items.filter((item) => item.status !== "Inactive")

  return (
    <div className="mx-auto p-4 space-y-4">
      {sections.map((section) => (
        <ProductSection
          selectedBusiness={selectedBusiness}
          key={section.id}
          section={section}
          items={activeItems}
          onUpdate={(field, value) => updateSection(section.id, field, value)}
          onRemove={() => removeSection(section.id)}
        />
      ))}
      <button onClick={addSection} className="flex items-center text-[#98b93c] gap-1 hover:underline">
        <FiPlus /> Add More
      </button>
      <FooterButtons onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}
