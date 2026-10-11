import React, { useState, useEffect } from "react";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { fieldTypes } from "../../../pages/DocumentTemplate/data/data-index";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import TableValuesEditor from "./TableValuesEditor";

const TableFieldsEditor = () => {
  const [showFields, setShowFields] = useState(false);
  const [activeSection, setActiveSection] = useState("fields");
  const {
    tableFields,
    setTableFields,
    tableValues,
    setTableValues,
    setRequireTable,
  } = useDocumentConext();

  useEffect(() => {
    if (tableValues.length > 0) {
      const updatedValues = tableValues.map((row) => ({
        ...row,
        values: tableFields.reduce(
          (acc, field) => ({
            ...acc,
            [field.id]: row.values[field.id] || "",
          }),
          {}
        ),
      }));
      setTableValues(updatedValues);
    }
  }, [tableFields]);

  const updateField = (index, key, value) => {
    const newFields = [...tableFields];
    newFields[index][key] = value;
    setTableFields(newFields);

    setTableValues((prev) =>
      prev.map((row) => ({
        ...row,
        values: {
          ...row.values,
          [newFields[index].id]:
            key === "name"
              ? `Enter ${value.toLowerCase()}`
              : row.values[newFields[index].id],
        },
      }))
    );
  };

  const addField = () => {
    setTableFields([
      ...tableFields,
      { id: tableFields.length + 1, name: "", type: "text", width: 20 },
    ]);
  };

  const handleDeleteField = (fieldId) => {
    setTableFields(tableFields.filter((f) => f.id !== fieldId));
    setTableValues((prev) => {
      return prev.map((row) => {
        const newValues = { ...row.values };
        delete newValues[fieldId];
        return { ...row, values: newValues };
      });
    });
  };

  if (!showFields) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <button
          onClick={() => {
            setShowFields(true);
            setRequireTable(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white text-sm rounded-md hover:bg-emerald-600 transition-colors duration-200"
        >
          <AddIcon className="h-4 w-4 mr-1" />
          Add Table to Document
        </button>
        <p className="mt-1 text-xs text-gray-500">
          Click to add a table structure to your document
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto">
      <div className="flex justify-center mt-1 space-x-3">
        <button
          onClick={() => setActiveSection("fields")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-200 ${
            activeSection === "fields"
              ? "bg-emerald-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Edit Fields
        </button>
        <button
          onClick={() => setActiveSection("values")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-200 ${
            activeSection === "values"
              ? "bg-emerald-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          disabled={tableFields.length === 0}
        >
          Edit Values
        </button>
        <button
          title="remove table"
          onClick={() => {
            setRequireTable(false);
            setShowFields(false);
          }}
          className="p-2 hover:bg-red-300 bg-red-200 rounded-md text-red-500"
        >
          <CloseIcon />
        </button>
      </div>

      {activeSection === "fields" && (
        <div className="space-y-3 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Table Structure
              </h3>
              <p className="text-xs text-gray-500">Define your table columns</p>
            </div>
            <button
              type="button"
              onClick={addField}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-emerald-500 hover:bg-emerald-600 transition-colors duration-200 shadow-sm"
            >
              <AddIcon className="h-3 w-3 mr-1" />
              Add Column
            </button>
          </div>

          <div className="space-y-2">
            {tableFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-md transition-colors duration-200"
              >
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateField(index, "name", e.target.value)}
                  placeholder="Field name"
                  className="flex-1 w-20 text-sm rounded-md border p-2 border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors duration-200"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(index, "type", e.target.value)}
                  className="w-16 text-sm rounded-md border p-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {fieldTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={field.width}
                  onChange={(e) =>
                    updateField(index, "width", parseInt(e.target.value))
                  }
                  placeholder="Width %"
                  className="w-10 text-sm rounded-md border p-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteField(field.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors duration-200"
                >
                  <DeleteIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === "values" && tableFields.length > 0 && (
        <TableValuesEditor
          fields={tableFields}
          values={tableValues}
          setValues={setTableValues}
          onFieldUpdate={(rowId, fieldId, value) => {
            setTableValues((prev) =>
              prev.map((row) =>
                row.id === rowId
                  ? { ...row, values: { ...row.values, [fieldId]: value } }
                  : row
              )
            );
          }}
        />
      )}
    </div>
  );
};

export default TableFieldsEditor;
