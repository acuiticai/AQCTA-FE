import React, { useState } from "react";
import { X, Search } from "lucide-react";
import { useDocumentTemplates } from "@/pages/DocumentTemplate/hooks/useDocumentTemplates";
import TemplateCard from "../../../components/document-template/ui/TemplateCard";
import { useTranslation } from "react-i18next";

const DocumentTemplateModal = ({
  isOpen,
  onClose,
  contractId,
  onSubmit,
  type,
}) => {
  const { t } = useTranslation();
  const {
    templates,
    loading,
    error,
    filterType,
    searchQuery,
    setFilterType,
    setSearchQuery,
  } = useDocumentTemplates();

  const [selectedTemplate, setSelectedTemplate] = useState({
    id: type,
    name: type,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    let payload = {
      templateId: selectedTemplate._id,
      contractId: contractId,
    };
    if (selectedTemplate) {
      onSubmit(payload);
      onClose();
    }
  };
  console.log("templates", templates);
  console.log("type prop:", type);
  if (!isOpen) return null;

  // Filter templates - handle type matching
  // API returns type: "invoice" but we pass "Commercial Invoice" or "Proforma Invoice"
  const filteredTemplates = templates.filter((template) => {
    // Exact match first
    if (template.type === type) return true;
    
    // Handle "invoice" type matching "Commercial Invoice" or "Proforma Invoice"
    if (template.type?.toLowerCase() === "invoice" && type?.toLowerCase().includes("invoice")) {
      return true;
    }
    
    return false;
  });
  
  console.log("filteredTemplates", filteredTemplates);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl transform transition-all max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {t("documents.selectTemplate", {
              defaultValue: "Select Document Template",
            })}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {/* Search and Filter Section */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute ml-2 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t("documents.searchTemplates", {
                  defaultValue: "Search templates...",
                })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-lime-500"
              />
            </div>
          </div>
          {console.log("filtered templates", filteredTemplates)}
          {/* Templates Grid */}
          <div className="overflow-y-auto max-h-[50vh]">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="border-t-4 border-lime-500 border-solid rounded-full animate-spin w-8 h-8"></div>
                <span className="ml-2 text-gray-600">
                  {t("documents.loadingTemplates", {
                    defaultValue: "Loading templates...",
                  })}
                </span>
              </div>
            ) : error ? (
              <div className="text-red-500 text-center py-4">{error}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TemplateCard
                  selectedTemplate={selectedTemplate}
                  templates={filteredTemplates}
                  setSelectedTemplate={setSelectedTemplate}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedTemplate}
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500 ${selectedTemplate
                ? "bg-lime-500 hover:bg-lime-600"
                : "bg-gray-300 cursor-not-allowed"
              }`}
          >
            {t("documents.useTemplate", { defaultValue: "Use Template" })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentTemplateModal;
