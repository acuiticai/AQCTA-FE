import React from "react";
import { CustomTextInput } from "../../ui/Input";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";

// Main Form Component
const TemplateSettingsForm = () => {
  const { documentType, setDocumentType, templateName, setTemplateName } =
    useDocumentConext();
  return (
    <form className="max-w-md mx-auto p-6">
      <CustomTextInput
        label="Template Name"
        value={templateName}
        onChange={setTemplateName}
        required
      />
      <div>
        <label className="block text-lime-500 mb-2">Document Type *</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-50 border border-gray-300 focus:outline-none focus:border-lime-500"
          required
        >
          <option value="">Select Document Type</option>
          <option value="Sales Contract">Sales Contract</option>
          <option value="Proforma Invoice">Proforma Invoice</option>
          <option value="Commercial Invoice">Commercial Invoice</option>
          <option value="Credit Note">Credit Note</option>
          <option value="Debit Note">Debit Note</option>
        </select>
      </div>
    </form>
  );
};

export default TemplateSettingsForm;
