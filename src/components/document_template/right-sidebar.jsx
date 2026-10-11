"use client"

import { useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import FileUpload from "./file-upload"
import ColorPicker from "./color-picker"
import TableManager from "./table-manager"
import SigneesManager from "./signees-manager"
import SectionManager from "./section-manager"
import TermsEditor from "./terms-editor"
import RemarksEditor from "./remarks-editor"
import LabelEditor from "./label-editor"
import LogoPositionEditor from "./logo-position-editor"
import PageBreakControl from "./page-break-control"
import DynamicFieldEditor from "./dynamic-field-editor"

export default function RightSidebar({ activeTab, contentType, documentState, updateDocumentState }) {
  // Render different content based on contentType
  const renderContent = () => {
    switch (contentType) {
      case "font":
        return <FontSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "background-image":
        return <BackgroundImageSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "customer-name":
        return <CustomerNameSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "field-config":
        return <FieldConfigSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "total-section":
        return <TotalSectionSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "template-properties":
        return <TemplatePropertiesSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "organization-detail":
        return <OrganizationDetailSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "document-title":
        return <DocumentTitleSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "table-manager":
        return <TableManagerSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "signees-manager":
        return <SigneesManagerSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "sections-manager":
        return <SectionsManagerSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "terms-editor":
        return <TermsEditorSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "remarks-editor":
        return <RemarksEditorSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "label-editor":
        return <LabelEditorSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "logo-position":
        return <LogoPositionSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "page-breaks":
        return <PageBreakSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      case "dynamic-fields":
        return <DynamicFieldsSettings documentState={documentState} updateDocumentState={updateDocumentState} />
      default:
        return <FontSettings documentState={documentState} updateDocumentState={updateDocumentState} />
    }
  }

  return <div className="w-300 bg-white border-l border-gray-200 overflow-y-auto p-4">{renderContent()}</div>
}

function FontSettings({ documentState, updateDocumentState }) {
  const handleChange = (field, value) => {
    updateDocumentState("font", field, value)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-500">Font</h3>

      <div className="space-y-2">
        <div className="relative">
          <select
            className="w-full p-2 pr-8 border border-gray-300 rounded-md bg-white appearance-none"
            value={documentState.font.family}
            onChange={(e) => handleChange("family", e.target.value)}
          >
            <option>Select Font</option>
            <option>Arial</option>
            <option>Helvetica</option>
            <option>Times New Roman</option>
            <option>Calibri</option>
            <option>Verdana</option>
            <option>Georgia</option>
            <option>Tahoma</option>
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label Color</label>
          <ColorPicker color={documentState.font.labelColor} onChange={(value) => handleChange("labelColor", value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Font Color</label>
          <ColorPicker color={documentState.font.fontColor} onChange={(value) => handleChange("fontColor", value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
        <div className="flex items-center">
          <input
            type="text"
            value={documentState.font.fontSize}
            onChange={(e) => handleChange("fontSize", Number.parseInt(e.target.value) || 12)}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
          <div className="flex flex-col ml-2">
            <button
              className="border border-gray-300 px-1 rounded-t"
              onClick={() => handleChange("fontSize", documentState.font.fontSize + 1)}
            >
              ▲
            </button>
            <button
              className="border border-gray-300 px-1 rounded-b border-t-0"
              onClick={() => handleChange("fontSize", Math.max(1, documentState.font.fontSize - 1))}
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BackgroundImageSettings({ documentState, updateDocumentState }) {
  const handleChange = (field, value) => {
    updateDocumentState("background", field, value)
  }

  const handleFileSelect = (file, fileUrl) => {
    handleChange("image", fileUrl)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-500">Background Image</h3>

      <FileUpload
        onFileSelect={handleFileSelect}
        currentFile={documentState.background.image}
        label="Upload Background Image"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Image Position</label>
        <div className="relative">
          <select
            className="w-full p-2 pr-8 border border-gray-300 rounded-md bg-white appearance-none"
            value={documentState.background.position}
            onChange={(e) => handleChange("position", e.target.value)}
          >
            <option>Center Centre</option>
            <option>Top Left</option>
            <option>Top Right</option>
            <option>Bottom Left</option>
            <option>Bottom Right</option>
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
        <ColorPicker color={documentState.background.color} onChange={(value) => handleChange("color", value)} />
      </div>
    </div>
  )
}

function CustomerNameSettings({ documentState, updateDocumentState }) {
  const handleChange = (field, value) => {
    updateDocumentState("customer", field, value)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Customer Details</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Label</label>
        <input
          type="text"
          value={documentState.customer.label || "Buyer:"}
          onChange={(e) => handleChange("label", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Buyer:"
        />
        <p className="text-xs text-gray-500 mt-1">This is the label shown before the customer name</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address Label</label>
        <input
          type="text"
          value={documentState.customer.addressLabel || "Address:"}
          onChange={(e) => handleChange("addressLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Address:"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Font Color</label>
        <ColorPicker color={documentState.customer.fontColor} onChange={(value) => handleChange("fontColor", value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
        <div className="flex items-center">
          <input
            type="text"
            value={documentState.customer.fontSize}
            onChange={(e) => handleChange("fontSize", Number.parseInt(e.target.value) || 12)}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
          <div className="flex flex-col ml-2">
            <button
              className="border border-gray-300 px-1 rounded-t"
              onClick={() => handleChange("fontSize", documentState.customer.fontSize + 1)}
            >
              ▲
            </button>
            <button
              className="border border-gray-300 px-1 rounded-b border-t-0"
              onClick={() => handleChange("fontSize", Math.max(1, documentState.customer.fontSize - 1))}
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> These settings only affect how customer information will appear in the template. Actual
          customer data will be populated when creating a document.
        </p>
      </div>
    </div>
  )
}

function TermsEditorSettings({ documentState, updateDocumentState }) {
  const handleTermsChange = (newTermsHtml) => {
    updateDocumentState("", "termsHtml", newTermsHtml)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Terms & Conditions</h3>

      <TermsEditor termsHtml={documentState.termsHtml} onTermsChange={handleTermsChange} />
    </div>
  )
}

function RemarksEditorSettings({ documentState, updateDocumentState }) {
  const handleRemarksChange = (newRemarksHtml) => {
    updateDocumentState("", "remarksHtml", newRemarksHtml)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Remarks</h3>

      <RemarksEditor remarksHtml={documentState.remarksHtml} onRemarksChange={handleRemarksChange} />
    </div>
  )
}

function LogoPositionSettings({ documentState, updateDocumentState }) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Logo Settings</h3>

      <LogoPositionEditor
        logoSettings={documentState.logoSettings || { position: "top-left", size: 64, visible: true }}
        onLogoSettingsChange={(settings) => updateDocumentState("", "logoSettings", settings)}
      />
    </div>
  )
}

function LabelEditorSettings({ documentState, updateDocumentState }) {
  const handleLabelsChange = (newLabels) => {
    updateDocumentState("", "fieldLabels", newLabels)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Field Labels</h3>

      <LabelEditor labels={documentState.fieldLabels || {}} onLabelsChange={handleLabelsChange} />
    </div>
  )
}

function SigneesManagerSettings({ documentState, updateDocumentState }) {
  const handleSigneesChange = (newSignees) => {
    updateDocumentState("", "signees", newSignees)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Signees</h3>

      <SigneesManager signees={documentState.signees || []} onSigneesChange={handleSigneesChange} />

      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> These settings define the signature sections in your template. Actual signee
          information will be populated when creating a document.
        </p>
      </div>
    </div>
  )
}

function PageBreakSettings({ documentState, updateDocumentState }) {
  const handlePageBreaksChange = (newPageBreaks) => {
    updateDocumentState("", "pageBreaks", newPageBreaks)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Page Breaks</h3>

      <PageBreakControl pageBreaks={documentState.pageBreaks || []} onPageBreaksChange={handlePageBreaksChange} />
    </div>
  )
}

function FieldConfigSettings({ documentState, updateDocumentState }) {
  const handleChange = (field, subfield, value) => {
    const updatedConfig = { ...documentState.tableConfig[field], [subfield]: value }
    updateDocumentState("tableConfig", field, updatedConfig)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Field</h3>
        <h3 className="text-sm font-medium text-gray-700">Width(%)</h3>
        <h3 className="text-sm font-medium text-gray-700">Label</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <div
            className={`w-5 h-5 ${documentState.tableConfig.lineItemNumber.show ? "bg-lime-500" : "bg-gray-200"} rounded-md flex items-center justify-center cursor-pointer`}
            onClick={() => handleChange("lineItemNumber", "show", !documentState.tableConfig.lineItemNumber.show)}
          >
            {documentState.tableConfig.lineItemNumber.show && <Check className="w-4 h-4 text-white" />}
          </div>
          <span className="text-sm flex-1">Line Item Number</span>
          <input
            type="text"
            value={documentState.tableConfig.lineItemNumber.width}
            onChange={(e) => handleChange("lineItemNumber", "width", Number.parseInt(e.target.value) || 0)}
            className="w-16 p-1 border border-gray-300 rounded-md"
          />
          <div className="flex flex-col ml-1 mr-2">
            <button
              className="border border-gray-300 px-1 rounded-t"
              onClick={() =>
                handleChange("lineItemNumber", "width", documentState.tableConfig.lineItemNumber.width + 1)
              }
            >
              ▲
            </button>
            <button
              className="border border-gray-300 px-1 rounded-b border-t-0"
              onClick={() =>
                handleChange("lineItemNumber", "width", Math.max(1, documentState.tableConfig.lineItemNumber.width - 1))
              }
            >
              ▼
            </button>
          </div>
          <input
            type="text"
            value={documentState.tableConfig.lineItemNumber.label}
            onChange={(e) => handleChange("lineItemNumber", "label", e.target.value)}
            className="w-16 p-1 border border-gray-300 rounded-md"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div
            className={`w-5 h-5 ${documentState.tableConfig.item.show ? "bg-lime-500" : "bg-gray-200"} rounded-md flex items-center justify-center cursor-pointer`}
            onClick={() => handleChange("item", "show", !documentState.tableConfig.item.show)}
          >
            {documentState.tableConfig.item.show && <Check className="w-4 h-4 text-white" />}
          </div>
          <span className="text-sm flex-1">Item</span>
          <input
            type="text"
            value={documentState.tableConfig.item.width}
            onChange={(e) => handleChange("item", "width", Number.parseInt(e.target.value) || 0)}
            className="w-16 p-1 border border-gray-300 rounded-md"
          />
          <div className="flex flex-col ml-1 mr-2">
            <button
              className="border border-gray-300 px-1 rounded-t"
              onClick={() => handleChange("item", "width", documentState.tableConfig.item.width + 1)}
            >
              ▲
            </button>
            <button
              className="border border-gray-300 px-1 rounded-b border-t-0"
              onClick={() => handleChange("item", "width", Math.max(1, documentState.tableConfig.item.width - 1))}
            >
              ▼
            </button>
          </div>
          <input
            type="text"
            value={documentState.tableConfig.item.label}
            onChange={(e) => handleChange("item", "label", e.target.value)}
            className="w-16 p-1 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> These settings only affect how table fields will appear in the template. Actual data
          will be populated when creating a document.
        </p>
      </div>
    </div>
  )
}

function TemplatePropertiesSettings({ documentState, updateDocumentState }) {
  const handlePaperSizeChange = (size) => {
    updateDocumentState("", "paperSize", size)
  }

  const handleOrientationChange = (orientation) => {
    updateDocumentState("", "orientation", orientation)
  }

  const handleMarginChange = (side, value) => {
    updateDocumentState("margins", side, Number.parseFloat(value) || 0.7)
  }

  const handleTemplateNameChange = (value) => {
    updateDocumentState("", "templateName", value)
  }

  const handleTemplateTypeChange = (value) => {
    updateDocumentState("", "documentType", value)
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
        <input
          type="text"
          value={documentState.templateName}
          onChange={(e) => handleTemplateNameChange(e.target.value)}
          placeholder="Enter Template Name"
          className="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
        <select
          value={documentState.documentType}
          onChange={(e) => handleTemplateTypeChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="invoice">Invoice</option>
          <option value="payslip">Payslip</option>
          <option value="saleorder">Sale order</option>
          <option value="quotation">Quotation</option>
          <option value="payment">Payment</option>
          <option value="workorder">Work order</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
        <div className="flex space-x-4 mt-2">
          <div className="flex items-center">
            <input
              type="radio"
              id="a5"
              name="paperSize"
              checked={documentState.paperSize === "A5"}
              onChange={() => handlePaperSizeChange("A5")}
              className="w-4 h-4 text-lime-500"
            />
            <label htmlFor="a5" className="ml-2 text-sm text-gray-700">
              A5
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="radio"
              id="a4"
              name="paperSize"
              checked={documentState.paperSize === "A4"}
              onChange={() => handlePaperSizeChange("A4")}
              className="w-4 h-4 text-lime-500"
            />
            <label htmlFor="a4" className="ml-2 text-sm text-gray-700">
              A4
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="radio"
              id="letter"
              name="paperSize"
              checked={documentState.paperSize === "Letter"}
              onChange={() => handlePaperSizeChange("Letter")}
              className="w-4 h-4 text-lime-500"
            />
            <label htmlFor="letter" className="ml-2 text-sm text-gray-700">
              Letter
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Orientation</label>
        <div className="flex space-x-4 mt-2">
          <div className="flex items-center">
            <input
              type="radio"
              id="portrait"
              name="orientation"
              checked={documentState.orientation === "Portrait"}
              onChange={() => handleOrientationChange("Portrait")}
              className="w-4 h-4 text-lime-500"
            />
            <label htmlFor="portrait" className="ml-2 text-sm text-gray-700">
              Portrait
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="radio"
              id="landscape"
              name="orientation"
              checked={documentState.orientation === "Landscape"}
              onChange={() => handleOrientationChange("Landscape")}
              className="w-4 h-4 text-lime-500"
            />
            <label htmlFor="landscape" className="ml-2 text-sm text-gray-700">
              Landscape
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Margin (in inches)</label>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Top</label>
            <input
              type="text"
              value={documentState.margins.top}
              onChange={(e) => handleMarginChange("top", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bottom</label>
            <input
              type="text"
              value={documentState.margins.bottom}
              onChange={(e) => handleMarginChange("bottom", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Left</label>
            <input
              type="text"
              value={documentState.margins.left}
              onChange={(e) => handleMarginChange("left", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Right</label>
            <input
              type="text"
              value={documentState.margins.right}
              onChange={(e) => handleMarginChange("right", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function OrganizationDetailSettings({ documentState, updateDocumentState }) {
  const handleChange = (field, value) => {
    updateDocumentState("company", field, value)
  }

  const handleLogoSelect = (file, fileUrl) => {
    updateDocumentState("", "logo", fileUrl)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Organization Details</h3>

      <FileUpload onFileSelect={handleLogoSelect} currentFile={documentState.logo} label="Upload Company Logo" />

      <LogoPositionEditor
        logoSettings={documentState.logoSettings || { position: "top-left", size: 64, visible: true }}
        onLogoSettingsChange={(settings) => updateDocumentState("", "logoSettings", settings)}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name Label</label>
        <input
          type="text"
          value={documentState.company.nameLabel || "From:"}
          onChange={(e) => handleChange("nameLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="From:"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Website Label</label>
        <input
          type="text"
          value={documentState.company.websiteLabel || "Website:"}
          onChange={(e) => handleChange("websiteLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Website:"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Label</label>
        <input
          type="text"
          value={documentState.company.emailLabel || "Email:"}
          onChange={(e) => handleChange("emailLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Email:"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Label</label>
        <input
          type="text"
          value={documentState.company.phoneLabel || "Tel:"}
          onChange={(e) => handleChange("phoneLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Tel:"
        />
      </div>

      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> These settings only affect how company information will appear in the template. Actual
          company data will be populated when creating a document.
        </p>
      </div>
    </div>
  )
}

function DocumentTitleSettings({ documentState, updateDocumentState }) {
  const handleInvoiceChange = (field, value) => {
    updateDocumentState("invoice", field, value)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Document Information</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Document Title Label</label>
        <input
          type="text"
          value={documentState.invoice.subjectLabel || "Subject:"}
          onChange={(e) => handleInvoiceChange("subjectLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Subject:"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Document Number Label</label>
        <input
          type="text"
          value={documentState.invoice.numberLabel || "Number:"}
          onChange={(e) => handleInvoiceChange("numberLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Number:"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reference Label</label>
        <input
          type="text"
          value={documentState.invoice.referenceLabel || "Reference:"}
          onChange={(e) => handleInvoiceChange("referenceLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Reference:"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date Label</label>
        <input
          type="text"
          value={documentState.invoice.dateLabel || "Date:"}
          onChange={(e) => handleInvoiceChange("dateLabel", e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Date:"
        />
      </div>

      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> These settings only affect how document information will appear in the template. Actual
          document data will be populated when creating a document.
        </p>
      </div>
    </div>
  )
}

function TableManagerSettings({ documentState, updateDocumentState }) {
  const handleItemsChange = (newItems) => {
    // Calculate totals
    const subtotal = newItems.reduce((sum, item) => sum + item.amount, 0)
    const tax = subtotal * (documentState.totals.taxRate / 100)
    const total = subtotal + tax

    // Update items and totals
    updateDocumentState("", "items", newItems)
    updateDocumentState("totals", "subtotal", subtotal)
    updateDocumentState("totals", "tax", tax)
    updateDocumentState("totals", "total", total)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Table Items</h3>

      <TableManager items={documentState.items} onItemsChange={handleItemsChange} />

      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700">Totals</h4>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Subtotal:</span>
            <span className="text-sm font-medium">${documentState.totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Tax ({documentState.totals.taxRate}%):</span>
            <span className="text-sm font-medium">${documentState.totals.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Total:</span>
            <span className="text-sm font-medium">${documentState.totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> These are sample items for preview purposes. Actual items will be populated when
          creating a document from this template.
        </p>
      </div>
    </div>
  )
}

function SectionsManagerSettings({ documentState, updateDocumentState }) {
  const handleSectionsChange = (newSections) => {
    updateDocumentState("", "sections", newSections)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Document Sections</h3>

      <SectionManager sections={documentState.sections || []} onSectionsChange={handleSectionsChange} />

      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> Sections help organize your document structure. You can add, remove, and reorder
          sections as needed.
        </p>
      </div>
    </div>
  )
}

function TotalSectionSettings({ documentState, updateDocumentState }) {
  const [expanded, setExpanded] = useState(true)

  const handleChange = (field, value) => {
    updateDocumentState("totals", field, value)
  }

  const handleTaxSummaryChange = (value) => {
    updateDocumentState("", "showTaxSummary", value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Total Section</h3>
        <button onClick={() => setExpanded(!expanded)}>
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? "transform rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Total Labels</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal Label</label>
            <input
              type="text"
              value={documentState.totals.subtotalLabel || "Subtotal"}
              onChange={(e) => handleChange("subtotalLabel", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Subtotal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Label</label>
            <input
              type="text"
              value={documentState.totals.taxLabel || "Tax"}
              onChange={(e) => handleChange("taxLabel", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Tax"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Label</label>
            <input
              type="text"
              value={documentState.totals.totalLabel || "Total"}
              onChange={(e) => handleChange("totalLabel", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Total"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
            <div className="flex items-center">
              <input
                type="text"
                value={documentState.totals.fontSize}
                onChange={(e) => handleChange("fontSize", Number.parseInt(e.target.value) || 50)}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <div className="flex flex-col ml-2">
                <button
                  className="border border-gray-300 px-1 rounded-t"
                  onClick={() => handleChange("fontSize", documentState.totals.fontSize + 1)}
                >
                  ▲
                </button>
                <button
                  className="border border-gray-300 px-1 rounded-b border-t-0"
                  onClick={() => handleChange("fontSize", Math.max(1, documentState.totals.fontSize - 1))}
                >
                  ▼
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Font Color</label>
              <ColorPicker
                color={documentState.totals.fontColor}
                onChange={(value) => handleChange("fontColor", value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
              <ColorPicker
                color={documentState.totals.backgroundColor}
                onChange={(value) => handleChange("backgroundColor", value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Taxes</h3>
          <button>
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={documentState.showTaxSummary}
              onChange={() => handleTaxSummaryChange(!documentState.showTaxSummary)}
              className="w-4 h-4 border-gray-300 rounded"
            />
            <label className="ml-2 text-sm text-gray-700">Show Tax Summary Table</label>
          </div>
        </div>
      </div>
    </div>
  )
}

function DynamicFieldsSettings({ documentState, updateDocumentState }) {
  const handleDynamicFieldsChange = (newFields) => {
    updateDocumentState("", "dynamicFields", newFields)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700">Dynamic Fields</h3>

      <DynamicFieldEditor
        dynamicFields={documentState.dynamicFields || []}
        onDynamicFieldsChange={handleDynamicFieldsChange}
      />
    </div>
  )
}

