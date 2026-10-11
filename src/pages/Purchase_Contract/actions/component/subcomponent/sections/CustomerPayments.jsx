import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi"; // Toggle Icons
import FormInput from "./reusablecomponent/FormInput"; // Import the reusable input component

const CustomerPayments = () => {
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
          Customer Payments
        </span>
      </div>

      {/* ✅ Form Grid (Show/Hide based on `isOpen` state) */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left Side */}
          <div className="space-y-4">
            <FormInput
              label="Shipping Line"
              placeholder="Shipping Line"
              isDropdown
            />
            <FormInput
              label="Bill of Lading (BL) Number"
              placeholder="Enter BL Number"
            />
            <FormInput
              label="Container Size (e.g., 20FT, 40FT)"
              placeholder="Container Size"
            />
            <FormInput
              label="Total Net Weight"
              placeholder="Enter Net Weight"
            />
          </div>

          {/* Right Side */}
          <div className="space-y-4">
            <FormInput
              label="Booking Confirmation Number"
              placeholder="Enter Booking Number"
            />
            <FormInput
              label="CTR & Seal Number"
              placeholder="Enter CTR & Seal Number"
            />
            <FormInput
              label="Total Gross Weight"
              placeholder="Enter Gross Weight"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPayments;
