import React, { useState } from "react";
import searchIcon01 from "../assets/img/icons/searchIcon01.svg";
import searchIcon02 from "../assets/img/icons/searchIcon02.svg";

const SearchBar = ({
  value = "",
  onChange,
  placeholder = "Search...",
  className = "",
  style = {}, // Inline style for custom adjustments
  onFilterClick = () => {}, // Default empty function to handle filter click
}) => {
  // Handle input changes and preserve casing
  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div
      className={`relative ${className}`}
      style={{ width: "180px", ...style }} // Set fixed width
    >
      {/* Search Icon */}
      <img
        src={searchIcon01}
        alt="Search Icon"
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          transform: "translateY(-50%)",
          width: "16px",
          height: "16px",
          color: "#9ca3af", // Equivalent to Tailwind text-gray-400
        }}
      />

      {/* Input Field */}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        style={{
          padding: "9px 32px",
          background: "#F2F2F2",
          borderLeft: "1px solid rgb(229, 231, 235)",
          fontSize: "0.875rem",
          borderRadius: "8px",
          width: "180px",
          outline: "none",
          border: "1px solid transparent",
          transition: "all 0.2s ease",
        }}
        onFocus={(e) => {
          e.target.style.border = "1px solid var(--p-blue)";
          e.target.style.boxShadow = "0 0 0 2px rgba(175, 208, 57, 0.25)";
        }}
        onBlur={(e) => {
          e.target.style.border = "1px solid transparent";
          e.target.style.boxShadow = "none";
        }}
      />

      {/* Filter Icon */}
      <img
        onClick={onFilterClick}
        src={searchIcon02}
        alt="Filter Icon"
        style={{
          position: "absolute",
          top: "50%",
          right: "8%",
          transform: "translateY(-50%)",
          width: "16px",
          height: "16px",
          color: "#9ca3af",
          cursor: "pointer",
        }}
      />
    </div>
  );
};

export default SearchBar;
