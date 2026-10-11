import React from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Edit, Image, FileText, Trash, Calendar } from "lucide-react";
import StaffTabs from "@/pages/HrManagement/components/StaffManagement/Actions/StaffTabs";
import ProfileSection from "@/pages/HrManagement/components/StaffManagement/Actions/ProfileSection";
import EmploymentRecordTable from "@/pages/HrManagement/components/StaffManagement/Actions/EmploymentRecordTable";


const StaffProfilePage = () => {
  const { id } = useParams(); // Get staff ID from URL

  return (
    <div className="p-6">
      {/* Back Button */}
      <button className="text-gray-500 flex items-center mb-4">
        <ArrowLeft size={20} className="mr-2" /> Back
      </button>

      {/* Staff Name */}
      <h1 className="text-2xl font-semibold mb-4">Aditya</h1>

      {/* Profile Section */}
      <div className="bg-gray-100 p-6 rounded-lg flex justify-between items-center">
        <ProfileSection staffId={id} />

        {/* Action Buttons & Status */}
        <div className="flex flex-col items-end space-y-4">
          {/* <StatusBadge status="Active" /> */}
          <div className="flex space-x-3">
            <button className="p-2 bg-gray-200 rounded-lg">
              <Edit size={18} />
            </button>
            <button className="p-2 bg-gray-200 rounded-lg">
              <Image size={18} />
            </button>
            <button className="p-2 bg-gray-200 rounded-lg">
              <FileText size={18} />
            </button>
            <button className="p-2 bg-gray-200 rounded-lg">
              <Calendar size={18} />
            </button>
            <button className="p-2 bg-red-500 text-white rounded-lg">
              <Trash size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <StaffTabs />

      {/* Employment Record Table */}
      <EmploymentRecordTable staffId={id} />
    </div>
  );
};

export default StaffProfilePage;
