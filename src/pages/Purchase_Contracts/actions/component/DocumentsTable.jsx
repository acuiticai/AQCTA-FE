import React from "react";
import { FiEye, FiDownload } from "react-icons/fi";

const DocumentsTable = () => {
  const documents = [
    { name: "ABC Document", type: "Declaration Form", uploadedBy: "John", dateTime: "22-12-2024 / 10:44 AM" },
    { name: "XYZ Document", type: "Registration Form", uploadedBy: "Marry", dateTime: "22-12-2024 / 10:44 AM" },
    { name: "DEF Document", type: "Signature", uploadedBy: "Jeff", dateTime: "22-12-2024 / 10:44 AM" },
  ];

  return (
    <div className="bg-[#F9F9FA] p-6 rounded-xl shadow-sm mt-6 border font-sans text-[#303030] font-normal">
      {/* ✅ Header Section */}
      <h2 className="text-lg font-semibold mb-4">Documents</h2>

      {/* ✅ Documents Table */}
      <div className="overflow-x-auto">
        <table className="w-full border rounded-lg text-sm">
          {/* ✅ Table Header */}
          <thead>
            <tr className="bg-[#F2F2F2] text-left">
              <th className="p-3 font-normal">Document Name</th>
              <th className="p-3 font-normal">Document Type</th>
              <th className="p-3 font-normal">Uploaded By</th>
              <th className="p-3 font-normal">Date/Time Uploaded</th>
              <th className="p-3 text-center font-normal">Action</th>
            </tr>
          </thead>

          {/* ✅ Table Body */}
          <tbody>
            {documents.map((doc, index) => (
              <tr key={index} className="border-t hover:bg-gray-50">
                <td className="p-3">{doc.name}</td>
                <td className="p-3">{doc.type}</td>
                <td className="p-3">{doc.uploadedBy}</td>
                <td className="p-3">{doc.dateTime}</td>
                <td className="p-3 text-center flex justify-center space-x-2">
                  <button className="p-2 hover:bg-gray-100 rounded-md">
                    <FiEye className="text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-md">
                    <FiDownload className="text-gray-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentsTable;
