import React, { useState, useEffect, useRef } from "react";
import { FiChevronDown, FiX, FiPlus } from "react-icons/fi";
import ConfirmationModal from "./ConfirmationModal ";
import { useContractContext } from "../context/ContractContext";

const BasicInfo = () => {
  const { contractData, updateContractData } = useContractContext();
  const [sections, setSections] = useState([]);

  // ✅ Prevent unnecessary updates on first render
  const isFirstRender = useRef(true);

  // ✅ Format the date for input field
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return dateString.split("T")[0]; // Convert ISO format to YYYY-MM-DD
  };

  // ✅ Sync fetched contract data
  useEffect(() => {
    // console.log("Fetched Basic Info:", contractData.basicInfo);

    if (contractData.basicInfo) {
      const formattedBasicInfo = Array.isArray(contractData.basicInfo)
        ? contractData.basicInfo
        : [contractData.basicInfo];

      if (
        !formattedBasicInfo.length ||
        Object.keys(formattedBasicInfo[0]).length === 0
      ) {
        formattedBasicInfo[0] = {
          id: Date.now(),
          purchasingCompany: "",
          supplierName: "",
          contractDate: "",
          contractNumber: "",
          isOpen: true, // ✅ Keep first section open by default
        };
      }

      // ✅ Preserve `isOpen` state for existing sections
      const updatedSections = formattedBasicInfo.map((section) => ({
        ...section,
        id: section.id || Date.now(),
        isOpen: sections.find((s) => s.id === section.id)?.isOpen ?? true, // ✅ Preserve toggle state
      }));

      setSections(updatedSections);
    }
  }, [contractData.basicInfo]); // ✅ Runs every time basicInfo changes

  // ✅ Prevent infinite updates in `updateContractData`
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (JSON.stringify(contractData.basicInfo) !== JSON.stringify(sections)) {
      updateContractData("basicInfo", sections);
    }
  }, [sections]);

  // ✅ Add a new section
  const addSection = () => {
    setSections([
      ...sections,
      {
        id: Date.now(),
        purchasingCompany: "",
        supplierName: "",
        contractDate: "",
        contractNumber: "",
        isOpen: true,
      },
    ]);
  };

  const toggleSection = (id) => {
    setSections((prevSections) =>
      prevSections.map((sec) =>
        sec.id === id ? { ...sec, isOpen: !sec.isOpen } : sec
      )
    );
  };

  // ✅ Handle input change
  const handleChange = (id, field, value) => {
    setSections((prevSections) =>
      prevSections.map((sec) =>
        sec.id === id
          ? {
              ...sec,
              [field]: field === "contractDate" ? formatDate(value) : value,
            }
          : sec
      )
    );
  };

  // ✅ Remove Section Handling
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);

  const confirmRemoveSection = (id) => {
    if (sections.length > 1) {
      setSelectedSection(id);
      setIsModalOpen(true);
    }
  };

  const removeSection = () => {
    setSections((prev) => prev.filter((sec) => sec.id !== selectedSection));
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div
          key={section.id}
          className="bg-white shadow-md rounded-xl border p-4 relative"
        >
          {/* ✅ Section Header */}
          <div
            className="flex justify-between items-center cursor-pointer pb-1 border-b border-gray-300"
            onClick={() => toggleSection(section.id)}
          >
            <div className="flex items-center space-x-2">
              <FiChevronDown
                className={`transition-transform text-gray-600 ${
                  section.isOpen ? "rotate-180" : ""
                }`}
              />
              <h2 className="font-semibold">Purchasing Company</h2>
            </div>
            {sections.length > 1 && (
              <button
                className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  confirmRemoveSection(section.id);
                }}
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          {/* ✅ Section Fields */}
          {section.isOpen && (
            <div className="mt-4 space-y-3">
              {[
                "purchasingCompany",
                "supplierName",
                "contractDate",
                "contractNumber",
              ].map((field, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 items-center gap-4"
                >
                  <label className="text-sm text-gray-600 capitalize">
                    {field.replace(/([A-Z])/g, " $1")}
                  </label>
                  <input
                    type={field === "contractDate" ? "date" : "text"}
                    placeholder={field.replace(/([A-Z])/g, " $1")}
                    value={
                      field === "contractDate"
                        ? formatDate(section[field])
                        : section[field] || ""
                    }
                    onChange={(e) =>
                      handleChange(section.id, field, e.target.value)
                    }
                    className="col-span-2 w-full p-2 bg-gray-50 rounded-md text-sm border border-gray-300"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* ✅ Add Section Button */}
      <button
        className="flex items-center text-[var(--p-blue)] text-sm font-medium mt-4"
        onClick={addSection}
      >
        <span className="mr-3">Add More</span>
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--p-blue)] text-white rounded-full">
          <FiPlus size={16} />
        </div>
      </button>

      {/* ✅ Confirmation Modal */}
      {isModalOpen && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={removeSection}
          title="Remove Section"
          message="Are you sure you want to remove this section?"
        />
      )}
    </div>
  );
};

export default BasicInfo;
