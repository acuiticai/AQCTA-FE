import axios from "axios";
import { messaging, onMessage, initializeMessaging } from "@/firebase-config";
import { toast } from "react-toastify";
import notificationSound from "@/utils/notificationSound";
import React from "react";
import { withRouter } from "react-router-dom";
import { logoutUser } from "@/utils/generic";
import { initializeNotifications } from "@/utils/initializeNotifications";
import Cookies from "js-cookie";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SessionExpiredMessage = ({ title, body }) => (
  <div>
    <strong>{title}:</strong> {body}
  </div>
);

class NotificationService {
  constructor() {
    this.notifications = [];
    this.previousNotifications = []; // Track previous notifications to detect new ones
    this.unreadCount = 0;
    this.listeners = [];
    this.userId = null;
    this.pollingInterval = null;
    this.isInitialized = false;
    this.history = null;
    this.sessionExpired = false;
  }

  // Initialize the service for a specific user
  init(userId, history) {
    console.log("🔧 NotificationService: Initializing with userId:", userId);
    console.log("🔧 NotificationService: History:", history);
    if (history) {
      console.log("🔧 NotificationService: Setting history");
      this.history = history;
    }
    if (this.isInitialized && this.userId === userId) {
      console.log(
        "🔧 NotificationService: Already initialized for user:",
        userId
      );
      return; // Already initialized for this user
    }

    // Cleanup previous initialization if any
    if (this.isInitialized) {
      console.log(
        "🔧 NotificationService: Cleaning up previous initialization"
      );
      this.cleanup();
    }

    this.userId = userId;
    this.isInitialized = true;
    console.log("🔧 NotificationService: Initialized for user:", userId);

    // Start polling for notifications
    this.startPolling();
  }

  // Start polling for new notifications
  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Fetch notifications immediately
    this.fetchNotifications();

    // Then poll every 10 seconds for more responsive updates
    this.pollingInterval = setInterval(() => {
      this.fetchNotifications();
    }, 10000);

    console.log("🔄 NotificationService: Started polling");
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("⏹️ NotificationService: Stopped polling");
    }
  }

  // Fetch notifications from the server
  async fetchNotifications() {
    if (!this.userId) {
      console.warn("⚠️ NotificationService: No user ID set");
      return;
    }

    try {
      console.log(
        "🔍 NotificationService: Fetching notifications for user:",
        this.userId
      );

      // Get the auth token from localStorage or cookies
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const token = adminInfo.token;

      if (!token) {
        console.warn("⚠️ NotificationService: No auth token available");
        return;
      }

      const response = await axios.get(
        `${Base_URL}/notifications/user/${this.userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("📡 NotificationService: API Response:", response.data);

      if (response.data.success) {
        const newNotifications = response.data.notifications || [];

        // Store previous notifications before updating
        this.previousNotifications = [...this.notifications];

        // Update current notifications
        this.notifications = newNotifications;

        // Check for new unread notifications and show toasts
        this.checkForNewNotifications();

        this.updateUnreadCount();
        this.notifyListeners();
        console.log(
          "📬 NotificationService: Fetched",
          this.notifications.length,
          "notifications, unread count:",
          this.unreadCount
        );
      } else {
        console.warn("⚠️ NotificationService: API returned success: false");
      }
    } catch (error) {
      console.error(
        "❌ NotificationService: Error fetching notifications:",
        error.response?.data || error.message
      );
    }
  }

  // Check for new notifications and show toasts
  checkForNewNotifications() {
    // console.log("🔍 NotificationService: Checking for new notifications...");
    // console.log("📊 Previous notifications count:", this.previousNotifications.length);
    // console.log("📊 Current notifications count:", this.notifications.length);

    if (this.previousNotifications.length === 0) {
      // console.log("📊 First time loading, skipping toast for existing notifications");
      // First time loading, don't show toasts for existing notifications
      return;
    }

    // Create a set of previous notification IDs for quick lookup
    const previousIds = new Set(this.previousNotifications.map((n) => n._id));

    // Find new notifications (not in previous list)
    const newNotifications = this.notifications.filter(
      (notification) =>
        !previousIds.has(notification._id) &&
        !notification.isRead &&
        !notification.is_read // Only unread notifications
    );

    console.log(
      "🔍 NotificationService: Found",
      newNotifications.length,
      "new unread notifications"
    );

    // Show toast for each new unread notification
    newNotifications.forEach((notification) => {
      console.log(
        "🔔 NotificationService: Showing toast for new notification:",
        notification._id
      );

      console.log("🔍 NotificationService: Notification :", { notification });

      const title =
        notification.title || notification.message || "New Notification";
      const body =
        notification.body ||
        notification.message ||
        "You have a new notification";
      const data = {
        link: notification.link,
        notificationId: notification._id,
        state: notification?.state,
        ...notification.data,
      };

      // Show toast notification
      this.showNotification(title, body, data);
    });

    if (newNotifications.length > 0) {
      console.log(
        "🔔 NotificationService: Showed toasts for",
        newNotifications.length,
        "new notifications"
      );
    }
  }

  // Update unread count
  updateUnreadCount() {
    this.unreadCount = this.notifications.filter(
      (notification) => !notification.isRead && !notification.is_read
    ).length;
  }

  // Subscribe to notification updates
  subscribe(callback) {
    this.listeners.push(callback);

    // Immediately call with current state
    callback({
      notifications: this.notifications,
      unreadCount: this.unreadCount,
    });

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  // Notify all listeners
  notifyListeners() {
    console.log(
      "📢 NotificationService: Notifying",
      this.listeners.length,
      "listeners"
    );
    console.log(
      "📢 NotificationService: Current state - notifications:",
      this.notifications.length,
      "unread:",
      this.unreadCount
    );
    this.listeners.forEach((callback, index) => {
      try {
        console.log(`📢 NotificationService: Calling listener ${index + 1}`);
        callback({
          notifications: this.notifications,
          unreadCount: this.unreadCount,
        });
        console.log(
          `📢 NotificationService: Listener ${index + 1} called successfully`
        );
      } catch (error) {
        console.error(
          `❌ NotificationService: Error in listener ${index + 1} callback:`,
          error
        );
      }
    });
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    console.log(
      "🔧 NotificationService: Marking notification as read:",
      notificationId
    );
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const token = adminInfo.token;

      if (!token) {
        console.warn(
          "⚠️ NotificationService: No auth token available for markAsRead"
        );
        return;
      }

      const response = await axios.patch(
        `${Base_URL}/notifications/mark-read/${notificationId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log(
          "✅ NotificationService: Successfully marked notification as read"
        );
        // Update local state
        this.notifications = this.notifications.map((notification) =>
          notification._id === notificationId
            ? { ...notification, isRead: true, is_read: true }
            : notification
        );

        console.log(
          "📊 NotificationService: Updated notifications count:",
          this.notifications.length
        );
        this.updateUnreadCount();
        this.notifyListeners();
        console.log(
          "📢 NotificationService: Notified listeners of state change"
        );
      }
    } catch (error) {
      console.error("❌ Error marking notification as read:", error);
    }
  }

  // Mark all notifications as read
  async markAllAsRead(explicitUserId) {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    const token = adminInfo.token;
    const userId =
      explicitUserId || this.userId || adminInfo.id || adminInfo._id;

    if (!token) {
      throw new Error("No auth token available for markAllAsRead");
    }
    if (!userId) {
      throw new Error("No user ID available for markAllAsRead");
    }

    // Keep service in sync even when init/FCM never set this.userId
    if (!this.userId) {
      this.userId = userId;
    }

    const response = await axios.patch(
      `${Base_URL}/notifications/mark-all-read/${userId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data?.success) {
      throw new Error(
        response.data?.message || "Failed to mark all notifications as read"
      );
    }

    this.notifications = this.notifications.map((notification) => ({
      ...notification,
      isRead: true,
      is_read: true,
    }));

    this.updateUnreadCount();
    this.notifyListeners();

    return response.data;
  }

  // Delete notification
  async deleteNotification(notificationId) {
    console.log(
      "🗑️ NotificationService: Deleting notification:",
      notificationId
    );
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const token = adminInfo.token;

      if (!token) {
        console.warn(
          "⚠️ NotificationService: No auth token available for deleteNotification"
        );
        return;
      }

      const response = await axios.delete(
        `${Base_URL}/notifications/${notificationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log(
          "✅ NotificationService: Successfully deleted notification"
        );
        // Remove from local state
        this.notifications = this.notifications.filter(
          (notification) => notification._id !== notificationId
        );

        console.log(
          "📊 NotificationService: Updated notifications count:",
          this.notifications.length
        );
        this.updateUnreadCount();
        this.notifyListeners();
        console.log(
          "📢 NotificationService: Notified listeners of state change"
        );
      }
    } catch (error) {
      console.error("❌ Error deleting notification:", error);
    }
  }

  // Navigate to the page specified in notification
  navigateToNotification(notification) {
    if (!notification.link) {
      console.warn("⚠️ Notification has no link");
      return null;
    }

    console.log("🧭 NotificationService: Navigating to:", notification.link);
    return notification.link;
  }

  // Handle notification click with navigation
  handleNotificationClick(notification) {
    const history = this.history;
    console.debug({ history, notification });
    if (!history && !notification?.state) {
      // fallback
      console.log(
        "🧭 NotificationService: No history, navigating to:",
        notification.link
      );
      window.location.href = this.navigateToNotification(notification);
      return;
    }
    // Mark as read first
    this.markAsRead(
      notification?._id || notification?.id || notification?.notificationId
    );

    // Navigate to the specified page
    const link = this.navigateToNotification(notification);
    console.log("🧭 NotificationService: Link:", link);
    console.log("🧭 NotificationService: Notification:", notification);
    if (link) {
      if (/^https?:\/\//.test(link)) {
        console.log(
          "🧭 NotificationService: Navigating to absolute link:",
          link
        );
        // If link is absolute, navigate directly
        window.location.href = link;
      } else if (notification?.state) {
        console.log(
          "🧭 NotificationService: Navigating to relative link with state:",
          link
        );
        history.push(link, { ...notification?.state });
      } else {
        console.log(
          "🧭 NotificationService: Navigating to relative link without state:",
          link
        );
        history.push(link);
      }
    }
  }

  // Cleanup
  cleanup() {
    this.stopPolling();
    this.notifications = [];
    this.unreadCount = 0;
    this.listeners = [];
    this.userId = null;
    this.isInitialized = false;
    console.log("🧹 NotificationService: Cleaned up");
  }

  // Get current state
  getState() {
    return {
      notifications: this.notifications,
      unreadCount: this.unreadCount,
    };
  }

  // Show notification toast for FCM messages
  showNotification(title, body, data = {}) {
    const logout = () => {
      logoutUser();
      window.location.href = "/login";
    };

    console.log("🔔 NotificationService: Showing toast notification:", {
      title,
      body,
      data,
    });

    if (this.sessionExpired) {
      return;
    }

    // Create the toast content with title, body, and link if available
    let toastContent = `${title}: ${body}`;

    if (title === "Session Expired" || title === "Invalid Token") {
      try {
        notificationSound.play("error");
        console.log("🔊 NotificationService: Played notification sound");
      } catch (error) {
        console.warn("Could not play notification sound:", error);
      }

      const AUTO_REDIRECT_SECONDS = 5;
      toast.error(
        <SessionExpiredMessage title={title} body={body} />,
        {
          position: "top-right",
          hideProgressBar: false,
          autoClose: AUTO_REDIRECT_SECONDS * 1000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          style: {
            boxShadow: "1.5px 1.5px 1.5px 1.5px rgba(255, 0, 0, 0.65)",
          },
          onClick: () => {
            logout();
          },
          onClose: () => {
            logout();
          },
          closeButton: ({ closeToast }) => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeToast();
              }}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "16px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              ×
            </button>
          ),
        }
      );

      this.sessionExpired = true;
      localStorage.setItem("session_expired", true);
      document.cookie = "session_expired=true; path=/; SameSite=Lax";
      return;
    }

    if (!data?.platform) {
      console.warn(
        "🔔 NotificationService: No platform available, skipping notification"
      );
      return;
    }

    // Play notification sound first
    try {
      notificationSound.play("default");
      console.log("🔊 NotificationService: Played notification sound");
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }

    const customData = JSON.parse(data?.customDataStringified || "{}");
    console.log("customData", customData);
    if (
      customData?.link &&
      (!customData?.state || (this.history && customData?.state))
    ) {
      // Add link information if available
      toastContent += `\n\nClick to view details →`;
    }
    console.log("toastContent", toastContent);

    toast.info(toastContent, {
      position: "top-right",
      autoClose: 6000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      onClick:
        customData?.link &&
        (!customData?.state || (this.history && customData?.state))
          ? () => this.handleNotificationClick(customData)
          : undefined,
      style: {
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        borderRadius: "16px",
        boxShadow: "0 15px 35px rgba(0,0,0,0.2)",
        padding: "16px",
        minWidth: "350px",
        maxWidth: "450px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)",
        cursor: customData?.link ? "pointer" : "default",
        whiteSpace: "pre-line",
        lineHeight: "1.5",
      },
      progressStyle: {
        background: "rgba(255,255,255,0.3)",
        height: "3px",
      },
    });

    this.fetchNotifications();
  }

  // Test notification method for debugging
  testNotification() {
    console.log("🧪 NotificationService: Testing notification");

    // Test basic toast first
    toast.success("Basic toast test - SUCCESS", {
      position: "top-right",
      autoClose: 3000,
    });

    // Test info toast
    toast.info("Basic toast test - INFO", {
      position: "top-right",
      autoClose: 3000,
    });

    // Test error toast
    toast.error("Basic toast test - ERROR", {
      position: "top-right",
      autoClose: 3000,
    });

    // Test the full notification
    setTimeout(() => {
      this.showNotification(
        "Test Notification",
        "This is a test notification to verify toast functionality",
        { link: "/notifications" }
      );
    }, 1000);
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Fetch most recent 50 unread notifications for header
notificationService.fetchRecentUnreadNotifications = async function (userId) {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  const token = adminInfo.token;
  if (!token) return { notifications: [], unreadCount: 0 };

  try {
    const response = await axios.get(
      `${Base_URL}/notification/user/${userId}/recent-unread`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (response.data.success) {
      return {
        notifications: response.data.notifications,
        unreadCount: response.data.unreadCount,
      };
    }
    return { notifications: [], unreadCount: 0 };
  } catch (error) {
    return { notifications: [], unreadCount: 0 };
  }
};

export default withRouter(notificationService);
