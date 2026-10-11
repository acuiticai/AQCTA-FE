import { useState, useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import { EditorState, convertToRaw, ContentState } from "draft-js";
import { useForm } from "react-hook-form";
import draftToHtml from "draftjs-to-html";
import { stateFromHTML } from "draft-js-import-html";
import { toast } from "react-toastify";
import { initialValues, initialValuesFormHeader } from "../data/data-index";

export const useDocumentTemplateCreate = () => {
  const history = useHistory();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("general");
  const [activeSubTabList, setActiveSubTabList] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [activeSection, setActiveSection] = useState("");
  const [headerData, setHeaderData] = useState(initialValuesFormHeader);

  // Document State
  const [documentType, setDocumentType] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateVersion, setTemplateVersion] = useState(1);
  const [logo, setLogo] = useState(null);

  // Table State
  const [tableFields, setTableFields] = useState(initialValues);
  const [tableValues, setTableValues] = useState([]);

  // Rich Text State
  const [termsEditorState, setTermsEditorState] = useState(
    EditorState.createEmpty()
  );
  const [paymentEditorState, setPaymentEditorState] = useState(
    EditorState.createEmpty()
  );

  // Signees State
  const [signees, setSignees] = useState([
    { id: 1, title: "Company Representative", name: "", designation: "" },
    { id: 2, title: "Client", name: "", designation: "" },
  ]);

  // Form handling
  const { handleSubmit, setValue } = useForm();

  useEffect(() => {
    if (id) {
      loadExistingTemplate(id);
    }
  }, [id]);

  const loadExistingTemplate = async (templateId) => {
    try {
      const templates = JSON.parse(
        localStorage.getItem("savedTemplates") || "[]"
      );
      const template = templates.find((t) => t.id === parseInt(templateId));

      if (template) {
        // Load basic info
        setDocumentType(template.documentType || "");
        setTemplateName(template.templateName || "");
        console.log(logo);

        setLogo(template.logo || null);
        setTemplateVersion(template.version || 1);

        // Load table fields first
        const savedFields = template.tableFields || initialValues;
        setTableFields(savedFields);

        // Load table values with proper validation
        if (template.tableValues && Array.isArray(template.tableValues)) {
          const validTableValues = template.tableValues.map((row) => ({
            id: row.id || Date.now(),
            values: savedFields.reduce((acc, field) => {
              // Preserve existing values or set empty string
              acc[field.id] = row.values?.[field.id] || "";
              return acc;
            }, {}),
          }));
          setTableValues(validTableValues);
        } else {
          // Initialize with one empty row if no values exist
          setTableValues([
            {
              id: Date.now(),
              values: savedFields.reduce((acc, field) => {
                acc[field.id] = "";
                return acc;
              }, {}),
            },
          ]);
        }

        // Load rich text content
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

        // Load signees
        setSignees(
          template.signees || [
            {
              id: 1,
              title: "Company Representative",
              name: "",
              designation: "",
            },
            { id: 2, title: "Client", name: "", designation: "" },
          ]
        );
      }
    } catch (error) {
      console.error("Error loading template:", error);
      toast.error("Error loading template");
    }
  };

  const saveTemplate = async (formData) => {
    try {
      // Ensure all table values are properly structured before saving
      const validatedTableValues = tableValues.map((row) => ({
        id: row.id,
        values: tableFields.reduce((acc, field) => {
          // Preserve existing values and ensure all fields are included
          acc[field.id] = row.values?.[field.id] || "";
          return acc;
        }, {}),
      }));

      const templateData = {
        id: id ? parseInt(id) : Date.now(),
        version: id ? templateVersion + 1 : 1,
        documentType,
        templateName,
        createdAt: new Date().toISOString(),
        logo,
        tableFields,
        tableValues: validatedTableValues, // Save all rows
        terms: draftToHtml(convertToRaw(termsEditorState.getCurrentContent())),
        payment: draftToHtml(
          convertToRaw(paymentEditorState.getCurrentContent())
        ),
        signees,
      };

      const templates = JSON.parse(
        localStorage.getItem("savedTemplates") || "[]"
      );
      const templateIndex = templates.findIndex(
        (t) => t.id === templateData.id
      );

      if (templateIndex >= 0) {
        templates[templateIndex] = templateData;
      } else {
        templates.push(templateData);
      }

      localStorage.setItem("savedTemplates", JSON.stringify(templates));
      history.push("/document-templates");
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Error saving template");
    }
  };

  return {
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
    // Form
    handleSubmit,
    saveTemplate,

    // Utils
    isEditing: !!id,
  };
};
