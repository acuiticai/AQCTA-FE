import React from "react";

const ProfileSection = ({ staffId }) => {
  return (
    <div className="flex space-x-6">
      {/* Profile Image */}
      <div className="w-32 h-32 bg-gray-200 rounded-lg overflow-hidden">
        <img
          src={`/images/staff/${staffId}.jpg`} // Replace with actual image URL
          alt="Profile"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Staff Info */}
      <div className="bg-[#F2F5F9] p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Personal Info</h2>
        <p className="text-sm text-gray-600">
          <strong>First Name:</strong> Aditya
        </p>
        <p className="text-sm text-gray-600">
          <strong>Last Name:</strong> Verma
        </p>
        <p className="text-sm text-gray-600">
          <strong>Date of Birth:</strong> 12/12/1990
        </p>
        <p className="text-sm text-gray-600">
          <strong>Email:</strong> aditya@gmail.com
        </p>
        <p className="text-sm text-gray-600">
          <strong>Department:</strong> HR
        </p>
      </div>
    </div>
  );
};

export default ProfileSection;
