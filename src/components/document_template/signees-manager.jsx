"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

export default function SigneesManager({ signees, onSigneesChange }) {
  const [expanded, setExpanded] = useState(true)

  const addSignee = () => {
    const newSignee = {
      title: "Authorized Signatory",
      name: "",
      company: "",
      showSignature: true,
      showStamp: true,
    }

    onSigneesChange([...signees, newSignee])
  }

  const removeSignee = (index) => {
    const newSignees = [...signees]
    newSignees.splice(index, 1)
    onSigneesChange(newSignees)
  }

  const updateSignee = (index, field, value) => {
    const newSignees = [...signees]
    newSignees[index] = { ...newSignees[index], [field]: value }
    onSigneesChange(newSignees)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Signees</h3>
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
          {signees.map((signee, index) => (
            <div key={index} className="border border-gray-200 rounded-md p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Signee {index + 1}</h4>
                <button onClick={() => removeSignee(index)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={signee.title}
                    onChange={(e) => updateSignee(index, "title", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="e.g. Authorized Signatory"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={signee.name}
                    onChange={(e) => updateSignee(index, "name", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Full Name"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Company</label>
                  <input
                    type="text"
                    value={signee.company}
                    onChange={(e) => updateSignee(index, "company", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Company Name"
                  />
                </div>

                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`show-signature-${index}`}
                      checked={signee.showSignature}
                      onChange={(e) => updateSignee(index, "showSignature", e.target.checked)}
                      className="w-4 h-4 border-gray-300 rounded"
                    />
                    <label htmlFor={`show-signature-${index}`} className="ml-2 text-sm text-gray-700">
                      Show Signature
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`show-stamp-${index}`}
                      checked={signee.showStamp}
                      onChange={(e) => updateSignee(index, "showStamp", e.target.checked)}
                      className="w-4 h-4 border-gray-300 rounded"
                    />
                    <label htmlFor={`show-stamp-${index}`} className="ml-2 text-sm text-gray-700">
                      Show Stamp
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addSignee}
            className="flex items-center justify-center w-full py-2 border border-dashed border-gray-300 rounded-md text-lime-500 hover:text-lime-700"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Signee
          </button>
        </div>
      )}
    </div>
  )
}

