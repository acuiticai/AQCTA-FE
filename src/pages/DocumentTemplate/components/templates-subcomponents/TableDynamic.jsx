import React from "react";

const DynamicTable = ({ columns, tableData, term, total, totalInWords }) => {
  console.log("tableData",tableData)
  return (
    <>
      {/* Table Section */}
      <table className="w-full text-center border-collapse mb-6 text-sm">
        <thead className="border-y-2 border-black">
          <tr>
            {columns?.map((col, index) => (
              <th
                key={index}
                // The following classes ensure the header text is kept on a single line
                className="px-2 pb-4  whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData && tableData?.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {console.log("row",row)}
              {row?.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  // Similar classes for the data cells
                  className="p-2 whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Term and Total Section */}
      <div className="border-y-2 mt-5 pb-2  mb-1 w-full flex justify-between border-black">
        <span className="px-2 font-bold">{term}</span>
        <span className="px-2 font-bold">{total}</span>
      </div>

      {/* Total Amount in Words */}
      <p className="text-sm border-t border-black mb-4">{totalInWords}</p>
    </>
  );
};

export default DynamicTable;
