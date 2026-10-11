import React from "react";
import { createPortal } from "react-dom";

const CustomPopup = ({ isOpen, onClose, title, message, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  // Define background color based on type
  const getColor = () => {
    switch (type) {
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <div className={`text-white text-lg font-bold p-3 rounded-t ${getColor()}`}>
          {title || "Notification"}
        </div>
        <div className="p-4 text-gray-800">{message}</div>
        <div className="flex justify-end gap-2 mt-4">
          {onCancel && (
            <button
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={onConfirm || onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CustomPopup;
