import { useState } from "react";
import { useLabelManagement } from "@/pages/DocumentTemplate/context/LabelContext";

export const LabelEditor = ({ section, fieldId, currentLabel, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentLabel);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(editValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="inline-flex items-center">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="px-1 py-0.5 border rounded text-sm w-24"
          autoFocus
          onBlur={() => setIsEditing(false)}
        />
      </form>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-gray-100 px-1 text-[11px] rounded"
    >
      {currentLabel}
    </span>
  );
};
