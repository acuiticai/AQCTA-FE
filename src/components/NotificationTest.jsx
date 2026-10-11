import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import notificationService from '@/services/notificationService.jsx';

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NotificationTest = ({ userId }) => {
  const [loading, setLoading] = useState(false);

  const sendTestNotification = async (type) => {
    if (!userId) {
      toast.error("User ID is required");
      return;
    }

    setLoading(true);
    try {
      const testData = {
        title: `Test ${type} Notification`,
        body: `This is a test ${type} notification with navigation.`,
        message: `This is a test ${type} notification with navigation.`,
        contractId: "507f1f77bcf86cd799439011", // Test contract ID
        type: `test_${type}`,
        link: type === 'contract' ? '/view-sales-contract?contractId=507f1f77bcf86cd799439011' : '/notifications'
      };

      const response = await axios.post(`${Base_URL}/notifications/send-notification`, {
        userId,
        notification: testData
      });

      if (response.data.success) {
        toast.success(`${type} test notification sent successfully!`);
      } else {
        toast.error("Failed to send test notification");
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast.error("Error sending test notification: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const testStyledNotification = () => {
    notificationService.testNotification();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Notification Navigation Test</h3>
      <div className="space-y-2">
        <button
          onClick={testStyledNotification}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
        >
          Test Styled Notification & Sound
        </button>
        <button
          onClick={() => sendTestNotification('contract')}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending...' : 'Send Contract Notification'}
        </button>
        <button
          onClick={() => sendTestNotification('general')}
          disabled={loading}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending...' : 'Send General Notification'}
        </button>
      </div>
      <p className="text-sm text-gray-600 mt-4">
        Click on notifications in the header to test navigation functionality.
      </p>
    </div>
  );
};

export default NotificationTest; 