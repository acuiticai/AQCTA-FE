import React, { useState, useEffect, useContext } from "react";
import { Camera, X } from "lucide-react";
import axios from "axios";
import backgroundImage from "../assets/BgFrame.svg";
import ProfileTab from "@/pages/Tabs/profile-tab.jsx";
import SignatureTab from "@/pages/Tabs/signature-tab.jsx";
import RolesTab from "@/pages/Tabs/roles-tab.jsx";
import SecurityTab from "@/pages/Tabs/security-tab.jsx";
import { AdminContext } from "@/context/AdminContext";
import { useHistory } from "react-router-dom";

import {
  BRANDING_PLACEHOLDER_LOGO,
  fetchBrandingLogo,
  readCachedBrandingLogo,
  writeCachedBrandingLogo,
} from "@/utils/brandingLogo";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function ProfileSettings() {
  const [logo, setLogo] = useState(
    () => readCachedBrandingLogo() || BRANDING_PLACEHOLDER_LOGO
  );
  let history = useHistory();
  const [activeTab, setActiveTab] = useState("profile"); // Default active tab
  const [loading, setLoading] = useState(false); // Default active tab
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [profileData, setProfileData] = useState({
    name: "",
    last_name: "",
    email: "",
    contact: "",
    role: "Super Admin",
    image: null,
  });

  console.log("profile data", profileData);

  useEffect(() => {
    fetchProfileData();
    fetchConfiguration();
  }, []);

  const handleProfileImageUploadAndUpdate = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file); // Follow the same field name as System Users API

    try {
      setLoading(true);

      // Step 1: Upload Image
      const uploadResponse = await axios.post(`${Base_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedImageUrl = uploadResponse.data.url; // Ensure this matches System Users API response
      let profileData = {
        image: uploadedImageUrl,
      };
      const updateResponse = await axios.put(
        `${Base_URL}/admin/image/${adminInfo.id}`,
        profileData
      );

      // Step 2: Update Profile with New Image
      // const updateResponse = await axios.put(
      //   `${Base_URL}/admin/profile/update/${adminInfo.id}`,
      //   { profileImage: uploadedImageUrl },
      //   {
      //     headers: { "Content-Type": "application/json" },
      //   }
      // );

      if (updateResponse.status === 200) {
        // Update local state with the new image
        setProfileData((prev) => ({
          ...prev,
          image: uploadedImageUrl,
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to upload or update image:", error);
      setLoading(false);
    }
  };

  const fetchConfiguration = async () => {
    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${state?.adminInfo?.token}`,
      };
      const nextLogo = await fetchBrandingLogo({ headers });
      setLogo(nextLogo || BRANDING_PLACEHOLDER_LOGO);
      writeCachedBrandingLogo(nextLogo);
    } catch (error) {
      console.error("Failed to fetch configuration:", error);
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/admin/profile/${adminInfo.id}`
      );
      setProfileData(response.data);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleProfileImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await axios.post(`${Base_URL}/profile/image`, formData);
      setProfileData((prev) => ({ ...prev, image: response.data.imageUrl }));
    } catch (error) {
      console.error("Failed to upload image:", error);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <ProfileTab
            user_id={adminInfo.id}
            profileData={profileData}
            setProfileData={setProfileData}
          />
        );
      case "signature":
        return <SignatureTab profileData={profileData} />;
      case "roles":
        return <RolesTab profileData={profileData} />;
      case "security":
        // When clicking the main Security section, do nothing
        return (
          <SecurityTab
            user_id={adminInfo.id}
            fetchAdminInfo={fetchProfileData}
            adminInfo={profileData}
            activeSection="security-2fa" // Default to 2FA section
          />
        );
      case "security-2fa":
      case "security-password":
      case "security-devices":
        return (
          <SecurityTab
            user_id={adminInfo.id}
            fetchAdminInfo={fetchProfileData}
            adminInfo={profileData}
            activeSection={activeTab}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative max-h-[100vh] overflow-y-auto pb-[120px]">
      {/* Background image layer */}
      <div
        className="fixed top-[40%] left-0 w-full h-full z-0"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />

      {/* Content */}
      <div className="relative">
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-12">
          <img
            src={logo || BRANDING_PLACEHOLDER_LOGO}
            alt="PCI"
            className="w-auto h-20 mt-2"
            onError={(e) => { e.target.onerror = null; e.target.src = BRANDING_PLACEHOLDER_LOGO; }}
          />
          <h1 className="text-3xl text-[#4a4a4a] font-medium">
            Manage your Profile Settings
          </h1>
        </div>
        <hr className="border-t border-gray-300" />
        <div className="flex justify-end items-center mt-20 mr-20">
          <button
            onClick={() => {
              history.push("/home");
            }}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#fff1f2] text-[#ef4444] rounded-md hover:bg-[#fee2e2] transition-colors"
          >
            <X className="w-4 h-4" />
            Exit
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-2">
          <div className="flex gap-12">
            {/* Sidebar */}

            <div className="w-64">
              {/* Profile Section with Image and Info Side by Side */}
              <div className="flex items-start gap-4 mb-8">
                <div className="relative">
                  <img
                    src={`${profileData?.image}`}
                    alt="Profile"
                    //
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                  />

                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="profileImageInput"
                    onChange={handleProfileImageUploadAndUpdate}
                  />

                  {/* Camera button triggers file input */}
                  <button
                    className="absolute bottom-0 right-0 bg-[#bcd374] p-1.5 rounded-full shadow-md hover:bg-[#a8bf60] transition-colors"
                    onClick={() =>
                      document.getElementById("profileImageInput").click()
                    }
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="mt-2">
                  <h2 className="text-xl font-semibold text-[#2d3748]">
                    {profileData?.name}
                  </h2>
                  <p className="text-[#4a5568]">{profileData.role.name}</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="w-full space-y-0.5">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`w-full text-left py-3 px-4 transition-colors ${
                    activeTab === "profile"
                      ? "bg-[#bcd374] text-white"
                      : "text-[#4a5568] hover:bg-white/60"
                  }`}
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => setActiveTab("signature")}
                  className={`w-full text-left py-3 px-4 transition-colors ${
                    activeTab === "signature"
                      ? "bg-[#bcd374] text-white"
                      : "text-[#4a5568] hover:bg-white/60"
                  }`}
                >
                  Digital Signature
                </button>
                <button
                  onClick={() => setActiveTab("roles")}
                  className={`w-full text-left py-3 px-4 transition-colors ${
                    activeTab === "roles"
                      ? "bg-[#bcd374] text-white"
                      : "text-[#4a5568] hover:bg-white/60"
                  }`}
                >
                  User Roles
                </button>
                <div className="w-full text-left py-3 px-4 text-[#4a5568] font-medium">
                  Security
                </div>
                {/* Security Subsections - Always visible */}
                <div className="pl-4">
                  <button
                    onClick={() => setActiveTab("security-2fa")}
                    className={`w-full text-left py-2 px-4 transition-colors ${
                      activeTab === "security-2fa"
                        ? "bg-[#bcd374] text-white"
                        : "text-[#4a5568] hover:bg-white/60"
                    }`}
                  >
                    Two-Factor Authentication
                  </button>
                  <button
                    onClick={() => setActiveTab("security-password")}
                    className={`w-full text-left py-2 px-4 transition-colors ${
                      activeTab === "security-password"
                        ? "bg-[#bcd374] text-white"
                        : "text-[#4a5568] hover:bg-white/60"
                    }`}
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => setActiveTab("security-devices")}
                    className={`w-full text-left py-2 px-4 transition-colors ${
                      activeTab === "security-devices"
                        ? "bg-[#bcd374] text-white"
                        : "text-[#4a5568] hover:bg-white/60"
                    }`}
                  >
                    Trusted Devices
                  </button>
                </div>
                {/* End Security Subsections */}
              </nav>
            </div>

            <div className="flex-1 bg-white rounded-2xl p-8 shadow-md mt-20 border border-gray-200">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bcd374]" />
                </div>
              ) : (
                renderTabContent()
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 text-[#4a5568] text-sm">
          All Rights Reserved. PCI 2026.
        </footer>
      </div>
    </div>
  );
}
