import React from "react";

const TextAreaField = ({ placeholder, value, name, onChange }) => (
  <textarea
    placeholder={placeholder}
    value={value}
    name={name}
    onChange={onChange}
    className="w-full border-gray-300  rounded-[12px] shadow-sm px-4 py-2 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
  />
);

export default TextAreaField;
