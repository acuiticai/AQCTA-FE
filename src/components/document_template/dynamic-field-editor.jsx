"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown } from "lucide-react"

export default function DynamicFieldEditor({ dynamicFields, onDynamicFieldsChange }) {
  const [expanded, setExpanded] = useState(true)

  const addDynamicField = () => {
    onDynamicFieldsChange([
      ...dynamicFields,
      { id: `field-${Date.now()}`, label: "", placeholder: "", type: "text", required: false },
    ])
  }

  const removeDynamicField = (index) => {
    const newFields = [...dynamicFields]
    newFields.splice(index, 1)
    onDynamicFieldsChange(newFields)
  }

  const updateDynamicField = (index, field, value) => {
    const newFields = [...dynamicFields]
    newFields[index] = { ...newFields[index], [field]: value }
    onDynamicFieldsChange(newFields)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Dynamic Fields</h3>
        <button onClick={() => setExpanded(!expanded)}>
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? "transform rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {dynamicFields.map((field, index) => (
            <div key={field.id} className="border border-gray-200 rounded-md p-3 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Field {index + 1}</h4>
                <button onClick={() => removeDynamicField(index)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Label</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateDynamicField(index, "label", e.target.value)}
                    placeholder="Field Label"
                    className="w-full p-1.5 text-sm border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={(e) => updateDynamicField(index, "placeholder", e.target.value)}
                    placeholder="Placeholder Text"
                    className="w-full p-1.5 text-sm border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateDynamicField(index, "type", e.target.value)}
                    className="w-full p-1.5 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="textarea">Text Area</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`required-${field.id}`}
                    checked={field.required}
                    onChange={(e) => updateDynamicField(index, "required", e.target.checked)}
                    className="w-4 h-4 border-gray-300 rounded"
                  />
                  <label htmlFor={`required-${field.id}`} className="ml-2 text-sm text-gray-700">
                    Required Field
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 p-2 rounded-md">
                <p className="text-xs text-gray-500">
                  <strong>Template Variable:</strong>{" "}
                  <code className="bg-gray-200 px-1 py-0.5 rounded">{`{{${field.label.toLowerCase().replace(/\s+/g, "_")}}}`}</code>
                </p>
              </div>
            </div>
          ))}

          <button
            onClick={addDynamicField}
            className="flex items-center justify-center w-full py-2 border border-dashed border-gray-300 rounded-md text-lime-500 hover:text-lime-700"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Dynamic Field
          </button>

          <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> Dynamic fields define what data will be collected when creating a document from
              this template. Use the template variables in your document content.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

