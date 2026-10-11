import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Editor } from "react-draft-wysiwyg";
import { EditorState, convertToRaw, ContentState } from "draft-js";
import { useForm, Controller } from "react-hook-form";
import draftToHtml from "draftjs-to-html";
import { stateFromHTML } from "draft-js-import-html";
import { toast } from "react-toastify";

import FormHeader from "./FormHeader";
import DocumentForm from "./DocumentForm";
import ActionButtons from "./ActionButtons";
import TemplateLoadDialog from "./TemplateLoadDialog";
import LogoUploader from "./LogoUploader";
import PreviewSection from "./PreviewSection";
import TableFieldsEditor from "../../../components/document-template/sections/TableFieldsEditor";
import RichTextSection from "../../../components/document-template/sections/RichTextSection";
import { initialValues } from "../data/data-index";
import SigneeManager from "../../../components/document-template/sections/SigneeManager";

const TemplateCreator = () => {
  const [documentType, setDocumentType] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [logo, setLogo] = useState(null);
  const [tableFields, setTableFields] = useState(initialValues);
  const [termsEditorState, setTermsEditorState] = useState(
    EditorState.createEmpty()
  );
  const [paymentEditorState, setPaymentEditorState] = useState(
    EditorState.createEmpty()
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [loadTemplateDialogOpen, setLoadTemplateDialogOpen] = useState(false);
  const [templateVersion, setTemplateVersion] = useState(1);
  const [tableValues, setTableValues] = useState([
    {
      id: Date.now(),
      values: {},
    },
  ]);
  const [signees, setSignees] = useState([
    { id: 1, title: "Company Representative", name: "" },
    { id: 2, title: "Client", name: "" },
  ]);

  useEffect(() => {
    // Initialize tableValues with empty values for each field
    setTableValues([
      {
        id: Date.now(),
        values: tableFields.reduce(
          (acc, field) => ({
            ...acc,
            [field.id]: "",
          }),
          {}
        ),
      },
    ]);
  }, []); // Run once on mount

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      documentType: "",
      templateName: "",
    },
  });

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
    },
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        setLogo({
          preview: reader.result,
          file: file,
        });
      };
      reader.readAsDataURL(file);
    },
    maxSize: 5242880,
  });

  const saveTemplate = async (formData) => {
    try {
      const templateData = {
        id: Date.now(),
        version: templateVersion,
        documentType: formData.documentType,
        templateName: formData.templateName,
        createdAt: new Date().toISOString(),
        logo,
        tableFields,
        terms: draftToHtml(convertToRaw(termsEditorState.getCurrentContent())),
        payment: draftToHtml(
          convertToRaw(paymentEditorState.getCurrentContent())
        ),
        signees,
      };

      const templates = JSON.parse(
        localStorage.getItem("savedTemplates") || "[]"
      );

      const existingTemplateIndex = templates.findIndex(
        (t) => t.templateName === formData.templateName
      );

      if (existingTemplateIndex >= 0) {
        templates[existingTemplateIndex] = {
          ...templates[existingTemplateIndex],
          ...templateData,
          version: templates[existingTemplateIndex].version + 1,
        };
      } else {
        templates.push(templateData);
      }

      localStorage.setItem("savedTemplates", JSON.stringify(templates));
      setSavedTemplates(templates);

      toast.success("Template saved successfully!");
    } catch (error) {
      toast.error("Error saving template");
      console.error(error);
    }
  };

  const loadTemplate = (template) => {
    setDocumentType(template.documentType);
    setTemplateName(template.templateName);
    setLogo(template.logo);
    setTableFields(template.tableFields);

    const termsContent = stateFromHTML(template.terms);
    const paymentContent = stateFromHTML(template.payment);

    setTermsEditorState(
      EditorState.createWithContent(
        ContentState.createFromBlockArray(termsContent.contentBlocks)
      )
    );
    setPaymentEditorState(
      EditorState.createWithContent(
        ContentState.createFromBlockArray(paymentContent.contentBlocks)
      )
    );

    setLoadTemplateDialogOpen(false);
    toast.success("Template loaded successfully!");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-h-[90vh] overflow-y-auto pb-[120px]">
      <div className="bg-white rounded-lg shadow-lg">
        <form onSubmit={handleSubmit(saveTemplate)} className="space-y-6 p-6">
          <FormHeader />

          <DocumentForm control={control} errors={errors} />

          <LogoUploader logo={logo} setLogo={setLogo} />

          <TableFieldsEditor
            tableFields={tableFields}
            setTableFields={setTableFields}
            tableValues={tableValues}
            setTableValues={setTableValues}
          />

          <div className="space-y-6">
            <RichTextSection
              title="Terms and Conditions"
              editorState={termsEditorState}
              onEditorStateChange={setTermsEditorState}
            />

            <RichTextSection
              title="Payment Instructions"
              editorState={paymentEditorState}
              onEditorStateChange={setPaymentEditorState}
            />
          </div>

          <SigneeManager signees={signees} setSignees={setSignees} />

          <ActionButtons
            onLoadClick={() => setLoadTemplateDialogOpen(true)}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
          />
        </form>

        <TemplateLoadDialog
          isOpen={loadTemplateDialogOpen}
          onClose={() => setLoadTemplateDialogOpen(false)}
          templates={savedTemplates}
          onLoadTemplate={loadTemplate}
        />

        {previewMode && (
          <PreviewSection
            documentType={documentType}
            logo={logo}
            tableFields={tableFields}
            tableValues={tableValues}
            termsEditorState={termsEditorState}
            paymentEditorState={paymentEditorState}
            signees={signees}
          />
        )}
      </div>
    </div>
  );
};

export default TemplateCreator;
