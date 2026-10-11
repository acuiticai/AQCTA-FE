import React from "react";

// ✅ Importing Your Downloaded SVG Icons
import EyeIcon from "../iconsvg/eye.svg";
import EditIcon from "../iconsvg/edit.svg";
import DownloadIcon from "../iconsvg/frame.svg";

const DocumentsTable = ({ documents }) => {
  return (
    <div className="p-4 bg-[#F9F9FA] rounded-lg shadow-md mt-4">
      {/* ✅ Title */}
      <h3 className="font-bold text-lg mb-3">Documents</h3>

      {/* ✅ Table */}
      <table className="w-full text-sm  rounded-lg shadow-md overflow-hidden">
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="p-3 text-left">Document Name</th>
            <th className="p-3 text-left">Document Type</th>
            <th className="p-3 text-left">Date/Time Uploaded</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, index) => (
            <tr key={index} className="border-b last:border-none">
              <td className="p-3">{doc.name}</td>
              <td className="p-3">{doc.type}</td>
              <td className="p-3">{doc.dateTime}</td>
              {/* ✅ Status Colors */}
              <td
                className={`p-3 font-medium ${
                  doc.status === "Approved"
                    ? "text-green-600"
                    : doc.status === "Sent"
                    ? "text-orange-500"
                    : "text-gray-500"
                }`}
              >
                {doc.status}
              </td>
              {/* ✅ Action Buttons with Imported SVG Icons */}
              <td className="p-3 text-center">
                <div className="flex justify-center items-center gap-3">
                  <button className="p-2 hover:bg-gray-200 rounded-md">
                    <img src={EyeIcon} alt="View" className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-gray-200 rounded-md">
                    <img src={EditIcon} alt="Edit" className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-gray-200 rounded-md">
                    <img src={DownloadIcon} alt="Download" className="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DocumentsTable;
