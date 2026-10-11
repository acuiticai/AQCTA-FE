import React, { useState, useEffect } from "react";
import { requestFirebaseNotificationPermission } from "@/NotificationPermission";
import { messaging, onMessage } from "@/firebase-config";
import { toast } from "react-toastify";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NotificationDebug = ({ userId }) => {
  const [debugInfo, setDebugInfo] = useState({
    permission: "unknown",
    token: null,
    serviceWorker: false,
    messaging: false,
    backendConnection: false,
    notifications: [],
  });

  const [loading, setLoading] = useState(false);

  // Check service worker registration
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const hasFirebaseSW = registrations.some((reg) =>
          reg.active?.scriptURL?.includes("firebase-messaging-sw.js")
        );
        setDebugInfo((prev) => ({ ...prev, serviceWorker: hasFirebaseSW }));
      });
    }
  }, []);

  // Check messaging availability
  useEffect(() => {
    if (messaging) {
      setDebugInfo((prev) => ({ ...prev, messaging: true }));
    }
  }, []);

  const testPermission = async () => {
    setLoading(true);
    try {
      const token = await requestFirebaseNotificationPermission();
      setDebugInfo((prev) => ({
        ...prev,
        permission: token ? "granted" : "denied",
        token,
      }));
    } catch (error) {
      setDebugInfo((prev) => ({
        ...prev,
        permission: "error",
        token: null,
      }));
    }
    setLoading(false);
  };

  const testBackendConnection = async () => {
    if (!userId) return;

    try {
      // Test the notification system endpoint
      const testResponse = await axios.get(`${Base_URL}/notifications/test`);
      console.log("Backend test response:", testResponse.data);

      // Test user notifications endpoint
      const response = await axios.get(
        `${Base_URL}/notifications/user/${userId}`
      );
      setDebugInfo((prev) => ({
        ...prev,
        backendConnection: response.data.success,
        notifications: response.data.notifications || [],
      }));

      toast.success("Backend connection successful!", {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Backend connection error:", error);
      setDebugInfo((prev) => ({
        ...prev,
        backendConnection: false,
      }));

      toast.error("Backend connection failed: " + error.message, {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  const testRealTimeListener = () => {
    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("🔔 Real-time message received:", payload);
        toast.success("Real-time notification received!", {
          position: "top-right",
          autoClose: 3000,
        });
      });

      toast.info(
        "Real-time listener set up. Send a test notification to trigger it.",
        {
          position: "top-right",
          autoClose: 5000,
        }
      );

      // Cleanup after 10 seconds
      setTimeout(() => {
        unsubscribe();
        toast.info("Real-time listener cleaned up.", {
          position: "top-right",
          autoClose: 3000,
        });
      }, 10000);
    } catch (error) {
      toast.error("Failed to set up real-time listener: " + error.message);
    }
  };

  const sendTestNotification = async () => {
    if (!debugInfo.token || !userId) {
      toast.error("Token or User ID missing");
      return;
    }

    try {
      const response = await axios.post(
        `${Base_URL}/notifications/send-notification`,
        {
          token: debugInfo.token,
          userId,
          notification: {
            title: "Test Notification",
            body: "This is a test notification from debug component",
            icon: "/logo192.png",
          },
        }
      );

      if (response.data.success) {
        toast.success("Test notification sent successfully!");
      } else {
        toast.error(
          "Failed to send test notification: " + response.data.message
        );
      }
    } catch (error) {
      toast.error("Error sending test notification: " + error.message);
    }
  };

  const testToastFunctionality = () => {
    console.log('🧪 Testing toast functionality');
    
    // Test different toast types
    toast.success('Success toast test!', {
      position: "top-right",
      autoClose: 3000,
    });
    
    toast.info('Info toast test!', {
      position: "top-right",
      autoClose: 3000,
    });
    
    toast.warning('Warning toast test!', {
      position: "top-right",
      autoClose: 3000,
    });
    
    toast.error('Error toast test!', {
      position: "top-right",
      autoClose: 3000,
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Notification System Debug</h2>

      <div className="space-y-4">
        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className={`p-3 rounded ${
              debugInfo.permission === "granted" ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <strong>Permission:</strong> {debugInfo.permission}
          </div>
          <div
            className={`p-3 rounded ${
              debugInfo.serviceWorker ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <strong>Service Worker:</strong>{" "}
            {debugInfo.serviceWorker ? "Registered" : "Not Found"}
          </div>
          <div
            className={`p-3 rounded ${
              debugInfo.messaging ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <strong>Messaging:</strong>{" "}
            {debugInfo.messaging ? "Available" : "Not Available"}
          </div>
          <div
            className={`p-3 rounded ${
              debugInfo.backendConnection ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <strong>Backend:</strong>{" "}
            {debugInfo.backendConnection ? "Connected" : "Failed"}
          </div>
        </div>

        {/* Token Display */}
        {debugInfo.token && (
          <div className="p-3 bg-gray-100 rounded">
            <strong>FCM Token:</strong>
            <div className="text-xs break-all mt-1">{debugInfo.token}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={testPermission}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Testing..." : "Test Permission"}
          </button>

          <button
            onClick={testBackendConnection}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test Backend
          </button>

          <button
            onClick={testRealTimeListener}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Test Real-time Listener
          </button>

          <button
            onClick={sendTestNotification}
            disabled={!debugInfo.token}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            Send Test Notification
          </button>

          <button
            onClick={testToastFunctionality}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Test Toast Functionality
          </button>
        </div>

        {/* Notifications List */}
        {debugInfo.notifications.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">
              Recent Notifications ({debugInfo.notifications.length})
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {debugInfo.notifications
                .slice(0, 5)
                .map((notification, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="font-medium">{notification.title}</div>
                    <div className="text-gray-600">{notification.body}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <strong>Debug Info:</strong>
          <pre className="text-xs mt-1 overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default NotificationDebug;
