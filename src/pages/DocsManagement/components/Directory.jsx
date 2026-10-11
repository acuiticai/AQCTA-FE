import { BackButton } from "@/page-layouts/index";
import React from "react";
import { useTranslation } from "react-i18next";

const Directory = ({
  currentFolder,
  handleBackClick,
  showNewFolderInput,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  setShowNewFolderInput,
  renderContent,
  getCurrentFolderItems,
}) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });

  return (
    <main
      style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 24px" }}
    >
      {currentFolder && (
        <BackButton
          onClick={handleBackClick}
          style={{
            marginBottom: "1.5rem",
          }}
        />
      )}

      {showNewFolderInput && (
        <div
          style={{
            position: "fixed",
            inset: "0",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "50",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              padding: "1.5rem",
              borderRadius: "0.5rem",
              boxShadow: "0px 4px 10px rgba(0,0,0,0.15)",
            }}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "600",
                marginBottom: "1rem",
              }}
            >
              {dm("createNewFolder", "Create New Folder")}
            </h2>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={dm("enterFolderName", "Enter folder name")}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #CBD5E0",
                  borderRadius: "0.5rem",
                }}
              />
              <button
                onClick={handleCreateFolder}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#3B82F6",
                  color: "#FFFFFF",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                {dm("create", "Create")}
              </button>
              <button
                onClick={() => setShowNewFolderInput(false)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#F3F4F6",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                {dm("cancel", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      {renderContent(getCurrentFolderItems())}
    </main>
  );
};

export default Directory;
