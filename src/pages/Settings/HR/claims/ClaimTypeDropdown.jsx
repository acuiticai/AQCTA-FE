import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

const ClaimTypeDropdown = ({ options, value, onChange, label }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [isOpen, setIsOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState(value || []);

  useEffect(() => {
    setSelectedOptions(value || []);
  }, [value]);

  const handleToggle = (optionId, optionName) => {
    let newSelection;
    if (selectedOptions.includes(optionId)) {
      newSelection = selectedOptions.filter(item => item !== optionId);
    } else {
      newSelection = [...selectedOptions, optionId];
    }
    setSelectedOptions(newSelection);
    onChange(newSelection);
  };

  return (
    <div className="relative">
      <label className="block text-gray-500 text-sm mb-2">{label || thr("selectOptions", "Select Options")}</label>
      <div 
        className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 text-gray-900 flex justify-between items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="truncate">
          {selectedOptions.length > 0 
            ? options
                .filter(option => selectedOptions.includes(option._id))
                .map(option => option.name)
                .join(', ') 
            : thr("selectOptionsPlaceholder", "Select options")}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <div 
              key={option._id} 
              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
              onClick={() => handleToggle(option._id, option.name)}
            >
              <input 
                type="checkbox" 
                checked={selectedOptions.includes(option._id)} 
                onChange={() => {}} 
                className="mr-2 h-4 w-4 text-[#A6C437] focus:ring-[#A6C437]"
              />
              <span>{option.name}</span>
            </div>
          ))}
          {options.length === 0 && (
            <div className="p-2 text-gray-500">{thr("noOptionsAvailable", "No options available")}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClaimTypeDropdown;
