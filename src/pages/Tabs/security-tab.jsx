"use client";

import { useContext, useState, useEffect } from "react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Form, DataTable, TableRow, TableData } from "@/page-layouts/index";
import AdminServices from "@/services/AdminServices";
import { AdminContext } from "@/context/AdminContext";
import { Laptop, Smartphone, X, Trash2, Tablet, Monitor } from "lucide-react";
import { formatDate } from "@/components/formatAmount";
import ActionButtons from "@/page-layouts/components/ActionButtons";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import AddTrustedDeviceModal from "./AddTrustedDeviceModal";
import TrustedDevicesServices from "@/services/TrustedDevicesServices";
import _ from "lodash";
import { generateDeviceFingerprint } from "@/utils/helpers/trustedDevices";
import { ItemsGrid } from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function SecurityTab({
  user_id,
  fetchAdminInfo,
  adminInfo,
  activeSection = "security",
}) {
  const { dispatch } = useContext(AdminContext);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [is2FAEnabled, setIs2FAEnabled] = useState(
    adminInfo?.two_factor_auth || false
  );

  // Trusted Devices State
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [searchValue, setSearchValue] = useState("");
  const [addTrustedDeviceModalOpen, setAddTrustedDeviceModalOpen] =
    useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myFingerprint, setMyFingerprint] = useState(null);
  const [fingerprintLoaded, setFingerprintLoaded] = useState(false);

  // Fetch device fingerprint on mount
  useEffect(() => {
    const fetchMyFingerprint = async () => {
      try {
        const fingerprint = await generateDeviceFingerprint();
        setMyFingerprint(fingerprint);
        setFingerprintLoaded(true);
      } catch (error) {
        console.error("Error generating fingerprint:", error);
        setFingerprintLoaded(true);
      }
    };
    fetchMyFingerprint();
  }, []);

  // Fetch devices when needed
  useEffect(() => {
    if (activeSection === "security-devices" && fingerprintLoaded) {
      fetchDevices();
    }
  }, [
    fingerprintLoaded,
    searchValue,
    currentPage,
    recordsPerPage,
    activeSection,
  ]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await TrustedDevicesServices.getTrustedDevices({
        search: searchValue,
        page: currentPage,
        limit: recordsPerPage,
      });
      setDevices(response?.data || []);
    } catch (error) {
      notifyError(error.message || "Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleRecordsPerPageChange = (recordsPerPage) => {
    setRecordsPerPage(recordsPerPage);
    setCurrentPage(1);
  };

  const onSearch = (value) => {
    setSearchValue(value);
    setCurrentPage(1);
  };

  const onRevoke = async (deviceId) => {
    try {
      await TrustedDevicesServices.removeTrustedDevice(deviceId);
      notifySuccess("Device access revoked successfully!");
      fetchDevices();
    } catch (error) {
      notifyError(error.message || "Failed to revoke device access");
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType.toLowerCase()) {
      case "mobile":
        return "📱";
      case "tablet":
        return "📱";
      case "desktop":
        return "💻";
      default:
        return "🖥️";
    }
  };

  const twoFactorFormFields = [
    {
      type: "select",
      name: "twoFactorAuth",
      label: "Two-Factor Authentication",
      value: is2FAEnabled,
      onChange: (value) => setIs2FAEnabled(value),
      options: [
        { label: "Enabled", value: true },
        { label: "Disabled", value: false },
      ],
      direction: "row",
      containerClassName: "w-[300px]",
    },
  ];

  const passwordFormFields = [
    {
      type: "password",
      name: "currentPassword",
      label: "Current Password",
      placeholder: "Enter your current password",
      required: true,
    },
    {
      type: "password",
      name: "newPassword",
      label: "New Password",
      placeholder: "Enter your new password",
      required: true,
    },
    {
      type: "password",
      name: "confirmPassword",
      label: "Confirm New Password",
      placeholder: "Confirm your new password",
      required: true,
    },
  ];

  const handle2FASubmit = async (e) => {
    // e.preventDefault();
    try {
      await AdminServices.updateTwoFactorAuth({
        userId: user_id,
        isEnabled: is2FAEnabled,
      });

      dispatch({
        type: "UPDATE_ADMIN_INFO",
        payload: { two_factor_auth: is2FAEnabled },
      });
      await fetchAdminInfo();
      return { success: true };
    } catch (error) {
      console.error("Failed to update 2FA settings:", error);
      const errorMsg =
        error.response?.data?.message || "Failed to update 2FA settings";
      notifyError(errorMsg);
      return { success: false };
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      notifyError("New passwords do not match");
      return;
    }

    try {
      const response = await axios.post(`${Base_URL}/admin/changePassword`, {
        userId: user_id,
        oldPassword: currentPassword,
        newPassword: newPassword,
      });

      if (response.status === 200) {
        notifySuccess("Password updated successfully!");
        setSuccessMessage("Password updated successfully!");
        // Reset form
        e.target.reset();
      }
    } catch (error) {
      console.error("Failed to update password:", error);
      const errorMsg =
        error.response?.data?.message || "Failed to update password";
      setError(errorMsg);
      notifyError(errorMsg);
      return { success: false };
    }
    return { success: true };
  };
  const renderDeviceIcon = (item) => {
    const iconProps = {
      className: `w-8 h-8 text-gray-600 ${
        isCurrentDevice(item) ? "text-[#bcd374]" : ""
      } group-hover:text-[#bcd374] transition-colors`,
    };

    switch ((item.deviceType || "").toLowerCase()) {
      case "mobile":
        return <Smartphone {...iconProps} />;
      case "tablet":
        return <Tablet {...iconProps} />;
      case "desktop":
        return <Laptop {...iconProps} />;
      default:
        return <Monitor {...iconProps} />;
    }
  };

  const isCurrentDevice = (item) => {
    return myFingerprint && item.deviceFingerprint === myFingerprint;
  };

  const renderSection = () => {
    switch (activeSection) {
      case "security-2fa":
        return (
          <div className="bg-white rounded-lg">
            <h4 className="text-base font-medium text-[#2d3748] mb-4">
              Two-Factor Authentication
            </h4>
            <Form
              formFields={twoFactorFormFields}
              handleSubmit={handle2FASubmit}
              submitSuccessMessage="2FA settings updated successfully!"
              submitErrorMessage="Failed to update 2FA settings"
              showFooterButtons={true}
              labelAndFieldDirection="row"
              customLabelWidth="w-1/2"
              disableReSubmission={false}
              showCancelButton={false}
              saveButtonText="Update"
            />
          </div>
        );

      case "security-password":
        return (
          <div className="bg-white rounded-lg">
            <h4 className="text-base font-medium text-[#2d3748] mb-4">
              Change Password
            </h4>
            {error && (
              <div className="p-3 bg-red-50 text-red-500 text-sm rounded-md mb-4">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-green-50 text-green-500 text-sm rounded-md mb-4">
                {successMessage}
              </div>
            )}
            <Form
              formFields={passwordFormFields}
              handleSubmit={handlePasswordSubmit}
              submitSuccessMessage="Password updated successfully!"
              submitErrorMessage="Failed to update password"
              showFooterButtons={true}
              labelAndFieldDirection="row"
              customLabelWidth="w-1/2"
              disableReSubmission={false}
              showCancelButton={false}
              saveButtonText="Update"
            />
          </div>
        );

      case "security-devices":
        return (
          <div className="bg-white rounded-lg">
            {devices && (
              <div className="mt-0">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-base font-medium text-[#2d3748] mb-4">
                    Trusted Devices
                  </h4>
                  <button
                    onClick={() => setAddTrustedDeviceModalOpen(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#bcd374] rounded-lg hover:bg-[#bcd374]/90 transition-colors"
                  >
                    Add This Device
                  </button>
                </div>
                <ItemsGrid
                  items={devices}
                  onDelete={onRevoke}
                  highlightId={myFingerprint}
                  showKeys={[
                    "deviceLabel",
                    "ipAddress",
                    "browser",
                    "operatingSystem",
                    "deviceType",
                  ]}
                  detailsKeys={[
                    "deviceLabel",
                    "deviceName",
                    "deviceType",
                    "browser",
                    "operatingSystem",
                    "ipAddress",
                    "isActive",
                    "lastUsed",
                    "createdAt",
                    "updatedAt",
                  ]}
                  highlightKey="deviceFingerprint"
                  loading={loading}
                  emptyStateTitle="No trusted devices found"
                  emptyStateSubtitle="Add your first device to get started"
                  renderIcon={renderDeviceIcon}
                  renderBadge={(item) =>
                    isCurrentDevice(item) ? (
                      <span className="px-2 py-1 text-xs font-medium text-[#bcd374] bg-[#bcd374]/10 rounded-full">
                        Current Device
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.isActive
                            ? "text-green-600 bg-green-50"
                            : "text-gray-600 bg-gray-50"
                        }`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    )
                  }
                  modalTitle="Device Details"
                  renderActions={(item) =>
                    item.isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRevoke(item._id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                        title="Revoke Access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  }
                />
              </div>
            )}
            <AddTrustedDeviceModal
              open={addTrustedDeviceModalOpen}
              onClose={() => setAddTrustedDeviceModalOpen(false)}
              onSuccess={fetchDevices}
              configData={adminInfo}
            />
          </div>
        );

      default:
        return (
          <div className="space-y-8">
            <h3 className="text-lg font-medium text-[#2d3748]">
              Security Settings
            </h3>
            <div className="bg-white rounded-lg">
              <h4 className="text-base font-medium text-[#2d3748] mb-4">
                Two-Factor Authentication
              </h4>
              <Form
                formFields={twoFactorFormFields}
                handleSubmit={handle2FASubmit}
                submitSuccessMessage="2FA settings updated successfully!"
                submitErrorMessage="Failed to update 2FA settings"
                showFooterButtons={true}
                labelAndFieldDirection="row"
                customLabelWidth="w-1/2"
                disableReSubmission={false}
                showCancelButton={false}
                saveButtonText="Update"
              />
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h4 className="text-base font-medium text-[#2d3748] mb-4">
                Change Password
              </h4>
              {error && (
                <div className="p-3 bg-red-50 text-red-500 text-sm rounded-md mb-4">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="p-3 bg-green-50 text-green-500 text-sm rounded-md mb-4">
                  {successMessage}
                </div>
              )}
              <Form
                formFields={passwordFormFields}
                handleSubmit={handlePasswordSubmit}
                submitSuccessMessage="Password updated successfully!"
                submitErrorMessage="Failed to update password"
                showFooterButtons={true}
                labelAndFieldDirection="row"
                customLabelWidth="w-1/2"
                disableReSubmission={false}
                showCancelButton={false}
                saveButtonText="Update"
              />
            </div>
          </div>
        );
    }
  };

  return renderSection();
}
