import React from "react";
import { Label } from "@windmill/react-ui";

const LabelArea = ({ label, color, className, required = false }) => {
  return (
    <Label
      color={color}
      style={{ color: { color } }}
      className={` ${className} col-span-4 sm:col-span-2 font-medium text-sm flex`}
    >
      {label} {required && <span className="text-red-500">*</span>}
    </Label>
  );
};

export default LabelArea;
