import React from "react";

const InputField = ({ placeholder, type = "text", value, disabled, onChange }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    disabled={disabled}
    onChange={onChange}
    className="w-full border-gray-300 rounded-lg shadow-sm p-2 bg-gray-100"
  />
);

export default InputField;
