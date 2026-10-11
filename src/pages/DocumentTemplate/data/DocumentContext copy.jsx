import React, { createContext, useContext, useState, useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import { EditorState, convertToRaw } from "draft-js";
import { useForm } from "react-hook-form";
import draftToHtml from "draftjs-to-html";
import { stateFromHTML } from "draft-js-import-html";
import { initialValues, initialValuesFormHeader } from "./data-index";
import request from "@/services/httpService";
import { useLabelManagement } from "../context/LabelContext";

// Create Context
const DocumentTemplateContext = createContext();

// Create Provider Component
export const DocumentTemplateProvider = ({ children }) => {
  const history = useHistory();
  const { id } = useParams();

  // Content Showing Statuses
  const [requireTable, setRequireTable] = useState(false);
  const [requireContent, setRequireContent] = useState(false);
  const [requiredShipping, setRequiredShipping] = useState(false);
  const [requiredPayment, setRequiredPayment] = useState(false);
  const [requiredGradeAndQuantity, setRequiredGradeAndQuantity] =
    useState(false);

  // Content States
  const [contentEntriesGradeAndQuantiy, setContentEntriesGradeAndQuantiy] =
    useState({});
  const [paymentEntries, setPaymentEntries] = useState({});
  const [shippingEntries, setShippingEntries] = useState({});

  // All states from the hook
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

  const { handleSubmit, setValue } = useForm();
  const { labels, updateLabel } = useLabelManagement();
  const [fieldLabels, setFieldLabels] = useState({
    headerData: {},
    tableFields: {},
    contentFields: {},
    shippingFields: {},
    paymentFields: {},
  });

  const loadExistingTemplate = async (templateId) => {
    try {
      const response = await request.get(`/document-templates/${templateId}`);
      const template = response.data;

      if (template) {
        // Basic Fields
        setDocumentType(template.documentType || "");
        setTemplateName(template.templateName || "");
        setTemplateVersion(template.version || 1);

        if (template.fieldLabels) {
          setFieldLabels(template.fieldLabels);
          // Sync with label management context
          Object.entries(template.fieldLabels).forEach(([section, labels]) => {
            Object.entries(labels).forEach(([fieldId, label]) => {
              updateLabel(section, fieldId, label);
            });
          });
        }

        // Set Logo
        if (template.logo && template.logo.file) {
          setLogo(template.logo);
        }

        // Set Header Data
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

        // Handle Rich Text Editors
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

        // Handle Additional Entries
        if (
          template.contentEntriesGradeAndQuantiy &&
          Object.keys(template.contentEntriesGradeAndQuantiy).length > 0
        ) {
          setContentEntriesGradeAndQuantiy(
            template.contentEntriesGradeAndQuantiy
          );
          setRequireContent(true);
          setRequiredGradeAndQuantity(true);
        }

        if (
          template.shippingEntries &&
          Object.keys(template.shippingEntries).length > 0
        ) {
          setShippingEntries(template.shippingEntries);
          setRequiredShipping(true);
        }

        if (
          template.paymentEntries &&
          Object.keys(template.paymentEntries).length > 0
        ) {
          setPaymentEntries(template.paymentEntries);
          setRequiredPayment(true);
        }
      }
    } catch (error) {
      console.error("Error loading template:", error);
    }
  };

  const saveTemplate = async (formData) => {
    try {
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
        terms: draftToHtml(convertToRaw(termsEditorState.getCurrentContent())),
        payment: draftToHtml(
          convertToRaw(paymentEditorState.getCurrentContent())
        ),
        signees: signees.map(({ title, name, designation }) => ({
          title,
          name,
          designation,
        })),
        fieldLabels,
      };

      if (id) {
        // Update case
        templateData.contentEntriesGradeAndQuantiy = requiredGradeAndQuantity
          ? contentEntriesGradeAndQuantiy
          : null;

        templateData.shippingEntries = requiredShipping
          ? shippingEntries
          : null;

        templateData.paymentEntries = requiredPayment ? paymentEntries : null;

        templateData.tableFields = requireTable ? tableFields : null;
        templateData.tableValues = requireTable ? validatedTableValues : null;
      } else {
        // Create new case
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
      }
      if (id) {
        await request.put(`/document-templates/${id}`, templateData);
      } else {
        await request.post("/document-templates", templateData);
      }

      history.push("/document-templates");
    } catch (error) {
      console.error("Error saving template:", error);
    }
  };
  const updateFieldLabel = (section, fieldId, newLabel) => {
    setFieldLabels((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [fieldId]: newLabel,
      },
    }));
    // Sync with label management context
    updateLabel(section, fieldId, newLabel);
  };

  useEffect(() => {
    if (id) {
      loadExistingTemplate(id);
    }
  }, [id]);

  const value = {
    // States
    activeSection,
    documentType,
    templateName,
    logo,
    tableFields,
    tableValues,
    termsEditorState,
    paymentEditorState,
    signees,
    headerData,
    activeTab,
    selectedIndex,
    activeSubTabList,

    // Restriction Conditions
    requireTable,
    requireContent,
    requiredShipping,
    requiredPayment,
    requiredGradeAndQuantity,

    // Content States
    contentEntriesGradeAndQuantiy,
    shippingEntries,
    paymentEntries,

    // Setters
    setActiveSection,
    setDocumentType,
    setTemplateName,
    setLogo,
    setTableFields,
    setTableValues,
    setTermsEditorState,
    setPaymentEditorState,
    setSignees,
    setHeaderData,
    setActiveTab,
    setSelectedIndex,
    setActiveSubTabList,

    // Content Setters
    setRequireTable,
    setRequireContent,
    setRequiredGradeAndQuantity,
    setRequiredShipping,
    setRequiredPayment,
    setContentEntriesGradeAndQuantiy,
    setShippingEntries,
    setPaymentEntries,

    // Form
    handleSubmit,
    saveTemplate,

    // Add label-related functions
    fieldLabels,
    updateFieldLabel,

    // Utils
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
      "useDocumentTemplate must be used within a DocumentTemplateProvider"
    );
  }
  return context;
};
