import React from "react";

const FormRow = ({ label, children }) => (
  <div className="grid grid-cols-12 items-center">
    <label className="col-span-4 text-sm font-medium text-gray-700">{label}</label>
    <div className="col-span-8">{children}</div>
  </div>
);

export default FormRow;
