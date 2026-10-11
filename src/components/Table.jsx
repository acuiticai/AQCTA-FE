import React from "react";

const Table = ({ headers, data, renderRow, emptyMessage = "No data available" }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm  border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-600" style={{ backgroundColor: "#F2F2F2" }}>
            {headers.map((header, index) => (
              <th
                key={index}
                className="py-2 px-4 font-medium"
                style={{
                  fontFamily: "'Inter'",
                  fontWeight: "400",
                  textAlign: "left",
                  fontSize: "13px"
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.length > 0 ? (
            data?.map((rowData, index) => renderRow(rowData, index))
          ) : (
            <tr>
              <td colSpan={headers?.length} className="py-4 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
