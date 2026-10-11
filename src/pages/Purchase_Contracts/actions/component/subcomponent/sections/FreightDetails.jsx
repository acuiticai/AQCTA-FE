import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi"; // Toggle Icons
import FormInput from "./reusablecomponent/FormInput"; // Import reusable input component

const FreightDetails = () => {
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
          Freight Details
        </span>
      </div>

      {/* ✅ Form Grid (Show/Hide based on `isOpen` state) */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left Side */}
          <div className="space-y-4">
            <FormInput label="Freight Amount (with Currency)" placeholder="Enter Freight Amount" disabled  className="border-none bg-transparent focus:ring-0"
            />
            <FormInput label="Insurance Fee" placeholder="Enter Insurance Fee" disabled />
          </div>

          {/* Right Side */}
          <div className="space-y-4">
            <FormInput label="Warehousing Fee" placeholder="Enter Warehousing Fee" disabled />
            <FormInput label="Miscellaneous Charges" placeholder="Enter Miscellaneous Charges" disabled />
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightDetails;
