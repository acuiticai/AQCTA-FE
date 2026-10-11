"use client"

import { useState } from "react"
import {
  FileText,
  Layout,
  Table,
  CreditCard,
  FileSpreadsheet,
  Undo2,
  RefreshCw,
  Save,
  Plus,
  FileDown,
  Trash2,
} from "lucide-react"

export default function TopNavigation({
  activeTab,
  onTabChange,
  onSave,
  onNew,
  onDelete,
  onToggleTemplates,
  saveStatus,
  templateName,
  onTemplateNameChange,
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState(templateName)

  const tabs = [
    { id: "general", label: "General", icon: FileText },
    { id: "header-footer", label: "Header & Footer", icon: Layout },
    { id: "transaction", label: "Transaction Details", icon: FileSpreadsheet },
    { id: "table", label: "Table", icon: Table },
    { id: "total", label: "Total", icon: CreditCard },
    { id: "more", label: "Additional", icon: FileSpreadsheet },
  ]

  const handleNameClick = () => {
    setTempName(templateName)
    setIsEditingName(true)
  }

  const handleNameChange = (e) => {
    setTempName(e.target.value)
  }

  const handleNameBlur = () => {
    if (tempName.trim()) {
      onTemplateNameChange(tempName)
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      if (tempName.trim()) {
        onTemplateNameChange(tempName)
      }
      setIsEditingName(false)
    } else if (e.key === "Escape") {
      setIsEditingName(false)
    }
  }

  return (
    <div className="flex flex-col border-b border-gray-200 bg-white">
      {/* Template name and actions */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
        <div className="flex items-center">
          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="px-2 py-1 border border-gray-300 rounded-md text-lg font-medium"
              autoFocus
            />
          ) : (
            <h1 className="text-lg font-medium cursor-pointer hover:text-lime-600" onClick={handleNameClick}>
              {templateName}
            </h1>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="flex items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            onClick={onToggleTemplates}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Templates
          </button>
          <button
            className="flex items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            onClick={onNew}
          >
            <Plus className="w-4 h-4 mr-2" />
            New
          </button>
          <button
            className="flex items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
          <button
            className={`flex items-center px-3 py-1.5 text-sm rounded-md ${
              saveStatus === "saving"
                ? "bg-gray-300 text-gray-700"
                : saveStatus === "saved"
                  ? "bg-green-500 text-white"
                  : saveStatus === "error"
                    ? "bg-red-500 text-white"
                    : "bg-lime-500 text-white hover:bg-lime-600"
            }`}
            onClick={onSave}
            disabled={saveStatus === "saving"}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "Saved!"
                : saveStatus === "error"
                  ? "Error!"
                  : "Save"}
          </button>
        </div>
      </div>

      {/* Tabs and actions */}
      <div className="flex justify-between items-center px-4 py-2">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                  isActive ? "bg-lime-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center space-x-2">
          <button className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
            <Undo2 className="w-4 h-4 mr-2" />
            Undo
          </button>
          <button className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Preview
          </button>
          <button className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
        </div>
      </div>
    </div>
  )
}

