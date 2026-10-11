import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi"; // Toggle Icons
import FormInput from "./reusablecomponent/FormInput"; // Import the reusable input component

const ShipmentDetails = () => {
  const [isOpen, setIsOpen] = useState(true); // State to toggle section

  return (
    <div className="p-6 rounded-xl shadow-sm border bg-[#F9F9FA] font-sans text-[#303030] font-normal">
      {/* ✅ Section Header with Toggle Icon */}
      <div
        className="flex items-center justify-between cursor-pointer text-lg font-semibold"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center">
          {isOpen ? (
            <FiChevronUp className="text-green-500 mr-2" />
          ) : (
            <FiChevronDown className="text-green-500 mr-2" />
          )}
          Shipment Details
        </span>
      </div>

      {/* ✅ Form Grid (Show/Hide based on `isOpen` state) */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left Side */}
          <div className="space-y-4">
            <FormInput label="Shipment Record ID" placeholder="Shipment Record ID" disabled />
            <FormInput label="Port of Discharge" placeholder="Port of Discharge" disabled />
            <FormInput label="Shipping Line" placeholder="Shipping Line" disabled />
            <FormInput label="Booking Confirmation Number" placeholder="Booking Confirmation Number" disabled />
            <FormInput
              label="Estimated Departure and Arrival Dates"
              placeholder="Estimated Departure and Arrival Dates"
              disabled
              fullWidth
            />
          </div>

          {/* Right Side */}
          <div className="space-y-4">
            <FormInput label="Port of Loading" placeholder="Port of Loading" disabled />
            <FormInput label="Transshipment Port (if applicable)" placeholder="Transshipment Port (if applicable)" disabled />
            <FormInput label="Container Number and Seal Number" placeholder="Container Number and Seal Number" disabled />
            <FormInput label="Vessel Name" placeholder="Vessel Name" disabled />
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipmentDetails;
