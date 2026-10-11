import React from "react";

const Dropdown = ({
  options = [],
  value = "",
  onChange,
  label = "",
  className = "",
  placeholder = "Select an option",
  style = {},
}) => {
  return (
    <div
      className={`dropdown-wrapper ${className}`}
      style={{
        padding: "0rem 2rem 0rem .8rem",
        background: "rgb(242, 242, 242)",
        borderRadius: "8px",
      }}
    >
      {label && (
        <label className="text-sm font-medium text-gray-600">{label}</label>
      )}
      <select
        value={value}
        onChange={onChange}
        style={{
          background: "rgb(242, 242, 242)",
          borderRadius: "8px",
          outline: "none",
          fontSize: "0.875rem",
          padding: "0.5rem 2rem 0.5rem 1.4rem",
        }}
        className="focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
      >
        <option style={{ boxShadow: "0px", marginTop: "12px" }} value="">
          {placeholder}
        </option>
        {options.map((option) => (
          <option
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Dropdown;
