import { useState, useEffect } from "react";
import notificationService from "@/services/notificationService.jsx";

export const useHeaderNotifications = (userId) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchHeaderNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { notifications, unreadCount } =
        await notificationService.fetchRecentUnreadNotifications(userId);
      setNotifications(notifications);
      setUnreadCount(unreadCount);
      // Keep singleton service in sync so polling/listeners don't overwrite
      notificationService.notifications = notifications;
      notificationService.unreadCount = unreadCount;
      if (!notificationService.userId) {
        notificationService.userId = userId;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchHeaderNotifications();

    // Subscribe to notificationService updates
    const unsubscribe = notificationService.subscribe(({ notifications, unreadCount }) => {
      setNotifications(notifications.slice(0, 50)); // Only most recent 50
      setUnreadCount(unreadCount);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    refreshNotifications: fetchHeaderNotifications,
  };
}; 