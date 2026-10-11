import React from "react";
import { useTranslation } from "react-i18next";

const RenameModal = ({
  showRenameModal,
  setShowRenameModal,
  newItemName,
  setNewItemName,
  confirmRename,
}) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });

  if (!showRenameModal) return null;

  return (
    <div
      onClick={() => setShowRenameModal(false)}
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
          {dm("renameItem", "Rename Item")}
        </h2>
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={dm("enterNewName", "Enter new name")}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #CBD5E0",
            borderRadius: "5px",
            marginBottom: "1rem",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={() => setShowRenameModal(false)}
            style={{
              padding: "0.5rem 1rem",
              background: "#E2E8F0",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#CBD5E0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#E2E8F0")}
          >
            {dm("cancel", "Cancel")}
          </button>
          <button
            onClick={confirmRename}
            style={{
              padding: "0.5rem 1rem",
              background: "#3182CE",
              color: "white",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2B6CB0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#3182CE")}
          >
            {dm("rename", "Rename")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;
