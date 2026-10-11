import React from "react";

const TableCell = ({ children, className = "", ...props }) => {
  return (
    <td className={`py-2 px-4 border border-gray-200 ${className}`} {...props}>
      {children}
    </td>
  );
};

export default TableCell;
