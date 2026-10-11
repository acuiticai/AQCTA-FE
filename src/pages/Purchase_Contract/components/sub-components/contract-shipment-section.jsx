import { useState } from "react";
import { FiChevronDown, FiX, FiCalendar, FiUpload } from "react-icons/fi";
import FormField from "./form-fields";
import PriceInput from "./price-input";

const ContractShipmentSection = ({ title, onRemove }) => {
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
        <div className="p-4 border-t">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {/* Left Column */}
            <div className="space-y-3">
              <FormField
                type="select"
                label="Port of Loading"
                placeholder="Port of Loading"
                options={["Port of Loading"]}
                labelWidth="w-[180px]"
              />

              <div className="flex items-center">
                <label className="text-sm text-gray-600 w-[180px]">
                  Shipment Month
                </label>
                <div className="flex-1 relative">
                  <input
                    type="date"
                    className="w-full p-3 rounded-md bg-gray-50 border text-gray-600 pr-10"
                  />
                  <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <FormField
                type="select"
                label="Origin Vessel"
                placeholder="Origin Vessel"
                options={["Origin Vessel"]}
                labelWidth="w-[180px]"
              />

              <FormField
                type="select"
                label="Transship Vessel"
                placeholder="Transship Vessel"
                options={["Transship Vessel"]}
                labelWidth="w-[180px]"
              />

              <div className="flex items-center">
                <label className="text-sm text-gray-600 w-[180px]">
                  Estimated Departure Date
                </label>
                <div className="flex-1 relative">
                  <input
                    type="date"
                    className="w-full p-3 rounded-md bg-gray-50 border text-gray-600 pr-10"
                  />
                  <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <FormField
                type="text"
                label="Freight Amount"
                placeholder="Freight Amount (With Currency)"
                labelWidth="w-[180px]"
              />

              <PriceInput
                label="Forecast Costs"
                labelWidth="w-[180px]"
                placeholder="Forecast Costs (USD)"
              />

              <FormField
                type="text"
                label="Shipping Line"
                placeholder="Shipping Line"
                labelWidth="w-[180px]"
              />

              <FormField
                type="text"
                label="CTR & Seal No"
                placeholder="CTR & Seal No"
                labelWidth="w-[180px]"
              />

              <PriceInput
                label="Total Freight Expenses"
                labelWidth="w-[180px]"
                placeholder="Total Freight Expenses (USD) *Convert 4.05"
              />

              <PriceInput
                label="Misc Fee"
                labelWidth="w-[180px]"
                placeholder="Misc Fee (USD) *Convert 4.05"
              />

              <div className="flex items-center">
                <label className="text-sm text-gray-600 w-[180px]">
                  Receive Document From Supplier
                </label>
                <div className="flex-1">
                  <button className="w-full flex items-center justify-center gap-2 p-3 rounded-md border border-dashed border-gray-300 text-gray-600 hover:border-gray-400">
                    <FiUpload className="text-gray-400" />
                    Upload Image
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <FormField
                type="select"
                label="Port of Discharge"
                placeholder="Port of Discharge"
                options={["Port of Discharge"]}
                labelWidth="w-[180px]"
              />

              <FormField
                type="select"
                label="Shipment Terms"
                placeholder="Shipment Terms"
                options={["Shipment Terms"]}
                labelWidth="w-[180px]"
              />

              <FormField
                type="select"
                label="Transhipment Port"
                placeholder="Transhipment Port"
                options={["Transhipment Port"]}
                labelWidth="w-[180px]"
              />

              <div className="flex items-center">
                <label className="text-sm text-gray-600 w-[180px]">
                  Transship ETA/ETD
                </label>
                <div className="flex-1 relative">
                  <input
                    type="date"
                    className="w-full p-3 rounded-md bg-gray-50 border text-gray-600 pr-10"
                  />
                  <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div className="flex items-center">
                <label className="text-sm text-gray-600 w-[180px]">
                  Estimated Time of Arrival
                </label>
                <div className="flex-1 relative">
                  <input
                    type="date"
                    className="w-full p-3 rounded-md bg-gray-50 border text-gray-600 pr-10"
                  />
                  <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <FormField
                type="text"
                label="Forecast Costs Description"
                placeholder="Forecast Costs Description"
                labelWidth="w-[180px]"
              />

              <FormField
                type="text"
                label="Courier Details"
                placeholder="Courier Details To Customer"
                labelWidth="w-[180px]"
              />

              <FormField
                type="text"
                label="Booking Confirmation No"
                placeholder="Booking Confirmation No"
                labelWidth="w-[180px]"
              />

              <FormField
                type="text"
                label="BL (Bill of Lading) No"
                placeholder="BL (Bill of Lading) No"
                labelWidth="w-[180px]"
              />

              <PriceInput
                label="Total Warehouse Fee"
                labelWidth="w-[180px]"
                placeholder="Total Warehouse Fee (USD) *Convert 4.05"
              />

              <PriceInput
                label="Total Freight & Misc"
                labelWidth="w-[180px]"
                placeholder="Total Freight & Misc (USD) *Rate 4.05"
              />

              <div className="flex items-center">
                <label className="text-sm text-gray-600 w-[180px]">
                  Send Out Document
                </label>
                <div className="flex-1">
                  <button className="w-full flex items-center justify-center gap-2 p-3 rounded-md border border-dashed border-gray-300 text-gray-600 hover:border-gray-400">
                    <FiUpload className="text-gray-400" />
                    Upload Image
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractShipmentSection;
