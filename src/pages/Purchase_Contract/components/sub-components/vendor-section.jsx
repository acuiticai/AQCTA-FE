import { useState } from "react";
import { FiChevronDown, FiX, FiCalendar } from "react-icons/fi";
import FormField from "./form-fields";

const VendorSection = ({ title, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div
        className="flex justify-between items-center p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <FiChevronDown
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
          <span className="font-medium">{title}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-500 hover:text-red-700"
        >
          <FiX size={18} />
        </button>
      </div>

      {/* Form Content */}
      {isExpanded && (
        <div className="p-4 border-t space-y-3">
          <div className="grid gap-3">
            <FormField
              type="select"
              label="Vendor Name"
              placeholder="Vendor Name"
              options={["Vendor Name"]}
              labelWidth="w-[180px]"
            />

            <FormField
              type="text"
              label="Purchase Order Number"
              placeholder="PO1235-N3214"
              defaultValue="PO1235-N3214"
              labelWidth="w-[180px]"
            />

            <FormField
              type="select"
              label="Item"
              placeholder="Item"
              options={["Item"]}
              labelWidth="w-[180px]"
            />

            <FormField
              type="text"
              label="Quantity"
              placeholder="Quantity"
              labelWidth="w-[180px]"
            />

            <FormField
              type="select"
              label="Unit of Measure"
              placeholder="Unit of Measure"
              options={["Unit of Measure"]}
              labelWidth="w-[180px]"
            />

            <FormField
              type="text"
              label="Purchase Price/Unit"
              placeholder="Purchase Price/Unit"
              labelWidth="w-[180px]"
            />

            <FormField
              type="select"
              label="Vendor Payment Terms"
              placeholder="Vendor Payment Terms"
              options={["Vendor Payment Terms"]}
              labelWidth="w-[180px]"
            />

            <FormField
              type="select"
              label="Purchase Delivery Terms"
              placeholder="Purchase Delivery Terms"
              options={["Purchase Delivery Terms"]}
              labelWidth="w-[180px]"
            />

            <div className="flex items-center">
              <label className="text-sm text-gray-600 w-[180px]">
                Expected Delivery Date
              </label>
              <div className="flex-1 relative">
                <input
                  type="date"
                  className="w-full p-3 rounded-md bg-gray-50 border text-gray-600 pr-10"
                  placeholder="Expected Delivery Date"
                />
                <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <FormField
              type="select"
              label="Purchase Status"
              placeholder="Purchase Status"
              options={["Purchase Status"]}
              labelWidth="w-[180px]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorSection;
