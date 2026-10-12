// MultiField.jsx

import React from "react";
import FormInput from "./FormInput";

/**
 * @param {object[]} fields
 * @param {"row"|"column"} direction — used when rowLayout is not set
 * @param {number[]} [rowLayout] — e.g. [1, 2] = first row one field (salutation), second row two fields (first/last name) side by side on md+
 */
const MultiField = ({ fields = [], direction, rowLayout }) => {
  const layoutSum = Array.isArray(rowLayout)
    ? rowLayout.reduce((a, b) => a + b, 0)
    : 0;

  if (rowLayout?.length && layoutSum === fields.length) {
    let offset = 0;
    return (
      <div className="flex flex-col gap-3 w-full">
        {rowLayout.map((count, rowIndex) => {
          const rowFields = fields.slice(offset, offset + count);
          offset += count;
          const isMultiColumnRow = count > 1;
          const rowGridClass =
            !isMultiColumnRow
              ? "w-full"
              : count === 2
                ? "grid grid-cols-1 md:grid-cols-2 gap-3 w-full"
                : count === 3
                  ? "grid grid-cols-1 md:grid-cols-3 gap-3 w-full"
                  : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full";
          return (
            <div key={rowIndex} className={rowGridClass}>
              {rowFields.map((field) => (
                <div key={field.name} className="min-w-0 w-full">
                  <FormInput multiField={true} {...field} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2 w-full ${
        direction === "row" ? "flex-row flex-wrap" : "flex-col"
      }`}
    >
      {fields.map((field) => (
        <FormInput multiField={true} key={field.name} {...field} />
      ))}
    </div>
  );
};

export default MultiField;
