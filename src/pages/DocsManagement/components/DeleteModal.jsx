import React from "react";
import { useTranslation } from "react-i18next";

const DeleteModal = ({
  showDeleteModal,
  setShowDeleteModal,
  selectedItem,
  confirmDelete,
}) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });

  if (!showDeleteModal) return null;

  return (
    <div
      onClick={() => setShowDeleteModal(false)}
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
          {dm("moveToTrash", "Move to Trash")}
        </h2>
        <p style={{ color: "#4A5568", marginBottom: "1rem" }}>
          {dm(
            "moveToTrashConfirm",
            "Are you sure you want to move to trash {{name}}?",
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
            onClick={() => setShowDeleteModal(false)}
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
            onClick={confirmDelete}
            style={{
              padding: "0.5rem 1rem",
              background: "#E53E3E",
              color: "white",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#C53030")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#E53E3E")}
          >
            {dm("trashAction", "Trash")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
