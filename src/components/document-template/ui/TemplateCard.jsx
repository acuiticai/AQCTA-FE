import React from "react";
import { Calendar, Users, FileText, Clock } from "lucide-react";
import { formatDate } from "@/components/formatAmount";

const TemplateCard = ({ templates, selectedTemplate, setSelectedTemplate }) => {
  console.log("templates templates", templates);
  return (
    <>
      {templates?.map((template) => (
        <div
          key={template._id}
          onClick={() =>
            setSelectedTemplate((prevTemp) =>
              prevTemp?._id === template?._id ? "" : template
            )
          }
          className={`group p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
            selectedTemplate?._id === template._id
              ? "border-lime-500 bg-lime-50"
              : "border-gray-200 hover:border-lime-400"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">
                {template.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{template.type}</p>
            </div>
            {template.isDefault && (
              <span className="text-xs bg-lime-100 text-lime-600 px-2 py-0.5 rounded-full font-medium">
                Default
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-sm text-gray-500">
            <div className="flex items-center">
              <Calendar size={14} className="mr-1.5 text-lime-500" />
              <span>Created: {formatDate(template.createdAt)}</span>
            </div>

            {/* <div className="flex items-center">
              <Users size={14} className="mr-1.5 text-lime-500" />
              <span>Used by {template.usageCount || 0} users</span>
            </div> */}

            <div className="flex items-center">
              <FileText size={14} className="mr-1.5 text-lime-500" />
              <span>
                {template.pageCount || 1}{" "}
                {(template.pageCount || 1) === 1 ? "page" : "pages"}
              </span>
            </div>

            <div className="flex items-center">
              <Clock size={14} className="mr-1.5 text-lime-500" />
              <span>
                Last updated:{" "}
                {formatDate(template?.updatedAt || template?.createdAt)}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {template.tags?.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default TemplateCard;
