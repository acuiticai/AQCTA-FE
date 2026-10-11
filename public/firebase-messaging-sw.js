// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Must match firebase-config.js - flexaerp-b8733
firebase.initializeApp({
    apiKey: "AIzaSyCtU5Z64WJ3MiGtAqmC0dO04vjZmfZxdl0",
    authDomain: "flexaerp-b8733.firebaseapp.com",
    projectId: "flexaerp-b8733",
    storageBucket: "flexaerp-b8733.firebasestorage.app",
    messagingSenderId: "589671266783",
    appId: "1:589671266783:web:89fb9c76166180343bac6a",
});

let messaging = null;

// Check if messaging is supported before initializing
const initializeMessaging = async () => {
    try {
        // Check if the browser supports the required APIs
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            messaging = firebase.messaging();
            console.log("✅ Firebase Messaging is ready", messaging);
            return messaging;
        } else {
            console.warn("🚫 Firebase Messaging is not supported in this browser.");
            return null;
        }
    } catch (error) {
        console.error("❌ Error initializing Firebase Messaging:", error);
        return null;
    }
};

// Initialize messaging
initializeMessaging().then((messagingInstance) => {
    if (messagingInstance) {
        // ✅ Main FCM background message handler
        messagingInstance.onBackgroundMessage(function (payload) {
            console.log("🚀 [SW] onBackgroundMessage payload received:", payload);

            const notificationTitle = payload.notification?.title || "No Title";
            const notificationOptions = {
                body: payload.notification?.body || "No body",
                icon: payload.notification?.icon || "/logo192.png",
            };

            self.registration.showNotification(notificationTitle, notificationOptions);
        });
    }
});

// ✅ Fallback in case FCM fails
self.addEventListener("push", function (event) {
    console.log("🔥 [SW Fallback] PUSH EVENT:", event);

    const data = event.data?.json()?.notification || {
        title: "Fallback Title",
        body: "Fallback body",
    };

    self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || "/logo192.png",
    });
});
