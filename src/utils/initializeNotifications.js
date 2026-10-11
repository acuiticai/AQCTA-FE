import { requestFirebaseNotificationPermission } from "@/NotificationPermission";
import notificationService from "@/services/notificationService.jsx";
import { messaging, initializeMessaging } from "@/firebase-config";
import axios from "axios";
import Cookies from "js-cookie";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Initializes notifications for the given user.
 * - Requests browser permission for notifications.
 * - Saves the FCM token to the backend for the user.
 * - Initializes the notification service for real-time updates.
 *
 * @param {string} userId - The user's ID
 * @returns {Promise<{success: boolean, token: string|null, error: string|null}>} Result object
 */
export async function initializeNotifications(userId, history) {
  console.log("🚀 Starting notification initialization for user:", userId);

  try {
    // Check if service worker is available
    if (!("serviceWorker" in navigator)) {
      console.error("❌ Service Worker not supported");
      return {
        success: false,
        token: null,
        error: "Service Worker not supported in this browser",
      };
    }

    // Check if messaging is available
    const messagingInstance = await initializeMessaging();
    if (!messagingInstance) {
      console.error("❌ Firebase messaging not available");
      return {
        success: false,
        token: null,
        error: "Firebase messaging not available in this browser",
      };
    }

    // Request browser permission and get FCM token
    console.log("🔐 Requesting notification permission...");
    const token = await requestFirebaseNotificationPermission();

    // Set the FCM token in cookies as 'fcm_token'
    // Cookies.set("fcm_token", token, {
    //   path: "/",
    //   sameSite: "lax",
    // });

    localStorage.setItem("fcm_token", token);

    if (!token) {
      console.error("❌ No FCM token received");
      return {
        success: false,
        token: null,
        error: "Notification permission denied or token not generated",
      };
    }

    console.log("✅ FCM token received:", token.substring(0, 20) + "...");

    if (!userId) {
      console.error("❌ User ID is required");
      return {
        success: false,
        token: null,
        error: "User ID is required",
      };
    }

    // // Store the FCM token in cookies as 'fcm_token'
    // document.cookie = `fcm_token=${encodeURIComponent(
    //   token
    // )}; path=/; SameSite=Lax`;

    // Save FCM token to backend for this user
    console.log("💾 Saving FCM token to backend...");
    try {
      const response = await axios.post(
        `${Base_URL}/system-users/update-fcm-token`,
        {
          userId,
          platform: "web",
          fcmToken: token,
        }
      );

      if (response.data.status) {
        console.log("✅ FCM token saved to backend for user:", userId);
      } else {
        console.warn(
          "⚠️ Backend returned error saving FCM token:",
          response.data.message
        );
      }
    } catch (error) {
      console.warn("⚠️ Failed to save FCM token to backend:", error.message);
      // Don't fail the entire initialization if backend save fails
      // The notification system will still work for real-time notifications
    }

    // Initialize the notification service for this user
    console.log("🔧 Initializing notification service...");
    notificationService.init(userId, history);

    console.log("✅ Notifications initialized successfully for user:", userId);

    return {
      success: true,
      token,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error initializing notifications:", error);
    return {
      success: false,
      token: null,
      error: error.message,
    };
  }
}

/**
 * Remove FCM token from backend when user logs out
 */
export async function removeFCMToken(userId, platform = "web") {
  try {
    if (!userId) {
      console.warn("⚠️ User ID is required to remove FCM token");
      return { success: false, error: "User ID is required" };
    }

    console.log(
      `🗑️ Removing FCM token for ${platform} platform for user:`,
      userId
    );

    const response = await axios.post(
      `${Base_URL}/system-users/remove-fcm-token`,
      {
        userId,
        platform,
      }
    );

    if (response.data.status) {
      console.log(
        `✅ FCM token removed from backend for ${platform} platform for user:`,
        userId
      );
      return { success: true, data: response.data };
    } else {
      console.warn(
        "⚠️ Backend returned error removing FCM token:",
        response.data.message
      );
      return { success: false, error: response.data.message };
    }
  } catch (error) {
    console.warn("⚠️ Failed to remove FCM token from backend:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Cleanup notifications when user logs out
 */
export function cleanupNotifications() {
  notificationService.cleanup();
  console.log("✅ Notifications cleaned up");
}
