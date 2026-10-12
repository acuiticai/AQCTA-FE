import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiUpload } from "react-icons/fi";
import FormInput from "./FormInput";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import Loader from "./Loader";
import ObjectFormRenderer from "./ObjectFormRenderer";
import { formatDate } from "@/components/formatAmount";

// Add custom styles for ReactQuill editor and textarea scrollbars
const quillStyles = `
  .ql-editor {
    overflow-y: scroll;
    max-height: 150px;
  }
  
  .dynamic-field-textarea {
    overflow-y: hidden;
    scrollbar-width: none !important;
  }
  
  .dynamic-field-textarea::-webkit-scrollbar {
    width: 6px;
  }
  
  .dynamic-field-textarea::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 3px;
  }
  
  .dynamic-field-textarea::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 3px;
  }
  
  .dynamic-field-textarea::-webkit-scrollbar-thumb:hover {
    background: transparent;
  }
  
  /* Show scrollbar only when content overflows */
  .dynamic-field-textarea.overflowing {
    overflow-y: auto;
    scrollbar-width: thin !important;
    scrollbar-color: gray transparent !important;
  }
`;

// Inject styles into the document
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = quillStyles;
  document.head.appendChild(styleElement);
}

const DynamicField = ({
  value = [],
  onChange,
  fieldConfig,
  label,
  required,
  error,
  shouldShowError,
  disabled,
  placeholder = "Add new item",
  maxItems = 50,
  minItems = 1,
  initialItems = 0,
  enableTextInput = false,
  textInputPlaceholder = "Paste your data here...\nEISU3572313,LEL111322\nGATU0539075,LEL111328",
  separator = ":",
  fixedLabelFields = [], // Array of field names where only values can be edited, not labels
  disabledFields = [], // Array of field names that cannot be edited or deleted,
  loading = false,
  isStatic = false,
  headerText = "Click to edit or add new",
  ...props
}) => {
  const inputPlaceholder = `Paste your data here...\n${[
    ["Value1", "Value2"],
    ["Value2", "Value3"],
  ]
    .map((field) => `${field[0]}:${field[1]}`)
    .join("\n")}`;

  // Ensure value is always an array
  const items = Array.isArray(value) ? value : [];

  console.debug({ items });

  // Define keys to skip in table display
  const skipKeys = ["id", "_id", "fieldType", "fieldValue_formData"];

  // State for text input
  const [textInput, setTextInput] = React.useState("");

  // State for tracking field types per row (default: text)
  const [fieldTypes, setFieldTypes] = React.useState({});

  // Ref to prevent infinite loops during sync
  const isUpdatingFromText = React.useRef(false);

  // Toggle field type between text and html
  const toggleFieldType = (rowIndex, fieldName) => {
    const key = `${rowIndex}-${fieldName}`;
    const currentType = fieldTypes[key] || "text";
    const newType = currentType === "text" ? "html" : "text";

    setFieldTypes((prev) => ({
      ...prev,
      [key]: newType,
    }));
  };

  // Get field type for a specific field
  const getFieldType = (rowIndex, fieldName) => {
    const key = `${rowIndex}-${fieldName}`;

    // Check if user has manually toggled the field type
    if (fieldTypes[key]) {
      return fieldTypes[key];
    }

    // Check if the item itself has a fieldType property
    const item = items[rowIndex];
    if (item && item.fieldType && fieldName === "fieldValue") {
      return item.fieldType;
    }

    // Default to text
    return "text";
  };

  // Add new item
  const addItem = () => {
    if (items.length >= maxItems) return;
    if (typeof onChange !== "function") {
      console.error("onChange is not a function in DynamicField");
      return;
    }

    const newItem = { id: Date.now() };

    // Initialize fields based on fieldConfig
    if (fieldConfig && fieldConfig.fields) {
      fieldConfig.fields.forEach((field) => {
        newItem[field.name] = field.defaultValue || "";
      });

      // If we have fieldName and fieldLabel, set fieldLabel to same as fieldName initially
      if (
        fieldConfig.fields.length >= 3 &&
        fieldConfig.fields[0].name === "fieldName" &&
        fieldConfig.fields[1].name === "fieldLabel"
      ) {
        newItem.fieldLabel = newItem.fieldName || "";
      }
    } else {
      newItem.value = "";
    }

    const newItems = [...items, newItem];
    onChange(newItems);

    // Update text input when items change (useEffect will handle this)
    // No need to manually update here to avoid conflicts
  };

  // Remove item
  const removeItem = (index) => {
    // if (items.length <= minItems) return;
    if (typeof onChange !== "function") {
      console.error("onChange is not a function in DynamicField");
      return;
    }

    const item = items[index];

    // Check if any field in this item is in disabledFields
    const hasDisabledFields = Object.keys(item).some(
      (fieldName) =>
        disabledFields.includes(fieldName) &&
        fieldName !== "id" &&
        fieldName !== "_id"
    );

    // Check if this item has any fixedLabelFields
    const hasFixedLabelFields = fixedLabelFields.includes(item.fieldName);

    if (hasDisabledFields) {
      console.warn("Cannot remove item with disabled fields");
      return;
    }

    if (hasFixedLabelFields) {
      console.warn("Cannot remove item with fixed label fields");
      return;
    }

    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);

    // Update text input when items change (useEffect will handle this)
    // No need to manually update here to avoid conflicts
  };

  // Update item
  const updateItem = (index, field, newValue) => {
    console.debug("updateItem", index, field, newValue);
    if (typeof onChange !== "function") {
      console.error("onChange is not a function in DynamicField");
      return;
    }

    // Check if field is disabled
    if (disabledFields.includes(field)) {
      console.warn(`Cannot edit disabled field: ${field}`);
      return;
    }

    // For fixedLabelFields, only allow editing if it's the value field (not the label field)
    const item = items[index];
    const isFixedLabelField =
      field === "fieldLabel" && fixedLabelFields.includes(item.fieldName);
    const isLabelField = field === "fieldName" || field === "fieldLabel";

    if (isFixedLabelField && isLabelField) {
      console.warn(
        `Cannot edit label field: ${field} for fixed field: ${item.fieldName}`
      );
      return;
    }

    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: newValue };
    onChange(newItems);

    // Update text input when items change (useEffect will handle this)
    // No need to manually update here to avoid conflicts
    // setTextInput(convertItemsToText(newItems));
  };

  // Parse text input and convert to array structure
  const parseTextInput = (text) => {
    if (text === null || text === undefined || !text.trim()) {
      onChange([]);
      return;
    }

    const lines = text.split("\n").filter((line) => line.trim());
    const parsedItems = [];

    lines.forEach((line, lineIndex) => {
      const newItem = { id: Date.now() + lineIndex };

      // Check if line contains the custom separator
      if (line.includes(separator)) {
        // Split by custom separator
        const separatorParts = line.split(separator);
        if (separatorParts.length >= 2) {
          const fieldLabel = separatorParts[0].trim();
          const fieldValue = separatorParts.slice(1).join(separator).trim(); // Join remaining parts in case value contains separators

          if (
            fieldConfig &&
            fieldConfig.type === "multi-field" &&
            fieldConfig.fields
          ) {
            // Map to fieldName, fieldLabel, and fieldValue
            if (fieldConfig.fields.length >= 3) {
              // Three fields: fieldName, fieldLabel, fieldValue
              newItem[fieldConfig.fields[0].name] = fieldLabel; // Use fieldLabel as fieldName for now
              newItem[fieldConfig.fields[1].name] = fieldLabel; // Use fieldLabel as fieldLabel
              newItem[fieldConfig.fields[2].name] = fieldValue;
            } else if (fieldConfig.fields.length === 2) {
              // Two fields: fieldName and fieldValue
              newItem[fieldConfig.fields[0].name] = fieldLabel;
              newItem[fieldConfig.fields[1].name] = fieldValue;
            }
          } else {
            newItem.fieldName = fieldLabel;
            newItem.fieldValue = fieldValue;
          }
          parsedItems.push(newItem);
        }
      }
      //  else {
      //   // Fallback to comma separation for backward compatibility
      //   const values = line
      //     .split(",")
      //     .map((val) => val.trim())
      //     .filter((val) => val);

      //   if (values.length > 0) {
      //     if (
      //       fieldConfig &&
      //       fieldConfig.type === "multi-field" &&
      //       fieldConfig.fields
      //     ) {
      //       // For multi-field configuration, map values to field names
      //       fieldConfig.fields.forEach((field, fieldIndex) => {
      //         newItem[field.name] = values[fieldIndex] || "";
      //       });
      //     } else {
      //       // For single field or auto-detect field count
      //       if (values.length === 1) {
      //         newItem.value = values[0];
      //       } else {
      //         // Multiple values - create fields dynamically
      //         values.forEach((val, index) => {
      //           const fieldName =
      //             fieldConfig?.fields?.[index]?.name || `field${index + 1}`;
      //           newItem[fieldName] = val;
      //         });
      //       }
      //     }
      //     parsedItems.push(newItem);
      //   }
      // }
    });

    // Always call onChange, even with empty array
    onChange(parsedItems);
    setTextInput(text);
  };

  // Convert items back to text format
  const convertItemsToText = (itemsArray) => {
    if (
      itemsArray === null ||
      itemsArray === undefined ||
      itemsArray.length === 0
    )
      return "";

    return itemsArray
      .map((item) => {
        // Get all non-id fields
        const fields = Object.keys(item).filter(
          (key) => key !== "id" && key !== "_id"
        );
        console.debug("item", item);
        console.debug("fieldConfig", fieldConfig);
        console.debug("fields", fields);

        if (
          fieldConfig &&
          fieldConfig.type === "multi-field" &&
          fieldConfig.fields &&
          fieldConfig.fields.length >= 2
        ) {
          // For fieldLabel:fieldValue format, use custom separator

          return fields
            .map((fieldName) => item[fieldName] || "")
            .join(separator);
        } else if (fields.length === 1 && item.value !== undefined) {
          // Single value field
          return item.value || "";
        } else {
          // Multiple fields - use comma separation for backward compatibility
          return fields
            .map((fieldName) => item[fieldName] || "")
            .join(separator);
        }
      })
      .join("\n");
  };

  // Handle text input change
  const handleTextInputChange = (e) => {
    const text = e.target.value;
    setTextInput(text);

    // Set flag to prevent infinite loop
    isUpdatingFromText.current = true;

    // Parse text input (handles both empty and non-empty text)
    parseTextInput(text);

    // Reset flag after a short delay
    setTimeout(() => {
      isUpdatingFromText.current = false;
    }, 100);
  };

  // Auto-populate text input when items change
  React.useEffect(() => {
    if (enableTextInput && !isUpdatingFromText.current) {
      console.debug("items", items);
      const textFromItems = convertItemsToText(items);
      setTextInput(textFromItems);
    }
  }, [enableTextInput, items]);

  // Initialize with specified number of items if empty
  React.useEffect(() => {
    if (
      items.length === 0 &&
      initialItems > 0 &&
      typeof onChange === "function"
    ) {
      const newItems = [];

      for (let i = 0; i < Math.max(initialItems, minItems); i++) {
        const newItem = { id: Date.now() + i };

        // Initialize fields based on fieldConfig
        if (fieldConfig && fieldConfig.fields) {
          fieldConfig.fields.forEach((field) => {
            newItem[field.name] = field.defaultValue || "";
          });

          // If we have fieldName and fieldLabel, set fieldLabel to same as fieldName initially
          if (
            fieldConfig.fields.length >= 3 &&
            fieldConfig.fields[0].name === "fieldName" &&
            fieldConfig.fields[1].name === "fieldLabel"
          ) {
            newItem.fieldLabel = newItem.fieldName || "";
          }
        } else {
          newItem.value = "";
        }

        newItems.push(newItem);
      }

      onChange(newItems);
    }
  }, []);

  const [firstTimeLoading, setFirstTimeLoading] = useState(true);

  useEffect(() => {
    // if (fieldConfig?.length > 0) {
    setFirstTimeLoading(false);
    // }
  }, []);

  // Auto-resize textareas when items change or component mounts
  useEffect(() => {
    const textareas = document.querySelectorAll(".dynamic-field-textarea");
    textareas.forEach((textarea) => {
      if (textarea) {
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = newHeight + "px";

        // Add/remove overflowing class based on whether content exceeds max height
        if (textarea.scrollHeight > 200) {
          textarea.classList.add("overflowing");
        } else {
          textarea.classList.remove("overflowing");
        }
      }
    });
  }, [items]);

  return (
    <div className="space-y-3 relative">
      {/* Text Input for Bulk Data Entry - Only show if enableTextInput is true and no fixedLabelFields */}
      {enableTextInput && fixedLabelFields.length === 0 && (
        <div className="p-4 border border-gray-200 rounded-lg bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <FiUpload size={16} className="text-blue-600" />
            <label className="text-sm font-medium text-blue-800">
              Bulk Data Entry
            </label>
          </div>
          <textarea
            placeholder={inputPlaceholder}
            value={textInput}
            onChange={handleTextInputChange}
            className="w-full p-3 border border-gray-300 rounded-md text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            disabled={disabled}
          />
          <p className="text-xs text-gray-600 mt-1">
            Paste your data here. Each line becomes a new item, values separated
            by {separator === ":" ? "colons" : "commas"}. You can also edit
            fields directly in the table below or add new rows using the "Add
            New Row" button.
          </p>
        </div>
      )}

      {/* Table View for Text Input Mode - Always show when enableTextInput is true */}
      {enableTextInput && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-4">
            <h3 className="text-sm font-medium text-gray-700">
              Data ({items.length} items) - {headerText}
            </h3>
            {(loading || firstTimeLoading) && <Loader className="w-4 h-4" />}
          </div>

          <div className="overflow-x-auto">
            <table key={`table-${items.length}`} className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  {items.length > 0
                    ? // Show headers based on existing items
                      Object.keys(items[0])
                        .filter((key) => !skipKeys.includes(key))
                        .map((fieldName, fieldIndex) => {
                          const field = fieldConfig?.fields?.find(
                            (f) => f.name === fieldName
                          );
                          // Skip hidden fields
                          if (field?.hidden) return null;

                          return (
                            <th
                              key={fieldName}
                              className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0 ${
                                fieldName === "fieldLabel"
                                  ? "w-1/3 min-w-[250px] max-w-[300px]"
                                  : fieldName === "fieldValue"
                                  ? "w-2/3 min-w-[300px] max-w-[500px]"
                                  : ""
                              }`}
                            >
                              {field?.fieldLabel ||
                                field?.label ||
                                fieldName.charAt(0).toUpperCase() +
                                  fieldName.slice(1)}
                            </th>
                          );
                        })
                    : // Show headers based on fieldConfig when no items exist
                      fieldConfig?.fields?.map((field) => {
                        // Skip hidden fields and skipKeys
                        if (field?.hidden || skipKeys.includes(field.name))
                          return null;

                        return (
                          <th
                            key={field.name}
                            className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0 ${
                              field.name === "fieldLabel"
                                ? "w-1/3 min-w-[50px] max-w-[50px]"
                                : field.name === "fieldValue"
                                ? "w-2/3 min-w-[50px] max-w-[50px]"
                                : ""
                            }`}
                          >
                            {field?.fieldLabel ||
                              field?.label ||
                              field.name.charAt(0).toUpperCase() +
                                field.name.slice(1)}
                          </th>
                        );
                      })}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px] min-w-[120px] max-w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody
                key={`tbody-${items.length}`}
                className="bg-white divide-y divide-gray-200"
              >
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        (fieldConfig?.fields?.filter(
                          (field) =>
                            !field?.hidden && !skipKeys.includes(field.name)
                        ).length || 2) + 1
                      }
                      className="px-4 py-2 text-center"
                    >
                      <div className="text-gray-500 my-2">No Item</div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, rowIndex) => (
                    <tr
                      key={item.id || `row-${rowIndex}`}
                      className="hover:bg-gray-50"
                    >
                      {Object.keys(item)
                        .filter((key) => !skipKeys.includes(key))
                        .map((fieldName, fieldIndex) => {
                          const field = fieldConfig?.fields?.find(
                            (f) => f.name === fieldName
                          );

                          // Skip hidden fields
                          if (field?.hidden) return null;

                          const isFieldDisabled =
                            disabledFields.includes(fieldName);

                          // Check if this field should be readonly based on fixedLabelFields
                          const isFixedLabelField =
                            fieldName === "fieldLabel" &&
                            fixedLabelFields.includes(item.fieldName);
                          const isLabelField =
                            fieldName === "fieldName" ||
                            fieldName === "fieldLabel";
                          const isReadonly =
                            isFieldDisabled ||
                            (isFixedLabelField && isLabelField);

                          return (
                            <td
                              key={`cell-${rowIndex}-${fieldName}`}
                              className={`px-4 py-2 text-sm border-r border-gray-200 last:border-r-0 align-top ${
                                fieldName === "fieldLabel"
                                  ? `w-1/3 min-w-[250px] max-w-[300px] ${
                                      item?.fieldType === "html"
                                        ? "align-top pt-4"
                                        : ""
                                    }`
                                  : fieldName === "fieldValue"
                                  ? "w-2/3 min-w-[300px] max-w-[500px]"
                                  : ""
                              }`}
                            >
                              {isReadonly ? (
                                <div className="px-2 py-1 text-sm text-gray-700 font-medium">
                                  {getFieldType(rowIndex, fieldName) ===
                                  "html" ? (
                                    <div
                                      className="max-h-[300px] overflow-y-auto border border-gray-200 rounded p-2"
                                      style={{
                                        wordWrap: "break-word",
                                        overflowWrap: "break-word",
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: item[fieldName] || "",
                                      }}
                                    />
                                  ) : getFieldType(rowIndex, fieldName) ===
                                    "custom" ? (
                                    <div className="max-h-[300px] overflow-y-auto">
                                      {item[fieldName]}
                                    </div>
                                  ) : getFieldType(rowIndex, fieldName) ===
                                    "date" ? (
                                    <div className="max-h-[300px] overflow-y-auto">
                                      {item[fieldName]
                                        ? formatDate(item[fieldName])
                                        : "N/A"}
                                    </div>
                                  ) : getFieldType(rowIndex, fieldName) ===
                                    "img" ? (
                                    <div className="max-h-[300px] overflow-y-auto">
                                      {item[fieldName] ? (
                                        <img
                                          src={item[fieldName]}
                                          alt="Image"
                                          className="max-w-full h-auto max-h-[200px] object-contain rounded border"
                                          onError={(e) => {
                                            e.target.style.display = "none";
                                            e.target.nextSibling.style.display =
                                              "block";
                                          }}
                                        />
                                      ) : (
                                        <div className="text-gray-500 text-sm">
                                          No image
                                        </div>
                                      )}
                                      {item[fieldName] && (
                                        <div
                                          className="text-gray-500 text-xs mt-1"
                                          style={{ display: "none" }}
                                        >
                                          Failed to load image
                                        </div>
                                      )}
                                    </div>
                                  ) : getFieldType(rowIndex, fieldName) ===
                                    "object-form" ? (
                                    <div className="max-h-[300px] overflow-y-auto">
                                      <ObjectFormRenderer
                                        data={item[fieldName] || {}}
                                        value={
                                          item[`${fieldName}_formData`] || {}
                                        }
                                        onChange={(result) => {
                                          updateItem(
                                            rowIndex,
                                            `${fieldName}_formData`,
                                            result
                                          );
                                        }}
                                        disabled={disabled}
                                      />
                                    </div>
                                  ) : (
                                    <div className="max-h-[300px] overflow-y-auto">
                                      {item[fieldName] || ""}
                                    </div>
                                  )}
                                </div>
                              ) : getFieldType(rowIndex, fieldName) ===
                                "html" ? (
                                <div className="w-full">
                                  <ReactQuill
                                    value={item[fieldName] || ""}
                                    onChange={(content) =>
                                      updateItem(rowIndex, fieldName, content)
                                    }
                                    theme="snow"
                                    modules={{
                                      toolbar: [
                                        [
                                          "bold",
                                          "italic",
                                          "underline",
                                          "strike",
                                          "clean",
                                        ],
                                      ],
                                    }}
                                    formats={[
                                      "bold",
                                      "italic",
                                      "underline",
                                      "strike",
                                      "clean",
                                    ]}
                                    placeholder={`Enter ${
                                      field?.fieldLabel ||
                                      field?.label ||
                                      fieldName
                                    }`}
                                    readOnly={disabled}
                                    style={{
                                      minHeight: "80px",
                                      maxHeight: "250px",
                                    }}
                                  />
                                </div>
                              ) : getFieldType(rowIndex, fieldName) ===
                                "custom" ? (
                                <div className="w-full px-2 py-1 text-sm text-gray-700 font-medium">
                                  {item[fieldName]}
                                </div>
                              ) : getFieldType(rowIndex, fieldName) ===
                                "date" ? (
                                <div className="w-full">
                                  <FormInput
                                    type="date"
                                    value={item[fieldName] || ""}
                                    onChange={(value) =>
                                      updateItem(rowIndex, fieldName, value)
                                    }
                                    disabled={disabled}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                </div>
                              ) : getFieldType(rowIndex, fieldName) ===
                                "img" ? (
                                <div className="w-full">
                                  <FormInput
                                    type="img"
                                    value={item[fieldName] || ""}
                                    onChange={(value) =>
                                      updateItem(rowIndex, fieldName, value)
                                    }
                                    style={{ width: "auto", height: "60px" }}
                                    disabled={disabled}
                                    className="w-full px-2 py-1 text-sm rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                </div>
                              ) : getFieldType(rowIndex, fieldName) ===
                                "object-form" ? (
                                <div className="w-full">
                                  <ObjectFormRenderer
                                    data={item[fieldName] || {}}
                                    value={item[`${fieldName}_formData`] || {}}
                                    onChange={(result) => {
                                      updateItem(
                                        rowIndex,
                                        `${fieldName}_formData`,
                                        result
                                      );
                                    }}
                                    disabled={disabled}
                                  />
                                </div>
                              ) : (
                                <div className="w-full">
                                  <FormInput
                                    type="textarea"
                                    value={item[fieldName] || ""}
                                    onChange={(e) => {
                                      updateItem(
                                        rowIndex,
                                        fieldName,
                                        e.target.value
                                      );
                                      // Auto-resize textarea
                                      const textarea = e.target;
                                      textarea.style.height = "auto";
                                      const newHeight = Math.min(
                                        textarea.scrollHeight,
                                        200
                                      );
                                      textarea.style.height = newHeight + "px";

                                      // Add/remove overflowing class based on whether content exceeds max height
                                      if (textarea.scrollHeight > 200) {
                                        textarea.classList.add("overflowing");
                                      } else {
                                        textarea.classList.remove(
                                          "overflowing"
                                        );
                                      }
                                    }}
                                    disabled={disabled}
                                    placeholder={`Enter ${
                                      field?.fieldLabel ||
                                      field?.label ||
                                      fieldName
                                    }`}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto dynamic-field-textarea"
                                    rows={1}
                                    style={{
                                      height: "auto",
                                      minHeight: "28px",
                                      maxHeight: "250px",
                                      overflowY: "auto",
                                      scrollbarWidth: "thin",
                                      scrollbarColor: "#cbd5e0 #f7fafc",
                                    }}
                                    ref={(textarea) => {
                                      if (textarea) {
                                        // Set initial height based on content
                                        textarea.style.height = "auto";
                                        const newHeight = Math.min(
                                          textarea.scrollHeight,
                                          200
                                        );
                                        textarea.style.height =
                                          newHeight + "px";

                                        // Add/remove overflowing class based on whether content exceeds max height
                                        if (textarea.scrollHeight > 200) {
                                          textarea.classList.add("overflowing");
                                        } else {
                                          textarea.classList.remove(
                                            "overflowing"
                                          );
                                        }
                                      }
                                    }}
                                    onInput={(e) => {
                                      // Auto-resize on input
                                      const textarea = e.target;
                                      textarea.style.height = "auto";
                                      const newHeight = Math.min(
                                        textarea.scrollHeight,
                                        200
                                      );
                                      textarea.style.height = newHeight + "px";

                                      // Add/remove overflowing class based on whether content exceeds max height
                                      if (textarea.scrollHeight > 200) {
                                        textarea.classList.add("overflowing");
                                      } else {
                                        textarea.classList.remove(
                                          "overflowing"
                                        );
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      <td className="px-4 py-2 text-sm text-gray-500 w-[120px] min-w-[120px] max-w-[120px]">
                        <div className="flex items-center gap-2 justify-center">
                          {/* HTML Toggle Checkbox - Only show for text, textarea, or html field types */}
                          {!enableTextInput ||
                            (fixedLabelFields.length > 0 && (
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`html-toggle-${rowIndex}`}
                                  checked={
                                    getFieldType(rowIndex, "fieldValue") ===
                                    "html"
                                  }
                                  disabled={
                                    !(
                                      getFieldType(rowIndex, "fieldValue") ===
                                        "text" ||
                                      getFieldType(rowIndex, "fieldValue") ===
                                        "textarea" ||
                                      getFieldType(rowIndex, "fieldValue") ===
                                        "html"
                                    )
                                  }
                                  onChange={() =>
                                    toggleFieldType(rowIndex, "fieldValue")
                                  }
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                  title="Toggle Formatted editor for this field"
                                />
                                <label
                                  htmlFor={`html-toggle-${rowIndex}`}
                                  className="ml-1 text-xs text-gray-600 cursor-pointer"
                                >
                                  Formatted
                                </label>
                              </div>
                            ))}

                          {/* Delete Button */}
                          {(() => {
                            const item = items[rowIndex];
                            const hasDisabledFields = Object.keys(item).some(
                              (fieldName) =>
                                disabledFields.includes(fieldName) &&
                                fieldName !== "id" &&
                                fieldName !== "_id"
                            );
                            const hasFixedLabelFields =
                              fixedLabelFields.includes(item.fieldName);
                            const canDelete =
                              !hasDisabledFields && !hasFixedLabelFields;

                            return canDelete ? (
                              <button
                                type="button"
                                onClick={() => removeItem(rowIndex)}
                                className={`p-1 rounded transition-colors ${
                                  canDelete
                                    ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                                    : "text-gray-300 cursor-not-allowed"
                                }`}
                                disabled={disabled || !canDelete || isStatic}
                                title={
                                  canDelete
                                    ? "Remove this item"
                                    : hasDisabledFields
                                    ? "Cannot remove item with disabled fields"
                                    : "Cannot remove item with fixed label fields"
                                }
                              >
                                <FiTrash2 size={14} />
                              </button>
                            ) : null;
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {/* Add New Row Button - Only show when there are items */}
                {!isStatic && (
                  <tr
                    className={`${
                      loading
                        ? "bg-gray-50"
                        : items.length < maxItems
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "bg-gray-50"
                    }`}
                  >
                    <td
                      colSpan={
                        items.length > 0
                          ? Object.keys(items[0])
                              .filter((key) => !skipKeys.includes(key))
                              .filter((key) => {
                                const field = fieldConfig?.fields?.find(
                                  (f) => f.name === key
                                );
                                return !field?.hidden;
                              }).length + 1
                          : (fieldConfig?.fields?.filter(
                              (field) =>
                                !field?.hidden && !skipKeys.includes(field.name)
                            ).length || 2) + 1
                      }
                      className="px-4 py-3 text-center w-[100px]"
                    >
                      <button
                        type="button"
                        onClick={addItem}
                        className={`flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg transition-colors border-2 border-dashed ${
                          items.length < maxItems &&
                          !disabled &&
                          !loading &&
                          !isStatic
                            ? "text-blue-600 hover:text-blue-700 hover:bg-blue-100 border-blue-300 hover:border-blue-400"
                            : "text-gray-400 border-gray-300 cursor-not-allowed"
                        }`}
                        disabled={
                          disabled || items.length >= maxItems || loading
                        }
                        title={
                          loading
                            ? "Loading..."
                            : items.length >= maxItems
                            ? `Maximum ${maxItems} items allowed`
                            : "Add new row"
                        }
                      >
                        <FiPlus size={16} />
                        <span className="text-sm font-medium">
                          {items.length === 0 ? "Add First Row" : "Add New Row"}
                        </span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error Message */}
      {shouldShowError && error && typeof error === "string" && (
        <div className="text-red-500 text-sm mt-1">{error}</div>
      )}
    </div>
  );
};

export default DynamicField;
