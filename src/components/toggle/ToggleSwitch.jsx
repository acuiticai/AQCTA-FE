import React from "react";

const ToggleSwitch = ({ isOn, handleToggle, disabled = false }) => {
  const handleChange = (e) => {
    if (!disabled && handleToggle) {
      handleToggle(e);
    }
  };

  return (
    <label className="inline-flex items-center cursor-pointer scale-75">
      <input
        type="checkbox"
        checked={isOn}
        onChange={handleToggle}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="relative w-9 h-5 bg-[#6D6E73] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--p-blue)] dark:peer-focus:ring-[var(--p-blue)] rounded-full peer dark:bg-[#6D6E73] peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-[#6D6E73] after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-[#6D6E73] peer-checked:bg-[var(--p-blue)] dark:peer-checked:bg-[var(--p-blue)]"></div>
    </label>
  );
};

export default ToggleSwitch;
