import React from "react";

const TemplateLoadDialog = ({ isOpen, onClose, templates, onLoadTemplate }) => {
  // Group templates by document type
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.documentType]) {
      acc[template.documentType] = [];
    }
    acc[template.documentType].push(template);
    return acc;
  }, {});

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full shadow-xl">
        <h3 className="text-lg font-medium text-gray-900 mb-4 pb-4 border-b border-gray-100">
          Load Template
        </h3>
        <div className="max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedTemplates).map(([docType, templates]) => (
            <div key={docType} className="mb-6">
              <h4 className="text-md font-medium text-gray-700 mb-2">
                {docType}
              </h4>
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onLoadTemplate(template)}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">
                        {template.templateName}
                      </span>
                      <div className="text-sm text-gray-500">
                        <span>Version {template.version}</span>
                        <span className="mx-2">•</span>
                        <span>
                          {new Date(template.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateLoadDialog;
