# Firebase Push Notification System Setup

This document provides a comprehensive guide to the Firebase push notification system implementation.

## Features

✅ **Real-time notifications** - Instant delivery via Firebase Cloud Messaging  
✅ **Toast notifications** - Beautiful toast alerts when new notifications arrive  
✅ **Header counter** - Unread notification count in the header  
✅ **Dropdown list** - Click to view all notifications in a dropdown  
✅ **Search functionality** - Search through notifications  
✅ **Mark as read** - Click to mark individual notifications as read  
✅ **Mark all as read** - Bulk action to mark all notifications as read  
✅ **Delete notifications** - Remove unwanted notifications  
✅ **Background notifications** - Works even when app is in background  
✅ **Automatic initialization** - Notifications automatically initialize on login  
✅ **FCM token management** - Tokens automatically saved to backend

## File Structure

```
src/
├── components/
│   ├── header/Header.jsx          # Main header with notification bell
│   └── NotificationTest.jsx       # Test component for development
├── hooks/
│   └── useNotifications.js        # Custom hook for notification state
├── services/
│   └── notificationService.js     # Core notification service
├── utils/
│   ├── sendTestNotification.js    # Test notification utilities
│   └── initializeNotifications.js # Notification initialization utility
├── firebase-config.js             # Firebase configuration
├── NotificationPermission.js      # Permission request utility
└── assets/css/custom.css          # Notification styles

public/
└── firebase-messaging-sw.js       # Service worker for background notifications
```

## Backend Structure

```
BaseSystem2.0-Backend/
├── firebase/
│   ├── firebase-config.js         # Firebase admin configuration
│   ├── notifications.js           # Notification API routes
│   └── serviceAccountKey.json     # Firebase service account key
├── SystemUsers/
│   ├── controller.js              # Updated with FCM token management
│   └── routes.js                  # Updated with FCM token route
└── models/
    └── Notification.js            # Notification database model
```

## Setup Instructions

### 1. Firebase Configuration

Ensure your Firebase configuration is properly set up:

**Frontend (`src/firebase-config.js`):**

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDwbfIHdNLxpTG14lcjjXJ8AkNIAbVDGnM",
  authDomain: "barenaerp.firebaseapp.com",
  projectId: "barenaerp",
  storageBucket: "barenaerp.firebasestorage.app",
  messagingSenderId: "94834123859",
  appId: "1:94834123859:web:d42b5195bef68651e092a6",
};
```

**Backend (`firebase/firebase-config.js`):**

```javascript
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

### 2. Service Worker

Ensure `public/firebase-messaging-sw.js` is in place for background notifications.

### 3. API Routes

The notification routes are already registered in `index.js`:

```javascript
app.use("/api/notifications", notification_Routes);
app.use("/api/system-users", systemUsersRoutes); // For FCM token management
```

## Usage

### Automatic Initialization

The notification system automatically initializes when users log in:

```jsx
// In Login.jsx - automatically called after successful login
const result = await initializeNotifications(userId);
if (result.success) {
  console.log("✅ Notifications initialized successfully");
} else {
  console.warn("⚠️ Notification initialization failed:", result.error);
}
```

### Manual Initialization

You can also manually initialize notifications:

```jsx
import {
  initializeNotifications,
  cleanupNotifications,
} from "@/utils/initializeNotifications";

// Initialize notifications
const result = await initializeNotifications(userId);

// Cleanup on logout
cleanupNotifications();
```

### Testing the System

Use the `NotificationTest` component for testing:

```jsx
// import NotificationTest from '@/components/NotificationTest';

// In your component
// <NotificationTest userId={adminInfo.id} />
```

### Sending Notifications

**From Backend:**

```javascript
const sendPushNotification = require("./utils/sendPushNotification");

await sendPushNotification({
  token: userFCMToken,
  title: "New Order",
  body: "You have received a new order #12345",
});
```

**From Frontend (for testing):**

```javascript
import { sendTestNotification } from "@/utils/sendTestNotification";

await sendTestNotification(userId, fcmToken, "Test Title", "Test message body");
```

### Using the Notification Hook

```jsx
import { useNotifications } from "@/hooks/useNotifications";

const MyComponent = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(userId);

  // Use the notification data and functions
};
```

## API Endpoints

### Send Notification

```
POST /api/notifications/send-notification
{
  "token": "user_fcm_token",
  "userId": "user_id",
  "notification": {
    "title": "Notification Title",
    "body": "Notification message",
    "icon": "/logo192.png"
  }
}
```

### Get User Notifications

```
GET /api/notifications/user/:userId
```

### Mark as Read

```
PATCH /api/notifications/mark-read/:notificationId
```

### Mark All as Read

```
PATCH /api/notifications/mark-all-read/:userId
```

### Get Unread Count

```
GET /api/notifications/unread-count/:userId
```

### Delete Notification

```
DELETE /api/notifications/:notificationId
```

### Update FCM Token

```
POST /api/system-users/update-fcm-token
{
  "userId": "user_id",
  "fcmToken": "firebase_fcm_token"
}
```

## Database Schema

```javascript
{
  userId: ObjectId,        // Reference to SystemUsers
  title: String,           // Notification title
  body: String,            // Notification body
  message: String,         // Legacy field for backward compatibility
  contractId: ObjectId,    // Optional reference to SalesContract
  isRead: Boolean,         // Read status
  is_read: Boolean,        // Legacy read status
  createdAt: Date          // Creation timestamp
}
```

## FCM Token Management

The system automatically:

1. **Requests permission** when users log in
2. **Generates FCM token** from Firebase
3. **Saves token to backend** for each user
4. **Initializes notification service** for real-time updates
5. **Cleans up** when users log out

## Troubleshooting

### Common Issues

1. **Notifications not showing**: Check browser permissions and FCM token
2. **Background notifications not working**: Verify service worker is properly configured
3. **Toast not appearing**: Ensure react-toastify is properly imported
4. **Counter not updating**: Check if notification service is properly initialized
5. **FCM token not saving**: Check backend endpoint `/api/system-users/update-fcm-token`

### Debug Steps

1. Check browser console for errors
2. Verify FCM token is generated correctly
3. Test API endpoints directly
4. Check Firebase console for delivery status
5. Verify service worker is registered
6. Check if FCM token is saved in user record

### Browser Support

- Chrome 42+
- Firefox 44+
- Safari 11.1+
- Edge 17+

## Security Considerations

1. **FCM Tokens**: Store securely and rotate regularly
2. **API Authentication**: Ensure notification endpoints are protected
3. **User Permissions**: Only send notifications to authorized users
4. **Rate Limiting**: Implement rate limiting on notification endpoints

## Performance Optimization

1. **Pagination**: Limit notifications to 50 per request
2. **Caching**: Cache frequently accessed notifications
3. **Cleanup**: Regularly clean up old notifications
4. **Lazy Loading**: Load notifications on demand

## Future Enhancements

- [ ] Notification categories/types
- [ ] Notification preferences
- [ ] Email fallback for failed push notifications
- [ ] Rich notifications with images
- [ ] Notification scheduling
- [ ] Analytics and tracking
