import Swal from "sweetalert2";
import React from "react";
import "sweetalert2/dist/sweetalert2.min.css";

// ✅ Success Notification
const notifySuccess = (message, callback) => {
  Swal.fire({
    icon: "success",
    title: "Success",
    text: message,
    confirmButtonColor: "#3085d6",
    customClass: {
      container: "swal-overlay-z-index",
      popup: "swal-popup-z-index",
    },
  }).then((result) => {
    if (result.isConfirmed && callback) {
      callback();
    }
  });
};

// ❌ Error Notification
const notifyError = (message, callback) => {
  Swal.fire({
    icon: "error",
    title: "Error",
    text: message,
    confirmButtonColor: "#d33",
    customClass: {
      container: "swal-overlay-z-index",
      popup: "swal-popup-z-index",
    },
  }).then((result) => {
    if (callback && result.isConfirmed) {
      callback(result);
    }
  });
};

// ⚠️ Warning Notification
const notifyWarning = (message) => {
  Swal.fire({
    icon: "warning",
    title: "Warning",
    text: message,
    confirmButtonColor: "#f39c12",
    customClass: {
      container: "swal-overlay-z-index",
      popup: "swal-popup-z-index",
    },
  });
};

// ℹ️ Info Notification
const notifyInfo = (message, callback) => {
  Swal.fire({
    icon: "info",
    title: "Info",
    text: message,
    confirmButtonColor: "#2563eb",
    customClass: {
      container: "swal-overlay-z-index",
      popup: "swal-popup-z-index",
    },
  }).then((result) => {
    if (result.isConfirmed && callback) {
      callback(result);
    }
  });
};

/** Browser push notification (when permission allows). */
const notifyBrowserPush = (title, body = "") => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const show = () => {
    try {
      new Notification(title, { body: body || undefined });
    } catch (_) {
      // no-op — unsupported or blocked in this context
    }
  };
  if (Notification.permission === "granted") {
    show();
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission()
      .then((permission) => {
        if (permission === "granted") show();
      })
      .catch(() => {});
  }
};

// Add this CSS to your global styles or component
const injectGlobalStyles = () => {
  const style = document.createElement("style");
  style.innerHTML = `
    .swal-overlay-z-index {
      z-index: 9999999999 !important;
    }
    .swal-popup-z-index {
      z-index: 10000000000 !important;
    }
  `;
  document.head.appendChild(style);
};

// Call this once when your app initializes
injectGlobalStyles();

export { notifySuccess, notifyError, notifyWarning, notifyInfo, notifyBrowserPush };
