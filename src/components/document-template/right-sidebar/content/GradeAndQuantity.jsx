import React from "react";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import { fieldConfigsGradeAndQuantity } from "@/data/data-document-content";
import DynamicInputsForm from "../../ui/DynamicInputs";

const GradeAndQuantity = () => {
  const {
    contentEntriesGradeAndQuantiy: entries,
    setContentEntriesGradeAndQuantiy: setEntries,
    setRequireContent,
    setRequiredGradeAndQuantity,
    requiredGradeAndQuantity,
  } = useDocumentConext();

  const handleAddContent = () => {
    setRequireContent(true);
    setRequiredGradeAndQuantity(true);
  };

  return (
    <DynamicInputsForm
      title="Grade and Quantity Details"
      subtitle="Manage grade and quantity fields"
      isVisible={requiredGradeAndQuantity}
      setIsVisible={setRequiredGradeAndQuantity}
      entries={entries}
      setEntries={setEntries}
      onAddContent={handleAddContent}
      inputFields={fieldConfigsGradeAndQuantity}
      section="gradeQuantity"
    />
  );
};

export default GradeAndQuantity;
