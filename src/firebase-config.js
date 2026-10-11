import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

// Use env vars - must match firebase-messaging-sw.js and .env (flexaerp-b8733)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCtU5Z64WJ3MiGtAqmC0dO04vjZmfZxdl0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "flexaerp-b8733.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "flexaerp-b8733",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "flexaerp-b8733.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "589671266783",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:589671266783:web:89fb9c76166180343bac6a",
  measurementId: "G-QKGEYJ04TZ"
};

const app = initializeApp(firebaseConfig);

// Check if messaging is supported before initializing
let messaging = null;

const initializeMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      console.log("✅ Firebase Messaging initialized successfully");
      return messaging;
    } else {
      console.warn("⚠️ Firebase Messaging is not supported in this browser");
      return null;
    }
  } catch (error) {
    console.error("❌ Error initializing Firebase Messaging:", error);
    return null;
  }
};

// Initialize messaging immediately
initializeMessaging().then((messagingInstance) => {
  messaging = messagingInstance;
});

export { messaging, getToken, onMessage, initializeMessaging };
