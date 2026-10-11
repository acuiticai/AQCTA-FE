import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi"; // Toggle Icons
import FormInput from "./reusablecomponent/FormInput"; // Import reusable input component

const AdditionalInformation = () => {
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
          Additional Information
        </span>
      </div>

      {/* ✅ Form Grid (Show/Hide based on `isOpen` state) */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left: Special Handling Instructions */}
          <FormInput label="Any special handling instructions" placeholder="Shipping Terms" disabled />

          {/* Right: Remarks or Notes */}
          <FormInput label="Remarks or notes" placeholder="Remarks or notes" disabled />
        </div>
      )}
    </div>
  );
};

export default AdditionalInformation;
