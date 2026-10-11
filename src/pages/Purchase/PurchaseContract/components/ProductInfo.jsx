import React, { useState, useEffect, useRef } from "react";
import { FiChevronDown, FiX, FiPlus } from "react-icons/fi";
import ConfirmationModal from "./ConfirmationModal ";
import { useContractContext } from "../context/ContractContext";
import Select from "react-select";
import axios from "axios";

// Assuming you have a similar BASE_URL defined somewhere
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ProductInfo = () => {
  const { contractData, updateContractData } = useContractContext();
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // We'll need to get the selectedBusiness from the context
  // Assuming there's a similar context setup as in ProductSection
  const selectedBusiness =
    contractData.businessId || contractData.selectedBusiness;

  const isFirstRender = useRef(true);

  // Custom styles for react-select
  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? "var(--p-blue)" : provided.borderColor,
      boxShadow: state.isFocused
        ? "0 0 0 2px var(--p-blue)"
        : provided.boxShadow,
      "&:hover": {
        borderColor: "var(--p-blue)",
      },
      padding: "2px",
      backgroundColor: "#F9FAFB",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
    }),
  };

  // Fetch items when component mounts and when selectedBusiness changes
  const fetchItems = async () => {
    if (!selectedBusiness) return;

    setLoadingItems(true);
    try {
      const response = await axios.get(
        `${Base_URL}/items/?businessId=${selectedBusiness}&active=true`
      );
      setItems(
        response?.data.filter((item) => item.status !== "Inactive") || []
      );
    } catch (error) {
      console.error("❌ Error fetching items:", error);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (selectedBusiness) {
      fetchItems();
    }
  }, [selectedBusiness]);

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
          isOpen: true,
        };
      }

      const updatedSections = formattedProductInfo.map((section) => ({
        ...section,
        id: section.id || Date.now(),
        isOpen: sections.find((s) => s.id === section.id)?.isOpen ?? true,
      }));

      setSections(updatedSections);
    }
  }, [contractData.productInfo]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (JSON.stringify(contractData.productInfo) !== JSON.stringify(sections)) {
      updateContractData("productInfo", sections);
    }
  }, [sections]);

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

  const toggleSection = (id) => {
    setSections((prevSections) =>
      prevSections.map((sec) =>
        sec.id === id ? { ...sec, isOpen: !sec.isOpen } : sec
      )
    );
  };

  // Handle input change for text fields
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

  // Handle dropdown change specifically for the items field
  const handleItemChange = (id, selectedOption) => {
    setSections((prevSections) =>
      prevSections.map((sec) =>
        sec.id === id
          ? {
              ...sec,
              item: selectedOption.value,
            }
          : sec
      )
    );
  };

  // Extract item names for dropdown options
  const itemOptions =
    items && Array.isArray(items)
      ? items.map((item) => ({ value: item.name, label: item.name }))
      : [];

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

          {section.isOpen && (
            <div className="mt-4 space-y-3">
              {/* Item dropdown */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm text-gray-600">Item</label>
                <div className="col-span-2 w-full">
                  <Select
                    options={itemOptions}
                    value={
                      section.item
                        ? { value: section.item, label: section.item }
                        : null
                    }
                    onChange={(option) => handleItemChange(section.id, option)}
                    styles={customStyles}
                    placeholder={
                      loadingItems ? "Loading items..." : "Select Item"
                    }
                    className="w-full"
                    isLoading={loadingItems}
                  />
                </div>
              </div>

              {/* Other fields remain as text inputs */}
              {[
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

      <button
        className="flex items-center text-[var(--p-blue)] text-sm font-medium mt-4"
        onClick={addSection}
      >
        <span className="mr-3">Add More</span>
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--p-blue)] text-white rounded-full">
          <FiPlus size={16} />
        </div>
      </button>

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
