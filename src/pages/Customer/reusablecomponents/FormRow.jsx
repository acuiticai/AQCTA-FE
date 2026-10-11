import React from "react";

const FormRow = ({ label, children }) => (
  <div className="grid grid-cols-12 items-start gap-y-2 mb-4">
    <label className="col-span-4 text-sm font-medium text-gray-700 pt-2">{label}</label>
    <div className="col-span-8">{children}</div>
  </div>
);
export default FormRow;
