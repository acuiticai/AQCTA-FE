import React from "react";
import { FiLoader } from "react-icons/fi";
import { useTranslation } from "react-i18next";

const ConfirmationModal = ({ isOpen, onClose, onConfirm, isLoading = false }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50 transition-opacity duration-300">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 animate-fadeIn">
        <h2 className="text-lg font-semibold text-gray-800">
          {t("customer.documents.confirmDeletion")}
        </h2>
        <p className="text-gray-600 mt-2">
          {t("customer.documents.deleteFileConfirm")}
        </p>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onClose}
            disabled={isLoading}
          >
            {t("Cancel")}
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <FiLoader className="mr-2 animate-spin" size={16} />
                {t("customer.documents.deleting")}
              </>
            ) : (
              t("Delete")
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
