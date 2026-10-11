"use client";

import { useState } from "react";
import { Search, X, FileText, ChevronRight } from "lucide-react";

export default function TemplatesList({
  templates,
  loading,
  onSelect,
  onClose,
  currentTemplateId,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = templates.filter((template) =>
    template.templateName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto flex flex-col overflow-y-scroll">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className="text-lg font-medium">Templates</h2>
        <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm
              ? "No templates match your search"
              : "No templates found"}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredTemplates.map((template) => (
              <li
                key={template._id}
                className={`hover:bg-gray-50 cursor-pointer ${
                  currentTemplateId === template._id ? "bg-lime-50" : ""
                }`}
                onClick={() => onSelect(template._id)}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-lime-500 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {template.templateName}
                      </h3>
                      <p className="text-xs text-gray-500">
                        v{template.version} •{" "}
                        {new Date(
                          template.updatedAt || template.createdAt
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
