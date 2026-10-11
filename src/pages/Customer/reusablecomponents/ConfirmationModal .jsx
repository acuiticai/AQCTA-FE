import React from "react";
import { useTranslation } from "react-i18next";

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  title,
  confirmText,
  cancelText,
  confirmClassName = "px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600",
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const resolvedTitle = title ?? t("customer.shared.confirm");
  const resolvedMessage = message ?? t("customer.shared.confirmDeleteItem");
  const resolvedConfirmText = confirmText ?? t("customer.shared.confirm");
  const resolvedCancelText = cancelText ?? t("Cancel");

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50 transition-opacity duration-300">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 animate-fadeIn">
        <h2 className="text-lg font-semibold text-gray-800">{resolvedTitle}</h2>
        <p className="text-gray-600 mt-2">{resolvedMessage}</p>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            onClick={onClose}
          >
            {resolvedCancelText}
          </button>
          <button className={confirmClassName} onClick={onConfirm}>
            {resolvedConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
