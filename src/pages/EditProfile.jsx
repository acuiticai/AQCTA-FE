import React, { useState, useEffect, useContext } from "react";
import { Camera, X } from "lucide-react";
import axios from "axios";
import ProfileTab from "@/pages/Tabs/profile-tab.jsx";
import SignatureTab from "@/pages/Tabs/signature-tab.jsx";
import RolesTab from "@/pages/Tabs/roles-tab.jsx";
import SecurityTab from "@/pages/Tabs/security-tab.jsx";
import { AdminContext } from "@/context/AdminContext";
import { useHistory } from "react-router-dom";
import { AQCTA_IDENTITY } from "@/config/aqctaIdentity";
import {
  BRANDING_PLACEHOLDER_LOGO,
  fetchBrandingLogo,
  readCachedBrandingLogo,
  writeCachedBrandingLogo,
} from "@/utils/brandingLogo";
import "./edit-profile.css";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NAV_ITEMS = [
  { id: "profile", label: "Edit Profile" },
  { id: "signature", label: "Digital Signature" },
  { id: "roles", label: "User Roles" },
];

const SECURITY_ITEMS = [
  { id: "security-2fa", label: "Two-Factor Authentication" },
  { id: "security-password", label: "Change Password" },
  { id: "security-devices", label: "Trusted Devices" },
];

export default function ProfileSettings() {
  const [logo, setLogo] = useState(
    () => readCachedBrandingLogo() || BRANDING_PLACEHOLDER_LOGO
  );
  const history = useHistory();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    fetchProfileData();
    fetchConfiguration();
  }, []);

  const handleProfileImageUploadAndUpdate = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setLoading(true);

      const uploadResponse = await axios.post(`${Base_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedImageUrl = uploadResponse.data.url;
      const updateResponse = await axios.put(
        `${Base_URL}/admin/image/${adminInfo.id}`,
        { image: uploadedImageUrl }
      );

      if (updateResponse.status === 200) {
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
      case "security-2fa":
      case "security-password":
      case "security-devices":
        return (
          <SecurityTab
            user_id={adminInfo.id}
            fetchAdminInfo={fetchProfileData}
            adminInfo={profileData}
            activeSection={
              activeTab === "security" ? "security-2fa" : activeTab
            }
          />
        );
      default:
        return null;
    }
  };

  const roleName =
    typeof profileData?.role === "object"
      ? profileData?.role?.name
      : profileData?.role;

  return (
    <div className="edit-profile">
      <header className="edit-profile__header">
        <div className="edit-profile__logo-plate">
          <img
            src={logo || BRANDING_PLACEHOLDER_LOGO}
            alt={AQCTA_IDENTITY.shortName}
            className="edit-profile__logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = BRANDING_PLACEHOLDER_LOGO;
            }}
          />
        </div>
        <h1 className="edit-profile__heading">Profile Settings</h1>
        <p className="edit-profile__sub">
          Manage your account details, signature, and security.
        </p>
        <span className="edit-profile__header-line" aria-hidden="true" />
      </header>

      <div className="edit-profile__toolbar">
        <button
          type="button"
          onClick={() => history.push("/home")}
          className="edit-profile__exit"
        >
          <X className="w-4 h-4" />
          Exit
        </button>
      </div>

      <div className="edit-profile__body">
        <div className="edit-profile__layout">
          <aside className="edit-profile__sidebar">
            <div className="edit-profile__identity">
              <div className="edit-profile__avatar-wrap">
                <img
                  src={profileData?.image || BRANDING_PLACEHOLDER_LOGO}
                  alt="Profile"
                  className="edit-profile__avatar"
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="profileImageInput"
                  onChange={handleProfileImageUploadAndUpdate}
                />
                <button
                  type="button"
                  className="edit-profile__camera"
                  aria-label="Change profile photo"
                  onClick={() =>
                    document.getElementById("profileImageInput").click()
                  }
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="edit-profile__identity-text">
                <h2 className="edit-profile__name">{profileData?.name}</h2>
                <p className="edit-profile__role">{roleName}</p>
              </div>
            </div>

            <nav className="edit-profile__nav" aria-label="Profile sections">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`edit-profile__nav-btn${
                    activeTab === item.id ? " is-active" : ""
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <div className="edit-profile__nav-label">Security</div>
              <div className="edit-profile__nav-sub">
                {SECURITY_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`edit-profile__nav-btn${
                      activeTab === item.id ? " is-active" : ""
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>
          </aside>

          <section className="edit-profile__panel">
            {loading ? (
              <div className="edit-profile__spinner">
                <div className="edit-profile__spinner-ring" />
              </div>
            ) : (
              renderTabContent()
            )}
          </section>
        </div>
      </div>

      <footer className="edit-profile__footer">
        All Rights Reserved. {AQCTA_IDENTITY.shortName} 2026.
      </footer>
    </div>
  );
}
