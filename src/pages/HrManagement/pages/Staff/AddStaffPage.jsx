import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import axios from "axios";
import StaffTabs from "@/pages/HrManagement/components/StaffManagement/StaffTabs";
import StaffForm from "@/pages/HrManagement/components/StaffManagement/StaffForm";
import StaffEmploymentForm from "@/pages/HrManagement/components/StaffManagement/StaffEmploymentForm";
import StaffContactForm from "@/pages/HrManagement/components/StaffManagement/StaffContactForm";
import StaffJobDetailsForm from "@/pages/HrManagement/components/StaffManagement/StaffJobDetailsForm";
import AddStaffModal from "@/pages/HrManagement/components/StaffManagement/AddStaffModal";
import { notifySuccess, notifyError } from "@/utils/toast";
import useUserLimit from "@/hooks/useUserLimit";
import UserLimitBanner from "@/components/subscription/UserLimitBanner";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

const AddStaffPage = () => {
  const [activeTab, setActiveTab] = useState("Personal Info");
  const { userUsage } = useUserLimit();
  const [showModal, setShowModal] = useState(true);
  const [staffData, setStaffData] = useState({
    business: "",
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    dateOfBirth: null,
    gender: "",
    mobileNumber: "",
    googleLocation: "",
    address: {
      unit: "",
      street: "",
      suburb: "",
      city: "",
      state: "",
      postcode: "",
      country: "",
    },
    employment: {
      employeeId: "",
      position: "",
      leaveGroup: "",
      claimGroup: "",
      joiningDate: null,
      probationPeriod: "",
      workingLocation: "",
    },
    jobDetails: {
      jobRole: "",
      workingShift: "",
    },
    status: "Active",
    image: null,
  });

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await axios.get(`${Base_URL}/businesses/get_all`);
      if (response.data && Array.isArray(response.data)) {
        localStorage.setItem("businesses", JSON.stringify(response.data));
      }
    } catch (error) {
      console.error("❌ Error fetching businesses:", error);
    }
  };

  const handleUpdateStaffData = (field, value) => {
    setStaffData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // const handleNestedUpdate = (section, field, value) => {
  //   setStaffData((prev) => ({
  //     ...prev,
  //     [section]: {
  //       ...prev[section],
  //       [field]: value,
  //     },
  //   }));
  // };

  const handleNestedUpdate = (section, field, value) => {
    setStaffData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value !== undefined && value !== null ? value.toString() : "", // ✅ Fixes the undefined error
      },
    }));
  };
  
  
  

  const handleSubmit = async () => {
    const submitData = new FormData();

    Object.keys(staffData).forEach((key) => {
      if (typeof staffData[key] === "object" && staffData[key] !== null) {
        // Convert objects to form fields
        Object.keys(staffData[key]).forEach((subKey) => {
          submitData.append(`${key}[${subKey}]`, staffData[key][subKey]);
        });
      } else if (key === "dateOfBirth" && staffData[key]) {
        submitData.append(key, new Date(staffData[key]).toISOString()); // Convert date properly
      } else {
        submitData.append(key, staffData[key]);
      }
    });
    

  

    if (staffData.image) {
      submitData.append("image", staffData.image);
    }

    try {
      const response = await axios.post(`${Base_URL}/staff-management/staff`, submitData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("✅ Staff created:", response.data);
      notifySuccess("Staff added successfully!");
    } catch (error) {
      console.error("❌ Error creating staff:", error);
      notifyError("Failed to add staff.");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Back button */}
      <div className="p-4">
        <button className="flex items-center text-gray-600 text-sm">
          <ArrowLeft size={16} className="mr-1" />
          Back
        </button>
      </div>

      {/* Page title */}
      <div className="px-4 py-2">
        <h1 className="text-lg font-medium text-gray-800">Add New</h1>
      </div>

      <div className="px-4">
        <UserLimitBanner userUsage={userUsage} />
      </div>

      {/* Tabs */}
      <StaffTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Form */}
      <div className="p-4">
        {activeTab === "Personal Infoss" && (
          <StaffForm staffData={staffData} handleUpdateStaffData={handleUpdateStaffData} />
        )}
        {activeTab === "Employment Details" && (
          <StaffEmploymentForm staffData={staffData} handleNestedUpdate={handleNestedUpdate} />
        )}
        {activeTab === "Contact Information" && (
          <StaffContactForm staffData={staffData} handleNestedUpdate={handleNestedUpdate} />
        )}
        {activeTab === "Job Details" && (
          <StaffJobDetailsForm staffData={staffData} handleNestedUpdate={handleNestedUpdate} />
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end p-4">
        <button onClick={handleSubmit} className="px-8 py-2 bg-lime-500 text-white rounded-xl">
          Save
        </button>
      </div>

      {/* Modal */}
      <AddStaffModal showModal={showModal} setShowModal={setShowModal} setSelectedUserData={setStaffData} />
    </div>
  );
};

export default AddStaffPage;
