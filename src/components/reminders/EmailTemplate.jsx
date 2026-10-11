import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const RichTextEditor = ({ content, onChange, disabled = false }) => {
  const [editorContent, setEditorContent] = useState(content);

  useEffect(() => {
    setEditorContent(content);
  }, [content]);

  const handleChange = (value) => {
    setEditorContent(value);
    onChange(value);
  };

  // Quill modules for toolbar functionality
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }],
      [{ align: [] }],
      ["link"],
      ["clean"],
    ],
  };

  // Quill formats supported
  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "font",
    "align",
    "link",
  ];

  return (
    <div className="rich-text-editor w-full">
      <ReactQuill
        theme="snow"
        value={editorContent}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        className="h-56"
        readOnly={disabled}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          className="text-sm text-[var(--p-blue)] hover:text-blue-700 cursor-pointer"
          onClick={() => {
            if (disabled) return;

            const insertPosition = document
              .querySelector(".ql-editor")
              .querySelector("p:last-child");
            const placeholders = document.createElement("div");
            placeholders.innerHTML =
              "<p>Available placeholders:</p>" +
              "<p>%CustomerName%, %InvoiceNumber%, %DueDate%, %OverdueDays%, %Balance%, %UserName%, %CompanyName%</p>";
            if (insertPosition) {
              insertPosition.parentNode.appendChild(placeholders);
              onChange(document.querySelector(".ql-editor").innerHTML);
            }
          }}
          disabled={disabled}
        >
          Insert Placeholders
        </button>
      </div>
    </div>
  );
};

export default RichTextEditor;
