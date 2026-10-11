import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi"; // Toggle Icons
import FormInput from "./reusablecomponent/FormInput"; // Import reusable input component

const TermsAndConditions = () => {
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
          Terms and Conditions
        </span>
      </div>

      {/* ✅ Form Grid (Show/Hide based on `isOpen` state) */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left: Shipping Terms */}
          <FormInput label="Shipping Terms (FOB, CIF, etc.)" placeholder="Shipping Terms" isDropdown disabled />

          {/* Right: Payment Terms */}
          <FormInput label="Payment Terms" placeholder="Payment Terms" isDropdown disabled />
        </div>
      )}
    </div>
  );
};

export default TermsAndConditions;
