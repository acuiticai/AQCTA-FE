import React, { useState, useEffect } from "react";
import { Search, Calendar, Plus, RotateCcw, Eye } from "lucide-react";
import { useHistory } from "react-router-dom";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import axios from "axios";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const API_URL = `${Base_URL}/staff-management/staff`;

const StaffManagement = () => {
  const history = useHistory();
  const [selectedBusiness, setSelectedBusiness] = useState(""); // Selected Business
  const [businesses, setBusinesses] = useState([]); // Businesses List
  const [staffData, setStaffData] = useState([]); // Staff Data
  const [filteredStaff, setFilteredStaff] = useState([]); // Filtered Staff
  const { isSingleBusiness, singleBusinessId, businesses: assignedBusinesses } =
    useSingleBusinessMode();

  // Fetch Businesses from LocalStorage (Same as Item List Screen)
  useEffect(() => {
    if (assignedBusinesses?.length) {
      setBusinesses(assignedBusinesses);
      return;
    }
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      setBusinesses(JSON.parse(storedBusinesses));
    }
  }, [assignedBusinesses]);

  useEffect(() => {
    if (isSingleBusiness && singleBusinessId && !selectedBusiness) {
      setSelectedBusiness(singleBusinessId);
    }
  }, [isSingleBusiness, singleBusinessId, selectedBusiness]);

  // Fetch Staff Data from API
  useEffect(() => {
    axios
      .get(API_URL)
      .then((response) => {
        setStaffData(response.data);
      })
      .catch((error) => {
        console.error("Error fetching staff data:", error);
      });
  }, []);

  // Filter Staff Based on Selected Business
  useEffect(() => {
    if (selectedBusiness) {
      const filtered = staffData.filter(
        (staff) => staff.business === selectedBusiness
      );
      setFilteredStaff(filtered);
    } else {
      setFilteredStaff(staffData);
    }
  }, [selectedBusiness, staffData]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "text-green-500 bg-green-50";
      case "Inactive":
        return "text-amber-500 bg-amber-50";
      case "Terminated":
        return "text-red-500 bg-red-50";
      case "Resigned":
        return "text-amber-500 bg-amber-50";
      default:
        return "text-gray-500 bg-gray-50";
    }
  };

  return (
    <div className="bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-5">
          <h1 className="text-base font-semibold text-gray-800">
            Staff Management
          </h1>
          <div className="flex items-center gap-4">
            {/* Business Dropdown (Fetching from LocalStorage) */}
            {!isSingleBusiness && (
            <DropdownBasic
              value={selectedBusiness}
              onChange={(value) => setSelectedBusiness(value)}
              options={businesses.map((b) => ({
                value: b._id,
                label: b.name,
              }))}
              placeholder="Select Business"
              className="w-56 border border-gray-300 rounded-lg p-2 relative text-sm"
            />
            )}

            {/* Add New Button (Same Styling) */}
            <button
              className="bg-lime-400 text-white px-7 py-3 rounded-xl flex items-center justify-center gap-2 text-sm min-w-36"
              onClick={() => history.push("/AddStaffPage")}
            >
              <Plus size={18} />
              Add New
            </button>
          </div>
        </div>

        {/* Search Filters (No Changes) */}
        <div className="grid grid-cols-4 gap-4 px-5 pb-5">
          <input
            type="text"
            placeholder="Search By Name"
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600"
          />
          <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
            <option value="" disabled selected>
              Search By Department
            </option>
          </select>
          <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
            <option value="" disabled selected>
              Search By Position
            </option>
          </select>
          <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
            <option value="" disabled selected>
              Search By Status
            </option>
          </select>
        </div>

        {/* Staff Section (No Changes) */}
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500 border-b">
                    Name
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500 border-b">
                    IC/Passport
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500 border-b">
                    Phone
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500 border-b">
                    Designation
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500 border-b">
                    Status
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500 border-b">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff, index) => (
                  <tr
                    key={staff._id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="py-3 px-4 border-b border-gray-200">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                          <img
                            src={`${staff.image}`} // Load from API
                            alt={staff.firstName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-sm text-gray-800">
                          {staff.firstName} {staff.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">
                      {staff.icPassport || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">
                      {staff.phone || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">
                      {staff.designation || "N/A"}
                    </td>
                    <td className="py-3 px-4 border-b border-gray-200">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                          staff.status
                        )}`}
                      >
                        {staff.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-b border-gray-200">
                      <button
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() =>
                          history.push(`/StaffProfilePage/${staff._id}`)
                        }
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffManagement;
