import React, { useState } from "react";
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useLabelManagement } from "@/pages/DocumentTemplate/context/LabelContext";

const EditableLabel = ({ section, fieldId, className = "" }) => {
  const { getLabel, updateLabel } = useLabelManagement();
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState("");
  const currentLabel = getLabel(section, fieldId);

  const handleEditClick = () => {
    setEditedLabel(currentLabel);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedLabel.trim()) {
      updateLabel(section, fieldId, editedLabel.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedLabel(currentLabel);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isEditing ? (
        <div className="flex items-center gap-2 w-full">
          <input
            type="text"
            value={editedLabel}
            onChange={(e) => setEditedLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="p-1 text-green-600 hover:bg-green-100 rounded-md"
            title="Save"
          >
            <CheckIcon fontSize="small" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 text-red-600 hover:bg-red-100 rounded-md"
            title="Cancel"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium text-gray-700">
            {currentLabel}
          </span>
          <button
            onClick={handleEditClick}
            className="p-1 text-gray-500 hover:bg-gray-100 rounded-md"
            title="Edit label"
          >
            <EditIcon fontSize="small" />
          </button>
        </div>
      )}
    </div>
  );
};

export default EditableLabel;
