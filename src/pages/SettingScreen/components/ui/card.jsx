import React from "react";

export const Card = ({ children, className, onClick }) => {
  return (
    <div onClick={onClick} className={`bg-white shadow-md rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
};

export const CardContent = ({ children, className }) => {
  return <div className={`mt-2 ${className}`}>{children}</div>;
};
