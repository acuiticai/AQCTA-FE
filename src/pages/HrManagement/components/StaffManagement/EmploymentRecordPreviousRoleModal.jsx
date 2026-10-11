import React from "react";
import { X } from "lucide-react";

const EmploymentRecordPreviousRoleModal = ({
  isOpen,
  onClose,
  recordData,
}) => {
  console.log("recordData ya hai", recordData);
  if (!isOpen) return null;

  const previousRoles = recordData?.previousRoles || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-800">
            Previous Roles
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {Array.isArray(previousRoles) && previousRoles.length > 0 ? (
            previousRoles.map((role, index) => (
              <div
                key={index}
                className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition duration-200"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Role #{index + 1}</h3>
                  {role?.status && (
                    <span className="text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                      {role.status}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-gray-700 text-sm">
                  <p><span className="font-semibold">Position:</span> {role?.position?.name || role?.position || "N/A"}</p>
                  <p><span className="font-semibold">Leave Group:</span> {role?.leaveGroup?.name || role?.leaveGroup || "N/A"}</p>
                  <p><span className="font-semibold">Claim Group:</span> {role?.claimGroup?.name || role?.claimGroup || "N/A"}</p>
                  <p><span className="font-semibold">Joining Date:</span> {role?.joiningDate ? new Date(role.joiningDate).toLocaleDateString() : "N/A"}</p>
                  <p><span className="font-semibold">End Date:</span> {role?.endDate ? new Date(role.endDate).toLocaleDateString() : "N/A"}</p>
                  {role?.reasonForLeaving && (
                    <p className="col-span-full"><span className="font-semibold">Reason for Leaving:</span> {role.reasonForLeaving}</p>
                  )}
                </div>
              </div>

            ))
          ) : (
            <p className="text-gray-500">No previous roles found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmploymentRecordPreviousRoleModal;
