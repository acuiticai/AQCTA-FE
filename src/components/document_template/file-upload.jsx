"use client"

import { useState } from "react"
import { Upload, X } from "lucide-react"

export default function FileUpload({ onFileSelect, currentFile, label = "Upload File" }) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState(currentFile)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file) => {
    // Create a preview URL
    const fileUrl = URL.createObjectURL(file)
    setPreview(fileUrl)

    // Pass the file to the parent component
    onFileSelect(file, fileUrl)
  }

  const clearFile = (e) => {
    e.stopPropagation()
    setPreview(null)
    onFileSelect(null, null)
  }

  return (
    <div
      className={`border border-dashed rounded-md p-4 text-center transition-colors ${
        isDragging ? "border-lime-500 bg-lime-50" : "border-gray-300"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById("file-upload").click()}
    >
      <input id="file-upload" type="file" className="hidden" onChange={handleFileInput} accept="image/*" />

      {preview ? (
        <div className="relative">
          <img
            src={preview || "/placeholder.svg"}
            alt="Preview"
            className="max-h-32 mx-auto object-contain rounded-md"
          />
          <button className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1" onClick={clearFile}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="w-6 h-6 mx-auto text-lime-500 mb-2" />
          <p className="text-sm text-lime-500">{label}</p>
        </>
      )}
    </div>
  )
}

