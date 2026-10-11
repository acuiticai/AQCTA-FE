"use client"

import { useState, useEffect } from "react"
import { FiX, FiFilter, FiCheck } from "react-icons/fi"
import { useTranslation } from "react-i18next"

const SearchBar = ({ isOpen, onClose, onApplyFilters, initialFilters, onreset }) => {
  const { t } = useTranslation()
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options })

  const [filters, setFilters] = useState({
    name: "",
    file_type: "",
    createdByMe: false,
    hasSalesContract: false,
    hasPurchaseContract: false,
    hasCustomer: false,
    hasVendor: false,
    deletedOnly: false,
    sharedTo: "",
    dateCreated: "Any time"
  });

  useEffect(() => {
    if (initialFilters) {
      setFilters((prev) => ({
        ...prev,
        ...initialFilters,
      }))
    }
  }, [initialFilters, isOpen])

  const handleReset = () => {
    const defaultFilters = {
      name: "",
      file_type: "",
      createdByMe: false,
      hasSalesContract: false,
      hasPurchaseContract: false,
      hasCustomer: false,
      hasVendor: false,
      deletedOnly: false,
      sharedTo: "",
      dateCreated: "Any time"
    };
    setFilters(defaultFilters);
    onreset();
  }

  const handleSearch = () => {
    onApplyFilters(filters)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFilters({
      ...filters,
      [name]: type === "checkbox" ? checked : value,
    })
  }

  if (!isOpen) return null

  const checkboxItems = [
    { key: "createdByMe", label: dm("createdByMe", "Created By Me") },
    { key: "hasSalesContract", label: dm("salesContract", "Sales Contract") },
    { key: "hasPurchaseContract", label: dm("purchaseContract", "Purchase Contract") },
    { key: "hasCustomer", label: dm("customerAttached", "Customer Attached") },
    { key: "hasVendor", label: dm("vendorAttached", "Vendor Attached") },
    { key: "deletedOnly", label: dm("deletedItemsOnly", "Deleted Items Only") },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50 overflow-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center">
            <FiFilter className="mr-2" /> {dm("searchFilters", "Search Filters")}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors" aria-label={dm("close", "Close")}>
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <label className="block font-medium">{dm("documentTitle", "Document Title")}</label>
          <input
            type="text"
            name="name"
            value={filters.name}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
            placeholder={dm("documentTitlePlaceholder", "e.g., invoice.pdf")}
          />
        </div>

        <div className="space-y-2 mb-4">
          <label className="block font-medium">{dm("fileType", "File Type")}</label>
          <select
            name="file_type"
            value={filters.file_type}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
          >
            <option value="">{dm("any", "Any")}</option>
            <option value="pdf">{dm("pdf", "PDF")}</option>
            <option value="docx">{dm("docx", "DOCX")}</option>
            <option value="png">{dm("image", "Image")}</option>
            <option value="xlsx">{dm("excel", "Excel")}</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {checkboxItems.map((item) => (
            <label key={item.key} className="flex items-center gap-2 border rounded p-2">
              <input
                type="checkbox"
                name={item.key}
                checked={filters[item.key]}
                onChange={handleInputChange}
              />
              {item.label}
            </label>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          <label className="block font-medium">{dm("sharedTo", "Shared To")}</label>
          <input
            type="text"
            name="sharedTo"
            value={filters.sharedTo}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
            placeholder={dm("enterUserIdOrEmail", "Enter user ID or email")}
          />
        </div>

        <div className="space-y-2 mb-4">
          <label className="block font-medium">{dm("dateCreated", "Date Created")}</label>
          <select
            name="dateCreated"
            value={filters.dateCreated}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
          >
            <option value="Any time">{dm("anyTime", "Any time")}</option>
            <option value="Today">{dm("today", "Today")}</option>
            <option value="Last 7 days">{dm("last7Days", "Last 7 days")}</option>
            <option value="Last 30 days">{dm("last30Days", "Last 30 days")}</option>
          </select>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center"
          >
            <FiX className="mr-1" /> {dm("reset", "Reset")}
          </button>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
          >
            <FiCheck className="mr-1" /> {dm("applyFilters", "Apply Filters")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SearchBar
