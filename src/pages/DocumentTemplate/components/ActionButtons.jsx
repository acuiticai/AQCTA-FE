import React from "react";
import { Save as SaveIcon } from "@mui/icons-material";

const ActionButtons = ({
  onCancel,
  previewMode,
  setPreviewMode,
  isEditing,
}) => (
  <div className="flex gap-4">
    <button
      type="submit"
      className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 transition-colors duration-200 shadow-sm"
    >
      <SaveIcon className="h-4 w-4 mr-2" />
      {isEditing ? "Update Template" : "Save Template"}
    </button>
    <button
      type="button"
      onClick={onCancel}
      className="inline-flex items-center px-6 py-2.5 border border-emerald-200 text-sm font-medium rounded-lg text-emerald-700 bg-white hover:bg-emerald-50 transition-colors duration-200 shadow-sm"
    >
      Cancel
    </button>
    <button
      type="button"
      onClick={() => setPreviewMode(!previewMode)}
      className="inline-flex items-center px-6 py-2.5 border border-emerald-200 text-sm font-medium rounded-lg text-emerald-700 bg-white hover:bg-emerald-50 transition-colors duration-200 shadow-sm"
    >
      {previewMode ? "Hide Preview" : "Show Preview"}
    </button>
  </div>
);

export default ActionButtons;
