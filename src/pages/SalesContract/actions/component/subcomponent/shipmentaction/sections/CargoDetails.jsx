import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi"; // Toggle Icons
import FormInput from "./reusablecomponent/FormInput"; // Import reusable input component

const CargoDetails = () => {
  const [isOpen, setIsOpen] = useState(true); // Toggle section visibility

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
          Cargo Details
        </span>
      </div>

      {/* ✅ Form Grid (Show/Hide based on `isOpen` state) */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left Side */}
          <div className="space-y-4">
            <FormInput label="Item Description" placeholder="Item Description" disabled />
            <FormInput label="Packing Type" placeholder="Packing Type" isDropdown disabled />
            <FormInput label="Total Value" placeholder="Total Value" disabled />
          </div>

          {/* Right Side */}
          <div className="space-y-4">
            <FormInput label="Quantity (MTS/FCL)" placeholder="Quantity (MTS/FCL)" disabled />
            <FormInput label="Weight per Container" placeholder="Weight per Container" disabled />
            <FormInput label="Per metric ton" placeholder="Per metric ton" disabled />
          </div>
        </div>
      )}
    </div>
  );
};

export default CargoDetails;
