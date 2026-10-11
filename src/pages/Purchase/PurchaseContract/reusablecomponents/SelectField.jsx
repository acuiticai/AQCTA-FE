import React from "react";

const SelectField = ({ options, onChange, defaultValue }) => (
  <select
    onChange={onChange}
    defaultValue={defaultValue}
    className="w-full border-gray-300 rounded-lg shadow-sm p-2 bg-gray-100"
  >
    {options.map((option, index) => (
      <option key={index} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default SelectField;
