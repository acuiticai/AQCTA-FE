import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import DropdownBasic from "@/components/DropdownBasic";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import SingleBusinessField from "@/components/SingleBusinessField";
import { readAssignedBusinessesFallback } from "@/utils/sessionAssignedBusinesses";

const StaffForm = ({ staffData, handleUpdateStaffData }) => {
  // Handle Image Preview
  const handleImageChange = (event) => {
    const file = event.target.files[0];

    if (file) {
      // Update Parent State with File Object
      handleUpdateStaffData("image", file);

      // Show Preview in UI
      const imageUrl = URL.createObjectURL(file);
      handleUpdateStaffData("imagePreview", imageUrl);

      // Log the image URL to the console
      console.log("Image URL after selection: ", imageUrl);
    }
  };

  // Ensure that the image preview is set if it's already provided by staffData
  useEffect(() => {
    if (staffData?.image && !staffData?.imagePreview) {
      // If staffData contains an image, generate the full URL
      const imageUrl = `${staffData.image}`; // Correct the URL format
      handleUpdateStaffData("imagePreview", imageUrl);

      // Log the image URL to the console
      console.log("Image URL from staffData: ", imageUrl);
    }
  }, [staffData, handleUpdateStaffData]);

  return (
    <div className="bg-[#F2F5F9] p-6 rounded-xl">
      <h2 className="text-gray-800 font-semibold text-lg mb-4">
        Personal Info
      </h2>

      <div className="flex items-start space-x-8">
        {/* Profile Image Section */}
        <div className="flex flex-col items-center">
          <div className="w-48 h-48 bg-white border border-gray-300 rounded-lg flex items-center justify-center relative">
            {staffData.imagePreview ? (
              <img
                src={staffData.imagePreview}
                alt="Profile Preview"
                className="w-full h-full object-cover rounded-lg"
                
              />
            ) : (
              <label
                htmlFor="imageUpload"
                className="w-full h-full flex items-center justify-center cursor-pointer"
              >
                <Plus size={40} className="text-gray-400" />
              </label>
            )}
          </div>
          <input
            type="file"
            id="imageUpload"
            className="hidden"
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>

        {/* User Information Fields */}
        <div className="flex-1 grid grid-cols-2 gap-6">
          {/* Business Dropdown */}
          <SingleBusinessField
            selectedValue={staffData.business}
            onAutoSelect={(id) => handleUpdateStaffData("business", id)}
            className="col-span-2"
          >
            <div className="col-span-2">
              <label className="block text-sm text-gray-700 mb-1">
                Business <span className="text-red-500">*</span>
              </label>
              <DropdownBasic
                value={staffData.business}
                onChange={(value) => handleUpdateStaffData("business", value)}
                options={(
                  readAssignedBusinessesFallback().length
                    ? readAssignedBusinessesFallback()
                    : JSON.parse(localStorage.getItem("businesses") || "[]")
                ).map((b) => ({
                  value: b._id,
                  label: b.name,
                }))}
                placeholder="Select a Business"
                className="w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
          </SingleBusinessField>

          {/* First Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              className="w-full p-3 border bg-white rounded-xl text-gray-600"
              value={staffData.firstName}
              onChange={(e) =>
                handleUpdateStaffData("firstName", e.target.value)
              }
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              className="w-full p-3 border bg-white rounded-xl text-gray-600"
              value={staffData.lastName}
              onChange={(e) =>
                handleUpdateStaffData("lastName", e.target.value)
              }
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              className="w-full p-3 border bg-white rounded-xl text-gray-600"
              value={staffData.displayName}
              onChange={(e) =>
                handleUpdateStaffData("displayName", e.target.value)
              }
            />
          </div>

          {/* Date of Birth Picker */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Date of Birth
            </label>
            <DatePicker
              selected={
                staffData.dateOfBirth ? new Date(staffData.dateOfBirth) : null
              }
              onChange={(date) => handleUpdateStaffData("dateOfBirth", date)}
              className="w-full p-3 border bg-white rounded-xl text-gray-600"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full p-3 border bg-white rounded-xl text-gray-600"
              value={staffData.email}
              onChange={(e) => handleUpdateStaffData("email", e.target.value)}
            />
          </div>

          {/* Gender Dropdown */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Gender</label>
            <select
              className="w-full p-3 border bg-white rounded-xl text-gray-600"
              value={staffData.gender}
              onChange={(e) => handleUpdateStaffData("gender", e.target.value)}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffForm;
