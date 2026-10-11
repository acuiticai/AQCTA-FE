import { CustomModal, Form } from "@/page-layouts/index";
import { useContext, useEffect, useState } from "react";
import { AdminContext } from "@/context/AdminContext";
import TrustedDevicesServices from "@/services/TrustedDevicesServices";
import { notifySuccess, notifyError } from "@/utils/toast";
import {
  generateDeviceFingerprint,
  detectBrowser,
  detectOS,
  checkDeviceExists,
  fetchIpAddress,
} from "@/utils/helpers/trustedDevices";
import _ from "lodash";

const AddTrustedDeviceModal = ({ open, onClose, onSuccess, configData }) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [deviceInfo, setDeviceInfo] = useState({
    deviceLabel: "",
    deviceName: "",
    deviceType: "desktop",
    browser: "",
    operatingSystem: "",
    user: adminInfo.id,
    deviceFingerprint: "",
  });
  const [ipAddress, setIpAddress] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    // Get browser and OS information
    const userAgent = window.navigator.userAgent;
    const browserInfo = detectBrowser(userAgent);
    const osInfo = detectOS(userAgent);

    // Fetch IP address and update device info
    const initializeDeviceInfo = async () => {
      const ip = await fetchIpAddress();
      setIpAddress(ip);

      // Create device fingerprint
      const fingerprint = await generateDeviceFingerprint(ip);
      setDeviceInfo((prev) => ({
        ...prev,
        browser: browserInfo,
        operatingSystem: osInfo,
        deviceName: userAgent,
        ipAddress: ip,
        deviceFingerprint: fingerprint,
      }));
    };

    initializeDeviceInfo();
  }, []);

  const onAddTrustedDevice = async () => {
    setSubmitAttempted(true);
    try {
      if (Object.values(deviceInfo).some((value) => !value)) {
        notifyError("Please fill all the fields");
        return;
      }

      // Check if device already exists
      const deviceExists = await checkDeviceExists(
        deviceInfo.deviceFingerprint,
        TrustedDevicesServices
      );

      if (deviceExists) {
        notifyError("This device is already registered!");
        return;
      }

      // Create new device object with required fields
      const newDevice = {
        ...deviceInfo,
        isActive: true,
        lastUsed: new Date().toISOString(),
        ipAddress,
        user: adminInfo.id,
      };

      await TrustedDevicesServices.addTrustedDevice(newDevice);
      notifySuccess("Device added successfully!");
      onSuccess?.(); // Refresh the devices list
      onClose();
    } catch (error) {
      notifyError(error.message || "Failed to add device");
    }
  };

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      width="700px"
      title="Add Your Device"
      actions={[
        {
          label: "Add",
          onClick: onAddTrustedDevice,
          disabled: !deviceInfo.deviceName,
        },
      ]}
    >
      <Form
        showFooterButtons={false}
        formFields={[
          {
            label: "Device Label",
            type: "text",
            required: true,
            value: deviceInfo.deviceLabel,
            error: "This field is required",
            shouldShowError: submitAttempted && !deviceInfo.deviceLabel,
            onChange: (e) =>
              setDeviceInfo((prev) => ({
                ...prev,
                deviceLabel: e.target.value,
              })),
            placeholder: "Enter device label",
          },
          {
            label: "Device Name",
            type: "textarea",
            labelOnTop: true,
            value: deviceInfo.deviceName,
            onChange: (e) =>
              setDeviceInfo((prev) => ({
                ...prev,
                deviceName: e.target.value,
              })),
            placeholder: "Enter device name",
            inActive: true,
          },
          {
            label: "Device Type",
            type: "text",
            value: _.capitalize(deviceInfo.deviceType),
            inActive: true,
          },
          {
            label: "Browser",
            type: "text",
            value: _.capitalize(deviceInfo.browser),
            inActive: true,
          },
          {
            label: "Operating System",
            type: "text",
            value: _.capitalize(deviceInfo.operatingSystem),
            inActive: true,
          },
          {
            label: "IP Address",
            type: "text",
            value: ipAddress || "Fetching...",
            inActive: true,
          },
        ]}
      />
    </CustomModal>
  );
};

export default AddTrustedDeviceModal;
