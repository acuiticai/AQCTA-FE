import React from "react";
import {
  InsertPhoto,
  TableChart,
  Description,
  People,
  Save as SaveIcon,
} from "@mui/icons-material";
import "../../print-layout.css";

const sidebarItems = [
  { id: "header", icon: <InsertPhoto />, label: "Document Header" },
  {
    id: "header-content",
    icon: <Description />,
    label: "Document Header Content",
  },
  { id: "table", icon: <TableChart />, label: "Insert Table" },
  { id: "content", icon: <Description />, label: "Document Content" },
  { id: "signees", icon: <People />, label: "Add Signees" },
];

const DocumentEditorLayout = ({
  children,
  activeSection,
  onSectionChange,
  onSave,
  onCancel,
  isEditing,
}) => {
  // Handle section toggle
  const handleSectionChange = (sectionId) => {
    if (activeSection === sectionId) {
      onSectionChange(null);
    } else {
      onSectionChange(sectionId);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-16 pt-16 bg-white shadow-lg z-10">
        <div className="space-y-2 p-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSectionChange(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200
                ${
                  activeSection === item.id
                    ? "bg-emerald-50 text-emerald-600"
                    : "hover:bg-gray-200"
                }
              `}
              title={item.label}
            >
              <span className="text-2xl">{item.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content and Actions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Actions Bar */}
        <div className="bg-white border-b px-6 py-3 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">
            {isEditing ? "Edit Template" : "Create Template"}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2"
            >
              <SaveIcon className="w-4 h-4" />
              {isEditing ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
};

export default DocumentEditorLayout;
