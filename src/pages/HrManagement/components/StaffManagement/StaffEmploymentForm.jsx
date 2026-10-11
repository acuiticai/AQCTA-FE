import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

const StaffEmploymentForm = ({ staffData, handleNestedUpdate }) => {
  const [employment, setEmployment] = useState({
    employeeId: "",
    position: "",
    leaveGroup: "",
    claimGroup: "",
    joiningDate: null, // Use `null` for `DatePicker`
    probationPeriod: "",
    workingLocation: "",
  });

  // ✅ Load data when `staffData` is provided
  useEffect(() => {
    if (staffData?.employment) {
      setEmployment({
        ...staffData.employment,
        joiningDate: staffData.employment.joiningDate
          ? new Date(staffData.employment.joiningDate)
          : null, // Ensure `joiningDate` is a valid Date object
      });
    }
  }, [staffData]);

  const handleInputChange = (field, value) => {
    setEmployment((prev) => ({ ...prev, [field]: value }));
    handleNestedUpdate("employment", field, value);
  };

  const handleDateChange = (date) => {
    setEmployment((prev) => ({ ...prev, joiningDate: date }));
    handleNestedUpdate("employment", "joiningDate", date.toISOString());
  };

  const handleSubmit = async () => {
    try {
      const response = await axios.put(
        `${Base_URL}/staff-management/staff/${staffData?._id}`,
        { employment }
      );
      console.log("✅ Employment details updated:", response.data);
      alert("Employment details updated successfully!");
    } catch (error) {
      console.error("❌ Error updating employment details:", error);
      alert("Failed to update employment details.");
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="grid grid-cols-2 gap-6">
        {/* Employee ID (Read-only) - ✅ FIXED */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Employee ID</label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-xl bg-gray-100 text-gray-500"
            placeholder="Employee ID"
            value={employment.employeeId || ""}
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Position</label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-xl"
            placeholder="Enter Position"
            value={employment.position}
            onChange={(e) => handleInputChange("position", e.target.value)}
          />
        </div>

        {/* Leave Group */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Leave Group</label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-xl"
            placeholder="Enter Leave Group"
            value={employment.leaveGroup}
            onChange={(e) => handleInputChange("leaveGroup", e.target.value)}
          />
        </div>

        {/* Claim Group */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Claim Group</label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-xl"
            placeholder="Enter Claim Group"
            value={employment.claimGroup}
            onChange={(e) => handleInputChange("claimGroup", e.target.value)}
          />
        </div>

        {/* Joining Date (With Calendar Picker) - ✅ FIXED */}
        <div className="relative">
          <label className="block text-sm text-gray-600 mb-1">Joining Date</label>
          <div className="relative">
            <DatePicker
              selected={employment.joiningDate}
              onChange={handleDateChange}
              className="w-full p-3 border border-gray-300 rounded-xl"
              placeholderText="Select Joining Date"
            />
            {/* <Calendar
              size={18}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
            /> */}
          </div>
        </div>

        {/* Probation Period */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Probation Period (Months)
          </label>
          <input
            type="number"
            className="w-full p-3 border border-gray-300 rounded-xl"
            placeholder="Enter Probation Period"
            value={employment.probationPeriod}
            onChange={(e) => handleInputChange("probationPeriod", e.target.value)}
          />
        </div>

        {/* Working Location */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Working Location</label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-xl"
            placeholder="Enter Working Location"
            value={employment.workingLocation}
            onChange={(e) => handleInputChange("workingLocation", e.target.value)}
          />
        </div>
      </div>

      
    </div>
  );
};

export default StaffEmploymentForm;
