import React, { useEffect, useState } from "react";

const StaffJobDetailsForm = ({ staffData, handleNestedUpdate }) => {
  const [jobRole, setJobRole] = useState("");
  const [workingShift, setWorkingShift] = useState("");

  useEffect(() => {
    if (staffData?.jobDetails) {
      setJobRole(staffData.jobDetails.jobRole || "");
      setWorkingShift(staffData.jobDetails.workingShift || "");
    }
  }, [staffData]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-gray-700 font-semibold text-lg mb-4">Job Details</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Job Role - ✅ FIXED */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Job Role</label>
          <select
            className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50"
            value={jobRole}
            onChange={(e) => {
              setJobRole(e.target.value);
              handleNestedUpdate("jobDetails", "jobRole", e.target.value);
            }}
          >
            <option value="">Select Job Role</option>
            <option value="Developer">Developer</option>
            <option value="Manager">Manager</option>
          </select>
        </div>

        {/* Working Shift - ✅ FIXED */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Working Shift</label>
          <select
            className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50"
            value={workingShift}
            onChange={(e) => {
              setWorkingShift(e.target.value);
              handleNestedUpdate("jobDetails", "workingShift", e.target.value);
            }}
          >
            <option value="">Select Working Shift</option>
            <option value="Morning">Morning</option>
            <option value="Night">Night</option>
          </select>
        </div>
      </div>

     
    </div>
  );
};

export default StaffJobDetailsForm;
