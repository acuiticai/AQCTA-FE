import React from "react";
import DocumentEditorLayout from "../../../components/document-template/sections/DocumentEditorLayout";
import HeaderSection from "../../../components/document-template/sections/HeaderSection";
import TableFieldsEditor from "../../../components/document-template/sections/TableFieldsEditor";
import RichTextSection from "../../../components/document-template/sections/RichTextSection";
import SigneeManager from "../../../components/document-template/sections/SigneeManager";
import { useDocumentTemplateCreate } from "../hooks/useDocumentTemplateCreate";
import ProformaInvoice from "./Pdf-Sample_Components/Proforma_Template";
import PreviewSection from "./PreviewSection";
import FormHeaderComponent from "./templates-subcomponents/HeaderInputs";

const documentsPreview = {
  "Document Type": PreviewSection,
  "Sales Contract": PreviewSection,
  "Proforma Invoice": ProformaInvoice,
  "Commercial Invoice": PreviewSection,
  "Credit Note": PreviewSection,
  "Debit Note": PreviewSection,
};

const DocumentTemplateCreate = () => {
  const {
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
    // Form
    handleSubmit,
    saveTemplate,

    // Utils
    isEditing,
  } = useDocumentTemplateCreate();

  const PreviewComponent = documentsPreview[documentType] || PreviewSection;
  const renderSection = () => {
    switch (activeSection) {
      case "header-content":
        return (
          <FormHeaderComponent
            setHeaderData={setHeaderData}
            headerData={headerData}
          />
        );

      case "header":
        return (
          <HeaderSection
            documentType={documentType}
            setDocumentType={setDocumentType}
            templateName={templateName}
            setTemplateName={setTemplateName}
            logo={logo}
            setLogo={setLogo}
          />
        );
      case "table":
        return (
          <TableFieldsEditor
            tableFields={tableFields}
            setTableFields={setTableFields}
            tableValues={tableValues}
            setTableValues={setTableValues}
          />
        );
      case "content":
        return (
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
        );
      case "signees":
        return <SigneeManager signees={signees} setSignees={setSignees} />;
      default:
        return null;
    }
  };

  return (
    <DocumentEditorLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onSave={handleSubmit(saveTemplate)}
      onCancel={() => history.push("/templates")}
      isEditing={isEditing}
    >
      <div className="h-full flex transition-all duration-300 ease-in-out">
        {/* Editor Panel - Hidden when no active section */}
        <div
          className={`${
            activeSection
              ? "w-1/2 opacity-100 translate-x-0"
              : "w-0 opacity-0 -translate-x-full"
          } transition-all duration-300 ease-in-out`}
        >
          <div className="p-6">{renderSection()}</div>
        </div>

        {/* Live Preview - Expands to full width when no active section */}
        <div
          style={{ scrollbarWidth: "none" }}
          className={`${
            activeSection ? "w-1/2" : "w-full"
          } bg-gray-50 overflow-auto border-l transition-all duration-300 ease-in-out`}
        >
          <PreviewComponent
            documentType={documentType}
            templateName={templateName}
            logo={logo}
            tableFields={tableFields}
            tableValues={tableValues}
            termsEditorState={termsEditorState}
            paymentEditorState={paymentEditorState}
            signees={signees}
            headerData={headerData}
          />
        </div>
      </div>
    </DocumentEditorLayout>
  );
};

export default DocumentTemplateCreate;
