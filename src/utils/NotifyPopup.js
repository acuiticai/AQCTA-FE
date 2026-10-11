import { useState } from "react";
import CustomPopup from "./CustomPopup"; 
const NotifyPopup = () => {
  const [popup, setPopup] = useState({
    isOpen: false,
    title: "Notification",
    message: "",
    type: "",
    onConfirm: null,
    onCancel: null,
  });

  const showPopup = (type, message, onConfirm, onCancel, title = "Notification") => {
    setPopup({
      isOpen: true,
      title,
      message,
      type,
      onConfirm,
      onCancel,
    });
  };

  const closePopup = () => {
    setPopup((prev) => ({ ...prev, isOpen: false }));
  };

  const PopupComponent = () => (
    <CustomPopup
      isOpen={popup.isOpen}
      title={popup.title}
      message={popup.message}
      type={popup.type}
      onConfirm={() => {
        if (popup.onConfirm) popup.onConfirm();
        closePopup();
      }}
      onCancel={() => {
        if (popup.onCancel) popup.onCancel();
        closePopup();
      }}
    />
  );

  return { showPopup, PopupComponent };
};

export default NotifyPopup;
