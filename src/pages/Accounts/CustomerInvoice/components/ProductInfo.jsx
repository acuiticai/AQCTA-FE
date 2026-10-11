import React, { useState, useEffect, useRef } from "react";
import { FiChevronDown, FiX, FiPlus } from "react-icons/fi";
import ConfirmationModal from "./ConfirmationModal ";
import { useContractContext } from "../context/ContractContext"; // Use context to update product info

const ProductInfo = () => {
  const { contractData, updateContractData } = useContractContext();
  const [sections, setSections] = useState([]);

  // ✅ Prevent unnecessary updates on first render
  const isFirstRender = useRef(true);

  useEffect(() => {
    console.log("Fetched Product Info:", contractData.productInfo);

    if (contractData.productInfo) {
      const formattedProductInfo = Array.isArray(contractData.productInfo)
        ? contractData.productInfo
        : [contractData.productInfo];

      if (
        !formattedProductInfo.length ||
        Object.keys(formattedProductInfo[0]).length === 0
      ) {
        formattedProductInfo[0] = {
          id: Date.now(),
          item: "",
          quantityFCL: "",
          quantityMTFCL: "",
          price: "",
          additionalPrice: "",
          totalValue: "",
          typeOfProduct: "",
          shippingTerms: "",
          packing: "",
          paymentTerms: "",
          breakevenValue: "",
          isOpen: true, // ✅ Keep first section open
        };
      }

      // ✅ Preserve `isOpen` state for existing sections
      const updatedSections = formattedProductInfo.map((section) => ({
        ...section,
        id: section.id || Date.now(),
        isOpen: sections.find((s) => s.id === section.id)?.isOpen ?? true, // ✅ Preserve toggle state
      }));

      setSections(updatedSections);
    }
  }, [contractData.productInfo]); // ✅ Runs every time productInfo changes

  // ✅ Prevent infinite updates in `updateContractData`
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (JSON.stringify(contractData.productInfo) !== JSON.stringify(sections)) {
      updateContractData("productInfo", sections);
    }
  }, [sections]);

  // ✅ Add a new section
  const addSection = () => {
    setSections([
      ...sections,
      {
        id: Date.now(),
        item: "",
        quantityFCL: "",
        quantityMTFCL: "",
        price: "",
        additionalPrice: "",
        totalValue: "",
        typeOfProduct: "",
        shippingTerms: "",
        packing: "",
        paymentTerms: "",
        breakevenValue: "",
        isOpen: true,
      },
    ]);
  };

  // ✅ Toggle section open/close
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
              [field]: value,
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
                className={`transition-transform ${
                  section.isOpen ? "rotate-180" : ""
                }`}
              />
              <h2 className="font-semibold">Product Info</h2>
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
                "item",
                "quantityFCL",
                "quantityMTFCL",
                "price",
                "additionalPrice",
                "totalValue",
                "typeOfProduct",
                "shippingTerms",
                "packing",
                "paymentTerms",
                "breakevenValue",
              ].map((label, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 items-center gap-4"
                >
                  <label className="text-sm text-gray-600">
                    {label.replace(/([A-Z])/g, " $1")}
                  </label>
                  <input
                    type="text"
                    placeholder={label.replace(/([A-Z])/g, " $1")}
                    value={section[label] || ""}
                    onChange={(e) =>
                      handleChange(section.id, label, e.target.value)
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
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={removeSection}
        title="Remove Section"
        message="Are you sure you want to remove this section?"
      />
    </div>
  );
};

export default ProductInfo;
