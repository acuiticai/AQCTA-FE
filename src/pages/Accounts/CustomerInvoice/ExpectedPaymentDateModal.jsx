import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import { Calendar, X } from "lucide-react";
import CustomDatePicker from "@/components/CustomDatePicker";

const ExpectedPaymentDateModal = ({ isOpen, onClose, onSave, currentDate }) => {
  useTranslation();
  const [selectedDate, setSelectedDate] = useState();

  if (!isOpen) return null;

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleSave = () => {
    onSave(selectedDate);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label={ciText("Close")}
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <Calendar className="mr-2 text-[var(--p-blue)]" size={24} />
          {ciText("Set Expected Payment Date")}
        </h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {ciText("When do you expect payment for this invoice?")}
          </label>
          <CustomDatePicker
            value={selectedDate}
            onChange={(date) => handleDateChange(date)}
            bgColor="#F3F4F6"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            onClick={onClose}
          >
            {ciText("Cancel")}
          </button>
          <button
            className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9CBA33] transition-colors font-medium"
            onClick={handleSave}
          >
            {ciText("Save Date")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpectedPaymentDateModal;
