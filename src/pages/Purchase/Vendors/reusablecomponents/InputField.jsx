import React from "react";

const InputField = ({
  placeholder,
  type = "text",
  value,
  disabled,
  onChange,
  onBlur,
  className = "",
}) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    disabled={disabled}
    onChange={onChange}
    onBlur={onBlur}
    className={`w-full border border-gray-300 rounded-lg shadow-sm p-2 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${className}`.trim()}
  />
);

export default InputField;
