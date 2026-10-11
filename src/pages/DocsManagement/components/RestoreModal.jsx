import React from "react";
import { useTranslation } from "react-i18next";

const RestoreModal = ({
  showRestoreModal,
  setShowRestoreModal,
  selectedItem,
  confirmRestore,
}) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });

  if (!showRestoreModal) return null;

  return (
    <div
      onClick={() => setShowRestoreModal(false)}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.5)",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "10px",
          boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: "600",
            marginBottom: "1rem",
          }}
        >
          {dm("restoreItem", "Restore Item")}
        </h2>
        <p style={{ color: "#4A5568", marginBottom: "1rem" }}>
          {dm(
            "restoreConfirm",
            "Are you sure you want to restore {{name}}?",
            { name: selectedItem?.name }
          )}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={() => setShowRestoreModal(false)}
            style={{
              padding: "0.5rem 1rem",
              background: "#E2E8F0",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background 0.2s",
              border: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#CBD5E0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#E2E8F0")}
          >
            {dm("cancel", "Cancel")}
          </button>
          <button
            onClick={confirmRestore}
            style={{
              padding: "0.5rem 1rem",
              background: "#3182CE",
              color: "white",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background 0.2s",
              border: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2B6CB0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#3182CE")}
          >
            {dm("restore", "Restore")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreModal;
