import React from "react";

const Label = ({ label, required = false }) => {
  return (
    <label className="block md:text-sm md:col-span-1 sm:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
  );
};

export default Label;
