import React from "react";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import DynamicInputsForm from "../../ui/DynamicInputs";
import { shippingInputFields } from "@/data/data-document-content";

// Shipping Details Component
export const ShippingDetails = () => {
  const {
    shippingEntries,
    setShippingEntries,
    setRequireContent,
    setRequiredShipping,
    requiredShipping,
  } = useDocumentConext();

  const handleAddContent = () => {
    setRequireContent(true);
    setRequiredShipping(true);
  };

  return (
    <DynamicInputsForm
      title="Shipping Details"
      subtitle="Manage shipping information"
      isVisible={requiredShipping}
      setIsVisible={setRequiredShipping}
      entries={shippingEntries}
      setEntries={setShippingEntries}
      onAddContent={handleAddContent}
      inputFields={shippingInputFields}
      section={"shipping"}
    />
  );
};
