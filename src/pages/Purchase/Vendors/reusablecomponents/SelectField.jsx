import React from "react";

const SelectField = ({ options, onChange, defaultValue }) => (
  <select
    onChange={onChange}
    defaultValue={defaultValue}
    className="w-full border-gray-300 px-4 py-2 rounded-[12px] shadow-sm bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
  >
    {options.map((option, index) => (
      <option key={index} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default SelectField;
