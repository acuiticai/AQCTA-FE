"use client"

import { ChevronRight } from "lucide-react"

export default function LeftSidebar({ activeTab, activeItem, onItemSelect }) {
  // Define sidebar items based on active tab
  const getSidebarItems = () => {
    switch (activeTab) {
      case "general":
        return [
          { id: "template-properties", label: "Template Properties" },
          { id: "font", label: "Font" },
          { id: "background", label: "Background" },
          { id: "logo-position", label: "Logo Position" },
          { id: "label-editor", label: "Field Labels" },
          { id: "sections-manager", label: "Sections Manager" },
        ]
      case "header-footer":
        return [
          { id: "header", label: "Header" },
          { id: "footer", label: "Footer" },
        ]
      case "transaction":
        return [
          { id: "organization-detail", label: "Organization Detail" },
          { id: "customer-detail", label: "Customer Detail" },
          { id: "document-detail", label: "Document Detail" },
        ]
      case "table":
        return [
          { id: "labels", label: "Labels" },
          { id: "layout", label: "Layout" },
          { id: "table-manager", label: "Table Manager" },
        ]
      case "total":
        return [
          { id: "layout", label: "Layout" },
          { id: "terms-editor", label: "Terms & Conditions" },
          { id: "remarks-editor", label: "Remarks" },
        ]
      case "more":
        return [
          { id: "organization-detail", label: "Organization Detail" },
          { id: "signees-manager", label: "Signees Manager" },
          { id: "page-breaks", label: "Page Breaks" },
        ]
      default:
        return [
          { id: "template-properties", label: "Template Properties" },
          { id: "font", label: "Font" },
          { id: "background", label: "Background" },
        ]
    }
  }

  const sidebarItems = getSidebarItems()

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      {sidebarItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onItemSelect(item.id)}
          className={`flex justify-between items-center w-full px-4 py-3 text-left text-sm border-b border-gray-100 hover:bg-gray-50 transition-colors ${
            activeItem === item.id ? "bg-lime-500 text-white hover:bg-lime-500" : ""
          }`}
        >
          {item.label}
          <ChevronRight className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}

