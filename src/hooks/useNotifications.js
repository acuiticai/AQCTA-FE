import { useState, useEffect, useCallback } from "react";
import notificationService from "@/services/notificationService.jsx";
import { requestFirebaseNotificationPermission } from "@/NotificationPermission";

export const useNotifications = (userId, history) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Initialize notification service when userId changes
  useEffect(() => {
    console.log("🔧 useNotifications: Initializing with userId:", userId);
    console.log("🔧 useNotifications: History:", history);
    if (userId) {
      notificationService.init(userId, history);
    }

    // Subscribe to notification updates
    const unsubscribe = notificationService.subscribe(
      ({ notifications, unreadCount }) => {
        console.log("📬 useNotifications: Received update from service:", {
          notificationsCount: notifications.length,
          unreadCount,
        });
        setNotifications(notifications);
        setUnreadCount(unreadCount);
      }
    );

    // Cleanup on unmount
    return () => {
      console.log("🔧 useNotifications: Cleaning up");
      unsubscribe();
      notificationService.cleanup();
    };
  }, [userId]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    setLoading(true);
    try {
      await notificationService.markAsRead(notificationId);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setLoading(true);
    try {
      await notificationService.markAllAsRead(userId);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    setLoading(true);
    try {
      await notificationService.deleteNotification(notificationId);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    try {
      await notificationService.fetchNotifications();
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  };
};
