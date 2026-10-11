"use client"

import { useState, useEffect } from "react"
import { ChevronDown } from "lucide-react"

export default function HtmlEditor({
  content,
  onContentChange,
  label = "Content",
  placeholder = "Enter content here...",
}) {
  const [expanded, setExpanded] = useState(true)
  const [editorContent, setEditorContent] = useState(content || "")

  useEffect(() => {
    setEditorContent(content || "")
  }, [content])

  const handleChange = (e) => {
    const newContent = e.target.value
    setEditorContent(newContent)
    onContentChange(newContent)
  }

  const handleBoldClick = () => {
    document.execCommand("bold", false, null)
  }

  const handleItalicClick = () => {
    document.execCommand("italic", false, null)
  }

  const handleUnderlineClick = () => {
    document.execCommand("underline", false, null)
  }

  const handleListClick = () => {
    document.execCommand("insertOrderedList", false, null)
  }

  const handleBulletClick = () => {
    document.execCommand("insertUnorderedList", false, null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">{label}</h3>
        <button onClick={() => setExpanded(!expanded)}>
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? "transform rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-2">
          <div className="flex space-x-2 border border-gray-300 rounded-t-md p-2 bg-gray-50">
            <button
              onClick={handleBoldClick}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-200"
              type="button"
            >
              <strong>B</strong>
            </button>
            <button
              onClick={handleItalicClick}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-200"
              type="button"
            >
              <em>I</em>
            </button>
            <button
              onClick={handleUnderlineClick}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-200"
              type="button"
            >
              <u>U</u>
            </button>
            <button
              onClick={handleListClick}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-200"
              type="button"
            >
              1.
            </button>
            <button
              onClick={handleBulletClick}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-200"
              type="button"
            >
              •
            </button>
          </div>

          <div
            className="min-h-[200px] p-3 border border-gray-300 rounded-b-md focus:outline-none focus:ring-2 focus:ring-lime-500"
            contentEditable={true}
            dangerouslySetInnerHTML={{ __html: editorContent }}
            onInput={(e) => handleChange(e)}
            placeholder={placeholder}
          />

          <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Tip:</strong> Use the formatting toolbar to add bold, italic, lists, and more to your content. The
              content will be displayed exactly as formatted in the document.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

