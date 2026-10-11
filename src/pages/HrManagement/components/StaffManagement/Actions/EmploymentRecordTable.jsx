import React from "react";
import { Edit } from "lucide-react";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const EmploymentRecordTable = () => {
  const isSingleBusiness = isSingleAssignedBusiness();

  return (
    <div className="mt-6 bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-3">Employment Record</h2>

      <table className="w-full border rounded-lg">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Address</th>
            {!isSingleBusiness && (
              <th className="p-2 text-left">Company</th>
            )}
            <th className="p-2 text-left">Designation</th>
            <th className="p-2 text-left">Leave Group</th>
            <th className="p-2 text-left">Claim Group</th>
            <th className="p-2 text-left">Start Date</th>
            <th className="p-2 text-left">End Date</th>
            <th className="p-2 text-left">Reason for Leaving</th>
            <th className="p-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="p-2">Malaysia</td>
            {!isSingleBusiness && <td className="p-2">PCI</td>}
            <td className="p-2">HR Manager</td>
            <td className="p-2">Mhe32</td>
            <td className="p-2">CLJ232</td>
            <td className="p-2">22/12/2005</td>
            <td className="p-2">-</td>
            <td className="p-2">-</td>
            <td className="p-2">
              <button className="text-blue-500">
                <Edit size={16} />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default EmploymentRecordTable;
