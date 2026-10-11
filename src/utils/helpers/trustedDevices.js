import TrustedDevicesServices from "@/services/TrustedDevicesServices";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

/**
 * Generates a unique device fingerprint using FingerprintJS
 * @returns {Promise<string>} A stable visitor ID that can be used as a device fingerprint
 */
export const generateDeviceFingerprint = async (ip = null) => {
  try {
    let ipAddress = ip;
    if (!ipAddress) {
      ipAddress = await fetchIpAddress();
    }
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    console.error("Error generating device fingerprint:", error);
    return null;
  }
};

/**
 * Gets all trusted accounts for the current device
 * @param {string} fingerprint - The device fingerprint
 * @param {Object} TrustedDevicesServices - The service object for trusted devices operations
 * @returns {Promise<Array>} Array of trusted accounts with their details
 */
export const getTrustedDevicesByFingerprint = async (fingerprint) => {
  try {
    const response =
      await TrustedDevicesServices.getTrustedDevicesByFingerprint(fingerprint);
    const devices = response?.data || [];
    const trustedDevices = devices.filter(
      (device) => device.deviceFingerprint === fingerprint
    );
    return trustedDevices;
  } catch (error) {
    console.error("Error fetching trusted accounts:", error);
    return [];
  }
};

/**
 * Detects the browser type from user agent string
 * @param {string} userAgent - The browser's user agent string
 * @returns {string} The detected browser name
 */
export const detectBrowser = (userAgent) => {
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  if (userAgent.includes("Opera")) return "Opera";
  return "Unknown Browser";
};

/**
 * Detects the operating system from user agent string
 * @param {string} userAgent - The browser's user agent string
 * @returns {string} The detected operating system name
 */
export const detectOS = (userAgent) => {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac")) return "MacOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iOS")) return "iOS";
  return "Unknown OS";
};

/**
 * Checks if a device with the given fingerprint already exists
 * @param {string} fingerprint - The device fingerprint to check
 * @param {Object} TrustedDevicesServices - The service object for trusted devices operations
 * @returns {Promise<boolean>} Whether the device exists or not
 */
export const checkDeviceExists = async (
  fingerprint,
  TrustedDevicesServices
) => {
  try {
    const response = await TrustedDevicesServices.getTrustedDevices();
    const devices = response?.data || [];
    return devices.some((device) => device.deviceFingerprint === fingerprint);
  } catch (error) {
    console.error("Error checking device existence:", error);
    return false;
  }
};

/**
 * Fetches the IP address of the current device
 * @returns {Promise<string>} The IP address of the device
 */
export const fetchIpAddress = async () => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Error fetching IP address:", error);
    return "unknown";
  }
};
