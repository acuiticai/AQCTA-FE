import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const sendTestNotification = async (userId, token, title = "Test Notification", body = "This is a test notification") => {
  try {
    const response = await axios.post(`${Base_URL}/notifications/send-notification`, {
      token,
      userId,
      notification: {
        title,
        body,
        icon: "/logo192.png"
      }
    });

    if (response.data.success) {
      console.log("✅ Test notification sent successfully:", response.data);
      return response.data;
    } else {
      console.error("❌ Failed to send test notification:", response.data);
      return null;
    }
  } catch (error) {
    console.error("❌ Error sending test notification:", error);
    return null;
  }
};

export const sendBulkTestNotifications = async (userId, token, count = 5) => {
  const notifications = [];
  
  for (let i = 1; i <= count; i++) {
    const notification = await sendTestNotification(
      userId,
      token,
      `Test Notification ${i}`,
      `This is test notification number ${i}. It contains some sample content to test the notification system.`
    );
    
    if (notification) {
      notifications.push(notification);
    }
    
    // Wait a bit between notifications
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return notifications;
}; 