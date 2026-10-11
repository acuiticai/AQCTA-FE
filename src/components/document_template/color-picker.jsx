"use client"

import { useState, useRef, useEffect } from "react"

export default function ColorPicker({ color, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(color)
  const pickerRef = useRef(null)

  // Update input value when color prop changes
  useEffect(() => {
    setInputValue(color)
  }, [color])

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleInputChange = (e) => {
    const value = e.target.value
    setInputValue(value)

    // Only update parent if it's a valid color
    if (value.match(/^#([0-9A-F]{3}){1,2}$/i)) {
      onChange(value)
    }
  }

  const handleColorChange = (e) => {
    const value = e.target.value
    setInputValue(value)
    onChange(value)
  }

  return (
    <div className="flex items-center space-x-2 relative" ref={pickerRef}>
      <div className="w-full">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="#RRGGBB"
        />
      </div>
      <div
        className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
        style={{ backgroundColor: color }}
        onClick={() => setIsOpen(!isOpen)}
      ></div>

      {isOpen && (
        <div className="absolute right-0 top-12 z-10 bg-white border border-gray-300 rounded-md p-2 shadow-lg">
          <input type="color" value={color} onChange={handleColorChange} className="w-32 h-32" />
        </div>
      )}
    </div>
  )
}

