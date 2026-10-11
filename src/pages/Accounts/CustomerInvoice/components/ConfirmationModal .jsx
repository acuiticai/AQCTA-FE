import React, { useState } from "react";

const ConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        <h2 className="text-lg font-semibold text-gray-800">Confirm Removal</h2>
        <p className="text-gray-600 mt-2">Are you sure you want to remove this section?</p>
        <div className="flex justify-end space-x-3 mt-4">
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-red-500 text-white rounded-md" onClick={onConfirm}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
