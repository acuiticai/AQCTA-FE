import CryptoJS from "crypto-js";
import React from "react";
import currencies from "@/utils/currency";
import AdminServices from "@/services/AdminServices";
import Cookies from "js-cookie";
import {
  messaging,
  getToken,
  onMessage,
  initializeMessaging,
} from "@/firebase-config";
import { clearSessionAssignedBusinesses } from "@/utils/sessionAssignedBusinesses";
import { clearSessionApiCache } from "@/utils/sessionApiCache";
import { clearStoredRefreshToken } from "@/utils/setupAxiosAuth";
const URL_PARAMS_SECRET_KEY = import.meta.env.VITE_URL_PARAMS_SECRET_KEY;

// Fallback VAPID key when env is missing (e.g. deployment without VITE_FIREBASE_VAPID_KEY)
// Source: Firebase Console > Project flexaerp-b8733 > Project Settings > Cloud Messaging > Web Push certificates
const FALLBACK_VAPID_KEY =
  "BBhcFCm-Nv7RM8Dy04pdunmjO6zRpp3LP8KxCwtq8Yxn7zDTp3-LRUd92DxZq03kF51alMf9u_LwO5ChBStKx-E";
function customEncodeUrlParams(data) {
  // Encrypt the data
  const ciphertext = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    URL_PARAMS_SECRET_KEY
  ).toString();
  // URI encode the encrypted string for safe URL usage
  return encodeURIComponent(ciphertext);
}

// To decrypt:
function customDecodeUrlParams(token) {
  const bytes = CryptoJS.AES.decrypt(
    decodeURIComponent(token),
    URL_PARAMS_SECRET_KEY
  );
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedData);
}

function removeHtmlTags(text = "") {
  return text.replace(/<[^>]*>?/g, "");
}

// Get the string content from the react element
function extractContent(children, headers) {
  if (headers === "Action") {
    return "";
  }

  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(extractContent).join(" ");
  }

  if (React.isValidElement(children)) {
    return extractContent(children.props?.children);
  }

  return "";
}

function getCurrenciesDropdownOptions() {
  return currencies.map((currency) => ({
    label: currency.name,
    value: currency.symbol,
    symbol: currency.symbol,
  }));
}

function getS3Url(s3Key) {
  return `${import.meta.env.VITE_APP_S3_URL ||
    "https://barena-docs.s3-ap-southeast-1.amazonaws.com/"
    }${s3Key}`;
}

function logoutUser() {
  Cookies.remove("token");
  Cookies.remove("refreshToken");
  Cookies.remove("adminData");
  Cookies.remove("fcm_token");
  Cookies.remove("session_expired");
  Cookies.remove("adminInfo");
  localStorage.removeItem("adminInfo");
  localStorage.removeItem("businesses");
  clearSessionAssignedBusinesses();
  clearSessionApiCache();
  localStorage.removeItem("token");
  localStorage.removeItem("session_expired");
  localStorage.removeItem("fcm_token");
  sessionStorage.removeItem("token");
  clearStoredRefreshToken();

  AdminServices.logout();
}

// Common notification permission handling function
async function handleNotificationPermission(options = {}) {
  const {
    serviceWorkerRegistration = null,
    onTokenReceived = null,
    onPermissionDenied = null,
    onError = null,
    retryFunction = null,
  } = options;

  try {
    // Check if messaging is supported
    const messagingInstance = await initializeMessaging();
    if (!messagingInstance) {
      console.warn("⚠️ Firebase Messaging not supported in this browser");
      return null;
    }

    // Check current permission status
    const permission = await Notification.requestPermission();
    console.log("🔔 Notification permission status:", permission);

    if (permission === "granted") {
      // Use env first; fallback to hardcoded key when env is missing (e.g. deployment mode)
      const envVapid = (import.meta.env.VITE_FIREBASE_VAPID_KEY || "").trim();
      const vapidKey = envVapid || FALLBACK_VAPID_KEY;
      const tokenOptions = { vapidKey };

      // Add service worker registration if provided
      if (serviceWorkerRegistration) {
        tokenOptions.serviceWorkerRegistration = serviceWorkerRegistration;
      }

      const token = await getToken(messagingInstance, tokenOptions);
      console.log("✅ Token received:", token);

      // Call custom token handler if provided
      if (onTokenReceived && token) {
        await onTokenReceived(token);
      }

      // Cookies.set("fcm_token", token);
      localStorage.setItem("fcm_token", token);

      return token;
    } else if (permission === "denied") {
      // Show a more informative message for denied permission
      const shouldRetry = confirm(
        "Notifications are required for this application to work properly. Would you like to enable them now?\n\n" +
        "Click 'OK' to open browser settings, or 'Cancel' to continue without notifications."
      );

      if (shouldRetry) {
        // Try to open browser settings (this works in some browsers)
        if (navigator.permissions) {
          navigator.permissions
            .query({ name: "notifications" })
            .then((result) => {
              console.log("Permission query result:", result);
            });
        }

        // Show instructions for manual permission enable
        alert(
          "To enable notifications:\n\n" +
          "1. Click the icon on the left of the address in your browser's address bar\n" +
          "2. Set 'Notifications' to 'Allow'\n" +
          "3. Refresh the page\n\n" +
          "This is required for the application to function properly."
        );
      }

      // Call custom permission denied handler if provided
      if (onPermissionDenied) {
        onPermissionDenied();
      }
      // Cookies.set("fcm_token", null);
      localStorage.setItem("fcm_token", null);

      return null;
    } else {
      // Permission is 'default' - user hasn't been asked yet
      console.log(
        "🔄 Permission not yet requested, will retry on next interaction"
      );
      // Cookies.set("fcm_token", null);
      localStorage.setItem("fcm_token", null);
      return null;
    }
  } catch (error) {
    console.error("❌ Error getting FCM token:", error);

    // // Show a more helpful error message
    // const shouldRetry = confirm(
    //   "There was an error setting up notifications. This is required for the application to work properly.\n\n" +
    //     "Would you like to try again?"
    // );

    // if (shouldRetry) {
    //   // Use custom retry function if provided, otherwise use default
    //   const retryFn = retryFunction || handleNotificationPermission;
    //   setTimeout(() => {
    //     retryFn(options);
    //   }, 1000);
    //   Cookies.set("fcm_token", null);
    //   localStorage.setItem("fcm_token", null);
    // }

    // Call custom error handler if provided
    if (onError) {
      onError(error);
    }

    return null;
  }
}

/**
 * Build a safe PDF download filename from a document number (invoice, quotation, sales order, etc.).
 * Preserves known prefixes (INV, QT, SO, PO, NV, …) and strips legacy timestamp suffixes.
 */
function formatInvoiceDownloadName(val) {
  if (!val || typeof val !== "string") return "document.pdf";
  const cleaned = String(val).replace(/\.pdf$/i, "").trim();
  if (!cleaned) return "document.pdf";

  const docToken = cleaned.match(
    /^([A-Za-z]{1,12})[._\s-]+(\d+)(?=[._\s-]|$)/,
  );
  if (docToken) {
    return `${docToken[1].toUpperCase()}-${docToken[2]}.pdf`;
  }

  if (/^\d+$/.test(cleaned)) {
    return `INV-${cleaned}.pdf`;
  }

  const longNum = cleaned.match(/(\d{3,})/);
  if (longNum) {
    const lead = cleaned.match(/^([A-Za-z]{1,8})/);
    const prefix = lead ? lead[1].toUpperCase() : "INV";
    return `${prefix}-${longNum[1]}.pdf`;
  }

  const slug = cleaned
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `${slug || "document"}.pdf`;
}

export {
  customEncodeUrlParams,
  customDecodeUrlParams,
  removeHtmlTags,
  extractContent,
  getCurrenciesDropdownOptions,
  getS3Url,
  logoutUser,
  handleNotificationPermission,
  formatInvoiceDownloadName,
};
