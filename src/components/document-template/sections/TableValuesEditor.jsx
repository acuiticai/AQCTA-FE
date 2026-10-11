import React from "react";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";

const TableValuesEditor = ({ fields, values, setValues, onFieldUpdate }) => {
  const addRow = () => {
    const newRow = {
      id: Date.now(),
      values: fields.reduce(
        (acc, field) => ({
          ...acc,
          [field.id]: getDefaultValue(field.type),
        }),
        {}
      ),
    };
    setValues([...values, newRow]);
  };

  const getDefaultValue = (type) => {
    switch (type) {
      case "date":
        return new Date().toISOString().split("T")[0];
      default:
        return "";
    }
  };

  const renderInput = (field, value, onChange) => {
    const handleChange = (e) => {
      let newValue = e.target.value;

      if (["number", "currency", "percentage"].includes(field.type)) {
        newValue = e.target.valueAsNumber || "";
        if (field.type === "currency") {
          newValue = parseFloat(newValue).toFixed(2);
        }
      }

      onChange(newValue);
    };

    const inputProps = {
      className:
        "w-full text-sm rounded-md border p-2 border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500",
      value: value ?? "",
      onChange: handleChange,
      placeholder: `Enter ${field.name.toLowerCase()}`,
    };

    switch (field.type) {
      case "number":
      case "percentage":
        return <input type="number" step="1" {...inputProps} />;
      case "currency":
        return <input type="number" step="0.01" {...inputProps} />;
      case "date":
        return <input type="date" {...inputProps} />;
      default:
        return <input type="text" {...inputProps} />;
    }
  };

  const calculateTotal = (fieldId) => {
    if (
      ["number", "currency"].includes(
        fields.find((f) => f.id === fieldId)?.type
      )
    ) {
      return values.reduce((sum, row) => {
        const value = parseFloat(row.values[fieldId]) || 0;
        return sum + value;
      }, 0);
    }
    return null;
  };

  return (
    <div className="space-y-1 px-1 py-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Sample Values</h3>
          <p className="text-xs text-gray-500">
            Add example data to preview table
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center p-1 border border-transparent text-xs font-medium rounded-md text-white bg-emerald-500 hover:bg-emerald-600 transition-colors duration-200 shadow-sm"
          title="Add Row"
        >
          <AddIcon className="h-2 w-2" />
        </button>
      </div>

      <div style={{ scrollbarWidth: "thin" }} className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {fields.map((field) => (
                <th
                  key={field.id}
                  className="px-3 py-1.5 text-left text-xs font-medium text-gray-700"
                  style={{ width: `${field.width}%` }}
                >
                  {field.name}
                </th>
              ))}
              <th className="px-3 py-1.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {values.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                {fields.map((field) => (
                  <td key={field.id} className="p-1.5">
                    {renderInput(field, row.values[field.id], (value) =>
                      onFieldUpdate(row.id, field.id, value)
                    )}
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setValues(values.filter((v) => v.id !== row.id))
                    }
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors duration-200"
                  >
                    <DeleteIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr>
              {fields.map((field) => (
                <td key={field.id} className="px-3 py-1.5 text-xs font-medium">
                  {calculateTotal(field.id) !== null && (
                    <span className="text-gray-700">
                      Total: {field.type === "currency" ? "$" : ""}
                      {calculateTotal(field.id).toFixed(2)}
                    </span>
                  )}
                </td>
              ))}
              <td className="w-16" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TableValuesEditor;
