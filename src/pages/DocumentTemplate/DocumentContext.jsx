import React, { createContext, useContext, useState, useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import { EditorState, convertToRaw } from "draft-js";
import { useForm } from "react-hook-form";
import draftToHtml from "draftjs-to-html";
import { stateFromHTML } from "draft-js-import-html";
import { initialValues, initialValuesFormHeader } from "./data/data-index";
import request from "@/services/httpService";
import { useLabelManagement } from "./context/LabelContext";
import {
  fieldConfigsGradeAndQuantity,
  paymentInputFields,
  shippingInputFields,
} from "@/data/default-labels";
import { notifySuccess, notifyError } from "@/utils/toast";

// Create Context
const DocumentTemplateContext = createContext();

// Helper function to create initial field labels from configs
const createInitialFieldLabels = () => {
  return {
    headerData: {
      buyer: "BUYER",
      contractNo: "Contract No",
      poNo: "PO No",
      intermediate: "Intermediate",
      date: "Date",
      terms: "Terms",
    },
    gradeQuantity: fieldConfigsGradeAndQuantity.reduce((acc, config) => {
      acc[config.id] = config.label;
      return acc;
    }, {}),
    payment: paymentInputFields.reduce((acc, config) => {
      acc[config.id] = config.label;
      return acc;
    }, {}),
    shipping: shippingInputFields.reduce((acc, config) => {
      acc[config.id] = config.label;
      return acc;
    }, {}),
  };
};

// Create Provider Component
export const DocumentTemplateProvider = ({ children }) => {
  const history = useHistory();
  const { id: selectedTemplateID } = useParams();

  const [id, setId] = useState("");
  const [contractId, setContractId] = useState("");
  const { labels, updateLabel, resetLabels } = useLabelManagement();

  // Content Showing Statuses
  const [contractDetails, setContractDetails] = useState();
  const [requireTable, setRequireTable] = useState(false);
  const [requireContent, setRequireContent] = useState(false);
  const [requiredShipping, setRequiredShipping] = useState(false);
  const [requiredPayment, setRequiredPayment] = useState(false);
  const [requireSignee, setRequireSignee] = useState(false);
  const [requiredGradeAndQuantity, setRequiredGradeAndQuantity] =
    useState(false);

  // Content States
  const [contentEntriesGradeAndQuantiy, setContentEntriesGradeAndQuantiy] =
    useState({});
  const [paymentEntries, setPaymentEntries] = useState({});
  const [shippingEntries, setShippingEntries] = useState({});

  // Basic template states remain the same
  const [activeTab, setActiveTab] = useState("general");
  const [activeSubTabList, setActiveSubTabList] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const [headerData, setHeaderData] = useState(initialValuesFormHeader);
  const [documentType, setDocumentType] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateVersion, setTemplateVersion] = useState(1);
  const [logo, setLogo] = useState(null);
  const [tableFields, setTableFields] = useState(initialValues);
  const [tableValues, setTableValues] = useState([]);
  const [termsEditorState, setTermsEditorState] = useState(
    EditorState.createEmpty()
  );
  const [paymentEditorState, setPaymentEditorState] = useState(
    EditorState.createEmpty()
  );
  const [signees, setSignees] = useState([
    { id: 1, title: "Company Representative", name: "", designation: "" },
    { id: 2, title: "Client", name: "", designation: "" },
  ]);
  const [FooterText, setFooterText] = useState([]);
  const [FooterText2, setFooterText2] = useState([]);

  // Local state for field labels that will sync with global label context
  const [fieldLabels, setFieldLabels] = useState(createInitialFieldLabels());

  const { handleSubmit } = useForm();

  // Function to sync local field labels with global label context
  const syncLabelsWithContext = (newLabels) => {
    Object.entries(newLabels).forEach(([section, sectionLabels]) => {
      Object.entries(sectionLabels).forEach(([fieldId, label]) => {
        updateLabel(section, fieldId, label);
      });
    });
  };

  // Function to load existing template with enhanced label handling
  const loadExistingTemplate = async (templateId, contractId) => {
    try {
      const response = await request.get(`/document-templates/${templateId}`);

      console.log(contractId);

      if (contractId) {
        const responseContract = await request.get(
          `/sales-contracts/${contractId}`
        );
        console.log("Logging Status of Sales Contract Fetching");

        console.log("responseContract",responseContract);
        setContractDetails(responseContract);
      }

      const template = response?.data;

      if (template) {
        // Basic Fields
        setDocumentType(template.documentType || "");
        setTemplateName(template.templateName || "");
        setTemplateVersion(template.version || 1);

        // Handle Labels
        if (template.fieldLabels) {
          // Update local state
          setFieldLabels(template.fieldLabels);
          // Sync with global label context
          syncLabelsWithContext(template.fieldLabels);
        } else {
          // If no labels in template, use defaults
          const defaultLabels = createInitialFieldLabels();
          setFieldLabels(defaultLabels);
          syncLabelsWithContext(defaultLabels);
        }

        // Rest of the template loading logic...
        if (template.logo && template.logo.file) {
          setLogo(template.logo);
        }

        if (template.headerData) {
          setHeaderData(template.headerData);
        }

        // Handle Table Data
        if (template.tableFields && template.tableFields.length > 0) {
          setTableFields(template.tableFields);
          setRequireTable(true);

          if (template.tableValues && Array.isArray(template.tableValues)) {
            const validTableValues = template.tableValues.map((row) => ({
              id: row.id || Date.now(),
              values: template.tableFields.reduce((acc, field) => {
                acc[field.id] = row.values?.[field.id] || "";
                return acc;
              }, {}),
            }));
            setTableValues(validTableValues);
          }
        }

        // Handle Rich Text Content
        if (template.terms) {
          try {
            const contentState = stateFromHTML(template.terms);
            setTermsEditorState(EditorState.createWithContent(contentState));
          } catch (error) {
            console.error("Error loading terms:", error);
            setTermsEditorState(EditorState.createEmpty());
          }
        }

        if (template.payment) {
          try {
            const contentState = stateFromHTML(template.payment);
            setPaymentEditorState(EditorState.createWithContent(contentState));
          } catch (error) {
            console.error("Error loading payment:", error);
            setPaymentEditorState(EditorState.createEmpty());
          }
        }

        // Handle Content Sections
        if (template.contentEntriesGradeAndQuantiy) {
          setContentEntriesGradeAndQuantiy(
            template.contentEntriesGradeAndQuantiy
          );
          setRequireContent(true);
          setRequiredGradeAndQuantity(true);
        }


        if (template.shippingEntries) {
          setShippingEntries(template.shippingEntries);
          setRequiredShipping(true);
        }

        if (template.paymentEntries) {
          setPaymentEntries(template.paymentEntries);
          setRequiredPayment(true);
        }


        if (template.FooterText) {
          setFooterText(template.FooterText);
        }
        if (template.FooterText2) {
          setFooterText2(template.FooterText2);
        }
        // Handle Signees
        if (template.signees && Array.isArray(template.signees)) {
          const formattedSignees = template.signees.map((signee, index) => ({
            id: index + 1,
            title: signee.title || "",
            name: signee.name || "",
            designation: signee.designation || "",
          }));
          setSignees(formattedSignees);
        }
      }
    } catch (error) {
      console.error("Error loading template:", error);
    }
  };

  // Enhanced save template function with label handling
  const saveTemplate = async () => {
    try {
      // Validation
      if (!templateName || templateName.trim() === "") {
        notifyError("Template name is required");
        return;
      }

      if (!documentType || documentType.trim() === "") {
        notifyError("Document type is required");
        return;
      }

      const validatedTableValues = tableValues.map((row) => ({
        id: row.id,
        values: tableFields.reduce((acc, field) => {
          acc[field.id] = row.values?.[field.id] || "";
          return acc;
        }, {}),
      }));

      const templateData = {
        documentType,
        templateName,
        version: templateVersion,
        headerData,
        logo,
        FooterText: FooterText,
        FooterText2: FooterText2,
        terms: draftToHtml(convertToRaw(termsEditorState.getCurrentContent())),
        payment: draftToHtml(
          convertToRaw(paymentEditorState.getCurrentContent())
        ),
        signees: signees.map(({ title, name, designation }) => ({
          title,
          name,
          designation,
        })),
        // Always include current field labels
        fieldLabels: {
          ...fieldLabels,
          // Sync with any updates from global label context
          headerData: labels.headerData,
          gradeQuantity: labels.gradeQuantity,
          payment: labels.payment,
          shipping: labels.shipping,
        },
      };

      // Handle conditional content based on requirements
      if (requireContent) {
        if (requiredGradeAndQuantity) {
          templateData.contentEntriesGradeAndQuantiy =
            contentEntriesGradeAndQuantiy;
        }
        if (requiredShipping) {
          templateData.shippingEntries = shippingEntries;
        }
        if (requiredPayment) {
          templateData.paymentEntries = paymentEntries;
        }
      }

      if (requireTable) {
        templateData.tableFields = tableFields;
        templateData.tableValues = validatedTableValues;
      }

      let response;
      if (id) {
        response = await request.put(`/document-templates/${id}`, templateData);
        notifySuccess("Document template updated successfully");
      } else {
        response = await request.post("/document-templates", templateData);
        notifySuccess("Document template created successfully");
        
        // Update the ID if we got one back
        if (response?.data?._id) {
          setId(response.data._id);
        }
      }

      // Optionally navigate back to templates list
      // history.push("/document-templates");
    } catch (error) {
      console.error("Error saving template:", error);
      
      // Extract error message from response
      let errorMessage = "Failed to save document template";
      
      if (error.response) {
        // Server responded with error
        const errorData = error.response.data;
        if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (errorData?.errors && Array.isArray(errorData.errors)) {
          errorMessage = errorData.errors.join(", ");
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      notifyError(errorMessage);
    }
  };

  // Function to update individual field labels
  const updateFieldLabel = (section, fieldId, newLabel) => {
    setFieldLabels((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [fieldId]: newLabel,
      },
    }));
    // Sync with global label context
    updateLabel(section, fieldId, newLabel);
  };

  // Load template on mount if editing
  useEffect(() => {
    if (selectedTemplateID) {
      const [id, contractId] = selectedTemplateID?.includes(":")
        ? selectedTemplateID.split(":")
        : [selectedTemplateID, ""];
      setId(id);
      setContractId(contractId);

      loadExistingTemplate(id, contractId);
    } else {
      // Reset to default labels for new templates
      setFieldLabels(createInitialFieldLabels());
    }
  }, [selectedTemplateID]);

  const value = {
    // All existing states and setters...
    activeSection,
    documentType,
    templateName,
    logo,
    tableFields,
    tableValues,
    termsEditorState,
    paymentEditorState,
    signees,
    FooterText,
    FooterText2,
    headerData,
    activeTab,
    selectedIndex,
    activeSubTabList,
    requireTable,
    requireContent,
    requiredShipping,
    requiredPayment,
    requiredGradeAndQuantity,
    contentEntriesGradeAndQuantiy,
    shippingEntries,
    paymentEntries,
    requireSignee,
    contractDetails,
    selectedTemplateId: id,

    setActiveSection,
    setDocumentType,
    setTemplateName,
    setLogo,
    setTableFields,
    setTableValues,
    setTermsEditorState,
    setPaymentEditorState,
    setFooterText,
    setFooterText2,
    setSignees,
    setHeaderData,
    setActiveTab,
    setSelectedIndex,
    setActiveSubTabList,
    setRequireTable,
    setRequireContent,
    setRequiredGradeAndQuantity,
    setRequiredShipping,
    setRequiredPayment,
    setContentEntriesGradeAndQuantiy,
    setShippingEntries,
    setPaymentEntries,
    setRequireSignee,
    setContractDetails,

    // Label-related functionality
    fieldLabels,
    updateFieldLabel,

    // Form handling
    handleSubmit,
    saveTemplate,

    // Utility
    isEditing: !!id,
  };

  return (
    <DocumentTemplateContext.Provider value={value}>
      {children}
    </DocumentTemplateContext.Provider>
  );
};

export const useDocumentConext = () => {
  const context = useContext(DocumentTemplateContext);
  if (!context) {
    throw new Error(
      "useDocumentContext must be used within a DocumentTemplateProvider"
    );
  }
  return context;
};
