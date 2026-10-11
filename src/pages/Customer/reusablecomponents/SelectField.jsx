import React from "react";
import { useTranslation } from "react-i18next";

const SelectField = ({ options, value, onChange, defaultValue }) => {
  const { t } = useTranslation();

  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full border-gray-300 rounded-lg shadow-sm p-2 bg-gray-100 focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
    >
      <option value="" disabled>
        {defaultValue || t("customer.shared.selectAnOption")}
      </option>
      {options.map((option, index) => (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default SelectField;
