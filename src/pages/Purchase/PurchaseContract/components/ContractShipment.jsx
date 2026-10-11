import React, { useState, useEffect, useRef } from "react";
import { FiChevronDown, FiX, FiPlus, FiUpload } from "react-icons/fi";
import ConfirmationModal from "./ConfirmationModal ";
import { useContractContext } from "../context/ContractContext"; // Using context to update contract shipment

const ContractShipment = () => {
  const { contractData, updateContractData } = useContractContext();
  const [sections, setSections] = useState([]);
  const isFirstRender = useRef(true); // Prevent unnecessary updates on first render

  // ✅ Sync fetched contract shipment data
  useEffect(() => {
    console.log("Fetched Contract Shipment:", contractData.contractShipment);

    if (contractData.contractShipment) {
      const formattedShipmentInfo = Array.isArray(contractData.contractShipment)
        ? contractData.contractShipment
        : [contractData.contractShipment];

      // ✅ Ensure at least one valid entry exists
      if (
        !formattedShipmentInfo.length ||
        Object.keys(formattedShipmentInfo[0]).length === 0
      ) {
        formattedShipmentInfo[0] = {
          id: Date.now(),
          portOfLoading: "",
          portOfDischarge: "",
          shipmentMonth: "",
          shipmentTerms: "",
          originVessel: "",
          transhipmentPort: "",
          transhipVessel: "",
          transhipETD_ETA: "",
          estimatedDepartureDate: "",
          estimatedTimeOfArrivalPortOfDischarge: "",
          freightAmount: "",
          forecastCosts: "",
          shippingLine: "",
          bookingConfirmationNo: "",
          ctrAndSealNo: "",
          blNo: "",
          totalFreightExpenses: "",
          receiveDocumentFromSupplier: null,
          sendOutDocumentToCustomerTrackingNo: null,
          isOpen: true,
        };
      }

      // ✅ Preserve `isOpen` state for existing sections
      const updatedSections = formattedShipmentInfo.map((section) => ({
        ...section,
        id: section.id || Date.now(),
        isOpen: sections.find((s) => s.id === section.id)?.isOpen ?? true, // ✅ Preserve toggle state
      }));

      setSections(updatedSections);
    }
  }, [contractData.contractShipment]);

  // ✅ Prevent infinite updates in `updateContractData`
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (
      JSON.stringify(contractData.contractShipment) !== JSON.stringify(sections)
    ) {
      updateContractData("contractShipment", sections);
    }
  }, [sections]);

  // ✅ Add a new section
  const addSection = () => {
    setSections([
      ...sections,
      {
        id: Date.now(),
        portOfLoading: "",
        portOfDischarge: "",
        shipmentMonth: "",
        shipmentTerms: "",
        originVessel: "",
        transhipmentPort: "",
        transhipVessel: "",
        transhipETD_ETA: "",
        estimatedDepartureDate: "",
        estimatedTimeOfArrivalPortOfDischarge: "",
        freightAmount: "",
        forecastCosts: "",
        shippingLine: "",
        bookingConfirmationNo: "",
        ctrAndSealNo: "",
        blNo: "",
        totalFreightExpenses: "",
        receiveDocumentFromSupplier: null,
        sendOutDocumentToCustomerTrackingNo: null,
        isOpen: true,
      },
    ]);
  };

  // ✅ Toggle section open/close
  const toggleSection = (id) => {
    setSections((prev) =>
      prev.map((sec) => (sec.id === id ? { ...sec, isOpen: !sec.isOpen } : sec))
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

  // ✅ Handle file upload
  const handleFileUpload = (id, field, event) => {
    const file = event.target.files[0]; // Get the uploaded file
    if (file) {
      setSections((prevSections) =>
        prevSections.map((sec) =>
          sec.id === id
            ? {
                ...sec,
                [field]: file.name, // Store file name for display
              }
            : sec
        )
      );
    }
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
              <h2 className="font-semibold">Contract Shipment</h2>
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
            <div className="mt-4 grid grid-cols-2 gap-6">
              {[
                "portOfLoading",
                "portOfDischarge",
                "shipmentMonth",
                "shipmentTerms",
                "originVessel",
                "transhipmentPort",
                "transhipVessel",
                "transhipETD_ETA",
                "estimatedDepartureDate",
                "estimatedTimeOfArrivalPortOfDischarge",
                "freightAmount",
                "forecastCosts",
                "shippingLine",
                "bookingConfirmationNo",
                "ctrAndSealNo",
                "blNo",
                "totalFreightExpenses",
              ].map((label, index) => (
                <div
                  key={index}
                  className="grid grid-cols-2 items-center gap-4"
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
                    className="w-full p-2 bg-gray-50 rounded-md text-sm border border-gray-300"
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
        <FiPlus className="mr-2" /> Add More
      </button>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={removeSection}
      />
    </div>
  );
};

export default ContractShipment;
