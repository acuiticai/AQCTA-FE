import React from "react";
import {
  FiGrid,
  FiList,
  FiSettings,
  FiX,
  FiMoreVertical,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";

const FileIcon = ({ name }) => {
  const extension = name.split(".").pop().toLowerCase();
  const icons = {
    pdf: "📄",
    svg: "📐",
    docx: "📃",
    csv: "📊",
    ppt: "📑",
    zip: "🗜️",
    txt: "📄",
    gif: "🖼️",
    mp3: "🎵",
    psd: "🖌️",
    jpeg: "🖼️",
    jpg: "🖼️",
    png: "🖼️",
  };
  return <div style={{ fontSize: "2rem" }}>{icons[extension] || "📁"}</div>;
};

const FileExplorer = ({
  folderHierarchy,
  currentPath,
  onFolderClick,
  onBackClick,
}) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const getCurrentFolderContent = () => {
    let current = folderHierarchy;
    for (const folder of currentPath) {
      if (current[folder]) {
        current = current[folder]._folders
          ? current[folder]
          : { _files: [], _folders: {} };
      }
    }
    return current || { _files: [], _folders: {} };
  };

  const currentFolder = getCurrentFolderContent();

  return (
    <>
      <section style={{ marginBottom: "24px" }}>
        <h2
          style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}
        >
          {dm("folders", "Folders")}
        </h2>
        <div style={{ display: "flex", gap: "16px" }}>
          {currentPath.length > 0 && (
            <div
              onClick={onBackClick}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 16px",
                backgroundColor: "#e5e7eb",
                borderRadius: "6px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                cursor: "pointer",
                width: "120px",
              }}
            >
              ← {dm("back", "Back")}
            </div>
          )}
          {currentFolder?._folders &&
            Object.keys(currentFolder?._folders).map((folder) => (
              <div
                key={folder}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 16px",
                  backgroundColor: "#fff",
                  borderRadius: "6px",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                  cursor: "pointer",
                  width: "120px",
                }}
                onClick={() => onFolderClick(folder)}
              >
                {folder}
                <FiMoreVertical style={{ color: "#6b7280" }} />
              </div>
            ))}
        </div>
      </section>

      <section>
        <h2
          style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}
        >
          {dm("files", "Files")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "24px",
          }}
        >
          {currentFolder._files && currentFolder._files.length > 0 ? (
            currentFolder._files.map((file) => (
              <div
                key={file.name}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "6px",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                  padding: "16px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <FileIcon name={file.name} />
                  <FiMoreVertical
                    style={{ color: "#6b7280", cursor: "pointer" }}
                  />
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {file.name}
                </p>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center", color: "#6b7280" }}>
              {dm("noFilesInThisFolder", "No files in this folder")}
            </p>
          )}
        </div>
      </section>
    </>
  );
};

export default FileExplorer;
