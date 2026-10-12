import { EmptyCellContainer } from "./EmptyCellContainer";
import React from "react";

const DetailsCard = ({ title, details, col = 1 }) => {
  const entries = Object.entries(details);
  const itemsPerColumn = Math.ceil(entries.length / col);

  // Split entries into columns
  const columns = [];
  for (let i = 0; i < col; i++) {
    const startIndex = i * itemsPerColumn;
    const endIndex = Math.min(startIndex + itemsPerColumn, entries.length);
    columns.push(entries.slice(startIndex, endIndex));
  }

  const renderDetailsList = (columnEntries) => (
    <ul className="text-sm text-gray-600 flex-grow gap-2">
      {columnEntries.map(([key, value]) => {
        const renderValue = () => {
          // Handle JSX elements (React elements)
          if (React.isValidElement(value)) {
            return value;
          }

          // Handle null, undefined, or empty values
          if (
            value === null ||
            value === undefined ||
            value === "" ||
            value === undefined
          ) {
            return <EmptyCellContainer />;
          }

          // Handle Arrays
          if (Array.isArray(value)) {
            if (value.length === 0 || value === undefined) {
              return <EmptyCellContainer />;
            }

            // Array of Objects (like ctrSealNumbers) - Display as Table
            if (
              typeof value[0] === "object" &&
              value?.[0] !== null &&
              value?.[0] !== undefined
            ) {
              const filteredKeys = Object.keys(value[0]).filter(
                (key) => key !== "id" && key !== "_id"
              );

              return filteredKeys?.length > 0 ? (
                <div className="w-full overflow-x-auto border border-p-gray-dark rounded-md">
                  <table className="min-w-full text-sm overflow-hidden">
                    {/* Table Header */}
                    <thead className="bg-p-gray-dark">
                      <tr>
                        {filteredKeys.map((key) => (
                          <th
                            key={key}
                            className="px-3 py-2 text-left text-gray-700 font-medium capitalize border-b border-gray-200"
                          >
                            {key.trim()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {/* Table Body */}
                    <tbody className="bg-white">
                      {value?.map((item, index) => (
                        <tr
                          key={item.id || index}
                          className={`${
                            index % 2 === 0
                              ? "bg-white"
                              : "bg-input-background-gray"
                          } hover:bg-blue-50 transition-colors`}
                        >
                          {filteredKeys.map((key) => (
                            <td
                              key={key}
                              className="px-3 py-2 text-black font-medium border-b border-gray-100"
                            >
                              {item[key] || <EmptyCellContainer />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyCellContainer />
              );
            }

            // Array of Strings or Numbers
            return Object.keys(value)?.length > 0 ? (
              <div className="space-y-1 w-full">
                {value?.map((item, index) =>
                  item ? (
                    <span
                      key={index}
                      className="font-semibold text-black  text-sm bg-white px-2 py-1 rounded border w-full"
                    >
                      {item}
                    </span>
                  ) : (
                    <EmptyCellContainer />
                  )
                )}
              </div>
            ) : (
              <EmptyCellContainer />
            );
          }

          // Handle Objects (non-array)
          if (
            typeof value === "object" &&
            value !== null &&
            value !== undefined
          ) {
            return Object.keys(value)?.length > 0 ? (
              <div className="font-semibold text-black text-sm bg-white p-2 rounded border w-full">
                {Object.entries(value)
                  .filter(([objKey]) => objKey !== "id" && objKey !== "_id") // Hide ID field
                  .map(([objKey, objValue]) => (
                    <div
                      key={objKey}
                      className="flex justify-between mb-1 last:mb-0"
                    >
                      <span className="text-gray-600 capitalize">
                        {objKey.trim()}:
                      </span>
                      <span className="text-black">
                        {objValue || <EmptyCellContainer />}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <EmptyCellContainer />
            );
          }

          // Handle Numbers
          if (typeof value === "number") {
            return value.toLocaleString(); // Format numbers with commas
          }

          // Handle Booleans
          if (typeof value === "boolean") {
            return value ? "Yes" : "No";
          }

          // Handle Strings and other primitives
          return value?.toString();
        };

        const isComplexValue =
          Array.isArray(value) ||
          (typeof value === "object" &&
            value !== null &&
            value !== undefined &&
            !React.isValidElement(value));

        return (
          <li
            key={key}
            className={`py-1 ${
              isComplexValue ? "flex flex-col" : "flex justify-between"
            }`}
          >
            <span className="text-gray-500 mb-2 capitalize">{key.trim()}:</span>
            <span
              className={`font-semibold text-black text-right${
                isComplexValue ? "w-full" : ""
              }`}
            >
              {renderValue()}
            </span>
          </li>
        );
      })}
    </ul>
  );

  // Get grid class based on column count
  const getGridClass = () => {
    switch (col) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-3";
      case 4:
        return "grid-cols-4";
      default:
        return "grid-cols-1";
    }
  };

  return (
    <div className="p-6 bg-[#F9F9FA] rounded-xl shadow-md flex flex-col min-h-full">
      {/* ✅ Title */}
      <h3 className="font-bold text-lg mb-3">{title}</h3>

      {/* ✅ Details List - Multiple Columns */}
      <div className={`grid gap-4 flex-grow ${getGridClass()}`}>
        {columns.map((columnEntries, columnIndex) => (
          <div
            key={columnIndex}
            className={`flex flex-col gap-2 ${
              col > 1
                ? "p-4 border border-gray-200 rounded-lg bg-white shadow-sm"
                : ""
            }`}
          >
            <div className="flex flex-col gap-8">
              {renderDetailsList(columnEntries)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export { DetailsCard };
