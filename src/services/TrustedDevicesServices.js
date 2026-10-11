import requests from "./httpService";

const TrustedDevicesServices = {
  // Add a new trusted device
  addTrustedDevice: async (deviceData) => {
    return requests.post("trusted-devices", deviceData);
  },

  // Get all trusted devices for the authenticated user
  getTrustedDevices: async (body) => {
    return requests.get("trusted-devices", { params: body });
  },

  getTrustedDevicesByFingerprint: async (fingerprint) => {
    return requests.get(`trusted-devices/accounts/${fingerprint}`);
  },
  getTrustedDevicesByEmail: async (email) => {
    return requests.get(`trusted-devices/user/${email}`);
  },

  // Remove a device from trusted devices
  removeTrustedDevice: async (deviceId) => {
    return requests.delete(`trusted-devices/${deviceId}`);
  },

  // Verify if a device is trusted
  verifyTrustedDevice: async (deviceData) => {
    return requests.post("trusted-devices/verify", deviceData);
  },

  // Update device information
  updateTrustedDevice: async (deviceId, deviceData = {}) => {
    return requests.put(`trusted-devices/${deviceId}`, deviceData);
  },
};

export default TrustedDevicesServices;
