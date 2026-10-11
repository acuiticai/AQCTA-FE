import React from "react";

const InputField = ({ placeholder, type = "text", value, name, onChange }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    name={name}
    onChange={onChange}
    className="w-full border-gray-300  rounded-[12px] shadow-sm px-[16px] py-[8px] bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
  />
);

export default InputField;
