"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

export default function LogoPositionEditor({ logoSettings, onLogoSettingsChange }) {
  const [expanded, setExpanded] = useState(true)

  const handleChange = (field, value) => {
    onLogoSettingsChange({
      ...logoSettings,
      [field]: value,
    })
  }

  const handleSizeChange = (value) => {
    // Ensure value is between 10 and 200
    const size = Math.max(10, Math.min(200, value))
    handleChange("size", size)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Logo Settings</h3>
        <button onClick={() => setExpanded(!expanded)}>
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? "transform rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                className={`p-2 border ${logoSettings.position === "top-left" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "top-left")}
              >
                Top Left
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "top-center" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "top-center")}
              >
                Top Center
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "top-right" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "top-right")}
              >
                Top Right
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "middle-left" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "middle-left")}
              >
                Middle Left
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "middle-center" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "middle-center")}
              >
                Middle Center
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "middle-right" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "middle-right")}
              >
                Middle Right
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "bottom-left" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "bottom-left")}
              >
                Bottom Left
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "bottom-center" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "bottom-center")}
              >
                Bottom Center
              </button>
              <button
                className={`p-2 border ${logoSettings.position === "bottom-right" ? "bg-lime-100 border-lime-500" : "border-gray-300"} rounded-md text-xs`}
                onClick={() => handleChange("position", "bottom-right")}
              >
                Bottom Right
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
            <div className="flex items-center">
              <input
                type="range"
                min="10"
                max="200"
                value={logoSettings.size}
                onChange={(e) => handleSizeChange(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex items-center ml-2">
                <input
                  type="text"
                  value={logoSettings.size}
                  onChange={(e) => handleSizeChange(Number(e.target.value) || 50)}
                  className="w-16 p-2 border border-gray-300 rounded-md text-center"
                />
                <span className="ml-1 text-xs text-gray-500">px</span>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-logo"
              checked={logoSettings.visible}
              onChange={(e) => handleChange("visible", e.target.checked)}
              className="w-4 h-4 border-gray-300 rounded"
            />
            <label htmlFor="show-logo" className="ml-2 text-sm text-gray-700">
              Show Logo
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

