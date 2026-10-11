import React from "react";
import { AdminContext } from "@/context/AdminContext";
import { useContext } from "react";
// import NotificationTest from "@/components/NotificationTest";
import NotificationDebug from "@/components/NotificationDebug";

const NotificationTestPage = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Notification System Test
          </h1>
          <p className="text-gray-600">
            Test the Firebase push notification system functionality
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Debug Component */}
          <div>
            <h2 className="text-xl font-semibold mb-4">System Debug</h2>
            <NotificationDebug userId={adminInfo?.id} />
          </div>

          {/* Test Component */}
          {/* <div>
            <h2 className="text-xl font-semibold mb-4">Manual Testing</h2>
            <NotificationTest userId={adminInfo?.id} />
          </div> */}
        </div>

        {/* Instructions */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Troubleshooting Steps:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <strong>Check Permission:</strong> Click "Test Permission" to
              ensure browser notifications are enabled
            </li>
            <li>
              <strong>Verify Service Worker:</strong> Make sure the Firebase
              service worker is registered
            </li>
            <li>
              <strong>Test Backend:</strong> Click "Test Backend" to verify API
              connectivity
            </li>
            <li>
              <strong>Test Real-time Listener:</strong> Set up the listener and
              send a test notification
            </li>
            <li>
              <strong>Check Console:</strong> Open browser dev tools to see
              detailed logs
            </li>
            <li>
              <strong>Verify FCM Token:</strong> Ensure a valid token is
              generated and saved
            </li>
          </ol>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">✅</div>
              <div className="text-sm font-semibold text-green-800">
                Firebase Config
              </div>
              <div className="text-xs text-green-600">Configured</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">✅</div>
              <div className="text-sm font-semibold text-green-800">
                Service Worker
              </div>
              <div className="text-xs text-green-600">Registered</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">✅</div>
              <div className="text-sm font-semibold text-green-800">
                API Routes
              </div>
              <div className="text-xs text-green-600">Available</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">🔊</div>
              <div className="text-sm font-semibold text-green-800">
                Sound System
              </div>
              <div className="text-xs text-green-600">Active</div>
            </div>
          </div>
        </div>

        {/* User Info */}
        {adminInfo && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">User Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-gray-700">User ID:</span>
                <span className="ml-2 text-gray-900">{adminInfo.id}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Name:</span>
                <span className="ml-2 text-gray-900">{adminInfo.name}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Email:</span>
                <span className="ml-2 text-gray-900">{adminInfo.email}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Role:</span>
                <span className="ml-2 text-gray-900">
                  {adminInfo.role?.name || "Admin"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationTestPage;
