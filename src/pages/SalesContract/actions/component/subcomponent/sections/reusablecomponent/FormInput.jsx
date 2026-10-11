import React from "react";

const FormInput = ({
  label,
  type = "text",
  placeholder,
  isDropdown = false,
}) => {
  return (
    <div>
      <label className="block text-gray-600 text-sm font-medium mb-1">
        {label}
      </label>
      {isDropdown ? (
        <select
          className="w-full p-3 border border-gray-300 rounded-xl text-gray-500 appearance-none mt-1 focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
          style={{ backgroundColor: "#F2F2F2" }}
        >
          <option>{placeholder}</option>
        </select>
      ) : (
        <input
          type={type}
          className="w-full p-3 border border-gray-300 rounded-xl text-gray-500 mt-1"
          placeholder={placeholder}
          style={{ backgroundColor: "#F2F2F2" }}
        />
      )}
    </div>
  );
};

export default FormInput;
