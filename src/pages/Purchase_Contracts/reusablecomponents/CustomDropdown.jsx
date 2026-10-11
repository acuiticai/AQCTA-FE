import React from "react";

const DropDownMenu = ({ options, onChange, defaultValue }) => {
  return (
    <div>
      <select
        className="w-full p-3 rounded-md bg-gray-50 border text-gray-600"
        onChange={(e) => onChange(e.target.value)}
        defaultValue={defaultValue || ""}
      >
        <option value="" disabled>
          Select a Business
        </option>
        {options.map((option) => (
          <option key={option._id} value={option._id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DropDownMenu;
