import React, { createContext, useContext, useState } from "react";
import {
  fieldConfigsGradeAndQuantity,
  paymentInputFields,
  shippingInputFields,
} from "@/data/default-labels";

const LabelManagementContext = createContext();

const initialHeaderLabels = {
  buyer: "BUYER",
  contractNo: "Contract No",
  poNo: "P",
  intermediate: "Intermediate",
  date: "Date",
  terms: "Terms",
};

const createInitialLabels = (fieldConfigs) => {
  return fieldConfigs.reduce((acc, config) => {
    acc[config.id] = config.label;
    return acc;
  }, {});
};

export const getDefaultLabels = () => ({
  headerData: initialHeaderLabels,
  gradeQuantity: createInitialLabels(fieldConfigsGradeAndQuantity),
  payment: createInitialLabels(paymentInputFields),
  shipping: createInitialLabels(shippingInputFields),
});

export const LabelManagementProvider = ({ children }) => {
  // Initialize with default labels
  const [labels, setLabels] = useState(getDefaultLabels());

  // Update a single label
  const updateLabel = (section, fieldId, newLabel) => {
    setLabels((prevLabels) => ({
      ...prevLabels,
      [section]: {
        ...prevLabels[section],
        [fieldId]: newLabel,
      },
    }));
  };

  // Get a specific label
  const getLabel = (section, fieldId) => {
    return labels[section]?.[fieldId] || fieldId;
  };

  // Update all labels at once (used when loading from backend)
  const updateAllLabels = (newLabels) => {
    setLabels(newLabels);
  };

  // Reset labels to default values
  const resetLabels = () => {
    setLabels(getDefaultLabels());
  };

  // Bulk update for a specific section
  const updateSectionLabels = (section, newSectionLabels) => {
    setLabels((prevLabels) => ({
      ...prevLabels,
      [section]: {
        ...prevLabels[section],
        ...newSectionLabels,
      },
    }));
  };

  const value = {
    labels,
    updateLabel,
    getLabel,
    resetLabels,
    updateAllLabels,
    updateSectionLabels,
    getDefaultLabels,
  };

  return (
    <LabelManagementContext.Provider value={value}>
      {children}
    </LabelManagementContext.Provider>
  );
};

export const useLabelManagement = () => {
  const context = useContext(LabelManagementContext);
  if (!context) {
    throw new Error(
      "useLabelManagement must be used within a LabelManagementProvider"
    );
  }
  return context;
};
