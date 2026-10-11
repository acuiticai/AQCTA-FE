import React from "react";

export const Button = ({ children, onClick, variant = "default", className }) => {
  const baseStyle = "px-4 py-2 rounded-md font-semibold focus:outline-none transition-all";
  
  const variants = {
    default: "bg-gray-200 hover:bg-gray-300 text-gray-800",
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    destructive: "bg-red-500 hover:bg-red-600 text-white",
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
