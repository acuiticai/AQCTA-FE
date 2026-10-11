import React from "react";
import { FiEye } from "react-icons/fi";
import { useHistory } from "react-router-dom"; // ✅ React Router v5 navigation

const ShipmentsTable = () => {
  const history = useHistory(); // ✅ React Router v5 navigation

  const shipments = [
    {
      id: "239823984", // Unique ID for dynamic routing
      date: "22-11-2024",
      terms: "100% LC AT SIGHT",
      etd: "EARLY - MID FEB...",
      country: "Malaysia",
      portLoading: "Any Port in Malaysia",
      portDischarge: "Karachi Sea Port, PAK",
    },
  ];

  return (
    <div className="bg-[#F9F9FA] p-6 rounded-xl shadow-sm mt-6 border font-sans text-[#303030] font-normal">
      {/* ✅ Header Section */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Shipments</h2>
        <button
          onClick={() => history.push("/Create Shipment")} // ✅ Keep old "Create Shipment" button
          className="flex items-center px-4 py-2 bg-lime-400 text-white text-sm font-medium rounded-xl shadow-sm"
        >
          Create Shipment Record
        </button>
      </div>

      {/* ✅ Shipments Table */}
      <div className="overflow-x-auto">
        <table className="w-full border rounded-lg text-sm">
          {/* ✅ Table Header */}
          <thead>
            <tr className="bg-[#F2F2F2] text-left">
              <th className="p-3 font-normal">Date</th>
              <th className="p-3 font-normal">Terms</th>
              <th className="p-3 font-normal">ETD Port of Loading</th>
              <th className="p-3 font-normal">Country</th>
              <th className="p-3 font-normal">Port of Loading</th>
              <th className="p-3 font-normal">Port of Discharge</th>
              <th className="p-3 text-center font-normal">Action</th>
            </tr>
          </thead>

          {/* ✅ Table Body */}
          <tbody>
            {shipments.map((shipment, index) => (
              <tr key={index} className="border-t hover:bg-gray-50">
                <td className="p-3">{shipment.date}</td>
                <td className="p-3">{shipment.terms}</td>
                <td className="p-3">{shipment.etd}</td>
                <td className="p-3">{shipment.country}</td>
                <td className="p-3">{shipment.portLoading}</td>
                <td className="p-3">{shipment.portDischarge}</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => history.push(`/Shipment Details`)} // ✅ Navigate to details page
                    className="p-2 hover:bg-gray-100 rounded-md"
                  >
                    <FiEye className="text-gray-600" />
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

export default ShipmentsTable;
