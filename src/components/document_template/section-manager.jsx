"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react"

export default function SectionManager({ sections, onSectionsChange }) {
  const [expanded, setExpanded] = useState(true)
  const [expandedSections, setExpandedSections] = useState({})

  const addSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      title: "New Section",
      content: "",
      type: "text", // text, terms, table, signees
      isVisible: true,
      order: sections.length,
    }

    onSectionsChange([...sections, newSection])

    // Expand the new section
    setExpandedSections({
      ...expandedSections,
      [newSection.id]: true,
    })
  }

  const removeSection = (index) => {
    const newSections = [...sections]
    newSections.splice(index, 1)

    // Reorder sections
    newSections.forEach((section, idx) => {
      section.order = idx
    })

    onSectionsChange(newSections)
  }

  const updateSection = (index, field, value) => {
    const newSections = [...sections]
    newSections[index] = { ...newSections[index], [field]: value }
    onSectionsChange(newSections)
  }

  const moveSection = (index, direction) => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === sections.length - 1)) {
      return
    }

    const newSections = [...sections]
    const targetIndex = direction === "up" ? index - 1 : index + 1

    // Swap sections
    ;[newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]

    // Update order  newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]

    // Update order
    newSections.forEach((section, idx) => {
      section.order = idx
    })

    onSectionsChange(newSections)
  }

  const toggleSectionExpand = (sectionId) => {
    setExpandedSections({
      ...expandedSections,
      [sectionId]: !expandedSections[sectionId],
    })
  }

  const toggleSectionVisibility = (index) => {
    const newSections = [...sections]
    newSections[index].isVisible = !newSections[index].isVisible
    onSectionsChange(newSections)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Document Sections</h3>
        <button onClick={() => setExpanded(!expanded)}>
          <svg
            className={`w-5 h-5 transition-transform ${expanded ? "transform rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div key={section.id} className="border border-gray-200 rounded-md">
              <div
                className="flex justify-between items-center p-3 cursor-pointer bg-gray-50"
                onClick={() => toggleSectionExpand(section.id)}
              >
                <div className="flex items-center">
                  <GripVertical className="w-4 h-4 text-gray-400 mr-2 cursor-move" />
                  <h4 className="text-sm font-medium">{section.title}</h4>
                  {!section.isVisible && <span className="ml-2 text-xs text-gray-500 italic">(Hidden)</span>}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveSection(index, "up")
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={index === 0}
                  >
                    <ChevronUp className={`w-4 h-4 ${index === 0 ? "opacity-30" : ""}`} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveSection(index, "down")
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={index === sections.length - 1}
                  >
                    <ChevronDown className={`w-4 h-4 ${index === sections.length - 1 ? "opacity-30" : ""}`} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSection(index)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${expandedSections[section.id] ? "transform rotate-180" : ""}`}
                  />
                </div>
              </div>

              {expandedSections[section.id] && (
                <div className="p-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Section Title</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(index, "title", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Section Type</label>
                      <select
                        value={section.type}
                        onChange={(e) => updateSection(index, "type", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="header">Header</option>
                        <option value="content">Content</option>
                        <option value="table">Table</option>
                        <option value="shipping">Shipping Details</option>
                        <option value="payment">Payment Details</option>
                        <option value="terms">Terms & Conditions</option>
                        <option value="remarks">Remarks</option>
                        <option value="footer">Footer</option>
                        <option value="signees">Signees</option>
                        <option value="text">Custom Text</option>
                      </select>
                    </div>

                    {section.type === "text" && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Content</label>
                        <textarea
                          value={section.content}
                          onChange={(e) => updateSection(index, "content", e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
                        />
                      </div>
                    )}

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`section-visible-${index}`}
                        checked={section.isVisible}
                        onChange={() => toggleSectionVisibility(index)}
                        className="w-4 h-4 border-gray-300 rounded"
                      />
                      <label htmlFor={`section-visible-${index}`} className="ml-2 text-sm text-gray-700">
                        Visible in document
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addSection}
            className="flex items-center justify-center w-full py-2 border border-dashed border-gray-300 rounded-md text-lime-500 hover:text-lime-700"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Section
          </button>
        </div>
      )}
    </div>
  )
}

