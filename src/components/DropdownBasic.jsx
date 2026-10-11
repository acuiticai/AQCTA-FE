import React from "react";

// const DropdownBasic = ({
//   options = [],
//   value = "",
//   onChange,
//   placeholder = "Select an option",
//   className = "",
//   style = {},
// }) => {
//   console.log("🔵 Dropdown Received Value:", value);
//   console.log("🔵 Dropdown Options:", options);

//   return (
//     <select
//       value={value} // Ensure this is a string
//       onChange={(e) => onChange(e.target.value)} // Only pass the value, not an object
//       className={`w-full border border-gray-300 rounded-md p-2 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 ${className}`}
//       style={{ height: "45px", ...style }}
//     >
//       <option value="">{placeholder}</option>
//       {options.map((option, index) => (
//         <option key={index} value={option.value}>
//           {option.label} {/* ✅ Ensure we're rendering a string */}
//         </option>
//       ))}
//     </select>
//   );
// };

////// Updated DropdownBasic component
const DropdownBasic = ({
  options = [],
  value = "",
  onChange,
  placeholder = "Select an option",
  className = "",
  style = {},
}) => {
  return (
    <div
      className={`dropdown-basic-wrapper w-full rounded-xl border border-gray-300 bg-white overflow-hidden transition-colors hover:border-gray-400 focus-within:ring-2 focus-within:ring-[var(--p-blue)] focus-within:border-[var(--p-blue)] ${className}`}
    >
      <select
        value={value}
        onChange={(e) => {
          const selectedValue = e.target.value;
          onChange(selectedValue);
        }}
        className="dropdown-basic w-full h-11 bg-transparent text-sm px-4 box-border border-0 rounded-none focus:outline-none text-left appearance-none"
        style={{
          color: value ? "#111827" : "#6b7280",
          ...style,
        }}
      >
        <option
          value=""
          className="text-[var(--p-black)]"
          style={{ backgroundColor: "var(--light-text)" }}
        >
          {placeholder}
        </option>
        {options.map((option, index) => (
          <option
            key={index}
            value={option.value}
            className="text-[var(--p-black)]"
            style={{ backgroundColor: "var(--light-text)" }}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DropdownBasic;
