import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi"; // Toggle Icons
import FormInput from "./reusablecomponent/FormInput"; // Import reusable input component

const PortsVesselDetails = () => {
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
          Ports and Vessel Details
        </span>
      </div>

      {/* ✅ Form Grid (Show/Hide based on `isOpen` state) */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left Side */}
          <div className="space-y-4">
            <FormInput label="Origin Port" placeholder="Select Origin Port" isDropdown />
            <FormInput label="Origin ETD (Estimated Time of Departure)" placeholder="Origin ETD" disabled />
            <FormInput label="Transshipment Vessel Name" placeholder="Enter Transshipment Vessel Name" disabled />
            <FormInput label="Port of Discharge (POD)" placeholder="Enter POD" disabled />
          </div>

          {/* Right Side */}
          <div className="space-y-4">
            <FormInput label="Origin Vessel Name" placeholder="Enter Origin Vessel Name" disabled />
            <FormInput label="Transshipment Port" placeholder="Enter Transshipment Port" disabled />
            <FormInput label="Transshipment ETA/ETD" placeholder="Enter ETA/ETD" disabled />
            <FormInput label="POD ETA" placeholder="Enter POD ETA" disabled />
          </div>
        </div>
      )}
    </div>
  );
};

export default PortsVesselDetails;
